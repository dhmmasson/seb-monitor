# Authentication Service

## What It Does

Provides password-based authentication for the dashboard using PBKDF2 key derivation and HMAC-SHA256 cookie signing. Zero external dependencies — uses Web Crypto API exclusively.

## How to Verify

```bash
cd server && deno test tests/auth_test.ts --no-check
```

All 11 tests should pass.

## API

### `hashPassword(password: string): Promise<string>`

Hashes a password with PBKDF2 (100k iterations, SHA-256, 16-byte random salt). Returns format: `iterations.base64salt.base64hash`.

### `verifyPassword(password: string, storedHash: string): Promise<boolean>`

Verifies a password against a stored hash using constant-time comparison.

### `signCookie(value: string, secret: string): Promise<string>`

Signs a cookie value with HMAC-SHA256. Returns format: `value.base64signature`.

### `verifyCookie(signedValue: string, secret: string): Promise<string | null>`

Verifies a signed cookie. Returns the original value if valid, `null` if tampered.

## Known Limitations

- PBKDF2 with 100k iterations is adequate for a low-traffic dashboard but could be upgraded to Argon2 if a Deno-compatible library is added.
- Cookie signing uses a shared secret from environment config — no key rotation mechanism.

## Spec Reference

- `plan.md` Section 4.2: Dashboard authentication
- `vision.md`: Privacy rules — dashboard access requires password authentication
