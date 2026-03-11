# at://press

Astro SSR blog engine powered by AT Protocol. Your PDS is your CMS.

## Commands

```bash
npm run setup      # Interactive first-time setup (writes .env)
npm run dev        # localhost:4321
npm run build      # Production build
npm run test       # Vitest unit tests
npm run test:e2e   # Playwright E2E (needs running server)
npm start          # Run built server (port 4000)
```

## Architecture

```
Published posts → AT Protocol PDS (user-configured)
Drafts          → Local SQLite (optional, /data/drafts.db)
Auth            → ATAuth (optional, user-configured)
```

## Key Files

```
src/lib/constants.ts  # All shared constants: URLs, limits, cache TTLs
src/lib/pds.ts        # PDS fetching, caching, blog entries
src/lib/drafts.ts     # SQLite draft CRUD, migration
src/lib/api.ts        # Auth helpers, session creation, request parsing
src/lib/auth.ts       # ATAuth login/verify, owner check
src/middleware.ts      # CSP headers, one-time migration trigger
src/pages/api/        # publish, update, delete, upload-image, about, logout
```

## Key Patterns

- All config in `constants.ts` — reads from `import.meta.env` (Astro) or `process.env` (Node)
- Drafts in SQLite, published posts on PDS
- Theme config imported from constants in Base.astro; FOUC script keeps `"blog-theme"` hardcoded
- Client-side constants passed via Astro `define:vars`
- All PDS catch blocks log errors before falling back to stale cache
- ATAuth is optional — write page degrades gracefully when not configured

## Environment

See `.env.example`. Required: `PDS_URL`, `DID`, `HANDLE`, `PDS_APP_PASSWORD`, `BLOG_URL`.

## Lexicon Collections

Default: WhiteWind (`com.whtwnd.blog.entry`). Configurable via `BLOG_COLLECTION` env var.
