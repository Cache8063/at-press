import { PDS_URL, DID, HANDLE, BLOG_COLLECTION, ABOUT_COLLECTION, ABOUT_RKEY } from "./constants";

const RKEY_REGEX = /^[a-zA-Z0-9._~-]{1,512}$/;

export function isValidRkey(rkey: string): boolean {
  return RKEY_REGEX.test(rkey);
}

export interface AtBlob {
  $type: "blob";
  ref: { $link: string };
  mimeType: string;
  size: number;
}

export interface BlogEntry {
  uri: string;
  cid: string;
  rkey: string;
  title: string;
  content: string;
  createdAt: string;
  visibility: string;
  theme?: string;
  blobs?: AtBlob[];
}

export interface AuthorProfile {
  displayName: string;
  description: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

interface ListRecordsResponse {
  records: Array<{
    uri: string;
    cid: string;
    value: Record<string, unknown>;
  }>;
  cursor?: string;
}

// --- Cache layer ---

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const PROFILE_TTL = 3600_000; // 1 hour
const ENTRIES_TTL = 300_000; // 5 minutes
const ENTRY_TTL = 600_000; // 10 minutes
const MAX_ENTRY_CACHE = 200;

let profileCache: CacheEntry<AuthorProfile> | null = null;
let entriesCache: CacheEntry<BlogEntry[]> | null = null;
const entryCache = new Map<string, CacheEntry<BlogEntry>>();

function isFresh<T>(entry: CacheEntry<T> | null | undefined): entry is CacheEntry<T> {
  return entry != null && Date.now() < entry.expiresAt;
}

export function invalidateCache(): void {
  profileCache = null;
  entriesCache = null;
  entryCache.clear();
}

export function invalidateEntry(rkey: string): void {
  entryCache.delete(rkey);
  entriesCache = null;
}

// --- Helpers ---

function extractRkey(uri: string): string {
  return uri.split("/").pop() || "";
}

export function blobUrl(did: string, cid: string): string {
  return `${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${cid}`;
}

function parseBlobsFromValue(val: Record<string, unknown>): AtBlob[] | undefined {
  if (!Array.isArray(val.blobs)) return undefined;
  return val.blobs.filter(
    (b: unknown) => {
      const blob = b as Record<string, unknown>;
      return (
        blob?.$type === "blob" &&
        typeof (blob?.ref as Record<string, unknown>)?.$link === "string" &&
        typeof blob?.mimeType === "string" &&
        typeof blob?.size === "number"
      );
    }
  ) as AtBlob[];
}

const FALLBACK_PROFILE: AuthorProfile = {
  displayName: HANDLE,
  description: "",
  avatarUrl: null,
  bannerUrl: null,
};

// --- Data fetching ---

export async function getProfile(): Promise<AuthorProfile> {
  if (isFresh(profileCache)) return profileCache.data;

  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=app.bsky.actor.profile&limit=1`
    );
    if (!res.ok) {
      console.error("PDS profile fetch failed:", res.status);
      return profileCache?.data ?? FALLBACK_PROFILE;
    }
    const data = (await res.json()) as ListRecordsResponse;
    const record = data.records[0]?.value as Record<string, unknown> | undefined;

    if (!record) {
      return profileCache?.data ?? FALLBACK_PROFILE;
    }

    const avatar = record.avatar as { ref?: { $link?: string } } | undefined;
    const banner = record.banner as { ref?: { $link?: string } } | undefined;

    const profile: AuthorProfile = {
      displayName: (record.displayName as string) || HANDLE,
      description: (record.description as string) || "",
      avatarUrl: avatar?.ref?.$link ? blobUrl(DID, avatar.ref.$link) : null,
      bannerUrl: banner?.ref?.$link ? blobUrl(DID, banner.ref.$link) : null,
    };

    profileCache = { data: profile, expiresAt: Date.now() + PROFILE_TTL };
    return profile;
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    return profileCache?.data ?? FALLBACK_PROFILE;
  }
}

export async function getBlogEntries(): Promise<BlogEntry[]> {
  if (isFresh(entriesCache)) return entriesCache.data;

  const entries: BlogEntry[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        repo: DID,
        collection: BLOG_COLLECTION,
        limit: "100",
      });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(
        `${PDS_URL}/xrpc/com.atproto.repo.listRecords?${params}`
      );
      if (!res.ok) {
        console.error("PDS listRecords failed:", res.status);
        break;
      }
      const data = (await res.json()) as ListRecordsResponse;

      for (const record of data.records) {
        const val = record.value as Record<string, unknown>;
        if (val.visibility !== "public") continue;

        entries.push({
          uri: record.uri,
          cid: record.cid,
          rkey: extractRkey(record.uri),
          title: (val.title as string) || "Untitled",
          content: val.content as string,
          createdAt: val.createdAt as string,
          visibility: val.visibility as string,
          theme: val.theme as string | undefined,
          blobs: parseBlobsFromValue(val),
        });
      }

      cursor = data.cursor;
    } while (cursor && entries.length < 500);
  } catch (err) {
    console.error("Failed to fetch blog entries:", err);
    if (entriesCache?.data) return entriesCache.data;
  }

  entries.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (entries.length > 0) {
    entriesCache = { data: entries, expiresAt: Date.now() + ENTRIES_TTL };
  }

  return entries;
}

export async function getBlogEntry(rkey: string): Promise<BlogEntry | null> {
  const cached = entryCache.get(rkey);
  if (isFresh(cached)) return cached.data;

  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${BLOG_COLLECTION}&rkey=${rkey}`
    );

    if (!res.ok) {
      if (res.status === 404) {
        entryCache.delete(rkey); // Deleted post — evict from cache
        return null;
      }
      return cached?.data ?? null; // Non-404 error — serve stale if available
    }

    const data = (await res.json()) as {
      uri: string;
      cid: string;
      value: Record<string, unknown>;
    };
    const val = data.value;

    if (val.visibility !== "public") {
      entryCache.delete(rkey); // No longer public — evict from cache
      return null;
    }

    const entry: BlogEntry = {
      uri: data.uri,
      cid: data.cid,
      rkey,
      title: (val.title as string) || "Untitled",
      content: val.content as string,
      createdAt: val.createdAt as string,
      visibility: val.visibility as string,
      theme: val.theme as string | undefined,
      blobs: parseBlobsFromValue(val),
    };

    // Enforce cache size limit
    if (entryCache.size >= MAX_ENTRY_CACHE) {
      const firstKey = entryCache.keys().next().value;
      if (firstKey) entryCache.delete(firstKey);
    }

    entryCache.set(rkey, { data: entry, expiresAt: Date.now() + ENTRY_TTL });
    return entry;
  } catch {
    return cached?.data ?? null; // Network error — serve stale if available
  }
}

// --- Draft / raw access (no cache, owner-only) ---

export async function getDraftEntries(): Promise<BlogEntry[]> {
  const entries: BlogEntry[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        repo: DID,
        collection: BLOG_COLLECTION,
        limit: "100",
      });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(
        `${PDS_URL}/xrpc/com.atproto.repo.listRecords?${params}`
      );
      if (!res.ok) break;
      const data = (await res.json()) as ListRecordsResponse;

      for (const record of data.records) {
        const val = record.value as Record<string, unknown>;
        if (val.visibility !== "author") continue;

        entries.push({
          uri: record.uri,
          cid: record.cid,
          rkey: extractRkey(record.uri),
          title: (val.title as string) || "Untitled",
          content: val.content as string,
          createdAt: val.createdAt as string,
          visibility: val.visibility as string,
          theme: val.theme as string | undefined,
          blobs: parseBlobsFromValue(val),
        });
      }

      cursor = data.cursor;
    } while (cursor && entries.length < 100);
  } catch (err) {
    console.error("Failed to fetch draft entries:", err);
  }

  entries.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return entries;
}

export async function getRawBlogEntry(
  rkey: string
): Promise<BlogEntry | null> {
  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${BLOG_COLLECTION}&rkey=${rkey}`
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      uri: string;
      cid: string;
      value: Record<string, unknown>;
    };
    const val = data.value;

    return {
      uri: data.uri,
      cid: data.cid,
      rkey,
      title: (val.title as string) || "Untitled",
      content: val.content as string,
      createdAt: val.createdAt as string,
      visibility: (val.visibility as string) || "public",
      theme: val.theme as string | undefined,
      blobs: parseBlobsFromValue(val),
    };
  } catch {
    return null;
  }
}

// --- About page content ---

const ABOUT_TTL = 3600_000; // 1 hour
let aboutCache: CacheEntry<string> | null = null;

const DEFAULT_ABOUT = `Writing about the things I build, break, and think about — mostly around self-hosting, the AT Protocol, and whatever side project has my attention.

This blog runs on [AT Protocol](https://atproto.com). Every post is an atproto record stored on my personal PDS at [arcnode.xyz](https://arcnode.xyz), rendered here with Astro. No database, no CMS — just protocol-native content.

I'm a consultant by trade, a developer by habit. Currently building [ConsultPitch](https://consultpitch.com) and running my own infrastructure on Hetzner and Proxmox.

Houston, TX`;

export async function getAbout(): Promise<string> {
  if (isFresh(aboutCache)) return aboutCache.data;

  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${ABOUT_COLLECTION}&rkey=${ABOUT_RKEY}`
    );

    if (!res.ok) {
      return aboutCache?.data ?? DEFAULT_ABOUT;
    }

    const data = (await res.json()) as { value: Record<string, unknown> };
    const content = (data.value.content as string) || DEFAULT_ABOUT;

    aboutCache = { data: content, expiresAt: Date.now() + ABOUT_TTL };
    return content;
  } catch {
    return aboutCache?.data ?? DEFAULT_ABOUT;
  }
}

export function invalidateAbout(): void {
  aboutCache = null;
}

// Re-export constants for backward compatibility
export { HANDLE, DID, PDS_URL } from "./constants";
