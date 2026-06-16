# Derived Metrics Service

## What It Does

Computes aggregated metrics from raw heartbeat, event, and paste content data. Provides per-session metrics and per-exam summaries for the dashboard.

## How to Verify

```bash
cd server && deno test tests/metrics_test.ts --no-check
```

All 9 tests should pass.

## API

### `computeSessionMetrics(db, sessionId): SessionMetrics`

Computes derived metrics for a single session:

| Metric | Description |
|---|---|
| `focusRatio` | `focusedTimeMs / (focusedTimeMs + unfocusedTimeMs)` — 1.0 = 100% focused |
| `pasteRatio` | `pastedChars / (typedChars + pastedChars + deletedChars)` |
| `totalCopyCount` | Sum of `copy_count` across all heartbeats |
| `totalPasteCount` | Sum of `paste_count` across all heartbeats |
| `unmatchedPasteCount` | Count of paste events where `matched_copy_hash IS NULL` |
| `largestPasteLength` | Length of the largest stored paste content |
| `largestPasteHash` | SHA-256 hash of the largest stored paste |

### `computeExamSummary(db, examId): ExamSummaryEntry[]`

Returns all sessions for an exam, each with computed metrics. Used by the exam list view.

## Known Limitations

- `focusRatio` returns 1 when no heartbeats exist (default assumption: student is focused).
- Metrics are computed on every request — no caching layer yet.

## Spec Reference

- `plan.md` Section 4, Task 4.5-4.6: Metrics computation and exam aggregation
