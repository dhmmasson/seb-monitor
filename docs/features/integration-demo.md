# Phase 1+2+4 Integration Demo

## What It Does

End-to-end demo that exercises the full SEB Monitor stack:
- **Phase 1**: Client library payload format (heartbeats + paste content)
- **Phase 2**: Server core (API ingestion, SQLite storage, paste content storage)
- **Phase 4**: Dashboard (authentication, exam list, student detail with paste viewer)

## How to Run

```bash
cd sebMonitoring
bash docs/demos/phase1-2-4-demo.sh
```

The script:
1. Starts the real server with a temp SQLite database
2. Sends heartbeats from 3 students (Alice, Bob, Charlie)
3. Sends paste content for Bob's external copies
4. Tests dashboard authentication (redirect, login, cookie)
5. Verifies dashboard pages render correctly (exam list, student detail)
6. Keeps the server running so you can open the dashboard in a browser

## What to Look For

### In the terminal output:
- All heartbeat responses return `sessionId`
- Paste content storage returns `{ ok: true }`
- Unauthenticated dashboard returns 302 redirect
- Login with correct password sets cookie and redirects
- Dashboard HTML contains all 3 student names

### In the browser (after the demo starts):
- `http://localhost:8000/dashboard` — exam table with 3 students
- Click Bob → student detail with Chart.js timeline, paste content expand, unmatched paste highlighting
- Click Alice → student detail with clean activity (no paste issues)

## Students Simulated

| Student | Behavior | Focus % | Paste % | Unmatched Pastes |
|---|---|---|---|---|
| Alice Martin | Focused, typed answer | 92% | 0% | 0 |
| Bob Dupont | Suspicious, external paste | 67% | 88% | 1 |
| Charlie Ng | Normal, focused | 97% | 0% | 0 |

## Spec Reference

- `plan.md` Phase 1: Client Library
- `plan.md` Phase 2: Server Core
- `plan.md` Phase 4: Dashboard UI
