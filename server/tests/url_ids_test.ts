/**
 * Tests for URL-safe exam ID encoding/decoding.
 * Exam IDs can be full URLs (e.g. "https://moodle.example.com/exam/123")
 * which break URL routing. These utilities encode them into URL-safe segments.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals } from "@std/assert";
import { encodeExamId, decodeExamId } from "../src/routes/url-ids.ts";

// ===== Roundtrip =====

Deno.test("encodeExamId + decodeExamId: roundtrip with full URL", () => {
  const original = "https://moodle.example.com/exam/123";
  const encoded = encodeExamId(original);
  const decoded = decodeExamId(encoded);
  assertEquals(decoded, original, "roundtrip should preserve the original ID");
});

Deno.test("encodeExamId + decodeExamId: roundtrip with simple string", () => {
  const original = "CS101-Midterm";
  const encoded = encodeExamId(original);
  const decoded = decodeExamId(encoded);
  assertEquals(decoded, original);
});

Deno.test("encodeExamId + decodeExamId: roundtrip with special characters", () => {
  const original = "exam/with?query=yes&foo=bar#fragment";
  const encoded = encodeExamId(original);
  const decoded = decodeExamId(encoded);
  assertEquals(decoded, original);
});

Deno.test("encodeExamId + decodeExamId: roundtrip with unicode", () => {
  const original = "Examen Français 2024";
  const encoded = encodeExamId(original);
  const decoded = decodeExamId(encoded);
  assertEquals(decoded, original);
});

Deno.test("encodeExamId + decodeExamId: roundtrip with empty string", () => {
  const original = "";
  const encoded = encodeExamId(original);
  const decoded = decodeExamId(encoded);
  assertEquals(decoded, original);
});

// ===== URL Safety =====

Deno.test("encodeExamId: output contains no slashes", () => {
  const encoded = encodeExamId("https://moodle.example.com/exam/123");
  assertEquals(
    encoded.includes("/"),
    false,
    `encoded value "${encoded}" should not contain slashes`,
  );
});

Deno.test("encodeExamId: output contains no colons", () => {
  const encoded = encodeExamId("https://moodle.example.com/exam/123");
  assertEquals(
    encoded.includes(":"),
    false,
    `encoded value "${encoded}" should not contain colons`,
  );
});

Deno.test("encodeExamId: output contains no question marks", () => {
  const encoded = encodeExamId("exam?query=yes");
  assertEquals(
    encoded.includes("?"),
    false,
    `encoded value "${encoded}" should not contain question marks`,
  );
});

Deno.test("encodeExamId: output contains no hash", () => {
  const encoded = encodeExamId("exam#fragment");
  assertEquals(
    encoded.includes("#"),
    false,
    `encoded value "${encoded}" should not contain hash`,
  );
});

Deno.test("encodeExamId: output is safe for URL path segment", () => {
  const encoded = encodeExamId("https://moodle.example.com/exam/123");
  // Should only contain URL-safe characters: a-z, A-Z, 0-9, -, _, ~
  const urlSafePattern = /^[a-zA-Z0-9\-_~]+$/;
  assertEquals(
    urlSafePattern.test(encoded),
    true,
    `encoded value "${encoded}" should only contain URL-safe characters`,
  );
});

// ===== Deterministic =====

Deno.test("encodeExamId: same input produces same output", () => {
  const id = "https://moodle.example.com/exam/123";
  assertEquals(encodeExamId(id), encodeExamId(id));
});

// ===== Decode errors =====

Deno.test("decodeExamId: returns input unchanged if not encoded", () => {
  // Simple strings that are already URL-safe should pass through
  const result = decodeExamId("CS101-Midterm");
  assertEquals(result, "CS101-Midterm");
});
