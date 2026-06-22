/**
 * Tests for CSV export — buildCsvTimeline generates a unified event+heartbeat CSV.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildCsvTimeline } from "../src/services/csv-export.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import { insertEvents } from "../src/db/events.ts";
import { insertPasteContent } from "../src/db/paste_contents.ts";
import type { HeartbeatPayload, PasteContentRequest } from "../../shared/types.ts";

function makeHeartbeat(
  overrides: Partial<HeartbeatPayload> = {},
): HeartbeatPayload {
  return {
    studentId: "student-1",
    examId: "exam-1",
    questionId: "q1",
    timestamp: Date.now(),
    focus: { focusedTimeMs: 58000, unfocusedTimeMs: 2000, blurCount: 1 },
    input: {
      typedChars: 100,
      pastedChars: 50,
      deletedChars: 10,
      currentLength: 140,
    },
    keys: { keyDownCount: 200, ctrlCount: 2, altCount: 0, shiftCount: 20 },
    copyCount: 1,
    pasteCount: 1,
    events: [],
    ...overrides,
  };
}

// ===== buildCsvTimeline =====

Deno.test("buildCsvTimeline: returns CSV header row", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat({ timestamp: 1000 }));

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n");
    assertEquals(lines[0], "type,time,hash,length,focus,content");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: empty session returns header only", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    // No heartbeats or events

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    assertEquals(lines.length, 1, "should have only the header row");
    assertEquals(lines[0], "type,time,hash,length,focus,content");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: includes heartbeat rows with focus % and snapshot content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const ts = 1700000000000;
    insertHeartbeat(db, session.sessionId, makeHeartbeat({
      timestamp: ts,
      inputContentHash: "snap-hash-001",
    }));

    // Insert corresponding input snapshot
    const stmt = db.prepareQuery(
      `INSERT INTO input_snapshots (hash, session_id, content, length, timestamp, exam_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    stmt.execute(["snap-hash-001", session.sessionId, "Student answer text", 18, ts, "exam-1"]);
    stmt.finalize();

    const csv = buildCsvTimeline(db, session.sessionId);
    assertStringIncludes(csv, "heartbeat");
    assertStringIncludes(csv, "97%");
    assertStringIncludes(csv, "snap-hash-001");
    assertStringIncludes(csv, "Student answer text");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: includes copy event with (copy) in content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertEvents(db, session.sessionId, [
      { type: "copy", timestamp: 1000, hash: "copy-hash-aaa", length: 42 },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    assertStringIncludes(csv, "copy");
    assertStringIncludes(csv, "copy-hash-aaa");
    assertStringIncludes(csv, "42");
    assertStringIncludes(csv, "(copy)");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: includes paste event with actual content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const paste: PasteContentRequest = {
      hash: "paste-hash-bbb",
      content: "Pasted paragraph of text",
      length: 24,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 2000,
    };
    insertPasteContent(db, paste);
    insertEvents(db, session.sessionId, [
      { type: "paste", timestamp: 2000, hash: "paste-hash-bbb", length: 24, matchedCopyHash: null },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    assertStringIncludes(csv, "paste");
    assertStringIncludes(csv, "paste-hash-bbb");
    assertStringIncludes(csv, "24");
    assertStringIncludes(csv, "Pasted paragraph of text");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: includes focus and blur events with empty focus/content columns", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertEvents(db, session.sessionId, [
      { type: "focus", timestamp: 1000 },
      { type: "blur", timestamp: 2000 },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    // Header + 2 data rows
    assertEquals(lines.length, 3);
    // Focus row should have empty focus and content columns
    assertStringIncludes(csv, "focus");
    assertStringIncludes(csv, "blur");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: entries are ordered by timestamp", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertEvents(db, session.sessionId, [
      { type: "paste", timestamp: 5000, hash: "h1", length: 10, matchedCopyHash: null },
      { type: "copy", timestamp: 1000, hash: "h2", length: 5 },
    ]);
    insertHeartbeat(db, session.sessionId, makeHeartbeat({ timestamp: 3000 }));

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    // Header at index 0, then: copy(1000), heartbeat(3000), paste(5000)
    assertEquals(lines.length, 4);
    assertStringIncludes(lines[1], "copy");
    assertStringIncludes(lines[2], "heartbeat");
    assertStringIncludes(lines[3], "paste");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: escapes CSV fields containing commas", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const paste: PasteContentRequest = {
      hash: "hash-comma",
      content: "Hello, world, this has commas",
      length: 30,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
    };
    insertPasteContent(db, paste);
    insertEvents(db, session.sessionId, [
      { type: "paste", timestamp: 1000, hash: "hash-comma", length: 30, matchedCopyHash: null },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    // Content with commas should be quoted
    assertStringIncludes(csv, '"Hello, world, this has commas"');
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: escapes CSV fields containing quotes", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const paste: PasteContentRequest = {
      hash: "hash-quote",
      content: 'She said "hello"',
      length: 16,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
    };
    insertPasteContent(db, paste);
    insertEvents(db, session.sessionId, [
      { type: "paste", timestamp: 1000, hash: "hash-quote", length: 16, matchedCopyHash: null },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    // Quotes in content should be doubled
    assertStringIncludes(csv, '"She said ""hello"""');
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: escapes CSV fields containing newlines", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const paste: PasteContentRequest = {
      hash: "hash-nl",
      content: "Line one\nLine two\nLine three",
      length: 28,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
    };
    insertPasteContent(db, paste);
    insertEvents(db, session.sessionId, [
      { type: "paste", timestamp: 1000, hash: "hash-nl", length: 28, matchedCopyHash: null },
    ]);

    const csv = buildCsvTimeline(db, session.sessionId);
    // Newlines in content should be quoted
    assertStringIncludes(csv, '"Line one\nLine two\nLine three"');
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: heartbeat without snapshot shows empty content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat({
      timestamp: 1000,
      // No inputContentHash
    }));

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    assertEquals(lines.length, 2, "header + 1 heartbeat row");
    assertStringIncludes(lines[1], "heartbeat");
    // Content column should be empty
    assertStringIncludes(lines[1], "97%");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: heartbeat with hash but no matching snapshot shows empty content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat({
      timestamp: 1000,
      inputContentHash: "orphan-hash",
    }));
    // No snapshot inserted for "orphan-hash"

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    assertEquals(lines.length, 2, "header + 1 heartbeat row");
    // Should have the hash but empty content
    assertStringIncludes(lines[1], "orphan-hash");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("buildCsvTimeline: mixed timeline with events and heartbeats", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const ts = 1700000000000;

    insertEvents(db, session.sessionId, [
      { type: "copy", timestamp: ts, hash: "copy1", length: 10 },
      { type: "paste", timestamp: ts + 2000, hash: "paste1", length: 20, matchedCopyHash: "copy1" },
    ]);
    insertHeartbeat(db, session.sessionId, makeHeartbeat({
      timestamp: ts + 1000,
      inputContentHash: "snap1",
    }));

    // Insert snapshot
    const stmt = db.prepareQuery(
      `INSERT INTO input_snapshots (hash, session_id, content, length, timestamp, exam_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    stmt.execute(["snap1", session.sessionId, "Answer text", 11, ts + 1000, "exam-1"]);
    stmt.finalize();

    const csv = buildCsvTimeline(db, session.sessionId);
    const lines = csv.split("\n").filter((l) => l.trim() !== "");
    // Header + copy(ts) + heartbeat(ts+1000) + paste(ts+2000) = 4 lines
    assertEquals(lines.length, 4);
    assertStringIncludes(lines[1], "copy");
    assertStringIncludes(lines[2], "heartbeat");
    assertStringIncludes(lines[3], "paste");
  } finally {
    closeTestDb(db);
  }
});
