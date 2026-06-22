# CSV Export — Student Event Log Download

## What it does

Downloads a CSV file containing the complete event timeline for a student session. The CSV merges all discrete events (copy, paste, focus, blur) and periodic heartbeats into a single unified timeline sorted by timestamp.

## How to verify it works

1. Start the server: `cd server && deno task dev`
2. Log in to the dashboard
3. Navigate to a student detail page
4. Click the **📥 Download CSV** button
5. Open the downloaded CSV in a spreadsheet application

## CSV Format

```
type,time,hash,length,focus,content
copy,2024-01-15T10:30:00.000Z,abc123...,10,,"(copy)"
paste,2024-01-15T10:31:00.000Z,def456...,200,,"Pasted text here..."
focus,2024-01-15T10:32:00.000Z,,,
heartbeat,2024-01-15T10:35:00.000Z,ghi789...,140,83%,"Full input content..."
blur,2024-01-15T10:36:00.000Z,,,
```

### Column definitions

| Column | Description |
|---|---|
| `type` | Event type: `copy`, `paste`, `focus`, `blur`, or `heartbeat` |
| `time` | ISO 8601 timestamp of the event |
| `hash` | SHA-256 hash for copy/paste events and heartbeats (input content hash) |
| `length` | Character length of copied/pasted text, or input content length for heartbeats |
| `focus` | Focus percentage for heartbeat rows (e.g., `83%`), empty for event rows |
| `content` | Paste content for paste events, snapshot content for heartbeats, `(copy)` for copy events, empty for focus/blur |

### Content escaping

CSV fields are properly escaped per RFC 4180:
- Fields containing commas, quotes, or newlines are wrapped in double quotes
- Internal double quotes are escaped by doubling them

## API Contract

```
GET /dashboard/{examId}/student/{sessionId}/export.csv
```

- **Auth**: Requires `seb_auth` cookie (same as other dashboard routes)
- **Response**: `text/csv; charset=utf-8` with `Content-Disposition: attachment`
- **Filename**: `{sessionId}-events.csv`

## Implementation

- `server/src/services/csv-export.ts` — `buildCsvTimeline(db, sessionId)` generates the CSV
- `server/src/routes/dashboard.ts` — route handler for `/export.csv`
- `server/src/routes/utils.ts` — `csv()` response helper
- `server/src/views/student-detail.ts` — download button in the student detail page

## Known limitations

- No streaming — the entire CSV is built in memory before sending. For very long sessions this could be slow, but in practice exam sessions produce manageable amounts of data.
- The filename uses the raw session UUID. A more user-friendly filename (e.g., student name) could be added later.

## Spec reference

This feature corresponds to Phase 5, Task 5.7 in `plan.md`: "Export functionality — download metrics as CSV."
