# Dashboard Routes & Auth Middleware

## What It Does

HTTP routes for the instructor dashboard with cookie-based authentication. All `/dashboard/*` routes are protected — unauthenticated requests are redirected to the login page.

## How to Verify

```bash
cd server && deno test tests/dashboard_test.ts --no-check
```

All 7 tests should pass.

## Routes

### Auth Routes (`routes/auth.ts`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/login` | Show the login form |
| `POST` | `/auth/login` | Verify password, set cookie, redirect to `/dashboard` |

**POST body**: `application/x-www-form-urlencoded` with `password` field.

**On success**: Sets `seb_auth` cookie (HMAC-SHA256 signed, HttpOnly, SameSite=Strict) and redirects to `/dashboard`.

**On failure**: Returns 401 with login page and error message.

### Dashboard Routes (`routes/dashboard.ts`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/dashboard` | Exam overview — shows first exam or empty state |
| `GET` | `/dashboard/:examId` | Student table for a specific exam |
| `GET` | `/dashboard/:examId/student/:sessionId` | Per-student detail view |

All dashboard routes check for a valid `seb_auth` cookie before rendering. Invalid or missing cookies redirect to `/auth/login`.

### Config Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check endpoint |
| `POST` | `/api/heartbeat` | Receive telemetry (unchanged) |
| `POST` | `/api/paste` | Receive paste content (unchanged) |

## Authentication Flow

```
1. User visits /dashboard → no cookie → redirect to /auth/login
2. User enters password → POST /auth/login
3. Server verifies against stored hash (PBKDF2)
4. On success: set signed cookie → redirect to /dashboard
5. On failure: return 401 with error
6. Subsequent requests include cookie → verified via HMAC-SHA256
```

## Environment Variables

| Variable | Description |
|---|---|
| `DASHBOARD_PASSWORD` | Plain-text password (hashed at startup) |
| `DASHBOARD_PASSWORD_HASH` | Pre-computed PBKDF2 hash (alternative) |

One of these must be set. If both are provided, `DASHBOARD_PASSWORD_HASH` takes precedence.

## Spec Reference

- `plan.md` Section 4, Tasks 4.1, 4.9: Auth routes and route wiring
- `vision.md`: Privacy rules — dashboard access requires password authentication
