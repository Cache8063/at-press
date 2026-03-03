import Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { BlogEntry, AtBlob } from "./pds";
import { createPdsSession } from "./api";
import { PDS_URL, DID, BLOG_COLLECTION } from "./constants";

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DRAFTS_DB_PATH || "/data/drafts.db";
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS drafts (
        rkey        TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        content     TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        blobs       TEXT
      )
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations_applied (
        name       TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  return db;
}

export function generateRkey(): string {
  return nanoid(13);
}

interface DraftRow {
  rkey: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  blobs: string | null;
}

function rowToEntry(row: DraftRow): BlogEntry {
  return {
    uri: "",
    cid: "",
    rkey: row.rkey,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    visibility: "author",
    blobs: row.blobs ? JSON.parse(row.blobs) : undefined,
  };
}

export function listDrafts(): BlogEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM drafts ORDER BY created_at DESC")
    .all() as DraftRow[];
  return rows.map(rowToEntry);
}

export function getDraft(rkey: string): BlogEntry | null {
  const row = getDb()
    .prepare("SELECT * FROM drafts WHERE rkey = ?")
    .get(rkey) as DraftRow | undefined;
  return row ? rowToEntry(row) : null;
}

export function saveDraft(draft: {
  rkey?: string;
  title: string;
  content: string;
  createdAt?: string;
  blobs?: AtBlob[];
}): string {
  const rkey = draft.rkey || generateRkey();
  const now = new Date().toISOString();
  const blobsJson = draft.blobs?.length ? JSON.stringify(draft.blobs) : null;

  getDb()
    .prepare(`
      INSERT INTO drafts (rkey, title, content, created_at, updated_at, blobs)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(rkey) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        updated_at = excluded.updated_at,
        blobs = excluded.blobs
    `)
    .run(rkey, draft.title, draft.content, draft.createdAt || now, now, blobsJson);

  return rkey;
}

export function deleteDraft(rkey: string): boolean {
  const result = getDb()
    .prepare("DELETE FROM drafts WHERE rkey = ?")
    .run(rkey);
  return result.changes > 0;
}

// --- Migration ---

function hasMigrationRun(name: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 FROM migrations_applied WHERE name = ?")
    .get(name);
  return !!row;
}

function markMigrationRun(name: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO migrations_applied (name) VALUES (?)")
    .run(name);
}

export async function migratePdsDraftsToSqlite(): Promise<void> {
  if (hasMigrationRun("pds-drafts-to-sqlite")) return;

  console.log("[migration] Checking for PDS drafts to migrate...");

  // Fetch drafts directly from PDS (not via getDraftEntries which now reads SQLite)
  const pdsDrafts: Array<{ rkey: string; title: string; content: string; createdAt: string; blobs?: AtBlob[] }> = [];
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

      const data = await res.json() as {
        records: Array<{ uri: string; value: Record<string, unknown> }>;
        cursor?: string;
      };

      for (const record of data.records) {
        const val = record.value;
        if (val.visibility !== "author") continue;

        pdsDrafts.push({
          rkey: record.uri.split("/").pop() || "",
          title: (val.title as string) || "Untitled",
          content: val.content as string,
          createdAt: val.createdAt as string,
          blobs: Array.isArray(val.blobs) ? val.blobs as AtBlob[] : undefined,
        });
      }

      cursor = data.cursor;
    } while (cursor);
  } catch (err) {
    console.error("[migration] Failed to fetch PDS drafts:", err);
  }

  if (pdsDrafts.length === 0) {
    console.log("[migration] No PDS drafts found.");
    markMigrationRun("pds-drafts-to-sqlite");
    return;
  }

  console.log(`[migration] Found ${pdsDrafts.length} PDS drafts, migrating...`);

  for (const draft of pdsDrafts) {
    saveDraft({
      rkey: draft.rkey,
      title: draft.title,
      content: draft.content,
      createdAt: draft.createdAt,
      blobs: draft.blobs,
    });
  }

  // Delete migrated drafts from PDS
  try {
    const [accessJwt] = await createPdsSession();
    if (accessJwt) {
      for (const draft of pdsDrafts) {
        const res = await fetch(
          `${PDS_URL}/xrpc/com.atproto.repo.deleteRecord`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessJwt}`,
            },
            body: JSON.stringify({
              repo: DID,
              collection: BLOG_COLLECTION,
              rkey: draft.rkey,
            }),
          }
        );
        if (res.ok) {
          console.log(`[migration] Deleted PDS draft: ${draft.rkey}`);
        } else {
          console.warn(`[migration] Failed to delete PDS draft ${draft.rkey}: ${res.status}`);
        }
      }
    }
  } catch (err) {
    console.warn("[migration] Failed to delete PDS drafts (copied to SQLite):", err);
  }

  markMigrationRun("pds-drafts-to-sqlite");
  console.log("[migration] PDS draft migration complete.");
}

// For testing: close and reset the database connection
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
