import { PDS_URL, DID, HANDLE, BLOG_COLLECTION, ABOUT_COLLECTION, ABOUT_RKEY, PROFILE_TTL, ENTRIES_TTL, ENTRY_TTL, MAX_ENTRY_CACHE, ABOUT_TTL } from "./constants";

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

interface AuthorProfile {
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
  const stale = profileCache;
  if (isFresh(profileCache)) return profileCache.data;

  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=app.bsky.actor.profile&limit=1`
    );
    if (!res.ok) {
      console.error("PDS profile fetch failed:", res.status);
      return stale?.data ?? FALLBACK_PROFILE;
    }
    const data = (await res.json()) as ListRecordsResponse;
    const record = data.records[0]?.value as Record<string, unknown> | undefined;

    if (!record) {
      return stale?.data ?? FALLBACK_PROFILE;
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
    return stale?.data ?? FALLBACK_PROFILE;
  }
}

export async function getBlogEntries(): Promise<BlogEntry[]> {
  const staleEntries = entriesCache;
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
    if (staleEntries?.data) return staleEntries.data;
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
  const staleData = cached?.data;
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
      return staleData ?? null; // Non-404 error — serve stale if available
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
  } catch (err) {
    console.error("Failed to fetch blog entry:", err);
    return staleData ?? null; // Network error — serve stale if available
  }
}

// --- Draft / raw access (no cache, owner-only) ---

import { listDrafts, getDraft } from "./drafts";

export async function getDraftEntries(): Promise<BlogEntry[]> {
  return listDrafts();
}

export async function getRawBlogEntry(
  rkey: string
): Promise<BlogEntry | null> {
  // Check local SQLite drafts first
  const draft = getDraft(rkey);
  if (draft) return draft;

  // Fall through to PDS for published entries
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
  } catch (err) {
    console.error("Failed to fetch raw blog entry:", err);
    return null;
  }
}

// --- About page content ---

let aboutCache: CacheEntry<string> | null = null;

const DEFAULT_ABOUT = `Welcome to my blog, powered by [AT Protocol](https://atproto.com). Posts are stored as records on my personal PDS — no database, no CMS, just protocol-native content.

Edit this section from the blog's about panel.`;

export async function getAbout(): Promise<string> {
  const staleAbout = aboutCache;
  if (isFresh(aboutCache)) return aboutCache.data;

  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${ABOUT_COLLECTION}&rkey=${ABOUT_RKEY}`
    );

    if (!res.ok) {
      return staleAbout?.data ?? DEFAULT_ABOUT;
    }

    const data = (await res.json()) as { value: Record<string, unknown> };
    const content = (data.value.content as string) || DEFAULT_ABOUT;

    aboutCache = { data: content, expiresAt: Date.now() + ABOUT_TTL };
    return content;
  } catch (err) {
    console.error("Failed to fetch about:", err);
    return staleAbout?.data ?? DEFAULT_ABOUT;
  }
}

export function invalidateAbout(): void {
  aboutCache = null;
}

// --- Bluesky feed ---

const BSKY_PUBLIC_API = "https://public.api.bsky.app";
const FEED_TTL = 300_000; // 5 minutes

export interface FeedPost {
  uri: string;
  cid: string;
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  images: Array<{ thumb: string; alt: string }>;
}

let feedCache: CacheEntry<FeedPost[]> | null = null;

export async function getBlueskyFeed(limit = 3): Promise<FeedPost[]> {
  const stale = feedCache;
  if (isFresh(feedCache)) return feedCache.data.slice(0, limit);

  try {
    const params = new URLSearchParams({
      actor: DID,
      limit: String(Math.min(limit * 2, 30)), // fetch extra to filter replies/reposts
      filter: "posts_no_replies",
    });

    const res = await fetch(`${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed?${params}`);
    if (!res.ok) {
      console.error("Bluesky feed fetch failed:", res.status);
      return stale?.data?.slice(0, limit) ?? [];
    }

    const data = (await res.json()) as {
      feed: Array<{
        post: {
          uri: string;
          cid: string;
          author: { did: string };
          record: { text?: string; createdAt?: string };
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
          embed?: {
            $type?: string;
            images?: Array<{ thumb?: string; alt?: string }>;
          };
        };
        reason?: unknown;
      }>;
    };

    const posts: FeedPost[] = [];

    for (const item of data.feed) {
      // Skip reposts
      if (item.reason) continue;
      // Only own posts
      if (item.post.author.did !== DID) continue;

      const images: FeedPost["images"] = [];
      if (item.post.embed?.$type === "app.bsky.embed.images#view" && item.post.embed.images) {
        for (const img of item.post.embed.images) {
          if (img.thumb) images.push({ thumb: img.thumb, alt: img.alt || "" });
        }
      }

      posts.push({
        uri: item.post.uri,
        cid: item.post.cid,
        text: item.post.record.text || "",
        createdAt: item.post.record.createdAt || "",
        likeCount: item.post.likeCount || 0,
        repostCount: item.post.repostCount || 0,
        replyCount: item.post.replyCount || 0,
        images,
      });

      if (posts.length >= limit) break;
    }

    feedCache = { data: posts, expiresAt: Date.now() + FEED_TTL };
    return posts;
  } catch (err) {
    console.error("Failed to fetch Bluesky feed:", err);
    return stale?.data?.slice(0, limit) ?? [];
  }
}

// Re-export constants for backward compatibility
export { HANDLE, DID, PDS_URL } from "./constants";
