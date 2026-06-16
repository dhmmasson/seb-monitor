# SEB Monitor — Exam Activity Monitoring

A lightweight client/server system for monitoring student activity during online exams running inside Safe Exam Browser (SEB).

**Not a cheating detector.** The system collects behavioral signals (focus, typing, copy/paste events) that instructors can review after the exam.

## Status

| Phase | Status | Version |
|---|---|---|
| Phase 1 — Client Library | ✅ Complete | v0.1.0 |
| Phase 2 — Server Core | ✅ Complete | v0.2.0 |
| Phase 3 — Docker | ✅ Complete | v0.5.0 |
| Phase 4 — Dashboard | ✅ Complete | v0.4.0 |
| Phase 5 — Resilience | ⬜ Not started | — |
| Phase 6 — Moodle Integration | ⬜ Not started | — |

## Quick Start

### Docker (Production)

```bash
# Build and start
docker compose up -d

# Check health
curl http://localhost:8000/health

# View logs
docker compose logs -f

# Stop
docker compose down
```

The server starts on port 8000 with:
- **Client JS**: http://localhost:8000/seb-monitor.js
- **API**: http://localhost:8000/api/heartbeat
- **Dashboard**: http://localhost:8000/dashboard
- **Health**: http://localhost:8000/health

### Run from Source (Development)

```bash
cd server
deno task dev    # starts on port 8000
```

### Run Tests

```bash
cd server && deno task test    # 91 server tests
cd client && deno test         # 74 client tests
deno task test:docker          # Docker integration tests (requires Docker)
```

### Run the Demo

```bash
# Terminal 1: start the server
cd server && deno task dev

# Terminal 2: open the demo page
open demo/index.html
# Click "Start Monitoring" → heartbeats flow to the server
```

## Architecture

```
Moodle/SEB Page
  └─ <script data-student-id="..." data-exam-id="..." ...>
       ↓ POST /api/heartbeat     ↓ POST /api/paste
  ┌──────────────────────────────────────────────────┐
  │  Deno server (Deno.serve + SQLite WAL)           │
  │  POST /api/heartbeat  → sessions + heartbeats    │
  │  POST /api/paste      → paste_contents           │
  │  GET  /api/paste/:hash → retrieve paste content  │
  │  GET  /health          → health check            │
  └──────────────────────────────────────────────────┘
```

## Moodle Integration

Add this to your SEB exam template:

```html
<script src="https://monitor.university.edu/seb-monitor.js"
  data-student-id="{fullname}"
  data-module-id="{module}"
  data-exam-id="{thisurl}"
  data-server-url="https://monitor.university.edu">
</script>
```

The script auto-discovers itself and reads all config from `data-*` attributes. No hidden DOM elements needed.

### Optional: questionId

- **Automatic**: Moodle quiz URLs with `?slot=3` are parsed automatically
- **Explicit**: Add `data-question-id="q3"` to the script tag

## Project Structure

```
sebMonitoring/
├── client/src/          # Browser-side TypeScript library
│   ├── index.ts         # Entry point — reads script data-attributes
│   ├── accumulator.ts   # Focus time, input stats, key stats
│   ├── collector.ts     # Event buffer
│   ├── heartbeat.ts     # Payload builder
│   ├── sender.ts        # HTTP sender with retry
│   ├── crypto.ts        # SHA-256 hashing
│   └── build.ts         # esbuild config → dist/seb-monitor.js
│
├── server/src/          # Deno backend
│   ├── main.ts          # Entry point (Deno.serve)
│   ├── routes/api.ts    # HTTP handler (heartbeat, paste, health)
│   ├── db/schema.ts     # SQLite migrations
│   ├── db/connection.ts # DB singleton
│   ├── db/sessions.ts   # findOrCreate(studentId, examId)
│   ├── db/heartbeats.ts # Heartbeat storage
│   ├── db/events.ts     # Event storage
│   └── db/paste_contents.ts # Paste content storage
│
├── shared/types.ts      # Types shared between client and server
├── demo/                # Live demo (HTML page + simple server)
└── docs/                # Feature docs + demo scripts
```

## Privacy Rules

- ❌ Never stores answer content
- ❌ Never stores individual keystrokes
- ❌ Never stores clipboard text (only SHA-256 hash)
- ✅ Stores paste content server-side (isolated, behind auth)
- ✅ All other data is behavioral metadata only

## Technology

| Component | Choice | Why |
|---|---|---|
| Runtime | Deno 2.x | Native TypeScript, secure by default |
| HTTP | `Deno.serve()` | Zero dependencies, built-in |
| Database | SQLite (WAL) | Self-contained, no separate DB container |
| Client | TypeScript → IIFE | Single file, no framework, embeddable |
| Testing | Deno built-in test runner | Fast, no config |

## Docker Deployment

### Build the Image

```bash
docker build -t seb-monitor .
```

### Run with Docker Compose

```bash
cp .env.example .env   # configure passwords
docker compose up -d
```

### Run with Docker

```bash
docker run -d \
  --name seb-monitor \
  -p 8000:8000 \
  -v seb-data:/data \
  -e DASHBOARD_PASSWORD=your-secret-password \
  -e COOKIE_SECRET=your-32-char-secret-here \
  seb-monitor
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server listen port |
| `DB_PATH` | `/data/seb-monitor.db` | SQLite database path |
| `DASHBOARD_PASSWORD` | — | Dashboard login password (required for dashboard access) |
| `DASHBOARD_PASSWORD_HASH` | — | Pre-computed PBKDF2 hash (alternative to plaintext password) |
| `COOKIE_SECRET` | `change-me-in-production` | HMAC-SHA256 secret for signing auth cookies |
| `BASE_PATH` | ` ` (empty) | URL prefix when behind a reverse proxy (e.g. `/seb-monitor`) |

### Volumes

| Mount | Description |
|---|---|
| `/data` | SQLite database storage — mount a volume to persist data across container restarts |

### Health Check

The container includes a built-in health check:

```bash
# From host
curl http://localhost:8000/health
# → {"status":"ok"}

# Docker health status
docker inspect --format='{{.State.Health.Status}}' seb-monitor
```

## Configuration

### Server (environment variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server listen port |
| `DB_PATH` | `:memory:` | SQLite database path (use `/data/seb-monitor.db` in Docker) |
| `DASHBOARD_PASSWORD` | — | Dashboard login password |
| `DASHBOARD_PASSWORD_HASH` | — | Pre-computed PBKDF2 hash (alternative) |
| `COOKIE_SECRET` | `change-me-in-production` | Cookie signing secret |
| `BASE_PATH` | ` ` (empty) | URL prefix when behind a reverse proxy (e.g. `/seb-monitor`) |

### Client (script data-attributes)

| Attribute | Required | Description |
|---|---|---|
| `data-student-id` | ✅ | Student identifier |
| `data-exam-id` | ✅ | Exam identifier |
| `data-server-url` | ✅ | Server base URL |
| `data-module-id` | — | Module/course identifier |
| `data-question-id` | — | Question identifier (auto from URL if omitted) |

## License

MIT 

## Reverse Proxy (Apache)

When serving behind Apache at a subpath (e.g. `https://devweb.estia.fr/seb-monitor/`):

**Apache config** (`/etc/apache2/sites-available/your-site-le-ssl.conf`):

```apache
RewriteRule ^/seb-monitor$ /seb-monitor/ [R]
ProxyPass /seb-monitor/ http://localhost:44513/
ProxyPassReverse /seb-monitor/ http://localhost:44513/
```

**Docker Compose** — set `BASE_PATH`:

```yaml
environment:
  - BASE_PATH=/seb-monitor
```

Apache strips the `/seb-monitor/` prefix before forwarding, so the server receives requests at `/api/heartbeat`, `/dashboard`, etc. `BASE_PATH` ensures redirects and cookies point to the correct subpath.
