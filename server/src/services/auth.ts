/**
 * Authentication services — password hashing (PBKDF2) and cookie signing (HMAC-SHA256).
 * Uses Web Crypto API — zero external dependencies.
 */

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Hash a password using PBKDF2 with a random salt.
 * Returns format: "iterations.base64salt.base64hash"
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    HASH_LENGTH * 8,
  );

  const hashArray = new Uint8Array(hashBuffer);
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...hashArray));

  return `${ITERATIONS}.${saltB64}.${hashB64}`;
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
  const salt = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    expectedHash.length * 8,
  );

  const computedHash = new Uint8Array(hashBuffer);

  // Constant-time comparison
  if (computedHash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHash.length; i++) {
    diff |= computedHash[i] ^ expectedHash[i];
  }
  return diff === 0;
}

/**
 * Sign a cookie value using HMAC-SHA256.
 * Returns format: "value.base64signature"
 */
export async function signCookie(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  return `${value}.${signatureB64}`;
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
  const signatureB64 = signedValue.substring(lastDot + 1);

  let signature: Uint8Array;
  try {
    signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    new Uint8Array(signature).buffer,
    encoder.encode(value),
  );

  return valid ? value : null;
}
