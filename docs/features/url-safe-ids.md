# URL-Safe Exam ID Encoding

## What It Does

Exam IDs can be full URLs (e.g. `https://moodle.example.com/exam/123`) which contain slashes, colons, and other characters that break URL routing. This module encodes them into URL-safe base64url segments (RFC 4648 §5) for use in dashboard routes.

## How to Verify

```bash
cd server && deno test tests/url_ids_test.ts --no-check
```

All 12 tests should pass.

## API

### `encodeExamId(examId: string): string`

Encodes any exam ID string into a URL-safe segment using base64url (no padding). Output only contains `[a-zA-Z0-9-_]`.

```
"https://moodle.example.com/exam/123" → "aHR0cHM6Ly9tb29kbGUuZXhhbXBsZS5jb20vZXhhbS8xMjM"
"CS101-Midterm" → "Q1MxMDEtTWlkdGVybQ"
```

### `decodeExamId(encoded: string): string`

Decodes a base64url segment back to the original string. If the input is not valid base64url, returns it unchanged (graceful fallback for plain strings like "CS101-Midterm").

## Usage in Routes

All dashboard views use `encodeExamId()` when generating links, and the dashboard route handler uses `decodeExamId()` when matching URL segments:

- `exam-index.ts` → links: `/dashboard/{encoded}`
- `exam-list.ts` → links: `/dashboard/{encoded}/student/{sessionId}`
- `student-detail.ts` → back link: `/dashboard/{encoded}`
- `dashboard.ts` → decodes before querying the database

## Spec Reference

- Fix for URL routing when exam IDs are full Moodle URLs
