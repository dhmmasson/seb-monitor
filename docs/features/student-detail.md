# Student Detail View

## What It Does

Per-student dashboard page showing detailed monitoring data: metric summary cards, an interactive activity timeline chart (Chart.js), and a full event table with expandable paste content.

## How to Verify

```bash
cd server && deno test tests/student_detail_test.ts --no-check
```

All 7 tests should pass.

## Features

### Metric Summary Cards

Six cards showing at a glance:
- Focus Ratio (%) — color-coded badge
- Paste Ratio (%) — color-coded badge
- Total Copy Count
- Total Paste Count
- Unmatched Paste Count
- Largest Paste Length

### Activity Timeline Chart

Chart.js line chart with dual Y-axes:
- **Left axis**: Focus % per heartbeat (0–100%)
- **Right axis**: Typed chars and pasted chars per heartbeat

Shows trend over time. Only rendered when heartbeats exist.

### Events Table

All discrete events (copy, paste, focus, blur) in chronological order with:
- Event type
- Timestamp
- Hash (truncated to 12 chars + ellipsis)
- Length
- Content (for paste events)

**Paste content expand**: Click "Show content" to toggle the actual pasted text inline. Only shown for paste events that have stored content.

**Unmatched paste highlighting**: Rows where `matched_copy_hash IS NULL` get a yellow background highlight.

## Known Limitations

- Chart.js is loaded from CDN — requires internet access on the client.
- No pagination for events tables with many rows (acceptable for exam duration).
- Paste content is rendered inline in the HTML — very large pastes could affect page size.

## Spec Reference

- `plan.md` Section 4, Tasks 4.7-4.7b: Student detail view with charts and paste content display
