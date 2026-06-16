# Server Core — Phase 2

## What it does

The server receives telemetry from the SEB monitoring client and stores it in SQLite. It provides:

- **POST /api/heartbeat** — receives heartbeat payloads with focus, input, key stats, and events
- **POST /api/paste** — receives paste content (the only raw text stored)
- **GET /api/paste/:hash** — retrieves stored paste content by SHA-256 hash
- **GET /health** — health check endpoint

## Architecture

```
Client → POST /api/heartbeat → Deno.serve() → findOrCreate(session) → insertHeartbeat + insertEvents → SQLite
Client → POST /api/paste     → Deno.serve() → insertPasteContent → SQLite
```

### Database Tables

| Table | Purpose |
|---|---|
| `sessions` | One row per (student, exam, day) — deduplication key |
| `heartbeats` | One row per heartbeat — focus, input, key stats |
| `events` | One row per discrete event (copy, paste, focus, blur) |
| `paste_contents` | Paste content store — isolated for access control |

### Key Design Decisions

- **SQLite with WAL mode** — self-contained, no external DB, handles 100 concurrent students easily
- **Session deduplication** — `findOrCreate(studentId, examId)` returns same session for same day
- **Paste content isolation** — stored separately from events, idempotent on hash
- **CORS enabled** — allows cross-origin requests from Moodle/SEB

## How to verify

### Run tests

```bash
cd server && deno task test
```

### Start the server

```bash
cd server && deno task dev
```

### Send a test heartbeat

```bash
curl -X POST http://localhost:8000/api/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student-1",
    "examId": "exam-1",
    "questionId": "q1",
    "timestamp": 1700000000000,
    "focus": {"focusedTimeMs": 58000, "unfocusedTimeMs": 2000, "blurCount": 1},
    "input": {"typedChars": 340, "pastedChars": 120, "deletedChars": 25, "currentLength": 435},
    "keys": {"keyDownCount": 890, "ctrlCount": 4, "altCount": 0, "shiftCount": 82},
    "copyCount": 1,
    "pasteCount": 2,
    "events": [
      {"type": "copy", "timestamp": 1700000001000, "hash": "abc123", "length": 50},
      {"type": "paste", "timestamp": 1700000002000, "hash": "def456", "length": 100},
      {"type": "focus", "timestamp": 1700000003000},
      {"type": "blur", "timestamp": 1700000004000}
    ]
  }'
```

Expected response: `{"sessionId": "<uuid>"}`

### Send paste content

```bash
curl -X POST http://localhost:8000/api/paste \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "def456",
    "content": "This is the pasted text content",
    "length": 30,
    "sessionId": "<uuid from heartbeat response>",
    "examId": "exam-1",
    "timestamp": 1700000002000
  }'
```

### Retrieve paste content

```bash
curl http://localhost:8000/api/paste/def456
```

## Known Limitations

- No authentication yet (Phase 4)
- No dashboard UI yet (Phase 4)
- No rate limiting yet (Phase 5)
- File-based SQLite requires `--allow-read --allow-write` permissions

## Spec Reference

- `vision.md` — Server Persistence, Heartbeat Model, Paste Content Storage
- `plan.md` — Section 2.2-2.9, Section 3 (Database Schema), Section 4 (API Endpoints)
