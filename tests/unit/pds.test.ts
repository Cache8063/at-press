import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the drafts module before importing pds
vi.mock("../../src/lib/drafts", () => ({
  listDrafts: vi.fn(() => []),
  getDraft: vi.fn(() => null),
}));

import { listDrafts, getDraft } from "../../src/lib/drafts";
import { getProfile, getBlogEntries, getBlogEntry, getDraftEntries, getRawBlogEntry, isValidRkey, invalidateCache, invalidateEntry, blobUrl, HANDLE, DID, PDS_URL } from "../../src/lib/pds";

function mockFetch(responses: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  const mock = vi.spyOn(globalThis, "fetch");
  for (const r of responses) {
    mock.mockResolvedValueOnce(
      new Response(JSON.stringify(r.body), {
        status: r.status ?? 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
  return mock;
}

describe("pds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    invalidateCache();
  });

  describe("isValidRkey", () => {
    it("accepts valid alphanumeric rkeys", () => {
      expect(isValidRkey("3abc123")).toBe(true);
      expect(isValidRkey("abc-def")).toBe(true);
      expect(isValidRkey("abc_def")).toBe(true);
      expect(isValidRkey("abc.def")).toBe(true);
      expect(isValidRkey("abc~def")).toBe(true);
    });

    it("rejects empty string", () => {
      expect(isValidRkey("")).toBe(false);
    });

    it("rejects strings with query injection characters", () => {
      expect(isValidRkey("abc&repo=evil")).toBe(false);
      expect(isValidRkey("abc?foo=bar")).toBe(false);
      expect(isValidRkey("abc/def")).toBe(false);
      expect(isValidRkey("abc<script>")).toBe(false);
    });

    it("rejects strings over 512 chars", () => {
      expect(isValidRkey("a".repeat(512))).toBe(true);
      expect(isValidRkey("a".repeat(513))).toBe(false);
    });
  });

  describe("constants", () => {
    it("exports expected HANDLE", () => {
      expect(HANDLE).toBe("bkb.arcnode.xyz");
    });

    it("exports expected DID", () => {
      expect(DID).toBe("did:plc:k23ujfuppr3hr4pxvtaz7jro");
    });

    it("exports expected PDS_URL", () => {
      expect(PDS_URL).toBe("https://arcnode.xyz");
    });
  });

  describe("getProfile", () => {
    it("returns profile data from PDS", async () => {
      mockFetch([{
        body: {
          records: [{
            uri: "at://did:plc:test/app.bsky.actor.profile/self",
            cid: "cid123",
            value: {
              displayName: "Test User",
              description: "A bio",
              avatar: { ref: { $link: "bafkreiabc" } },
              banner: { ref: { $link: "bafkreibanner" } },
            },
          }],
        },
      }]);

      const profile = await getProfile();
      expect(profile.displayName).toBe("Test User");
      expect(profile.description).toBe("A bio");
      expect(profile.avatarUrl).toContain("bafkreiabc");
      expect(profile.bannerUrl).toContain("bafkreibanner");
    });

    it("returns fallback when no profile record exists", async () => {
      mockFetch([{ body: { records: [] } }]);

      const profile = await getProfile();
      expect(profile.displayName).toBe(HANDLE);
      expect(profile.description).toBe("");
      expect(profile.avatarUrl).toBeNull();
      expect(profile.bannerUrl).toBeNull();
    });

    it("returns fallback on PDS fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("connection refused"));

      const profile = await getProfile();
      expect(profile.displayName).toBe(HANDLE);
      expect(profile.description).toBe("");
    });

    it("returns fallback on non-200 PDS response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal error", { status: 500 })
      );

      const profile = await getProfile();
      expect(profile.displayName).toBe(HANDLE);
    });

    it("returns null avatar when blob ref missing", async () => {
      mockFetch([{
        body: {
          records: [{
            uri: "at://did:plc:test/app.bsky.actor.profile/self",
            cid: "cid123",
            value: {
              displayName: "No Avatar",
              description: "No pic",
            },
          }],
        },
      }]);

      const profile = await getProfile();
      expect(profile.avatarUrl).toBeNull();
      expect(profile.bannerUrl).toBeNull();
    });
  });

  describe("getBlogEntries", () => {
    it("returns public entries sorted newest first", async () => {
      mockFetch([{
        body: {
          records: [
            {
              uri: `at://${DID}/com.whtwnd.blog.entry/older`,
              cid: "cid1",
              value: {
                title: "Older Post",
                content: "Content 1",
                createdAt: "2025-01-01T00:00:00Z",
                visibility: "public",
              },
            },
            {
              uri: `at://${DID}/com.whtwnd.blog.entry/newer`,
              cid: "cid2",
              value: {
                title: "Newer Post",
                content: "Content 2",
                createdAt: "2025-06-01T00:00:00Z",
                visibility: "public",
              },
            },
          ],
        },
      }]);

      const entries = await getBlogEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe("Newer Post");
      expect(entries[1].title).toBe("Older Post");
    });

    it("filters out non-public entries", async () => {
      mockFetch([{
        body: {
          records: [
            {
              uri: `at://${DID}/com.whtwnd.blog.entry/pub`,
              cid: "cid1",
              value: {
                title: "Public",
                content: "C",
                createdAt: "2025-01-01T00:00:00Z",
                visibility: "public",
              },
            },
            {
              uri: `at://${DID}/com.whtwnd.blog.entry/draft`,
              cid: "cid2",
              value: {
                title: "Draft",
                content: "C",
                createdAt: "2025-01-02T00:00:00Z",
                visibility: "author",
              },
            },
          ],
        },
      }]);

      const entries = await getBlogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Public");
    });

    it("extracts rkey from URI", async () => {
      mockFetch([{
        body: {
          records: [{
            uri: `at://${DID}/com.whtwnd.blog.entry/3abc123`,
            cid: "cid1",
            value: {
              title: "Test",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          }],
        },
      }]);

      const entries = await getBlogEntries();
      expect(entries[0].rkey).toBe("3abc123");
    });

    it("paginates through multiple pages", async () => {
      mockFetch([
        {
          body: {
            records: [{
              uri: `at://${DID}/com.whtwnd.blog.entry/page1`,
              cid: "cid1",
              value: {
                title: "Page 1",
                content: "C",
                createdAt: "2025-01-01T00:00:00Z",
                visibility: "public",
              },
            }],
            cursor: "next-page",
          },
        },
        {
          body: {
            records: [{
              uri: `at://${DID}/com.whtwnd.blog.entry/page2`,
              cid: "cid2",
              value: {
                title: "Page 2",
                content: "C",
                createdAt: "2025-01-02T00:00:00Z",
                visibility: "public",
              },
            }],
          },
        },
      ]);

      const entries = await getBlogEntries();
      expect(entries).toHaveLength(2);
    });

    it("returns empty array on PDS fetch error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network error"));

      const entries = await getBlogEntries();
      expect(entries).toEqual([]);
    });

    it("returns empty array on non-200 PDS response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("error", { status: 503 })
      );

      const entries = await getBlogEntries();
      expect(entries).toEqual([]);
    });

    it("defaults title to Untitled when missing", async () => {
      mockFetch([{
        body: {
          records: [{
            uri: `at://${DID}/com.whtwnd.blog.entry/notitle`,
            cid: "cid1",
            value: {
              content: "No title here",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          }],
        },
      }]);

      const entries = await getBlogEntries();
      expect(entries[0].title).toBe("Untitled");
    });
  });

  describe("getBlogEntry", () => {
    it("returns a single entry by rkey", async () => {
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/abc123`,
          cid: "cid1",
          value: {
            title: "My Post",
            content: "Hello world",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
          },
        },
      }]);

      const entry = await getBlogEntry("abc123");
      expect(entry).not.toBeNull();
      expect(entry!.title).toBe("My Post");
      expect(entry!.rkey).toBe("abc123");
    });

    it("returns null for non-public entry", async () => {
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/private`,
          cid: "cid1",
          value: {
            title: "Private",
            content: "Secret",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "author",
          },
        },
      }]);

      const entry = await getBlogEntry("private");
      expect(entry).toBeNull();
    });

    it("returns null when record not found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not found", { status: 404 })
      );

      const entry = await getBlogEntry("missing");
      expect(entry).toBeNull();
    });

    it("returns null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));

      const entry = await getBlogEntry("error");
      expect(entry).toBeNull();
    });
  });

  describe("cache behavior", () => {
    it("serves cached profile on second call without re-fetching", async () => {
      const fetchSpy = mockFetch([{
        body: {
          records: [{
            uri: "at://did:plc:test/app.bsky.actor.profile/self",
            cid: "cid123",
            value: { displayName: "Cached User", description: "Bio" },
          }],
        },
      }]);

      const first = await getProfile();
      const second = await getProfile();
      expect(first.displayName).toBe("Cached User");
      expect(second.displayName).toBe("Cached User");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("serves cached entries on second call without re-fetching", async () => {
      const fetchSpy = mockFetch([{
        body: {
          records: [{
            uri: `at://${DID}/com.whtwnd.blog.entry/cached`,
            cid: "cid1",
            value: {
              title: "Cached",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          }],
        },
      }]);

      const first = await getBlogEntries();
      const second = await getBlogEntries();
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("serves cached single entry on second call without re-fetching", async () => {
      const fetchSpy = mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/single`,
          cid: "cid1",
          value: {
            title: "Single",
            content: "C",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
          },
        },
      }]);

      const first = await getBlogEntry("single");
      const second = await getBlogEntry("single");
      expect(first!.title).toBe("Single");
      expect(second!.title).toBe("Single");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("invalidateCache clears all caches", async () => {
      mockFetch([
        {
          body: {
            records: [{
              uri: "at://did:plc:test/app.bsky.actor.profile/self",
              cid: "cid1",
              value: { displayName: "First", description: "" },
            }],
          },
        },
        {
          body: {
            records: [{
              uri: "at://did:plc:test/app.bsky.actor.profile/self",
              cid: "cid2",
              value: { displayName: "Second", description: "" },
            }],
          },
        },
      ]);

      const first = await getProfile();
      expect(first.displayName).toBe("First");

      invalidateCache();

      const second = await getProfile();
      expect(second.displayName).toBe("Second");
    });

    it("invalidateEntry clears specific entry and entries list", async () => {
      mockFetch([
        {
          body: {
            uri: `at://${DID}/com.whtwnd.blog.entry/inv`,
            cid: "cid1",
            value: {
              title: "Original",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          },
        },
        {
          body: {
            uri: `at://${DID}/com.whtwnd.blog.entry/inv`,
            cid: "cid2",
            value: {
              title: "Updated",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          },
        },
      ]);

      const first = await getBlogEntry("inv");
      expect(first!.title).toBe("Original");

      invalidateEntry("inv");

      const second = await getBlogEntry("inv");
      expect(second!.title).toBe("Updated");
    });

    it("evicts entry from cache when visibility changes to author", async () => {
      mockFetch([
        {
          body: {
            uri: `at://${DID}/com.whtwnd.blog.entry/vis`,
            cid: "cid1",
            value: {
              title: "Was Public",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          },
        },
      ]);

      const first = await getBlogEntry("vis");
      expect(first!.title).toBe("Was Public");

      // Now the entry was changed to author visibility
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/vis`,
          cid: "cid2",
          value: {
            title: "Was Public",
            content: "C",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "author",
          },
        },
      }]);

      invalidateEntry("vis");
      const second = await getBlogEntry("vis");
      expect(second).toBeNull(); // getBlogEntry filters non-public
    });

    it("evicts from cache on PDS 404 (deleted post)", async () => {
      mockFetch([
        {
          body: {
            uri: `at://${DID}/com.whtwnd.blog.entry/del`,
            cid: "cid1",
            value: {
              title: "Soon Deleted",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
            },
          },
        },
      ]);

      const first = await getBlogEntry("del");
      expect(first!.title).toBe("Soon Deleted");

      // Mock 404 for the deleted post
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not found", { status: 404 })
      );

      invalidateEntry("del");
      const second = await getBlogEntry("del");
      expect(second).toBeNull();
    });
  });

  describe("getDraftEntries", () => {
    it("returns drafts from SQLite via listDrafts", async () => {
      vi.mocked(listDrafts).mockReturnValueOnce([
        {
          uri: "",
          cid: "",
          rkey: "draft1",
          title: "My Draft",
          content: "WIP",
          createdAt: "2025-06-01T00:00:00Z",
          visibility: "author",
        },
      ]);

      const drafts = await getDraftEntries();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].title).toBe("My Draft");
      expect(drafts[0].visibility).toBe("author");
      expect(listDrafts).toHaveBeenCalled();
    });

    it("returns empty array when no drafts exist", async () => {
      vi.mocked(listDrafts).mockReturnValueOnce([]);

      const drafts = await getDraftEntries();
      expect(drafts).toEqual([]);
    });
  });

  describe("getRawBlogEntry", () => {
    it("returns draft from SQLite when it exists", async () => {
      vi.mocked(getDraft).mockReturnValueOnce({
        uri: "",
        cid: "",
        rkey: "local-draft",
        title: "Local Draft",
        content: "WIP content",
        createdAt: "2025-01-01T00:00:00Z",
        visibility: "author",
      });

      const entry = await getRawBlogEntry("local-draft");
      expect(entry).not.toBeNull();
      expect(entry!.title).toBe("Local Draft");
      expect(entry!.visibility).toBe("author");
      expect(getDraft).toHaveBeenCalledWith("local-draft");
    });

    it("falls through to PDS when not in SQLite", async () => {
      vi.mocked(getDraft).mockReturnValueOnce(null);
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/pub`,
          cid: "cid1",
          value: {
            title: "Public Post",
            content: "Content",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
          },
        },
      }]);

      const entry = await getRawBlogEntry("pub");
      expect(entry).not.toBeNull();
      expect(entry!.visibility).toBe("public");
    });

    it("returns null on 404 when not in SQLite", async () => {
      vi.mocked(getDraft).mockReturnValueOnce(null);
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Not found", { status: 404 })
      );

      const entry = await getRawBlogEntry("missing");
      expect(entry).toBeNull();
    });

    it("returns null on network error when not in SQLite", async () => {
      vi.mocked(getDraft).mockReturnValueOnce(null);
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("timeout"));

      const entry = await getRawBlogEntry("error");
      expect(entry).toBeNull();
    });

    it("defaults visibility to public when missing from PDS", async () => {
      vi.mocked(getDraft).mockReturnValueOnce(null);
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/novis`,
          cid: "cid1",
          value: {
            title: "No Visibility",
            content: "C",
            createdAt: "2025-01-01T00:00:00Z",
          },
        },
      }]);

      const entry = await getRawBlogEntry("novis");
      expect(entry!.visibility).toBe("public");
    });
  });

  describe("blobUrl", () => {
    it("constructs correct getBlob URL", () => {
      const url = blobUrl("did:plc:abc123", "bafkreiexample");
      expect(url).toBe(`${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=did:plc:abc123&cid=bafkreiexample`);
    });
  });

  describe("blob parsing", () => {
    const validBlob = {
      $type: "blob" as const,
      ref: { $link: "bafkreitest123" },
      mimeType: "image/png",
      size: 12345,
    };

    it("parses valid blobs from entry records", async () => {
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/withblob`,
          cid: "cid1",
          value: {
            title: "Post with Image",
            content: "![img](url)",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
            blobs: [validBlob],
          },
        },
      }]);

      const entry = await getBlogEntry("withblob");
      expect(entry).not.toBeNull();
      expect(entry!.blobs).toHaveLength(1);
      expect(entry!.blobs![0].ref.$link).toBe("bafkreitest123");
      expect(entry!.blobs![0].mimeType).toBe("image/png");
    });

    it("returns undefined blobs when field is missing", async () => {
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/noblob`,
          cid: "cid1",
          value: {
            title: "No Blobs",
            content: "Text only",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
          },
        },
      }]);

      const entry = await getBlogEntry("noblob");
      expect(entry).not.toBeNull();
      expect(entry!.blobs).toBeUndefined();
    });

    it("filters out malformed blobs", async () => {
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/badblob`,
          cid: "cid1",
          value: {
            title: "Bad Blobs",
            content: "C",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "public",
            blobs: [
              validBlob,
              { $type: "blob", ref: "not-an-object", mimeType: "image/png", size: 100 },
              { $type: "not-blob", ref: { $link: "cid" }, mimeType: "image/png", size: 100 },
              { $type: "blob", ref: { $link: "cid" }, mimeType: 123, size: 100 },
              null,
            ],
          },
        },
      }]);

      const entry = await getBlogEntry("badblob");
      expect(entry).not.toBeNull();
      expect(entry!.blobs).toHaveLength(1);
      expect(entry!.blobs![0].ref.$link).toBe("bafkreitest123");
    });

    it("parses blobs in getRawBlogEntry from PDS", async () => {
      vi.mocked(getDraft).mockReturnValueOnce(null);
      mockFetch([{
        body: {
          uri: `at://${DID}/com.whtwnd.blog.entry/rawblob`,
          cid: "cid1",
          value: {
            title: "Raw with Blob",
            content: "C",
            createdAt: "2025-01-01T00:00:00Z",
            visibility: "author",
            blobs: [validBlob],
          },
        },
      }]);

      const entry = await getRawBlogEntry("rawblob");
      expect(entry).not.toBeNull();
      expect(entry!.blobs).toHaveLength(1);
    });

    it("returns blobs from SQLite draft in getRawBlogEntry", async () => {
      vi.mocked(getDraft).mockReturnValueOnce({
        uri: "",
        cid: "",
        rkey: "draftblob",
        title: "Draft with Blob",
        content: "C",
        createdAt: "2025-01-01T00:00:00Z",
        visibility: "author",
        blobs: [validBlob],
      });

      const entry = await getRawBlogEntry("draftblob");
      expect(entry).not.toBeNull();
      expect(entry!.blobs).toHaveLength(1);
      expect(entry!.blobs![0].ref.$link).toBe("bafkreitest123");
    });

    it("returns blobs from getDraftEntries via listDrafts", async () => {
      vi.mocked(listDrafts).mockReturnValueOnce([{
        uri: "",
        cid: "",
        rkey: "draftblob",
        title: "Draft with Blob",
        content: "C",
        createdAt: "2025-01-01T00:00:00Z",
        visibility: "author",
        blobs: [validBlob],
      }]);

      const drafts = await getDraftEntries();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].blobs).toHaveLength(1);
    });

    it("parses blobs in getBlogEntries", async () => {
      mockFetch([{
        body: {
          records: [{
            uri: `at://${DID}/com.whtwnd.blog.entry/listblob`,
            cid: "cid1",
            value: {
              title: "Listed with Blob",
              content: "C",
              createdAt: "2025-01-01T00:00:00Z",
              visibility: "public",
              blobs: [validBlob],
            },
          }],
        },
      }]);

      const entries = await getBlogEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].blobs).toHaveLength(1);
    });
  });
});
