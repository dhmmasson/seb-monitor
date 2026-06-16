# Docker Deployment

## What It Does

Packages the SEB Monitor server and client into a single Docker image for easy deployment. The multi-stage build compiles the client TypeScript into a minified IIFE bundle, then copies it into a lightweight Deno Alpine image with the server.

## How to Verify It Works

### Build the image

```bash
docker build -t seb-monitor .
```

### Run the container

```bash
docker run -d \
  --name seb-monitor \
  -p 8000:8000 \
  -v seb-data:/data \
  -e DASHBOARD_PASSWORD=your-password \
  -e COOKIE_SECRET=$(openssl rand -hex 16) \
  seb-monitor
```

### Check health

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

### Verify static files

```bash
curl -I http://localhost:8000/seb-monitor.js
# Content-Type: application/javascript

curl -I http://localhost:8000/exam.html
# Content-Type: text/html
```

### Send a test heartbeat

```bash
curl -X POST http://localhost:8000/api/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"studentId":"test","examId":"test","questionId":"default","timestamp":0,"sessionId":"","focus":{"focusedTimeMs":1000,"unfocusedTimeMs":0,"blurCount":0},"input":{"typedChars":10,"pastedChars":0,"deletedChars":0,"currentLength":10},"keys":{"keyDownCount":10,"ctrlCount":0,"altCount":0,"shiftCount":0},"copyCount":0,"pasteCount":0,"events":[]}'
# → {"sessionId":"..."}
```

### Use Docker Compose

```bash
cp .env.example .env
# Edit .env with your passwords
docker compose up -d
docker compose logs -f
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server listen port |
| `DB_PATH` | `/data/seb-monitor.db` | SQLite database path |
| `DASHBOARD_PASSWORD` | — | Dashboard login password (required for dashboard) |
| `DASHBOARD_PASSWORD_HASH` | — | Pre-computed PBKDF2 hash (alternative to password) |
| `COOKIE_SECRET` | `change-me-in-production` | HMAC-SHA256 secret for auth cookies |

## Volumes

| Mount | Description |
|---|---|
| `/data` | SQLite database — persists across container restarts |

## Architecture

```
┌─────────────────────────────────────────────┐
│  Docker Image (denoland/deno:alpine)         │
│                                              │
│  /app/server/src/main.ts  ← entry point     │
│  /app/client/dist/seb-monitor.js ← static   │
│  /app/docs/demos/exam.html      ← static    │
│  /data/seb-monitor.db          ← volume     │
│                                              │
│  Port 8000 → API + Dashboard + Static files  │
└─────────────────────────────────────────────┘
```

## Known Limitations

- SQLite WAL mode requires the database to be on a local filesystem — do not use NFS or network mounts for the `/data` volume
- The container runs as root by default; for production, consider adding a non-root user
- No TLS termination — use a reverse proxy (nginx, Caddy, Traefik) for HTTPS in production

## Relevant Spec

- `plan.md` Section 1.2 (Server architecture decisions)
- `plan.md` Section 3 (Database schema — file-based SQLite)
- `plan.md` Section 5 (Phase 3 — Dockerization tasks)
- `vision.md` (D3: Deployment model)
