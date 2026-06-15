/**
 * Tests for authentication services — password hashing, cookie signing.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  hashPassword,
  verifyPassword,
  signCookie,
  verifyCookie,
} from "../src/services/auth.ts";

// ===== Password Hashing =====

Deno.test("hashPassword: returns a string containing salt and hash", async () => {
  const result = await hashPassword("test-password");
  assertExists(result, "hashPassword should return a value");
  assertEquals(typeof result, "string", "result should be a string");
  // PBKDF2 format: iterations.base64salt.base64hash
  const parts = result.split(".");
  assertEquals(parts.length, 3, "hash should have format: iterations.salt.hash");
});

Deno.test("hashPassword: produces different hashes for same input (random salt)", async () => {
  const hash1 = await hashPassword("same-password");
  const hash2 = await hashPassword("same-password");
  assertEquals(hash1 !== hash2, true, "same password should produce different hashes due to random salt");
});

Deno.test("verifyPassword: returns true for correct password", async () => {
  const hash = await hashPassword("correct-password");
  const result = await verifyPassword("correct-password", hash);
  assertEquals(result, true, "verifyPassword should return true for correct password");
});

Deno.test("verifyPassword: returns false for incorrect password", async () => {
  const hash = await hashPassword("correct-password");
  const result = await verifyPassword("wrong-password", hash);
  assertEquals(result, false, "verifyPassword should return false for wrong password");
});

Deno.test("verifyPassword: handles empty password", async () => {
  const hash = await hashPassword("");
  const result = await verifyPassword("", hash);
  assertEquals(result, true, "empty password should verify against its own hash");
});

// ===== Cookie Signing =====

Deno.test("signCookie: returns a string with value and signature", async () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";
  const result = await signCookie("user-session-id", secret);
  assertExists(result, "signCookie should return a value");
  assertEquals(typeof result, "string", "result should be a string");
  // Format: value.signature
  assertEquals(result.includes("."), true, "signed cookie should contain a dot separator");
});

Deno.test("verifyCookie: returns value for valid signature", async () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";
  const signed = await signCookie("my-session-id", secret);
  const result = await verifyCookie(signed, secret);
  assertEquals(result, "my-session-id", "verifyCookie should return the original value");
});

Deno.test("verifyCookie: returns null for tampered cookie", async () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";
  const signed = await signCookie("my-session-id", secret);
  const tampered = signed.replace("my-session-id", "hacked-value");
  const result = await verifyCookie(tampered, secret);
  assertEquals(result, null, "verifyCookie should return null for tampered cookie");
});

Deno.test("verifyCookie: returns null for wrong secret", async () => {
  const secret1 = "test-secret-key-at-least-32-chars-long!!";
  const secret2 = "different-secret-key-at-least-32-chars-!";
  const signed = await signCookie("my-session-id", secret1);
  const result = await verifyCookie(signed, secret2);
  assertEquals(result, null, "verifyCookie should return null for wrong secret");
});

Deno.test("verifyCookie: returns null for completely invalid string", async () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";
  const result = await verifyCookie("not-a-valid-cookie", secret);
  assertEquals(result, null, "verifyCookie should return null for invalid format");
});

Deno.test("signCookie + verifyCookie: roundtrip with special characters", async () => {
  const secret = "test-secret-key-at-least-32-chars-long!!";
  const value = "session-123-abc-!@#$%^&*()";
  const signed = await signCookie(value, secret);
  const result = await verifyCookie(signed, secret);
  assertEquals(result, value, "roundtrip should preserve value with special characters");
});
