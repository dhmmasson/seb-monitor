# Dashboard Views (Layout, Login, Exam List)

## What It Does

Server-side rendered HTML views for the instructor dashboard. Uses no JavaScript framework — pure string templates with embedded CSS.

## How to Verify

```bash
cd server && deno test tests/views_test.ts --no-check
```

All 10 tests should pass.

## Views

### `renderLayout(title, content): string`

Wraps any content in a full HTML document with `<head>`, viewport meta, embedded CSS, navigation bar, and container. All other views compose inside this layout.

### `renderLoginPage(error?): string`

Renders a password entry form. Shows an optional error message (HTML-escaped). Submits `POST /auth/login`.

### `renderExamList(examId, students[]): string`

Renders a table of all students for an exam with columns:
- Student ID (links to detail page)
- Focus Ratio (color-coded badge: ≥90% green, ≥50% yellow, <50% red)
- Paste Ratio (color-coded badge: ≤20% green, ≤50% yellow, >50% red)
- Copy/Paste/Unmatched counts
- Largest paste length

Shows "No students found" when the list is empty.

## Security

- All user-generated content is escaped via `escapeHtml()` from `views/utils.ts` to prevent XSS.

## Spec Reference

- `plan.md` Section 4, Tasks 4.2-4.4: Layout shell, login form, exam list view
