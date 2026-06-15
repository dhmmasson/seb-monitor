/**
 * URL-safe exam ID encoding/decoding.
 *
 * Exam IDs can be full URLs (e.g. "https://moodle.example.com/exam/123")
 * which contain slashes, colons, and other characters that break URL routing.
 * This module encodes them into URL-safe base64url segments (RFC 4648 §5).
 *
 * Encoding: base64url (no padding) — only uses [a-zA-Z0-9-_]
 * Decoding: reverse the encoding, with graceful fallback for plain strings.
 */

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Encode an exam ID into a URL-safe string.
 * Uses base64url (RFC 4648 §5) — no slashes, colons, or padding.
 */
export function encodeExamId(examId: string): string {
  const bytes = ENCODER.encode(examId);
  // Standard base64
  let b64 = btoa(String.fromCharCode(...bytes));
  // Convert to base64url: + → -, / → _, remove = padding
  b64 = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return b64;
}

/**
 * Decode a URL-safe exam ID back to the original string.
 * Attempts base64url decode; returns the input unchanged if it's not valid base64url.
 */
export function decodeExamId(encoded: string): string {
  try {
    // Convert base64url back to standard base64
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padding = (4 - (b64.length % 4)) % 4;
    b64 += "=".repeat(padding);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return DECODER.decode(bytes);
  } catch {
    // Not valid base64url — return as-is (plain string like "CS101-Midterm")
    return encoded;
  }
}
