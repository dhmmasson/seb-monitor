# Exam Index Page

## What It Does

Renders a table of all exams at `/dashboard`, showing each exam's ID and student count. Each exam links to its detail page (`/dashboard/:examId`). This replaces the previous behavior where `/dashboard` only showed the first exam.

## How to Verify

```bash
cd server && deno test tests/exam_index_test.ts --no-check
```

All 6 tests should pass.

## Behavior

- **With data**: Shows a table with columns "Exam" and "Students". Each exam ID links to `/dashboard/:examId`.
- **Without data**: Shows "No exams found. Send some heartbeats first!"
- **Multiple exams**: All unique exam IDs from the `sessions` table are listed, grouped and ordered alphabetically.

## Route

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard` | Exam index — lists all exams |
| `GET` | `/dashboard/:examId` | Student table for a specific exam |
| `GET` | `/dashboard/:examId/student/:sessionId` | Per-student detail |

## Spec Reference

- `plan.md` Section 4, Task 4.4: Exam overview page
