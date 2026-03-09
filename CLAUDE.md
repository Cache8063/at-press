# Arcnode Blog

Astro SSR blog on AT Protocol. Deployed on pds-hetzner via Docker.

## Commands

```bash
npm run dev        # localhost:4321
npm run build      # Production build
npm run test       # Vitest unit tests (99 tests)
npm run test:e2e   # Playwright E2E
npm start          # Run built server (port 4000)
```

## Architecture

```
Published posts → AT Protocol PDS (arcnode.xyz)
Drafts          → Local SQLite (/data/drafts.db, Docker volume)
Auth            → ATAuth (apricot.workingtitle.zip)
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

- Drafts in SQLite, published posts on PDS. See atproto skill for state transitions.
- All config centralized in `constants.ts`: URLs, limits, cache TTLs, session cookies, RSS params, theme colors
- Theme config imported from constants in Base.astro (server + client via `import`); `is:inline` FOUC script keeps `"blog-theme"` hardcoded (can't import)
- Client-side constants passed via Astro `define:vars` (write.astro: `MAX_IMAGE_SIZE`)
- All PDS catch blocks log errors before falling back to stale cache

## Environment

See `.env.example`. Only `PDS_APP_PASSWORD` is required.

## Skills

| Skill | Use When |
|-------|----------|
| atproto | PDS, blobs, collections, record schemas, about section, drafts |
| testing | Writing tests, running suites, debugging failures |
| deployment | Docker, CI/CD, volumes, server ops, manual deploy |
