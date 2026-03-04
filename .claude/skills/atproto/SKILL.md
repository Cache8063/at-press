---
name: atproto
description: "AT Protocol integration. Use when working with PDS, blobs, collections, drafts, or Bluesky data."
---

## AT Protocol

### Constants (`src/lib/constants.ts`)

```typescript
// Identity & URLs
BLOG_URL         = "https://blog.arcnode.xyz"
PDS_URL          = "https://arcnode.xyz"
DID              = "did:plc:k23ujfuppr3hr4pxvtaz7jro"
HANDLE           = "bkb.arcnode.xyz"
BLOG_COLLECTION  = "com.whtwnd.blog.entry"
ABOUT_COLLECTION = "xyz.arcnode.blog.about"
ABOUT_RKEY       = "self"

// Content limits
MAX_TITLE_LENGTH   = 300
MAX_CONTENT_LENGTH = 100_000
MAX_ABOUT_LENGTH   = 5_000
MAX_IMAGE_SIZE     = 5 * 1024 * 1024  // 5 MB

// Session
SESSION_DID_COOKIE    = "session_did"
SESSION_HANDLE_COOKIE = "session_handle"
SESSION_MAX_AGE       = 86400 * 7  // 7 days

// RSS
RSS_MAX_ITEMS          = 20
RSS_EXCERPT_LENGTH     = 300
DEFAULT_EXCERPT_LENGTH = 160

// Cache TTLs (ms)
PROFILE_TTL      = 3600_000  // 1 hour
ENTRIES_TTL      = 300_000   // 5 min
ENTRY_TTL        = 600_000   // 10 min
ABOUT_TTL        = 3600_000  // 1 hour
MAX_ENTRY_CACHE  = 200
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

All PDS catch blocks log via `console.error` before returning stale/fallback data. RSS feed returns 503 on fetch failure.
