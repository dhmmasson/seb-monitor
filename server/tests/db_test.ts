/**
 * Tests for database schema, connection, and CRUD operations.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import { insertEvents } from "../src/db/events.ts";
import {
  getPasteContent,
  insertPasteContent,
  getAllClipboardContent,
  getHashUsageStats,
} from "../src/db/paste_contents.ts";

// Helper to query with args using the deno.land/x/sqlite API
function queryAll(
  db: ReturnType<typeof createTestDb>,
  sql: string,
  args: unknown[] = [],
): unknown[][] {
  if (args.length === 0) {
    return [...db.query(sql)];
  }
  const stmt = db.prepareQuery(sql);
  try {
    return [...stmt.all(args)];
  } finally {
    stmt.finalize();
  }
}

// ===== Schema Tests =====

Deno.test("schema: creates sessions table", () => {
  const db = createTestDb();
  try {
    const rows = queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
    );
    assertEquals(rows.length, 1, "sessions table should exist");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: creates heartbeats table", () => {
  const db = createTestDb();
  try {
    const rows = queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='heartbeats'",
    );
    assertEquals(rows.length, 1, "heartbeats table should exist");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: creates events table", () => {
  const db = createTestDb();
  try {
    const rows = queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='events'",
    );
    assertEquals(rows.length, 1, "events table should exist");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: creates paste_contents table", () => {
  const db = createTestDb();
  try {
    const rows = queryAll(
      db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name='paste_contents'",
    );
    assertEquals(rows.length, 1, "paste_contents table should exist");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: sessions table has correct columns", () => {
  const db = createTestDb();
  try {
    const rows = db.query("PRAGMA table_info(sessions)");
    const columnNames = rows.map((r: unknown[]) => r[1] as string);
    assertEquals(columnNames, [
      "session_id",
      "student_id",
      "exam_id",
      "start_time",
      "created_at",
    ]);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: heartbeats table has correct columns", () => {
  const db = createTestDb();
  try {
    const rows = db.query("PRAGMA table_info(heartbeats)");
    const columnNames = rows.map((r: unknown[]) => r[1] as string);
    assertEquals(columnNames, [
      "id",
      "session_id",
      "timestamp",
      "question_id",
      "focused_time_ms",
      "unfocused_time_ms",
      "blur_count",
      "typed_chars",
      "pasted_chars",
      "deleted_chars",
      "current_length",
      "copy_count",
      "paste_count",
      "key_down_count",
      "ctrl_count",
      "alt_count",
      "shift_count",
      "created_at",
    ]);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: events table has correct columns", () => {
  const db = createTestDb();
  try {
    const rows = db.query("PRAGMA table_info(events)");
    const columnNames = rows.map((r: unknown[]) => r[1] as string);
    assertEquals(columnNames, [
      "id",
      "session_id",
      "timestamp",
      "type",
      "hash",
      "length",
      "matched_copy_hash",
      "created_at",
    ]);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("schema: paste_contents table has correct columns", () => {
  const db = createTestDb();
  try {
    const rows = db.query("PRAGMA table_info(paste_contents)");
    const columnNames = rows.map((r: unknown[]) => r[1] as string);
    assertEquals(columnNames, [
      "hash",
      "session_id",
      "content",
      "length",
      "timestamp",
      "exam_id",
      "event_type",
      "created_at",
    ]);
  } finally {
    closeTestDb(db);
  }
});

// ===== Session CRUD Tests =====

Deno.test("sessions: findOrCreate creates a new session", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    assertExists(session.sessionId, "session should have a sessionId");
    assertEquals(session.studentId, "student-1");
    assertEquals(session.examId, "exam-1");
    assertExists(session.startTime, "session should have a startTime");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("sessions: findOrCreate returns existing session for same student/exam", () => {
  const db = createTestDb();
  try {
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-1", "exam-1");
    assertEquals(
      session1.sessionId,
      session2.sessionId,
      "should return same session",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("sessions: different students get different sessions", () => {
  const db = createTestDb();
  try {
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-2", "exam-1");
    assertEquals(
      session1.sessionId !== session2.sessionId,
      true,
      "different students should get different sessions",
    );
  } finally {
    closeTestDb(db);
  }
});

// ===== Heartbeat Insert Tests =====

Deno.test("heartbeats: insertHeartbeat stores heartbeat data", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    const payload = {
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
    };

    insertHeartbeat(db, session.sessionId, payload);

    const rows = queryAll(db, "SELECT * FROM heartbeats WHERE session_id = ?", [
      session.sessionId,
    ]);
    assertEquals(rows.length, 1, "should have one heartbeat row");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("heartbeats: insertHeartbeat stores correct values", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    const payload = {
      studentId: "student-1",
      examId: "exam-1",
      questionId: "q1",
      timestamp: 1700000000000,
      focus: { focusedTimeMs: 58000, unfocusedTimeMs: 2000, blurCount: 1 },
      input: {
        typedChars: 340,
        pastedChars: 120,
        deletedChars: 25,
        currentLength: 435,
      },
      keys: { keyDownCount: 890, ctrlCount: 4, altCount: 0, shiftCount: 82 },
      copyCount: 1,
      pasteCount: 2,
      events: [],
    };

    insertHeartbeat(db, session.sessionId, payload);

    const rows = queryAll(
      db,
      "SELECT question_id, focused_time_ms, unfocused_time_ms, blur_count, typed_chars, pasted_chars, deleted_chars, current_length, copy_count, paste_count, key_down_count FROM heartbeats WHERE session_id = ?",
      [session.sessionId],
    );
    assertEquals(rows.length, 1);
    const row = rows[0];
    assertEquals(row[0], "q1");
    assertEquals(row[1], 58000);
    assertEquals(row[2], 2000);
    assertEquals(row[3], 1);
    assertEquals(row[4], 340);
    assertEquals(row[5], 120);
    assertEquals(row[6], 25);
    assertEquals(row[7], 435);
    assertEquals(row[8], 1);
    assertEquals(row[9], 2);
    assertEquals(row[10], 890);
  } finally {
    closeTestDb(db);
  }
});

// ===== Event Insert Tests =====

Deno.test("events: insertEvents stores events", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    const events = [
      { type: "copy", timestamp: 1000, hash: "abc123", length: 50 },
      { type: "paste", timestamp: 2000, hash: "def456", length: 100 },
      { type: "focus", timestamp: 3000 },
      { type: "blur", timestamp: 4000 },
    ];

    insertEvents(db, session.sessionId, events);

    const rows = queryAll(db, "SELECT * FROM events WHERE session_id = ?", [
      session.sessionId,
    ]);
    assertEquals(rows.length, 4, "should have four event rows");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("events: insertEvents stores copy event with hash", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertEvents(db, session.sessionId, [
      { type: "copy" as const, timestamp: 1000, hash: "abc123", length: 50 },
    ]);

    const rows = queryAll(
      db,
      "SELECT type, hash, length FROM events WHERE session_id = ?",
      [session.sessionId],
    );
    assertEquals(rows.length, 1);
    assertEquals(rows[0][0], "copy");
    assertEquals(rows[0][1], "abc123");
    assertEquals(rows[0][2], 50);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("events: insertEvents stores focus/blur without hash", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertEvents(db, session.sessionId, [
      { type: "focus" as const, timestamp: 1000 },
      { type: "blur" as const, timestamp: 2000 },
    ]);

    const rows = queryAll(
      db,
      "SELECT type, hash FROM events WHERE session_id = ? ORDER BY timestamp",
      [session.sessionId],
    );
    assertEquals(rows.length, 2);
    assertEquals(rows[0][0], "focus");
    assertEquals(rows[0][1], null);
    assertEquals(rows[1][0], "blur");
    assertEquals(rows[1][1], null);
  } finally {
    closeTestDb(db);
  }
});

// ===== Paste Content Tests =====

Deno.test("paste_contents: insertPasteContent stores content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertPasteContent(db, {
      hash: "abc123",
      content: "Hello world",
      length: 11,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
    });

    const result = getPasteContent(db, "abc123");
    assertExists(result, "paste content should exist");
    assertEquals(result.content, "Hello world");
    assertEquals(result.length, 11);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: insertPasteContent is idempotent for same hash", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    const request = {
      hash: "abc123",
      content: "Hello world",
      length: 11,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
    };

    insertPasteContent(db, request);
    insertPasteContent(db, request); // duplicate — should not fail

    const rows = queryAll(db, "SELECT * FROM paste_contents WHERE hash = ?", [
      "abc123",
    ]);
    assertEquals(rows.length, 1, "should still have only one row");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: getPasteContent returns null for missing hash", () => {
  const db = createTestDb();
  try {
    const result = getPasteContent(db, "nonexistent");
    assertEquals(result, null, "should return null for missing hash");
  } finally {
    closeTestDb(db);
  }
});

// ===== Session Day-Dedup Tests =====

Deno.test("sessions: same student/exam on different days creates different sessions", () => {
  const db = createTestDb();
  try {
    // Insert a session manually with yesterday's start_time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayStart = yesterday.getTime();

    const oldSessionId = "old-session-id";
    const stmt = db.prepareQuery(
      "INSERT INTO sessions (session_id, student_id, exam_id, start_time) VALUES (?, ?, ?, ?)",
    );
    try {
      stmt.execute([oldSessionId, "student-1", "exam-1", yesterdayStart]);
    } finally {
      stmt.finalize();
    }

    // findOrCreate should create a NEW session for today
    const session = findOrCreate(db, "student-1", "exam-1");
    assertEquals(
      session.sessionId !== oldSessionId,
      true,
      "should create new session for today, not reuse yesterday's",
    );
    assertEquals(session.studentId, "student-1");
    assertEquals(session.examId, "exam-1");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("sessions: findOrCreate reuses existing session from today", () => {
  const db = createTestDb();
  try {
    const s1 = findOrCreate(db, "student-1", "exam-1");
    const s2 = findOrCreate(db, "student-1", "exam-1");
    assertEquals(s1.sessionId, s2.sessionId, "same day should reuse session");
  } finally {
    closeTestDb(db);
  }
});

// ===== matchedCopyHash Persistence =====

Deno.test("events: insertEvents stores matchedCopyHash for paste events", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertEvents(db, session.sessionId, [
      { type: "copy" as const, timestamp: 1000, hash: "copy-abc", length: 50 },
      {
        type: "paste" as const,
        timestamp: 2000,
        hash: "paste-abc",
        length: 50,
        matchedCopyHash: "copy-abc",
      },
      {
        type: "paste" as const,
        timestamp: 3000,
        hash: "paste-ext",
        length: 100,
        matchedCopyHash: null,
      },
    ]);

    const rows = queryAll(
      db,
      "SELECT type, hash, matched_copy_hash FROM events WHERE session_id = ? ORDER BY timestamp",
      [session.sessionId],
    );
    assertEquals(rows.length, 3);
    // copy event has no matchedCopyHash
    assertEquals(rows[0][0], "copy");
    assertEquals(rows[0][2], null);
    // matched paste has matchedCopyHash
    assertEquals(rows[1][0], "paste");
    assertEquals(rows[1][2], "copy-abc");
    // unmatched paste has null matchedCopyHash
    assertEquals(rows[2][0], "paste");
    assertEquals(rows[2][2], null);
  } finally {
    closeTestDb(db);
  }
});

// ===== Clipboard Content: event_type column =====

Deno.test("paste_contents: event_type column exists", () => {
  const db = createTestDb();
  try {
    const rows = db.query("PRAGMA table_info(paste_contents)");
    const columnNames = rows.map((r: unknown[]) => r[1] as string);
    assertEquals(
      columnNames.includes("event_type"),
      true,
      "paste_contents should have event_type column",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: event_type defaults to paste", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    // Insert without specifying event_type — should default to 'paste'
    insertPasteContent(db, {
      hash: "default-test",
      content: "Hello",
      length: 5,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
    });

    const rows = queryAll(
      db,
      "SELECT event_type FROM paste_contents WHERE hash = ?",
      ["default-test"],
    );
    assertEquals(rows.length, 1);
    assertEquals(rows[0][0], "paste", "event_type should default to 'paste'");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: can insert with event_type copy", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertPasteContent(db, {
      hash: "copy-test",
      content: "Copied text",
      length: 12,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
      eventType: "copy",
    });

    const rows = queryAll(
      db,
      "SELECT event_type, content FROM paste_contents WHERE hash = ?",
      ["copy-test"],
    );
    assertEquals(rows.length, 1);
    assertEquals(rows[0][0], "copy");
    assertEquals(rows[0][1], "Copied text");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: can insert with event_type paste", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertPasteContent(db, {
      hash: "paste-test",
      content: "Pasted text",
      length: 11,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
      eventType: "paste",
    });

    const rows = queryAll(
      db,
      "SELECT event_type, content FROM paste_contents WHERE hash = ?",
      ["paste-test"],
    );
    assertEquals(rows.length, 1);
    assertEquals(rows[0][0], "paste");
    assertEquals(rows[0][1], "Pasted text");
  } finally {
    closeTestDb(db);
  }
});

// ===== Clipboard Content: getAllClipboardContent =====

Deno.test("paste_contents: getAllClipboardContent returns all rows for a hash", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    // Insert copy event
    insertPasteContent(db, {
      hash: "multi-hash",
      content: "Shared content",
      length: 14,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
      eventType: "copy",
    });

    // Insert paste event with same hash (different session)
    const session2 = findOrCreate(db, "student-2", "exam-1");
    insertPasteContent(db, {
      hash: "multi-hash",
      content: "Shared content",
      length: 14,
      sessionId: session2.sessionId,
      examId: "exam-1",
      timestamp: 2000,
      eventType: "paste",
    });

    const rows = getAllClipboardContent(db, "multi-hash");
    assertEquals(rows.length, 2, "should return both rows");

    // First row is the copy
    assertEquals(rows[0].eventType, "copy");
    assertEquals(rows[0].sessionId, session.sessionId);
    assertEquals(rows[0].content, "Shared content");

    // Second row is the paste
    assertEquals(rows[1].eventType, "paste");
    assertEquals(rows[1].sessionId, session2.sessionId);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: getAllClipboardContent returns empty for missing hash", () => {
  const db = createTestDb();
  try {
    const rows = getAllClipboardContent(db, "nonexistent");
    assertEquals(rows.length, 0, "should return empty array");
  } finally {
    closeTestDb(db);
  }
});

// ===== Clipboard Content: getHashUsageStats =====

Deno.test("paste_contents: getHashUsageStats aggregates correctly", () => {
  const db = createTestDb();
  try {
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-2", "exam-1");

    // Hash A: 1 copy + 2 pastes = 3 uses
    insertPasteContent(db, {
      hash: "hash-a",
      content: "Content A",
      length: 9,
      sessionId: session1.sessionId,
      examId: "exam-1",
      timestamp: 1000,
      eventType: "copy",
    });
    insertPasteContent(db, {
      hash: "hash-a",
      content: "Content A",
      length: 9,
      sessionId: session1.sessionId,
      examId: "exam-1",
      timestamp: 2000,
      eventType: "paste",
    });
    insertPasteContent(db, {
      hash: "hash-a",
      content: "Content A",
      length: 9,
      sessionId: session2.sessionId,
      examId: "exam-1",
      timestamp: 3000,
      eventType: "paste",
    });

    // Hash B: 2 copies = 2 uses
    insertPasteContent(db, {
      hash: "hash-b",
      content: "Content B",
      length: 9,
      sessionId: session1.sessionId,
      examId: "exam-1",
      timestamp: 1500,
      eventType: "copy",
    });
    insertPasteContent(db, {
      hash: "hash-b",
      content: "Content B",
      length: 9,
      sessionId: session2.sessionId,
      examId: "exam-1",
      timestamp: 2500,
      eventType: "copy",
    });

    const stats = getHashUsageStats(db);
    assertEquals(stats.length, 2, "should have 2 hash entries");

    // Hash A should be first (3 uses > 2 uses)
    assertEquals(stats[0].hash, "hash-a");
    assertEquals(stats[0].usageCount, 3);
    assertEquals(stats[0].copyCount, 1);
    assertEquals(stats[0].pasteCount, 2);
    assertEquals(stats[0].firstSeen, 1000);
    assertEquals(stats[0].lastSeen, 3000);
    assertEquals(stats[0].examId, "exam-1");

    // Hash B should be second
    assertEquals(stats[1].hash, "hash-b");
    assertEquals(stats[1].usageCount, 2);
    assertEquals(stats[1].copyCount, 2);
    assertEquals(stats[1].pasteCount, 0);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: getHashUsageStats returns empty when no data", () => {
  const db = createTestDb();
  try {
    const stats = getHashUsageStats(db);
    assertEquals(stats.length, 0, "should return empty array");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("paste_contents: getPasteContent returns event_type", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");

    insertPasteContent(db, {
      hash: "with-type",
      content: "Test content",
      length: 12,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
      eventType: "copy",
    });

    const result = getPasteContent(db, "with-type");
    assertExists(result, "should find content");
    assertEquals(result.eventType, "copy", "should return event_type");
  } finally {
    closeTestDb(db);
  }
});
