# Input Content Snapshot

## What it does

At each heartbeat interval (60s), the client reads the combined content of all answer fields (textareas and contenteditable elements), computes a SHA-256 hash, and:

1. Includes the hash in the heartbeat payload (`inputContentHash` field)
2. Sends the raw content to `POST /api/input-snapshot`

This allows instructors to see exactly what a student had written at each heartbeat interval — a point-in-time snapshot of their contribution, distinct from copy/paste events.

## How to verify it works

### Server-side

```bash
cd server && deno test --no-check
```

Tests verify:
- Heartbeat stores `input_content_hash` in the DB
- `POST /api/input-snapshot` stores content in the `input_snapshots` table
- `GET /api/input-snapshot/:hash/:sessionId` retrieves stored snapshots
- Idempotent insert (same hash + session doesn't create duplicates)
- Student detail view renders expandable content for snapshots

### Client-side

```bash
cd client && deno test --no-check
```

Tests verify:
- Heartbeat builder includes `inputContentHash` when provided
- Heartbeat builder omits it when not provided
- Sender posts to `/api/input-snapshot` endpoint

### Integration

```bash
# Start server
cd server && deno run --allow-net --allow-env src/main.ts

# Open demo page, type some text, wait for heartbeat
# Check DB: sqlite3 /data/seb-monitor.db "SELECT * FROM input_snapshots"
```

## API contract

### POST /api/input-snapshot

Request body:
```json
{
  "hash": "sha256-hash-of-content",
  "content": "The student's full answer text",
  "length": 31,
  "sessionId": "session-uuid",
  "examId": "exam-url",
  "timestamp": 1234567890
}
```

Response: `{ "ok": true }`

### GET /api/input-snapshot/:hash/:sessionId

Response:
```json
{
  "hash": "sha256-hash-of-content",
  "content": "The student's full answer text",
  "length": 31,
  "sessionId": "session-uuid",
  "timestamp": 1234567890,
  "examId": "exam-url"
}
```

## Database schema

New table `input_snapshots`:
```sql
CREATE TABLE input_snapshots (
  hash      TEXT NOT NULL,
  session_id TEXT NOT NULL,
  content   TEXT NOT NULL,
  length    INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  exam_id   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (hash, session_id)
);
```

New column on `heartbeats`:
```sql
ALTER TABLE heartbeats ADD COLUMN input_content_hash TEXT;
```

## Privacy notes

- Content is stored server-side behind dashboard authentication (same protection as paste content)
- Content is never sent in the heartbeat payload itself — only the hash travels in the heartbeat
- Content is only accessible via the dashboard or the authenticated API endpoint

## Dashboard

The student detail view (`/dashboard/:examId/student/:sessionId`) shows:
- A new **Snapshot** column in the events timeline
- Each heartbeat row with a snapshot has an expandable "Show content (N chars)" button
- Clicking reveals the full answer content at that heartbeat interval

## Spec reference

This feature extends the heartbeat model described in `vision.md` Section 3 (Heartbeat Model) with content snapshot capability. It is separate from the copy/paste monitoring described in Sections 4-6.
