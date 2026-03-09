# Arcnode Blog

Personal blog built on Astro SSR with AT Protocol (Bluesky) as the content backend. All posts are stored as AT Protocol records on a self-hosted PDS.

## Stack

- **Framework**: Astro 5 (SSR, Node adapter)
- **Styling**: Tailwind CSS 4 with 5 themes (default, parchment, moss, slate, rose)
- **Content**: AT Protocol PDS (published) + SQLite (drafts)
- **Auth**: ATAuth proxy (Bluesky identity)
- **Markdown**: marked + DOMPurify
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deploy**: Docker on Hetzner, CI/CD via Gitea Actions

## Features

- Sidebar profile with AT Protocol identity
- Editable about section (markdown, stored on PDS as `xyz.arcnode.blog.about`)
- 5 color themes with localStorage persistence
- Private drafts (SQLite) with publish/unpublish transitions to PDS
- Image uploads with magic byte validation
- RSS feed
- Responsive layout (sidebar collapses on mobile)

## Quick Start

```bash
cp .env.example .env
# Fill in PDS_APP_PASSWORD

npm install
npm run dev
```

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PDS_APP_PASSWORD` | Yes | AT Protocol app password |
| `ATAUTH_GATEWAY_URL` | No | ATAuth gateway (default: `https://apricot.workingtitle.zip`) |
| `ATAUTH_PUBLIC_URL` | No | ATAuth public URL for redirects |
| `DRAFTS_DB_PATH` | No | SQLite path for drafts (default: `/data/drafts.db`) |

## Testing

```bash
npm test          # Unit tests (99 tests)
npm run test:e2e  # E2E tests (against production)
```

## Deployment

Push to `main` triggers automated deploy via Gitea Actions:
1. Run tests + build (ubuntu-latest)
2. rsync to server (excludes .env, node_modules, .git, *.db)
3. Docker rebuild + restart (SQLite drafts persist via `blog-data` volume)
4. Health check
5. Matrix notification

Manual fallback: `rsync` locally + `ssh root@pds-hetzner "cd /opt/arcnode-blog && docker compose build --no-cache && docker compose up -d"`
