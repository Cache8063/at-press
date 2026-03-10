---
name: deployment
description: "Deploying the blog, Docker, CI/CD, and server operations."
---

## Deployment

### Infrastructure

- **Server**: pds-hetzner (`ssh root@pds-hetzner` via Tailscale)
- **Path**: `/opt/arcnode-blog/`
- **Container**: Docker, port 4000
- **Git**: Gitea at `gitea.cloudforest-basilisk.ts.net/Arcnode.xyz/arcnode-blog`
- **URL**: https://blog.arcnode.xyz (via Cloudflare)

### Manual Deploy (when CI/CD runner is stuck)

```bash
# From local machine
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude dist \
  --exclude tests --exclude test-results --exclude .astro \
  --exclude .env --exclude '*.db' --exclude '*.db-wal' --exclude '*.db-shm' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@pds-hetzner:/opt/arcnode-blog/

ssh root@pds-hetzner "cd /opt/arcnode-blog && docker compose build --no-cache && docker compose up -d"
curl -sf https://blog.arcnode.xyz/  # verify
```

### CI/CD (Gitea Actions)

Push to `main` triggers both workflows:

```
.gitea/workflows/
├── ci.yml       # Test + build on push/PR (ubuntu-latest)
└── deploy.yml   # Test -> rsync -> docker build -> health check -> Matrix notify
```

**rsync excludes**: `node_modules`, `.git`, `dist`, `tests`, `test-results`, `.astro`, `.env`, `*.db`, `*.db-wal`, `*.db-shm`

**Known issue**: Gitea runner on cloudforest-basilisk occasionally goes offline, leaving runs in "queued" status. Use manual deploy as fallback.

### Secrets (Gitea)

| Secret | Level | Purpose |
|--------|-------|---------|
| `DEPLOY_SSH_KEY` | Repo | SSH to pds-hetzner |
| `DEPLOY_HOST` | Repo | Server hostname |
| `MATRIX_HOMESERVER_URL` | Org | CI notifications |
| `MATRIX_CICD_ROOM_ID` | Org | CI notifications |
| `MATRIX_ACCESS_TOKEN` | Org | CI notifications |

### Server .env

On the server at `/opt/arcnode-blog/.env` (not in git, excluded from rsync):

```
PDS_APP_PASSWORD=<app password from arcnode.xyz>
```

### Docker Compose

```yaml
services:
  blog:
    build: .
    ports: ["0.0.0.0:4000:4000"]
    env_file: .env
    environment:
      - HOST=0.0.0.0
      - PORT=4000
      - ATAUTH_GATEWAY_URL=https://apricot.workingtitle.zip
      - DRAFTS_DB_PATH=/data/drafts.db
    volumes:
      - blog-data:/data
volumes:
  blog-data:
```

- `ATAUTH_GATEWAY_URL` points to K8s-hosted ATAuth (no local atauth container on pds-hetzner)
- `blog-data` named volume persists SQLite drafts across container rebuilds
- Dockerfile creates `/data` dir owned by `blog` user
- `better-sqlite3` native module compiled in build stage (needs python3, make, g++)
