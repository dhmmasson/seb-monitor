# Exam Activity Monitoring — Implementation Plan

> Derived from `vision.md`. This plan covers architecture decisions, project structure, and phased implementation tasks.

---

## 1. Architecture Decisions

### 1.1 Client Library

| Aspect | Decision |
|---|---|
| **Language** | TypeScript |
| **Build target** | Single self-contained IIFE JS file (no runtime dependencies) |
| **Bundler** | esbuild (fast, produces minimal bundles, trivial TS→JS) |
| **Embedding** | `<script src="…/seb-monitor.js"></script>` — same pattern as the colleague's `moodle.js` |
| **Runtime** | Pure browser APIs — no framework, no polyfills needed (SEB is Chromium-based) |
| **Data source** | Reads `data-student-id`, `data-exam-id`, `data-server-url`, `data-question-id` from the `<script>` tag's own `data-*` attributes (see vision.md D1) |

**Why a single IIFE file?**
The colleague's `moodle.js` is loaded as a plain `<script>` tag inside Moodle's Safe Exam Browser page. The monitoring script must follow the same injection pattern: no module bundler at runtime, no import maps, no npm packages in the browser. An IIFE ensures all code is self-contained and doesn't pollute the global scope.

### 1.2 Server

| Aspect | Decision |
|---|---|
| **Runtime** | Deno 2.x (already the project's declared runtime) |
| **HTTP framework** | `Deno.serve()` — built-in, zero dependencies (see vision.md D3). Replaced Oak during Phase 2 implementation. |
| **Containerization** | Single-stage Dockerfile → distroless or Alpine image |
| **Deployment** | `docker run` or `docker compose up` — single container, single port |
| **Process model** | Single process, no external workers needed |

**Why Deno in Docker?**
Deno compiles to a single executable via `deno compile`, or runs directly from source with cached deps. A Dockerfile based on `denoland/deno:alpine` produces a small (~50 MB) self-contained image. No Node.js, no npm, no build step on the server.

### 1.3 Database

| Aspect | Decision |
|---|---|
| **Engine** | SQLite (via `deno.land/x/sqlite` v3.9.1 — NOT `deno:sqlite` which requires special permissions) |
| **Mode** | WAL (Write-Ahead Logging) for concurrent read/write |
| **Storage** | File-based (`/data/seb-monitor.db`) mounted as a Docker volume |
| **Migrations** | Simple migration files applied at startup |

**Why SQLite?**
- **Self-contained**: No separate database container needed — keeps the Docker deployment to a single container.
- **Performance**: For a university exam (20–100 concurrent students, heartbeats every 60s), SQLite with WAL handles ~100 writes/second easily.
- **Portability**: The `.db` file is the entire database — trivial to backup, copy, or inspect.
- **Trade-off**: If the system later needs to scale to hundreds of simultaneous exams across multiple servers, PostgreSQL would be the migration path. But for the current scope, SQLite is the right choice.

### 1.4 Dashboard UI

| Aspect | Decision |
|---|---|
| **Rendering** | Server-side rendered (SSR) HTML — no SPA framework needed |
| **Styling** | Minimal CSS, possibly Tailwind via CDN or plain styles |
| **Charts** | Lightweight chart library (Chart.js or uPlot) loaded from a CDN or bundled |
| **Authentication** | Single shared password (configurable via env var), stored as a bcrypt hash |
| **URL scheme** | `/dashboard/{uuid}` — each exam gets a unique unguessable URL |
| **Session management** | Signed cookie after password entry, short TTL |

**Why SSR over SPA?**
The dashboard is read-only and low-traffic (instructors checking during/after exams). SSR avoids build complexity, works without JavaScript for the table view, and keeps the server self-contained. Charts degrade gracefully.

---

## 2. Project Structure

```
sebMonitoring/
├── vision.md                    # Original specification
├── plan.md                      # This file
│
├── client/                      # Browser-side monitoring library
│   ├── src/
│   │   ├── index.ts             # Entry point — IIFE wrapper
│   │   ├── collector.ts         # Event listeners (copy, paste, focus, keys)
│   │   ├── heartbeat.ts         # Heartbeat timer + payload construction
│   │   ├── crypto.ts            # SHA-256 hashing (Web Crypto API)
│   │   ├── accumulator.ts       # Focus time, input stats, key stats
│   │   └── sender.ts            # fetch() wrapper with retry + offline buffer
│   ├── build.ts                 # esbuild build script
│   ├── deno.json                # Deno config for type-checking client code
│   └── README.md                # Integration instructions for Moodle
│
├── server/                      # Deno backend
│   ├── src/
│   │   ├── main.ts              # Entry point — starts HTTP server
│   │   ├── config.ts            # Env vars, defaults
│   │   ├── db/
│   │   │   ├── schema.ts        # Table definitions + migrations
│   │   │   ├── connection.ts    # SQLite connection singleton
│   │   │   ├── sessions.ts      # Session CRUD
│   │   │   ├── heartbeats.ts    # Heartbeat inserts + queries
│   │   │   └── events.ts        # Event inserts + queries
│   │   ├── routes/
│   │   │   ├── api.ts           # POST /api/heartbeat — receives telemetry
│   │   │   ├── paste.ts         # POST /api/paste — receives paste content
│   │   │   ├── dashboard.ts     # GET /dashboard/* — SSR pages
│   │   │   └── auth.ts          # POST /auth/login — password check
│   │   ├── services/
│   │   │   ├── session.ts       # Session creation/lookup logic
│   │   │   ├── metrics.ts       # Derived metric computation
│   │   │   └── exam.ts          # Exam-level aggregation
│   │   └── views/
│   │       ├── layout.ts        # HTML layout wrapper
│   │       ├── login.ts         # Password entry page
│   │       ├── exam-list.ts     # Table of students for an exam
│   │       └── student-detail.ts # Per-student graphs + timeline
│   ├── deno.json                # Deno config + import map
│   ├── Dockerfile               # Multi-stage build → distroless
│   ├── docker-compose.yml       # Single-service compose file
│   └── tests/
│       ├── api_test.ts
│       ├── metrics_test.ts
│       └── db_test.ts
│
└── shared/                      # Types shared between client and server
    └── types.ts                 # HeartbeatPayload, ExamEvent, etc.
```

---

## 3. Database Schema

```sql
-- Enable WAL mode for concurrent access
PRAGMA journal_mode = WAL;

-- One row per (student, exam, day) combination
CREATE TABLE sessions (
    session_id    TEXT PRIMARY KEY,          -- UUID, server-generated
    student_id    TEXT NOT NULL,
    exam_id       TEXT NOT NULL,
    start_time    INTEGER NOT NULL,          -- Unix epoch ms
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_exam ON sessions(exam_id);
CREATE INDEX idx_sessions_student ON sessions(student_id);

-- One row per heartbeat received
CREATE TABLE heartbeats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    timestamp       INTEGER NOT NULL,
    question_id     TEXT NOT NULL DEFAULT 'default',  -- Added in v0.3.0

    -- Focus metrics
    focused_time_ms   INTEGER NOT NULL DEFAULT 0,
    unfocused_time_ms INTEGER NOT NULL DEFAULT 0,
    blur_count        INTEGER NOT NULL DEFAULT 0,

    -- Input stats
    typed_chars     INTEGER NOT NULL DEFAULT 0,
    pasted_chars    INTEGER NOT NULL DEFAULT 0,
    deleted_chars   INTEGER NOT NULL DEFAULT 0,
    current_length  INTEGER NOT NULL DEFAULT 0,

    -- Copy/paste counts
    copy_count      INTEGER NOT NULL DEFAULT 0,
    paste_count     INTEGER NOT NULL DEFAULT 0,

    -- Key stats
    key_down_count  INTEGER NOT NULL DEFAULT 0,
    ctrl_count      INTEGER NOT NULL DEFAULT 0,
    alt_count       INTEGER NOT NULL DEFAULT 0,
    shift_count     INTEGER NOT NULL DEFAULT 0,

    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_heartbeats_session ON heartbeats(session_id);
CREATE INDEX idx_heartbeats_timestamp ON heartbeats(timestamp);

-- One row per discrete event (copy, paste, focus, blur)
CREATE TABLE events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    timestamp       INTEGER NOT NULL,
    type            TEXT NOT NULL,            -- 'copy' | 'paste' | 'focus' | 'blur'

    -- Copy/paste fields (NULL for focus events)
    hash            TEXT,
    length          INTEGER,
    matched_copy_hash TEXT,

    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_type ON events(type);

-- Paste content store (most sensitive data — isolated for access control + retention)
-- NOTE: No FK on session_id — paste arrives immediately, may precede session creation (see vision.md D4)
CREATE TABLE IF NOT EXISTS paste_contents (
    hash            TEXT PRIMARY KEY,         -- SHA-256 of pasted text (dedup key)
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    content         TEXT NOT NULL,            -- The actual pasted text
    length          INTEGER NOT NULL,         -- Character count
    timestamp       INTEGER NOT NULL,         -- When the paste occurred
    exam_id         TEXT NOT NULL,            -- Denormalized for query convenience
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_paste_contents_session ON paste_contents(session_id);
CREATE INDEX idx_paste_contents_exam ON paste_contents(exam_id);
```

---

## 4. API Endpoints

### 4.1 Data Ingestion

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/heartbeat` | Receive a heartbeat payload from the client |

**Request body**: `HeartbeatPayload` (as defined in `vision.md`)

**Server-side logic**:
1. Validate payload structure
2. Look up or create session for `(studentId, examId, today)`
3. Insert heartbeat row
4. Insert event rows from `events[]` array
5. Return `200 OK` with `{ sessionId }` (client stores this for retry correlation)

### 4.1b Paste Content Ingestion

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/paste` | Receive paste content from the client (called immediately on paste, not during heartbeat) |

**Request body**: `PasteContentRequest` (hash, content, length, sessionId, examId, timestamp)

**Server-side logic**:
1. Validate payload
2. If hash already exists → skip (idempotent, content is identical)
3. If hash is new → insert into `paste_contents` table
4. Return `200 OK`

**Why a separate endpoint?** Paste content is the most sensitive data stored. Isolating it from heartbeats ensures: lost heartbeats don't lose paste evidence, independent retention policies, auditable access control.

### 4.1c Paste Content Retrieval (Dashboard)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/paste/{hash}` | Retrieve paste content by hash (requires dashboard auth) |

**Response**: `{ hash, content, length, sessionId, timestamp }`

### 4.2 Dashboard

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard/{examUuid}` | Exam overview — table of all students |
| `GET` | `/dashboard/{examUuid}/student/{sessionId}` | Per-student detailed view |
| `POST` | `/auth/login` | Authenticate with password, set cookie |
| `GET` | `/auth/login` | Show login form |

---

## 5. Implementation Phases

### Phase 1 — Client Library (MVP) ✅ COMPLETE (v0.1.0)

**Goal**: A working `seb-monitor.js` that captures events and sends heartbeats.

| # | Task | Details |
|---|---|---|
| 1.1 | Scaffold `client/` directory | `deno.json`, `build.ts` with esbuild, entry point |
| 1.2 | Implement `crypto.ts` | SHA-256 hashing via Web Crypto API (`SubtleCrypto`) |
| 1.3 | Implement `accumulator.ts` | Focus time accumulator (polls `document.visibilityState` every 1s), input stats tracker, key stats counter |
| 1.4 | Implement `collector.ts` | Attach `copy`, `paste`, `focus`, `blur`, `keydown`, `input` event listeners; maintain event buffer; on paste: immediately send content to `POST /api/paste` (fire-and-forget with retry) |
| 1.5 | Implement `heartbeat.ts` | 60-second interval timer; builds `HeartbeatPayload` from accumulators + event buffer; resets after send |
| 1.6 | Implement `sender.ts` | `fetch()` with retry (3 attempts, exponential backoff); offline buffering in `localStorage` |
| 1.7 | Wire entry point as IIFE | Self-executing function that reads DOM IDs, initializes collectors, starts heartbeat |
| 1.8 | Build script | `deno run -A client/build.ts` → outputs `dist/seb-monitor.js` (single file, minified) |
| 1.9 | Manual testing | Load in browser, verify console output, test copy/paste/focus events |

**Deliverable**: `dist/seb-monitor.js` — a single ~15 KB file ready to embed.

### Phase 2 — Server Core ✅ COMPLETE (v0.2.0 + v0.3.0)

**Goal**: A running Deno server that receives and stores heartbeats.

| # | Task | Details |
|---|---|---|
| 2.1 | Scaffold `server/` directory | `deno.json` with import map (oak, deno:sqlite) |
| 2.2 | Implement `db/schema.ts` | SQL migration runner — creates tables on first boot |
| 2.3 | Implement `db/connection.ts` | SQLite connection singleton with WAL mode |
| 2.4 | Implement `db/sessions.ts` | `findOrCreate(studentId, examId)` → returns `sessionId` |
| 2.5 | Implement `db/heartbeats.ts` | `insertHeartbeat(sessionId, payload)` |
| 2.6 | Implement `db/events.ts` | `insertEvents(sessionId, events[])` |
| 2.6b | Implement `db/paste_contents.ts` | `insertPasteContent(hash, content, sessionId, examId, timestamp)` + `getPasteContent(hash)` |
| 2.7 | Implement `routes/api.ts` | `POST /api/heartbeat` route — validates, persists, returns `sessionId` |
| 2.7b | Implement `routes/paste.ts` | `POST /api/paste` route — receives paste content, stores in `paste_contents`; `GET /api/paste/{hash}` — retrieves paste content (auth-protected) |
| 2.8 | Implement `main.ts` | Boots server on configurable port (default 8000) |
| 2.9 | Write integration tests | Test full heartbeat flow: send payload → verify DB rows |

**Deliverable**: Server that accepts heartbeats and stores them in SQLite.

### Phase 3 — Dockerization

**Goal**: Self-contained Docker image.

| # | Task | Details |
|---|---|---|
| 3.1 | Write `Dockerfile` | Multi-stage: build client → copy into Deno Alpine image |
| 3.2 | Write `docker-compose.yml` | Single service, volume mount for `/data`, port mapping |
| 3.3 | Config via env vars | `PORT`, `DB_PATH`, `DASHBOARD_PASSWORD`, `DASHBOARD_PASSWORD_HASH` |
| 3.4 | Health check endpoint | `GET /health` → `200 OK` |
| 3.5 | Graceful shutdown | Handle SIGTERM, close DB connection |
| 3.6 | Test Docker build | `docker build -t seb-monitor . && docker run -p 8000:8000 seb-monitor` |

**Deliverable**: `docker run seb-monitor` starts everything — client JS served at `/seb-monitor.js`, API at `/api/*`, dashboard at `/dashboard/*`.

### Phase 4 — Dashboard UI

**Goal**: Instructor-facing dashboard behind password authentication.

| # | Task | Details |
|---|---|---|
| 4.1 | Implement `routes/auth.ts` | Login page (SSR form), password verification (bcrypt), signed cookie |
| 4.2 | Implement `views/layout.ts` | HTML shell with `<head>`, nav, content slot |
| 4.3 | Implement `views/login.ts` | Simple password form |
| 4.4 | Implement `views/exam-list.ts` | **Exam overview page**: table with columns — Student ID, Focus Ratio, Paste Ratio, Total Events, Copy Count, Paste Count, Activity Timeline sparkline |
| 4.5 | Implement `services/metrics.ts` | Compute derived metrics from heartbeats: focus ratio, paste ratio, unmatched paste count, largest paste, largest text growth |
| 4.6 | Implement `services/exam.ts` | Aggregate per-exam: list all sessions, compute metrics per student |
| 4.7 | Implement `views/student-detail.ts` | **Per-student page**: charts — focus over time, input activity over time, key activity, copy/paste event timeline with **clickable paste hashes** that expand to show pasted content, raw event table |
| 4.7b | Implement paste content display | In student detail view, paste events with stored content show a toggle/expand to reveal the actual pasted text; unmatched pastes are highlighted |
| 4.8 | Integrate chart library | uPlot (tiny, fast) or Chart.js — bundled or CDN-loaded in the detail view |
| 4.9 | Route wiring | Protect `/dashboard/*` routes with auth middleware |
| 4.10 | UUID exam mapping | Generate UUID per exam on first heartbeat; instructor accesses `/dashboard/{uuid}` |

**Deliverable**: Functional dashboard — login → exam table → student detail with charts.

### Phase 5 — Resilience & Polish

**Goal**: Production hardening.

| # | Task | Details |
|---|---|---|
| 5.1 | Client offline buffer | Store unsent heartbeats in `localStorage`; replay on reconnect |
| 5.2 | Client retry with backoff | 3 retries with 1s/2s/4s delays before buffering |
| 5.3 | Server rate limiting | Basic rate limit per IP on `/api/heartbeat` |
| 5.4 | Data retention policy | Auto-delete data older than N days (configurable); paste content uses `PASTE_CONTENT_RETENTION_DAYS` (separate, more aggressive) |
| 5.5 | Exam end detection | Mark exam as "completed" when no heartbeats received for 10 min |
| 5.6 | Cross-student paste detection | Server-side query: find paste hashes matching copies from other sessions |
| 5.7 | Export functionality | `GET /dashboard/{examUuid}/export.csv` — download metrics as CSV |
| 5.8 | Client error reporting | Capture unhandled errors, include in next heartbeat |
| 5.9 | Logging | Structured JSON logs for debugging |

### Phase 6 — Moodle Integration & Deployment

**Goal**: Deploy alongside Moodle in SEB.

| # | Task | Details |
|---|---|---|
| 6.1 | Moodle HTML template | Add `<script>` tag with `data-*` attributes to SEB exam template |
| 6.2 | Verify DOM reader | Client auto-discovers script via `querySelector("script[data-student-id]")` — no hidden DOM elements needed |
| 6.3 | CORS configuration | If client and server are on different origins, configure CORS headers |
| 6.4 | HTTPS setup | Ensure server is behind a reverse proxy (nginx/Apache) with TLS |
| 6.5 | Load test | Simulate 50 concurrent students sending heartbeats |
| 6.6 | Documentation | Write `README.md` with setup, configuration, and deployment instructions |

---

## 6. Configuration

All configuration via environment variables (with defaults):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server listen port |
| `DB_PATH` | `/data/seb-monitor.db` | SQLite database file path |
| `DASHBOARD_PASSWORD` | *(required)* | Plain-text password for dashboard (hashed at startup) |
| `DASHBOARD_PASSWORD_HASH` | — | Pre-computed bcrypt hash (alternative to plain text) |
| `HEARTBEAT_INTERVAL_MS` | `60000` | Client heartbeat interval |
| `DATA_RETENTION_DAYS` | `90` | Auto-delete data older than this |
| `PASTE_CONTENT_RETENTION_DAYS` | `30` | Auto-delete stored paste content older than this (more aggressive than heartbeat data) |
| `CORS_ORIGIN` | `*` | Allowed origins for API requests |
| `LOG_LEVEL` | `info` | Logging verbosity |

---

## 7. Open Questions to Resolve

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | **Client: where is the `questionId` set?** | Hardcoded in script / CSS class / data attribute | ✅ **RESOLVED**: `data-question-id` attribute on `<script>` tag, with automatic fallback to Moodle `slot` URL param (see vision.md D2) |
| Q2 | **Server: Deno compile vs. source?** | `deno compile` → single binary in Docker / `deno run` in Docker | `deno run` with cached deps — simpler, smaller image, debuggable |
| Q3 | **Dashboard: one password for all exams?** | Single password / per-exam passwords / SSO | Single password initially; per-exam passwords if needed later |
| Q4 | **Client: what DOM elements contain answer fields?** | Moodle textareas / rich text editors / specific CSS selectors | Need to inspect the actual SEB exam page to identify `textarea`, `div[contenteditable]`, or Moodle-specific selectors |
| Q5 | **Server: should the client JS be served by this server or by Moodle?** | Served by this server (CORS) / copied into Moodle's static files | Served by this server is cleaner — single deployment, auto-versioned |
| Q6 | **Persistence: SQLite file location in production?** | Docker volume / host bind mount / embedded | Docker named volume for simplicity; bind mount for easy backup |
| Q7 | **Paste content retention: how long to keep stored paste text?** | Same as other data / shorter / longer / until manual deletion | Shorter than heartbeat data (e.g., 30 days) since it's the most sensitive; or keep until instructor explicitly clears an exam |

---

## 8. Estimated Effort

| Phase | Estimated Time | Priority |
|---|---|---|
| Phase 1 — Client Library | 2–3 days | 🔴 Must have |
| Phase 2 — Server Core | 3–4 days | 🔴 Must have |
| Phase 3 — Dockerization | 0.5–1 day | 🔴 Must have |
| Phase 4 — Dashboard UI | 2–3 days | 🔴 Must have |
| Phase 5 — Resilience & Polish | 2–3 days | 🟡 Should have |
| Phase 6 — Moodle Integration | 1–2 days | 🟡 Should have |
| **Total** | **11–17 days** | — |

---

## 9. Dependencies

### Client
| Package | Purpose | Bundle size impact |
|---|---|---|
| *(none)* | Pure Web Crypto + DOM APIs | 0 KB |

### Server
| Package | Purpose | Source |
|---|---|---|
| `oak` | HTTP framework | deno.land/x/oak |
| `deno:sqlite` | SQLite bindings | JSR |
| `bcrypt` | Password hashing | deno.land/x/bcrypt |

### Build
| Tool | Purpose |
|---|---|
| `esbuild` | TypeScript → single JS bundle (client) |
| `Docker` | Containerization (server) |

---

## 10. Future Considerations (Out of Scope)

- **Real-time dashboard updates** via WebSocket (polling is sufficient for v1)
- **Multi-exam dashboard** — aggregate across exams for a course
- **LMS integration API** — push metrics back into Moodle gradebook
- **Anomaly detection** — statistical flagging of unusual patterns
- **Per-question metrics** — if `questionId` tracking is implemented
