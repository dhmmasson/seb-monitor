/**
 * Tests for hash views — hash list and hash detail pages.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { renderHashList } from "../src/views/hash-list.ts";
import { renderHashDetail } from "../src/views/hash-detail.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertPasteContent } from "../src/db/paste_contents.ts";
import { getHashUsageStats, getAllClipboardContent } from "../src/db/paste_contents.ts";

// ===== Hash List View Tests =====

Deno.test("renderHashList: renders table with hashes ordered by usage", () => {
  const stats = [
    {
      hash: "hash-a",
      usageCount: 5,
      copyCount: 2,
      pasteCount: 3,
      firstSeen: 1000,
      lastSeen: 5000,
      examId: "exam-1",
    },
    {
      hash: "hash-b",
      usageCount: 3,
      copyCount: 1,
      pasteCount: 2,
      firstSeen: 2000,
      lastSeen: 4000,
      examId: "exam-1",
    },
  ];

  const html = renderHashList(stats);
  assertExists(html, "should return HTML");
  assertEquals(html.includes("<table"), true, "should include a table");
  assertEquals(html.includes("hash-a"), true, "should include first hash");
  assertEquals(html.includes("hash-b"), true, "should include second hash");
  assertEquals(html.includes("5"), true, "should show usage count");
  assertEquals(html.includes("3"), true, "should show usage count");
});

Deno.test("renderHashList: shows empty state when no data", () => {
  const html = renderHashList([]);
  assertExists(html, "should return HTML");
  assertEquals(html.includes("No hashes"), true, "should show empty message");
});

Deno.test("renderHashList: links to hash detail page", () => {
  const stats = [
    {
      hash: "abc123",
      usageCount: 1,
      copyCount: 1,
      pasteCount: 0,
      firstSeen: 1000,
      lastSeen: 1000,
      examId: "exam-1",
    },
  ];

  const html = renderHashList(stats);
  assertEquals(
    html.includes("/dashboard/hash/abc123"),
    true,
    "should link to hash detail page",
  );
});

// ===== Hash Detail View Tests =====

Deno.test("renderHashDetail: shows hash content and usage timeline", () => {
  const content = [
    {
      hash: "test-hash",
      eventType: "copy",
      sessionId: "s1",
      content: "Copied text",
      length: 11,
      timestamp: 1000,
      examId: "exam-1",
    },
    {
      hash: "test-hash",
      eventType: "paste",
      sessionId: "s2",
      content: "Copied text",
      length: 11,
      timestamp: 2000,
      examId: "exam-1",
    },
  ];

  const html = renderHashDetail("test-hash", content);
  assertExists(html, "should return HTML");
  assertEquals(html.includes("test-hash"), true, "should show hash");
  assertEquals(html.includes("Copied text"), true, "should show content");
  assertEquals(html.includes("copy"), true, "should show copy event type");
  assertEquals(html.includes("paste"), true, "should show paste event type");
});

Deno.test("renderHashDetail: shows empty state when no content", () => {
  const html = renderHashDetail("empty-hash", []);
  assertExists(html, "should return HTML");
  assertEquals(html.includes("No content"), true, "should show empty message");
});

Deno.test("renderHashDetail: links to student detail pages", () => {
  const content = [
    {
      hash: "test-hash",
      eventType: "copy",
      sessionId: "s1",
      content: "Text",
      length: 4,
      timestamp: 1000,
      examId: "exam-1",
    },
  ];

  const html = renderHashDetail("test-hash", content);
  assertEquals(
    html.includes("/dashboard/"),
    true,
    "should link to dashboard pages",
  );
});

// ===== Database Integration Tests =====

Deno.test("getHashUsageStats: aggregates correctly from database", () => {
  const db = createTestDb();
  try {
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-2", "exam-1");

    // Insert copy and paste events
    insertPasteContent(db, {
      hash: "shared-hash",
      content: "Shared content",
      length: 14,
      sessionId: session1.sessionId,
      examId: "exam-1",
      timestamp: 1000,
      eventType: "copy",
    });
    insertPasteContent(db, {
      hash: "shared-hash",
      content: "Shared content",
      length: 14,
      sessionId: session2.sessionId,
      examId: "exam-1",
      timestamp: 2000,
      eventType: "paste",
    });

    const stats = getHashUsageStats(db);
    assertEquals(stats.length, 1);
    assertEquals(stats[0].hash, "shared-hash");
    assertEquals(stats[0].usageCount, 2);
    assertEquals(stats[0].copyCount, 1);
    assertEquals(stats[0].pasteCount, 1);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("getAllClipboardContent: returns all rows for hash", () => {
  const db = createTestDb();
  try {
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-2", "exam-1");

    insertPasteContent(db, {
      hash: "multi-hash",
      content: "Content",
      length: 7,
      sessionId: session1.sessionId,
      examId: "exam-1",
      timestamp: 1000,
      eventType: "copy",
    });
    insertPasteContent(db, {
      hash: "multi-hash",
      content: "Content",
      length: 7,
      sessionId: session2.sessionId,
      examId: "exam-1",
      timestamp: 2000,
      eventType: "paste",
    });

    const rows = getAllClipboardContent(db, "multi-hash");
    assertEquals(rows.length, 2);
    assertEquals(rows[0].eventType, "copy");
    assertEquals(rows[1].eventType, "paste");
  } finally {
    closeTestDb(db);
  }
});
