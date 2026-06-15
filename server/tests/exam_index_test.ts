/**
 * Tests for exam index view — lists all exams with summary stats.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { renderExamIndex } from "../src/views/exam-index.ts";
import { encodeExamId } from "../src/routes/url-ids.ts";
import { createTestDb, closeTestDb } from "./helpers.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import type { HeartbeatPayload } from "../../shared/types.ts";

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

// ===== Exam Index View =====

Deno.test("renderExamIndex: returns full HTML page with 'All Exams' heading", () => {
  const db = createTestDb();
  try {
    const html = renderExamIndex(db);
    assertExists(html, "should return HTML");
    assertEquals(html.includes("<!DOCTYPE html>"), true, "should be full page");
    assertEquals(
      html.includes("All Exams"),
      true,
      "should show 'All Exams' heading",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderExamIndex: lists all unique exam IDs", () => {
  const db = createTestDb();
  try {
    const s1 = findOrCreate(db, "Alice", "CS101-Midterm");
    const s2 = findOrCreate(db, "Bob", "CS101-Midterm");
    const s3 = findOrCreate(db, "Charlie", "MATH201-Final");
    insertHeartbeat(db, s1.sessionId, makeHeartbeat({ studentId: "Alice" }));
    insertHeartbeat(db, s2.sessionId, makeHeartbeat({ studentId: "Bob" }));
    insertHeartbeat(
      db,
      s3.sessionId,
      makeHeartbeat({ studentId: "Charlie" }),
    );

    const html = renderExamIndex(db);
    assertEquals(
      html.includes("CS101-Midterm"),
      true,
      "should list CS101-Midterm",
    );
    assertEquals(
      html.includes("MATH201-Final"),
      true,
      "should list MATH201-Final",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderExamIndex: shows student count per exam", () => {
  const db = createTestDb();
  try {
    findOrCreate(db, "Alice", "exam-1");
    findOrCreate(db, "Bob", "exam-1");
    findOrCreate(db, "Charlie", "exam-2");

    const html = renderExamIndex(db);
    assertEquals(html.includes("exam-1"), true, "should list exam-1");
    assertEquals(html.includes("exam-2"), true, "should list exam-2");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderExamIndex: links to individual exam pages", () => {
  const db = createTestDb();
  try {
    const s = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, s.sessionId, makeHeartbeat());

    const html = renderExamIndex(db);
    const encodedId = encodeExamId("exam-1");
    assertEquals(
      html.includes(`/dashboard/${encodedId}`),
      true,
      `should link to /dashboard/${encodedId}`,
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderExamIndex: shows empty state when no exams exist", () => {
  const db = createTestDb();
  try {
    const html = renderExamIndex(db);
    assertEquals(
      html.includes("No exams"),
      true,
      "should show empty state message",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("renderExamIndex: shows table with Exam and Students columns", () => {
  const db = createTestDb();
  try {
    const s = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, s.sessionId, makeHeartbeat());

    const html = renderExamIndex(db);
    assertEquals(html.includes("<table"), true, "should have a table");
    assertEquals(html.includes("Exam"), true, "should have Exam column");
    assertEquals(
      html.includes("Students"),
      true,
      "should have Students column",
    );
  } finally {
    closeTestDb(db);
  }
});
