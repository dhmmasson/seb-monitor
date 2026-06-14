/**
 * SHA-256 hashing module using Web Crypto API.
 * Used for hashing copy/paste content without storing the actual text.
 *
 * @module crypto
 */

/** Hex character lookup table for byte-to-hex conversion */
const HEX_CHARS = "0123456789abcdef";

/**
 * Convert a Uint8Array to a lowercase hex string.
 * @param bytes - The byte array to convert
 * @returns Lowercase hexadecimal string
 */
function bytesToHex(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += HEX_CHARS[bytes[i] >> 4] + HEX_CHARS[bytes[i] & 0x0f];
  }
  return result;
}

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 * Returns lowercase hex string of 64 characters.
 *
 * @param message - The string to hash
 * @returns Promise resolving to lowercase hex hash string
 * @example
 * ```ts
 * const hash = await sha256("hello");
 * // => "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 * ```
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hashBuffer));
}
