# Arcnode Blog

Personal blog built on Astro SSR with AT Protocol (Bluesky) as the content backend. All posts are stored as AT Protocol records on a self-hosted PDS.

## Stack

- **Framework**: Astro 5 (SSR, Node adapter)
- **Styling**: Tailwind CSS 4 with 5 themes (parchment, midnight, moss, slate, rose)
- **Content**: AT Protocol PDS via WhiteWind blog collection
- **Auth**: ATAuth proxy (Bluesky identity)
- **Markdown**: marked + DOMPurify
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deploy**: Docker on Hetzner, CI/CD via Gitea Actions

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

## Testing

```bash
npm test          # Unit tests
npm run test:e2e  # E2E tests (against production)
```

## Deployment

Push to `main` triggers automated deploy via Gitea Actions:
1. Run tests + build
2. rsync to server
3. Docker rebuild
4. Health check
5. Matrix notification
