# at://press

**Protocol-native REpo-Stored Stories** — a blog engine where your AT Protocol PDS is your CMS.

Posts are stored as AT Protocol records on your personal data server. No database, no CMS, just protocol-native content that you own.

## Features

- **PDS as CMS** — Published posts are AT Protocol records on your PDS
- **WhiteWind compatible** — Uses `com.whtwnd.blog.entry` lexicon by default (configurable)
- **Private drafts** — SQLite-backed drafts with publish/unpublish transitions
- **ATAuth login** — Sign in with your AT Protocol identity to write and edit
- **Image uploads** — Upload images directly to your PDS blob store
- **5 color themes** — Default, Parchment, Moss, Slate, Rose (+ E-ink)
- **RSS feed** — Auto-generated at `/rss.xml`
- **Editable about section** — Markdown bio stored on your PDS
- **Responsive layout** — Sidebar profile, 3-column grid, mobile-friendly
- **Bluesky integration** — Profile link in sidebar

## Quick Start

```bash
git clone https://github.com/bkb/at-press.git
cd at-press
npm install
npm run setup    # Interactive — validates PDS, resolves DID, tests auth, writes .env
npm run dev      # → http://localhost:4321
```

Or manually:

```bash
cp .env.example .env
# Fill in your PDS_URL, DID, HANDLE, PDS_APP_PASSWORD, and BLOG_URL
npm install
npm run dev
```

## Docker

### One-liner

```bash
docker run -d --name at-press \
  --env-file .env \
  -p 4000:4000 \
  ghcr.io/bkb/at-press:latest
```

### Docker Compose

```yaml
services:
  blog:
    image: ghcr.io/bkb/at-press:latest
    container_name: at-press
    restart: unless-stopped
    ports:
      - "4000:4000"
    env_file: .env
    environment:
      - HOST=0.0.0.0
      - PORT=4000
      - DRAFTS_DB_PATH=/data/drafts.db
    volumes:
      - blog-data:/data

volumes:
  blog-data:
```

### Build from source

```bash
docker build -t at-press .
docker run -d --env-file .env -p 4000:4000 at-press
```

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PDS_URL` | Yes | — | Your PDS URL (e.g., `https://pds.example.com`) |
| `DID` | Yes | — | Your DID (e.g., `did:plc:abc123`) |
| `HANDLE` | Yes | — | Your handle (e.g., `you.example.com`) |
| `PDS_APP_PASSWORD` | Yes | — | App password from your PDS |
| `BLOG_URL` | Yes | `http://localhost:4321` | Public URL of your blog |
| `ATAUTH_GATEWAY_URL` | No | — | ATAuth gateway for authenticated editing |
| `ATAUTH_PUBLIC_URL` | No | — | ATAuth public URL for login redirects |
| `BLOG_COLLECTION` | No | `com.whtwnd.blog.entry` | Lexicon for blog posts |
| `ABOUT_COLLECTION` | No | `xyz.arcnode.blog.about` | Lexicon for about section |
| `DRAFTS_DB_PATH` | No | `/data/drafts.db` | SQLite path for draft storage |

## Architecture

```
┌──────────────┐     ┌─────────────────┐
│  Browser     │────▶│  at://press     │
│              │◀────│  (Astro SSR)    │
└──────────────┘     └────────┬────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐     ┌──────▼──────┐
              │  Your PDS  │     │  SQLite     │
              │ (published)│     │ (drafts)    │
              └───────────┘     └─────────────┘
```

- **Published posts**: Stored as AT Protocol records on your PDS
- **Drafts**: Private, stored in local SQLite (persisted via Docker volume)
- **Auth**: Optional ATAuth proxy for browser-based editing
- **Images**: Uploaded to your PDS blob store

## Lexicons

By default, at://press uses the [WhiteWind](https://whtwnd.com) blog lexicon (`com.whtwnd.blog.entry`), making your posts readable on WhiteWind and any other WhiteWind-compatible reader.

You can switch to [Leaflet](https://leaflet.pub) (`com.leaflet.blog.post`) or any other blog lexicon by setting the `BLOG_COLLECTION` environment variable.

## Stack

- **Framework**: [Astro 5](https://astro.build) (SSR, Node adapter)
- **Styling**: Tailwind CSS 4
- **Markdown**: marked + DOMPurify
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Container**: Docker (multi-arch: amd64 + arm64)

## Development

```bash
npm run dev        # Dev server at localhost:4321
npm test           # Unit tests
npm run test:e2e   # E2E tests (start server first)
npm run build      # Production build
npm start          # Run production server on port 4000
```

## Customization

### Logo

Replace the text logo in `src/layouts/Base.astro` with your own SVG or text:

```astro
<!-- Find this in Base.astro and replace with your logo -->
<a href="/" class="hover:opacity-80 transition-opacity font-mono text-sm font-bold text-accent">
  <span class="opacity-50">at://</span>press
</a>
```

### Themes

Themes are defined in `src/styles/global.css`. The active theme is stored in `localStorage` under `"blog-theme"`.

## Roadmap

- Full PDS + at://press installer — one-command self-sovereign publishing
- Plugin system for custom lexicons
- Comment system via AT Protocol

## License

[MIT](LICENSE)

---

*Originally built by [bkb](https://bsky.app/profile/bkb.arcnode.xyz) for [blog.arcnode.xyz](https://blog.arcnode.xyz). Powered by [AT Protocol](https://atproto.com).*
