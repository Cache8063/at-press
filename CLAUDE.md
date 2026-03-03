# Arcnode Blog

Astro SSR blog on AT Protocol. Deployed on pds-hetzner via Docker.

## Commands

```bash
npm run dev        # localhost:4321
npm run build      # Production build
npm run test       # Vitest unit tests
npm run test:e2e   # Playwright E2E
npm start          # Run built server (port 4000)
```

## Architecture

```
Astro SSR → AT Protocol PDS (arcnode.xyz) → ATAuth (apricot.workingtitle.zip)
```

## Key Directories

```
src/lib/           # Core: api, auth, pds, constants, utils
src/pages/         # Routes: index (sidebar+about), [rkey], write, rss.xml
src/pages/api/     # API: publish, update, delete, upload-image, about, logout
src/layouts/       # Base.astro (themes, nav, maxWidth prop)
src/styles/        # global.css (Tailwind + 5 themes + about modal)
tests/unit/        # Vitest tests
tests/e2e/         # Playwright tests
```

## Auth Flow

1. User clicks "Sign in" on /write
2. Redirects to ATAuth proxy (`ATAUTH_PUBLIC_URL`)
3. Returns with `_atauth_ticket` query param
4. Server verifies ticket against ATAuth gateway
5. Sets `session_did` cookie (httpOnly, secure, 7 days)

## Security

- Origin check on all API POSTs (`checkOrigin`)
- DOMPurify on all markdown rendering
- Magic byte validation on image uploads
- CSP via middleware
- Handle format validation

## Environment

See `.env.example`. Only `PDS_APP_PASSWORD` is required.

## Skills

| Skill | Use When |
|-------|----------|
| atproto | PDS, blobs, collections, record schemas, about section |
| testing | Writing tests, running suites, debugging failures |
| deployment | Docker, CI/CD, server ops, manual deploy |
