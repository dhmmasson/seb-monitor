# SEB Monitor Demo

This demo shows the SEB monitoring client in action. It includes:
- An HTML page that simulates a Moodle exam environment
- A Deno server that receives and displays heartbeats and paste content

## Quick Start

### 1. Start the Demo Server

```bash
cd /Users/dimitri/Documents/workspace2/enseignement/tools/sebMonitoring
deno run --allow-net demo/server.ts
```

The server will start on `http://localhost:8000`.

### 2. Open the Demo Page

Open `demo/index.html` in your browser (or use VS Code's Live Server extension).

### 3. Use the Demo

1. **Click "Start Monitoring"** to begin collecting events
2. **Type in the answer field** - keystrokes are tracked
3. **Copy text** from anywhere - copy events are captured
4. **Paste text** into the answer field - paste events are sent immediately
5. **Switch tabs/windows** - focus/blur events are tracked
6. **Watch the event log** - all events appear in real-time
7. **Heartbeats** are sent every 10 seconds (demo mode) or click "Send Heartbeat Now"

## What's Being Tracked

| Event | What's Captured |
|-------|-----------------|
| **Focus/Blur** | When the page gains/loses focus |
| **Copy** | SHA-256 hash of copied text, length |
| **Paste** | SHA-256 hash, length, content (sent separately) |
| **Input** | Characters typed, pasted, deleted |
| **Keys** | Total keydowns, Ctrl/Alt/Shift counts |

## Privacy Notes

- **No raw text** is stored in heartbeats
- **Copy content** is stored as SHA-256 hash only
- **Paste content** is sent separately via `/api/paste` endpoint
- **No individual keystrokes** are recorded - only aggregate counts

## Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/heartbeat` | Receive heartbeat payloads |
| `POST` | `/api/paste` | Receive paste content |
| `GET` | `/api/logs` | View all received messages (JSON) |
| `GET` | `/` | Server status page |

## Files

- `demo/index.html` - The demo HTML page
- `demo/server.ts` - The Deno server that receives messages
- `demo/README.md` - This file

## Next Steps

This demo uses inline JavaScript for simplicity. In production, the client library would be:
1. Built using `deno run -A client/build.ts`
2. Output to `dist/seb-monitor.js`
3. Embedded via `<script src="…/seb-monitor.js"></script>`

See `docs/features/build.md` for build configuration details.
