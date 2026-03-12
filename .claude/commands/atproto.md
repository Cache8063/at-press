---
name: atproto
description: "AT Protocol integration. Use when working with PDS, blobs, collections, drafts, or Bluesky data."
---

## AT Protocol

### Constants (`src/lib/constants.ts`)

All identity/URL constants read from `import.meta.env`:

```typescript
BLOG_URL         = import.meta.env.BLOG_URL || "http://localhost:4321"
PDS_URL          = import.meta.env.PDS_URL
DID              = import.meta.env.DID
HANDLE           = import.meta.env.HANDLE
BLOG_COLLECTION  = import.meta.env.BLOG_COLLECTION || "com.whtwnd.blog.entry"
ABOUT_COLLECTION = import.meta.env.ABOUT_COLLECTION || "xyz.arcnode.blog.about"
```

### PDS API Patterns

```typescript
// List records
GET ${PDS_URL}/xrpc/com.atproto.repo.listRecords?repo=${DID}&collection=${BLOG_COLLECTION}

// Get single record
GET ${PDS_URL}/xrpc/com.atproto.repo.getRecord?repo=${DID}&collection=${BLOG_COLLECTION}&rkey=${rkey}

// Put record (requires auth)
POST ${PDS_URL}/xrpc/com.atproto.repo.putRecord
  Authorization: Bearer ${accessJwt}

// Delete record
POST ${PDS_URL}/xrpc/com.atproto.repo.deleteRecord
```

### Draft State Transitions (`src/pages/api/update.ts`)
- Draft → Draft: `saveDraft()` only
- Draft → Publish: PDS `putRecord` + `deleteDraft()`
- Publish → Unpublish: `saveDraft()` + PDS `deleteRecord`
- Publish → Publish: PDS `putRecord` only

### Blob Handling
- Upload: `POST /xrpc/com.atproto.repo.uploadBlob` with raw bytes
- Serve: `GET ${PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${DID}&cid=${cid}`
- Supported: PNG, JPEG, WebP (max 5MB), validated via magic bytes
