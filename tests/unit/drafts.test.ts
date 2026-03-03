import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Use in-memory SQLite for tests
process.env.DRAFTS_DB_PATH = ":memory:";

import { listDrafts, getDraft, saveDraft, deleteDraft, generateRkey, closeDb } from "../../src/lib/drafts";

describe("drafts", () => {
  beforeEach(() => {
    // Reset the DB connection so each test gets a fresh in-memory DB
    closeDb();
  });

  afterEach(() => {
    closeDb();
  });

  describe("generateRkey", () => {
    it("generates valid rkeys matching RKEY_REGEX", () => {
      const rkey = generateRkey();
      expect(rkey).toMatch(/^[a-zA-Z0-9._~-]{1,512}$/);
      expect(rkey).toHaveLength(13);
    });

    it("generates unique rkeys", () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateRkey()));
      expect(keys.size).toBe(100);
    });
  });

  describe("saveDraft / getDraft", () => {
    it("saves and retrieves a draft", () => {
      const rkey = saveDraft({
        title: "Test Draft",
        content: "Some content",
      });

      const draft = getDraft(rkey);
      expect(draft).not.toBeNull();
      expect(draft!.title).toBe("Test Draft");
      expect(draft!.content).toBe("Some content");
      expect(draft!.visibility).toBe("author");
      expect(draft!.rkey).toBe(rkey);
    });

    it("saves with explicit rkey", () => {
      const rkey = saveDraft({
        rkey: "my-custom-rkey",
        title: "Custom Key",
        content: "Content",
      });

      expect(rkey).toBe("my-custom-rkey");
      const draft = getDraft("my-custom-rkey");
      expect(draft!.title).toBe("Custom Key");
    });

    it("updates an existing draft via upsert", () => {
      saveDraft({
        rkey: "update-test",
        title: "Original Title",
        content: "Original Content",
      });

      saveDraft({
        rkey: "update-test",
        title: "Updated Title",
        content: "Updated Content",
      });

      const draft = getDraft("update-test");
      expect(draft!.title).toBe("Updated Title");
      expect(draft!.content).toBe("Updated Content");
    });

    it("stores and retrieves blobs as JSON", () => {
      const blobs = [
        {
          $type: "blob" as const,
          ref: { $link: "bafkreitest123" },
          mimeType: "image/png",
          size: 12345,
        },
      ];

      saveDraft({
        rkey: "blob-test",
        title: "With Blob",
        content: "Content",
        blobs,
      });

      const draft = getDraft("blob-test");
      expect(draft!.blobs).toHaveLength(1);
      expect(draft!.blobs![0].ref.$link).toBe("bafkreitest123");
      expect(draft!.blobs![0].mimeType).toBe("image/png");
    });

    it("stores null blobs when none provided", () => {
      saveDraft({
        rkey: "no-blob",
        title: "No Blob",
        content: "Content",
      });

      const draft = getDraft("no-blob");
      expect(draft!.blobs).toBeUndefined();
    });

    it("preserves createdAt when provided", () => {
      const date = "2025-06-01T12:00:00.000Z";
      saveDraft({
        rkey: "date-test",
        title: "Dated",
        content: "Content",
        createdAt: date,
      });

      const draft = getDraft("date-test");
      expect(draft!.createdAt).toBe(date);
    });

    it("returns null for non-existent rkey", () => {
      const draft = getDraft("nonexistent");
      expect(draft).toBeNull();
    });

    it("sets empty uri and cid on draft entries", () => {
      saveDraft({
        rkey: "fields-test",
        title: "Fields",
        content: "Content",
      });

      const draft = getDraft("fields-test");
      expect(draft!.uri).toBe("");
      expect(draft!.cid).toBe("");
    });
  });

  describe("listDrafts", () => {
    it("returns drafts sorted newest first", () => {
      saveDraft({
        rkey: "older",
        title: "Older Draft",
        content: "C",
        createdAt: "2025-01-01T00:00:00Z",
      });
      saveDraft({
        rkey: "newer",
        title: "Newer Draft",
        content: "C",
        createdAt: "2025-06-01T00:00:00Z",
      });

      const drafts = listDrafts();
      expect(drafts).toHaveLength(2);
      expect(drafts[0].title).toBe("Newer Draft");
      expect(drafts[1].title).toBe("Older Draft");
    });

    it("returns empty array when no drafts exist", () => {
      const drafts = listDrafts();
      expect(drafts).toEqual([]);
    });
  });

  describe("deleteDraft", () => {
    it("deletes an existing draft", () => {
      saveDraft({
        rkey: "to-delete",
        title: "Delete Me",
        content: "Content",
      });

      expect(getDraft("to-delete")).not.toBeNull();
      const result = deleteDraft("to-delete");
      expect(result).toBe(true);
      expect(getDraft("to-delete")).toBeNull();
    });

    it("returns false when draft does not exist", () => {
      const result = deleteDraft("nonexistent");
      expect(result).toBe(false);
    });

    it("removes draft from list", () => {
      saveDraft({ rkey: "keep", title: "Keep", content: "C" });
      saveDraft({ rkey: "remove", title: "Remove", content: "C" });

      deleteDraft("remove");
      const drafts = listDrafts();
      expect(drafts).toHaveLength(1);
      expect(drafts[0].rkey).toBe("keep");
    });
  });
});
