import { assertEquals } from "@std/assert";
import { sha256 } from "./crypto.ts";

// Test SHA-256 hashing against known vectors
Deno.test("sha256 returns correct hash for empty string", async () => {
  // SHA-256 of empty string is a well-known vector
  const expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
  const result = await sha256("");
  assertEquals(result, expected);
});

Deno.test("sha256 returns correct hash for 'hello'", async () => {
  // SHA-256 of "hello" is a well-known vector
  const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  const result = await sha256("hello");
  assertEquals(result, expected);
});

Deno.test("sha256 returns hex string of length 64", async () => {
  const result = await sha256("test data");
  assertEquals(result.length, 64);
  // Verify it's valid hex
  assertEquals(/^[0-9a-f]{64}$/.test(result), true);
});

Deno.test("sha256 returns different hashes for different inputs", async () => {
  const hash1 = await sha256("input1");
  const hash2 = await sha256("input2");
  assertEquals(hash1 !== hash2, true);
});
