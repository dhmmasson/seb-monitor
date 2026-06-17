# Clipboard Content Capture

## What it does

Unified storage for both copy and paste content in exam monitoring. Both copy events (student copies text) and paste events (student pastes text) store raw content in a single `paste_contents` table with an `event_type` column to distinguish them.

## How it works

### Database Schema

The `paste_contents` table uses a composite primary key `(hash, session_id, event_type)`:

- **hash**: SHA-256 of the content (for quick matching)
- **session_id**: Which student session this event belongs to
- **event_type**: Either `"copy"` or `"paste"`

This allows:
- Same content hash stored for both copy and paste events
- Same content used by different students (cross-session tracking)
- Deduplication within the same session and event type

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/clipboard` | POST | Store copy or paste content |
| `GET /api/clipboard/:hash` | GET | Retrieve all events for a hash |

### Client Behavior

1. **On copy**: Client computes SHA-256 hash, stores content via `POST /api/clipboard` with `eventType: "copy"`
2. **On paste**: Client computes SHA-256 hash, stores content via `POST /api/clipboard` with `eventType: "paste"`
3. **Matching**: Client tracks copy hashes in a bounded Set (max 100) for immediate paste matching

## How to verify

### Test the API

```bash
# Start the server
cd server && deno run --allow-net --allow-env src/main.ts &

# Store a copy event
curl -X POST http://localhost:8000/api/clipboard \
  -H "Content-Type: application/json" \
  -d '{"hash":"abc123","content":"Copied text","length":12,"sessionId":"test","examId":"exam-1","timestamp":1000,"eventType":"copy"}'

# Store a paste event with same hash
curl -X POST http://localhost:8000/api/clipboard \
  -H "Content-Type: application/json" \
  -d '{"hash":"abc123","content":"Copied text","length":12,"sessionId":"test","examId":"exam-1","timestamp":2000,"eventType":"paste"}'

# Retrieve all events for this hash
curl http://localhost:8000/api/clipboard/abc123
# Returns: [{"hash":"abc123","eventType":"copy",...},{"hash":"abc123","eventType":"paste",...}]
```

### Run tests

```bash
cd server && deno test --no-check tests/db_test.ts
# Should pass 31 tests including:
# - event_type column exists
# - event_type defaults to paste
# - can insert with event_type copy
# - can insert with event_type paste
# - getAllClipboardContent returns all rows for a hash
# - getHashUsageStats aggregates correctly
```

## Known limitations

1. **Idempotency**: `INSERT OR IGNORE` means same hash + same session + same event_type is stored only once
2. **Bounded client cache**: Copy hash tracking limited to 100 entries (oldest evicted)
3. **No auth on API**: `GET /api/clipboard/:hash` has no auth (dashboard-only restriction not enforced)

## Related spec sections

- `vision.md` — Copy/Paste Monitoring section
- `plan.md` — Section 4.1b (Paste Content Ingestion)
