# at://press

Astro 6 SSR blog engine on AT Protocol. Your PDS is your CMS.

## Stack

Astro 6, @astrojs/node 10, TypeScript, Tailwind 4, better-sqlite3, marked, isomorphic-dompurify

## Commands

```bash
npm run setup        # Interactive first-time setup (writes .env)
npm run dev          # localhost:4321
npm run build        # Production build
npm run test         # Vitest (91 tests)
npm run test:e2e     # Playwright E2E
npm start            # Built server on port 4000
```

## Architecture

- **Published posts** → PDS records (default: `com.whtwnd.blog.entry`, configurable)
- **Drafts** → SQLite (`/data/drafts.db`, optional)
- **Auth** → ATAuth (optional, degrades gracefully)
- **Deploy** → Docker or bare Node.js

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.ts` | All config: URLs, limits, cache TTLs, env vars |
| `src/lib/pds.ts` | PDS fetching, caching, blog/about/profile |
| `src/lib/drafts.ts` | SQLite CRUD, migration, rkey generation |
| `src/lib/auth.ts` | ATAuth login/verify, owner check |
| `src/lib/api.ts` | Session creation, request parsing |
| `src/middleware.ts` | CSP headers, migration trigger |
| `src/pages/api/` | publish, update, delete, upload-image, about, logout |

## Rules

- All config centralized in `constants.ts` — never hardcode URLs or limits elsewhere
- `import.meta.env` for build-time vars, `process.env` for runtime (API routes)
- PDS catch blocks must log errors before falling back to stale cache
- Theme FOUC script in Base.astro keeps `"blog-theme"` hardcoded (can't import in `is:inline`)
- Client constants via Astro `define:vars` (write.astro: `MAX_IMAGE_SIZE`, `editBlobs`)
- Never commit `.env` — see `.env.example` for required vars

## Slash Commands

| Command | When to use |
|---------|-------------|
| `/atproto` | PDS records, blobs, collections, drafts, state transitions |
| `/testing` | Writing tests, running suites, mocking patterns |
