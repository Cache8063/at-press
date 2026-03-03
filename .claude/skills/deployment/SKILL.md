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

### Manual Deploy

```bash
ssh root@pds-hetzner
cd /opt/arcnode-blog
docker compose build --no-cache
docker compose up -d
curl localhost:4000  # health check
```

### CI/CD (Gitea Actions)

Push to `main` triggers: test -> deploy.

```
.gitea/workflows/
├── ci.yml       # Test + build on push/PR
└── deploy.yml   # Test -> rsync -> docker build -> health check -> Matrix notify
```

**rsync excludes**: `node_modules`, `.git`, `dist`, `tests`, `test-results`, `.astro`, `.env`

### Secrets (Gitea)

| Secret | Level | Purpose |
|--------|-------|---------|
| `DEPLOY_SSH_KEY` | Repo | SSH to pds-hetzner |
| `DEPLOY_HOST` | Repo | Server hostname |
| `MATRIX_HOMESERVER_URL` | Org | CI notifications |
| `MATRIX_CICD_ROOM_ID` | Org | CI notifications |
| `MATRIX_ACCESS_TOKEN` | Org | CI notifications |

### Server .env

On the server at `/opt/arcnode-blog/.env` (not in git, not rsynced):

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
      - ATAUTH_GATEWAY_URL=http://172.17.0.1:3100
```

The `ATAUTH_GATEWAY_URL` Docker override routes to the atauth container on the same host via Docker bridge.
