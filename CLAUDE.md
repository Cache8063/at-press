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

## Key Directories

```
src/lib/           # Core: api, auth, pds, drafts, constants, utils
src/pages/         # Routes: index (sidebar+about), [rkey], write, rss.xml
src/pages/api/     # API: publish, update, delete, upload-image, about, logout
src/layouts/       # Base.astro (themes, nav, maxWidth prop)
src/styles/        # global.css (Tailwind + 5 themes + about modal)
tests/unit/        # Vitest tests (drafts, pds, auth, utils, rss)
tests/e2e/         # Playwright tests
```

## Draft/Publish Flow

Drafts are private (SQLite). Published posts are public (PDS). Transitions handled by `update.ts`:
- Draft → Draft: SQLite only
- Draft → Publish: PDS putRecord + SQLite delete
- Publish → Unpublish: SQLite save + PDS deleteRecord
- Publish → Publish: PDS putRecord only

## Security

- Origin check on all API POSTs (`checkOrigin`)
- DOMPurify on all markdown rendering
- Magic byte validation on image uploads
- CSP via middleware
- Drafts stored in local SQLite (not publicly readable PDS)

## Environment

See `.env.example`. Only `PDS_APP_PASSWORD` is required.

## Skills

| Skill | Use When |
|-------|----------|
| atproto | PDS, blobs, collections, record schemas, about section, drafts |
| testing | Writing tests, running suites, debugging failures |
| deployment | Docker, CI/CD, volumes, server ops, manual deploy |
