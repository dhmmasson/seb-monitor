/**
 * Authentication services — password hashing (PBKDF2) and cookie signing (HMAC-SHA256).
 * Uses Web Crypto API — zero external dependencies.
 */

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;
const PBKDF2 = "PBKDF2";
const HMAC = "HMAC";
const SHA256 = "SHA-256";

/** Encode a Uint8Array to base64 string. */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/** Decode a base64 string to Uint8Array. */
function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** Create a PBKDF2 key from a password string. */
function deriveKey(password: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: PBKDF2 },
    false,
    ["deriveBits"],
  );
}

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns format: "iterations.base64salt.base64hash"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await deriveKey(password);

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: PBKDF2, salt, iterations: ITERATIONS, hash: SHA256 },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  return `${ITERATIONS}.${toBase64(salt)}.${toBase64(new Uint8Array(hashBuffer))}`;
}

/**
 * Verify a password against a stored hash.
 * Hash format: "iterations.base64salt.base64hash"
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split(".");
  if (parts.length !== 3) return false;

  const iterations = parseInt(parts[0], 10);
  const salt = fromBase64(parts[1]);
  const expectedHash = fromBase64(parts[2]);

  const keyMaterial = await deriveKey(password);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: PBKDF2, salt, iterations, hash: SHA256 },
    keyMaterial,
    expectedHash.length * 8,
  );

  // Constant-time comparison
  const computedHash = new Uint8Array(hashBuffer);
  if (computedHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

/** Create an HMAC-SHA256 key from a secret string. */
function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: HMAC, hash: SHA256 },
    false,
    ["sign", "verify"],
  );
}

/**
 * Sign a cookie value using HMAC-SHA256.
 * Returns format: "value.base64signature"
 */
export async function signCookie(value: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signatureBuffer = await crypto.subtle.sign(
    HMAC,
    key,
    new TextEncoder().encode(value),
  );
  return `${value}.${toBase64(new Uint8Array(signatureBuffer))}`;
}

/**
 * Verify a signed cookie. Returns the original value if valid, null if tampered.
 */
export async function verifyCookie(
  signedValue: string,
  secret: string,
): Promise<string | null> {
  const lastDot = signedValue.lastIndexOf(".");
  if (lastDot === -1) return null;

  const value = signedValue.substring(0, lastDot);
  let signature: Uint8Array;
  try {
    signature = fromBase64(signedValue.substring(lastDot + 1));
  } catch {
    return null;
  }

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    HMAC,
    key,
    new Uint8Array(signature).buffer,
    new TextEncoder().encode(value),
  );

  return valid ? value : null;
}
