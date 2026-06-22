/**
 * Tests for student detail view — per-student dashboard page.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { renderStudentDetail } from "../src/views/student-detail.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import { insertEvents } from "../src/db/events.ts";
import { insertPasteContent } from "../src/db/paste_contents.ts";
import type {
  HeartbeatPayload,
  PasteContentRequest,
} from "../../shared/types.ts";

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

// ===== Student Detail View =====

Deno.test("renderStudentDetail: shows student ID and session info", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertExists(html, "should return HTML");
    assertEquals(html.includes("Alice"), true, "should include student ID");
    assertEquals(html.includes("<!DOCTYPE html>"), true, "should be full page");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: shows metric summary cards", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({
        focus: { focusedTimeMs: 50000, unfocusedTimeMs: 10000, blurCount: 1 },
        copyCount: 3,
        pasteCount: 2,
      }),
    );

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(
      html.includes("Focus Ratio"),
      true,
      "should show focus ratio label",
    );
    assertEquals(
      html.includes("Paste Ratio"),
      true,
      "should show paste ratio label",
    );
    assertEquals(html.includes("Copies"), true, "should show copy count label");
    assertEquals(
      html.includes("Pastes"),
      true,
      "should show paste count label",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: includes Chart.js script for heartbeat timeline", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const now = Date.now();
    insertHeartbeat(db, session.sessionId, makeHeartbeat({ timestamp: now }));
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({ timestamp: now + 60000 }),
    );

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(html.includes("Chart"), true, "should reference Chart.js");
    assertEquals(
      html.includes("<canvas"),
      true,
      "should include canvas element",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: renders events table", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());
    insertEvents(db, session.sessionId, [
      { type: "copy", timestamp: 1000, hash: "aaa", length: 10 },
      {
        type: "paste",
        timestamp: 2000,
        hash: "bbb",
        length: 200,
        matchedCopyHash: null,
      },
      { type: "focus", timestamp: 3000 },
    ]);

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(
      html.includes("Events"),
      true,
      "should include events section",
    );
    assertEquals(html.includes("copy"), true, "should show copy events");
    assertEquals(html.includes("paste"), true, "should show paste events");
    assertEquals(html.includes("focus"), true, "should show focus events");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: shows paste content expand for stored pastes", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());
    const paste: PasteContentRequest = {
      hash: "abc123",
      content: "Hello world pasted text",
      length: 22,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
    };
    insertPasteContent(db, paste);
    insertEvents(db, session.sessionId, [
      {
        type: "paste",
        timestamp: 1000,
        hash: "abc123",
        length: 22,
        matchedCopyHash: null,
      },
    ]);

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(html.includes("abc123"), true, "should include paste hash");
    assertEquals(
      html.includes("paste-expand"),
      true,
      "should include expandable paste element",
    );
    assertEquals(
      html.includes("Hello world pasted text"),
      true,
      "should include paste content",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: highlights unmatched pastes", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());
    insertEvents(db, session.sessionId, [
      {
        type: "paste",
        timestamp: 1000,
        hash: "aaa",
        length: 10,
        matchedCopyHash: null,
      },
      {
        type: "paste",
        timestamp: 2000,
        hash: "bbb",
        length: 20,
        matchedCopyHash: "xxx",
      },
    ]);

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(
      html.includes("highlight-unmatched"),
      true,
      "should highlight unmatched pastes",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: handles session with no data", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    // No heartbeats or events

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(html.includes("Alice"), true, "should still show student ID");
    assertEquals(
      html.includes("No heartbeats"),
      true,
      "should show empty state for no heartbeats",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: shows expandable input content for heartbeats with snapshots", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");

    // Create a heartbeat with an input content hash
    const heartbeatPayload = makeHeartbeat({
      inputContentHash: "snap-hash-123",
    });
    insertHeartbeat(db, session.sessionId, heartbeatPayload);

    // Insert the corresponding input snapshot
    const stmt = db.prepareQuery(
      `INSERT INTO input_snapshots (hash, session_id, content, length, timestamp, exam_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    stmt.execute(["snap-hash-123", session.sessionId, "This is the student's answer text", 31, heartbeatPayload.timestamp, "exam-1"]);
    stmt.finalize();

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(html.includes("Show content"), true, "should include expand button");
    assertEquals(html.includes("This is the student's answer text"), true, "should include snapshot content");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: shows hash prefix for heartbeats with missing snapshots", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");

    // Create a heartbeat with a hash but no snapshot content
    insertHeartbeat(db, session.sessionId, makeHeartbeat({
      inputContentHash: "orphan-hash-abcdef",
    }));

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    // Should show the truncated hash, not the expand button
    assertEquals(html.includes("orphan-h"), true, "should show truncated hash");
    assertEquals(html.includes("Show content"), false, "should NOT show expand button for missing snapshot");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderStudentDetail: includes CSV download button", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());

    const html = renderStudentDetail(db, "exam-1", session.sessionId);
    assertEquals(
      html.includes("Download CSV"),
      true,
      "should include download CSV button text",
    );
    assertEquals(
      html.includes("export.csv"),
      true,
      "should link to export.csv endpoint",
    );
  } finally {
    closeTestDb(db);
  }
});
