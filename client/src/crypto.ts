/**
 * SHA-256 hashing module using Web Crypto API.
 * Used for hashing copy/paste content without storing the actual text.
 */

/**
 * Compute SHA-256 hash of a string.
 * Returns lowercase hex string.
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
