---
name: atproto
description: "AT Protocol integration. Use when working with PDS, blobs, collections, or Bluesky data."
---

## AT Protocol

### Constants

```typescript
// src/lib/constants.ts
BLOG_URL = "https://blog.arcnode.xyz"
PDS_URL  = "https://arcnode.xyz"
DID      = "did:plc:k23ujfuppr3hr4pxvtaz7jro"
HANDLE   = "bkb.arcnode.xyz"
BLOG_COLLECTION = "com.whtwnd.blog.entry"
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

// Create record (requires auth session)
POST ${PDS_URL}/xrpc/com.atproto.repo.createRecord
  Authorization: Bearer ${accessJwt}
  { repo: DID, collection: BLOG_COLLECTION, record: {...} }

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

### Blob Handling

- Upload: `POST /xrpc/com.atproto.repo.uploadBlob` with raw bytes
- Serve: `GET ${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${cid}`
- Supported: PNG, JPEG, WebP (max 5MB)
- Validated via magic bytes (not just Content-Type)

### Blog Record Schema (WhiteWind)

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

### Caching Strategy

| Data | TTL | Max Entries |
|------|-----|-------------|
| Profile | 1 hour | 1 |
| Blog list | 5 min | 1 |
| Single entry | 10 min | 200 |
| Drafts | No cache | - |

Stale cache served on network error (fallback).
