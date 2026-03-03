---
name: atproto
description: "AT Protocol integration. Use when working with PDS, blobs, collections, drafts, or Bluesky data."
---

## AT Protocol

### Constants

```typescript
// src/lib/constants.ts
BLOG_URL         = "https://blog.arcnode.xyz"
PDS_URL          = "https://arcnode.xyz"
DID              = "did:plc:k23ujfuppr3hr4pxvtaz7jro"
HANDLE           = "bkb.arcnode.xyz"
BLOG_COLLECTION  = "com.whtwnd.blog.entry"
ABOUT_COLLECTION = "xyz.arcnode.blog.about"
ABOUT_RKEY       = "self"
```

### PDS API Patterns

All blog data lives in the PDS as AT Protocol records.

```typescript
// List records
GET ${PDS_URL}/xrpc/com.atproto.repo.listRecords
  ?repo=${DID}&collection=${BLOG_COLLECTION}&limit=100

// Get single record
GET ${PDS_URL}/xrpc/com.atproto.repo.getRecord
  ?repo=${DID}&collection=${BLOG_COLLECTION}&rkey=${rkey}

// Put record (create or update, requires auth)
POST ${PDS_URL}/xrpc/com.atproto.repo.putRecord
  Authorization: Bearer ${accessJwt}
  { repo: DID, collection, rkey, record: {...} }

// Delete record
POST ${PDS_URL}/xrpc/com.atproto.repo.deleteRecord
  Authorization: Bearer ${accessJwt}
  { repo: DID, collection: BLOG_COLLECTION, rkey }
```

### Auth Session

```typescript
// Create session with app password (server-side only)
POST ${PDS_URL}/xrpc/com.atproto.server.createSession
  { identifier: DID, password: process.env.PDS_APP_PASSWORD }
// Returns: { accessJwt, refreshJwt, did, handle }
```

### Draft Storage (SQLite)

Drafts are stored in local SQLite (not PDS) for privacy. PDS `listRecords` is public — drafts on PDS are readable by anyone.

```typescript
// src/lib/drafts.ts
listDrafts()           // All drafts, newest first
getDraft(rkey)         // Single draft or null
saveDraft({ rkey?, title, content, createdAt?, blobs? })  // Upsert
deleteDraft(rkey)      // Returns boolean
generateRkey()         // nanoid(13)
migratePdsDraftsToSqlite()  // One-time PDS → SQLite migration
closeDb()              // For testing only
```

SQLite schema: `drafts` table (rkey PK, title, content, created_at, updated_at, blobs JSON) + `migrations_applied` table.

DB path: `DRAFTS_DB_PATH` env var, default `/data/drafts.db`. Use `:memory:` for tests.

**State transitions** (handled by `src/pages/api/update.ts`):
- Draft → Draft: `saveDraft()` only
- Draft → Publish: PDS `putRecord` + `deleteDraft()`
- Publish → Unpublish: `saveDraft()` + PDS `deleteRecord`
- Publish → Publish: PDS `putRecord` only

### Collections

**Blog entries** (`com.whtwnd.blog.entry`) — only published posts on PDS:
```typescript
{
  $type: "com.whtwnd.blog.entry",
  title: string,        // max 300 chars
  content: string,      // markdown, max 100k chars
  createdAt: string,    // ISO 8601
  visibility: "public" | "author",
  blobs?: Array<{ $link: string }>,
}
```

**About section** (`xyz.arcnode.blog.about`, rkey: `self`):
```typescript
{
  $type: "xyz.arcnode.blog.about",
  content: string,      // markdown, max 5k chars
}
```
- Fetched via `getAbout()` in `src/lib/pds.ts`
- Saved via `POST /api/about` (owner only)
- Rendered as markdown with DOMPurify in about modal
- Falls back to `DEFAULT_ABOUT` if no PDS record exists

### Blob Handling

- Upload: `POST /xrpc/com.atproto.repo.uploadBlob` with raw bytes
- Serve: `GET ${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${cid}`
- Supported: PNG, JPEG, WebP (max 5MB)
- Validated via magic bytes (not just Content-Type)

### Caching Strategy

| Data | TTL | Max Entries |
|------|-----|-------------|
| Profile | 1 hour | 1 |
| About | 1 hour | 1 |
| Blog list | 5 min | 1 |
| Single entry | 10 min | 200 |
| Drafts | No cache | - |

Stale cache served on network error (fallback).
