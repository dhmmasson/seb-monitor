/**
 * Tests for derived metrics computation — focus ratio, paste ratio, etc.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import {
  computeExamSummary,
  computeSessionMetrics,
} from "../src/services/metrics.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import { insertEvents } from "../src/db/events.ts";
import { insertPasteContent } from "../src/db/paste_contents.ts";
import type {
  HeartbeatPayload,
  PasteContentRequest,
} from "../../shared/types.ts";

// ===== Helper: create a heartbeat payload =====
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

// ===== Session Metrics =====

Deno.test("computeSessionMetrics: returns focus ratio from heartbeats", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    // Two heartbeats: first 96.7% focused, second 50% focused
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({
        focus: { focusedTimeMs: 58000, unfocusedTimeMs: 2000, blurCount: 0 },
      }),
    );
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({
        focus: { focusedTimeMs: 30000, unfocusedTimeMs: 30000, blurCount: 2 },
      }),
    );

    const metrics = computeSessionMetrics(db, session.sessionId);
    assertExists(metrics, "should return metrics");
    // Total focused: 88000, total unfocused: 32000, ratio = 88000/120000 = 0.733
    assertEquals(
      Math.round(metrics.focusRatio * 1000),
      733,
      "focus ratio should be ~73.3%",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeSessionMetrics: returns paste ratio from heartbeats", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({
        input: {
          typedChars: 100,
          pastedChars: 200,
          deletedChars: 10,
          currentLength: 290,
        },
      }),
    );

    const metrics = computeSessionMetrics(db, session.sessionId);
    // Total input = 100 + 200 + 10 = 310, paste ratio = 200/310 = 0.645
    assertEquals(
      Math.round(metrics.pasteRatio * 1000),
      645,
      "paste ratio should be ~64.5%",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeSessionMetrics: returns total copy and paste counts", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({ copyCount: 3, pasteCount: 5 }),
    );
    insertHeartbeat(
      db,
      session.sessionId,
      makeHeartbeat({ copyCount: 2, pasteCount: 1 }),
    );

    const metrics = computeSessionMetrics(db, session.sessionId);
    assertEquals(metrics.totalCopyCount, 5, "total copy count should be sum");
    assertEquals(metrics.totalPasteCount, 6, "total paste count should be sum");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeSessionMetrics: returns unmatched paste count from events", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());
    // Paste events: one matched, one unmatched
    insertEvents(db, session.sessionId, [
      {
        type: "paste",
        timestamp: 1000,
        hash: "aaa",
        length: 10,
        matchedCopyHash: "aaa",
      },
      {
        type: "paste",
        timestamp: 2000,
        hash: "bbb",
        length: 200,
        matchedCopyHash: null,
      },
      {
        type: "paste",
        timestamp: 3000,
        hash: "ccc",
        length: 5,
        matchedCopyHash: null,
      },
    ]);

    const metrics = computeSessionMetrics(db, session.sessionId);
    assertEquals(
      metrics.unmatchedPasteCount,
      2,
      "should count pastes with null matchedCopyHash",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeSessionMetrics: returns largest paste from stored paste content", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());
    // Store paste contents
    const paste1: PasteContentRequest = {
      hash: "hash1",
      content: "short",
      length: 5,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 1000,
    };
    const paste2: PasteContentRequest = {
      hash: "hash2",
      content: "a much longer paste content here",
      length: 31,
      sessionId: session.sessionId,
      examId: "exam-1",
      timestamp: 2000,
    };
    insertPasteContent(db, paste1);
    insertPasteContent(db, paste2);

    const metrics = computeSessionMetrics(db, session.sessionId);
    assertEquals(
      metrics.largestPasteLength,
      31,
      "should return largest paste length",
    );
    assertEquals(
      metrics.largestPasteHash,
      "hash2",
      "should return hash of largest paste",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeSessionMetrics: handles session with no heartbeats", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    // No heartbeats inserted

    const metrics = computeSessionMetrics(db, session.sessionId);
    assertEquals(
      metrics.focusRatio,
      1,
      "focus ratio should be 1 with no data (default: focused)",
    );
    assertEquals(metrics.pasteRatio, 0, "paste ratio should be 0 with no data");
    assertEquals(metrics.totalCopyCount, 0, "copy count should be 0");
    assertEquals(metrics.totalPasteCount, 0, "paste count should be 0");
    assertEquals(
      metrics.unmatchedPasteCount,
      0,
      "unmatched paste count should be 0",
    );
    assertEquals(metrics.largestPasteLength, 0, "largest paste should be 0");
  } finally {
    closeTestDb(db);
  }
});

// ===== Exam Summary =====

Deno.test("computeExamSummary: returns all sessions for an exam with metrics", () => {
  const db = createTestDb();
  try {
    // Two students in same exam
    const session1 = findOrCreate(db, "student-1", "exam-1");
    const session2 = findOrCreate(db, "student-2", "exam-1");
    // Different exam — should be excluded
    findOrCreate(db, "student-3", "exam-2");

    insertHeartbeat(
      db,
      session1.sessionId,
      makeHeartbeat({
        studentId: "student-1",
        focus: { focusedTimeMs: 50000, unfocusedTimeMs: 10000, blurCount: 1 },
        copyCount: 2,
        pasteCount: 1,
      }),
    );
    insertHeartbeat(
      db,
      session2.sessionId,
      makeHeartbeat({
        studentId: "student-2",
        focus: { focusedTimeMs: 60000, unfocusedTimeMs: 0, blurCount: 0 },
        copyCount: 0,
        pasteCount: 0,
      }),
    );

    const summary = computeExamSummary(db, "exam-1");
    assertEquals(summary.length, 2, "should return 2 sessions for exam-1");
    // Find student-1
    const s1 = summary.find((s) => s.studentId === "student-1");
    assertExists(s1, "should include student-1");
    assertEquals(
      Math.round(s1.focusRatio * 1000),
      833,
      "student-1 focus ratio ~83.3%",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeExamSummary: returns empty array for non-existent exam", () => {
  const db = createTestDb();
  try {
    const summary = computeExamSummary(db, "non-existent-exam");
    assertEquals(summary.length, 0, "should return empty array");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("computeExamSummary: includes studentId and sessionId in results", () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());

    const summary = computeExamSummary(db, "exam-1");
    assertEquals(summary.length, 1);
    assertEquals(summary[0].studentId, "student-1");
    assertEquals(summary[0].sessionId, session.sessionId);
  } finally {
    closeTestDb(db);
  }
});
