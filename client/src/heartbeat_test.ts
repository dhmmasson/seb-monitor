import { assertEquals } from "@std/assert";
import { createHeartbeatBuilder } from "./heartbeat.ts";
import type {
  ExamEvent,
  FocusAccumulator,
  InputStats,
  KeyStats,
} from "../../shared/types.ts";

// Helper to create mock accumulators
function createMockAccumulators() {
  return {
    focus: {
      focusedTimeMs: 58000,
      unfocusedTimeMs: 2000,
      blurCount: 1,
    } as FocusAccumulator,
    input: {
      typedChars: 340,
      pastedChars: 120,
      deletedChars: 25,
      currentLength: 435,
    } as InputStats,
    keys: {
      keyDownCount: 890,
      ctrlCount: 4,
      altCount: 0,
      shiftCount: 82,
    } as KeyStats,
  };
}

// Mock collector
function createMockCollector() {
  return {
    start: () => {},
    stop: () => {},
    getEvents: () =>
      [
        {
          type: "copy" as const,
          timestamp: 123456,
          hash: "abc123",
          length: 84,
        },
      ] as ExamEvent[],
    getCopyCount: () => 1,
    getPasteCount: () => 2,
    clearEvents: () => {},
  };
}

// ===== Heartbeat Builder Tests =====

Deno.test("build includes correct student/exam/question IDs", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student42",
    "exam10",
    "question3",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.studentId, "student42");
  assertEquals(payload.examId, "exam10");
  assertEquals(payload.questionId, "question3");
});

Deno.test("build includes focus accumulator data", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.focus.focusedTimeMs, 58000);
  assertEquals(payload.focus.unfocusedTimeMs, 2000);
  assertEquals(payload.focus.blurCount, 1);
});

Deno.test("build includes input stats data", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.input.typedChars, 340);
  assertEquals(payload.input.pastedChars, 120);
  assertEquals(payload.input.deletedChars, 25);
  assertEquals(payload.input.currentLength, 435);
});

Deno.test("build includes key stats data", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.keys.keyDownCount, 890);
  assertEquals(payload.keys.ctrlCount, 4);
  assertEquals(payload.keys.altCount, 0);
  assertEquals(payload.keys.shiftCount, 82);
});

Deno.test("build includes copy and paste counts from collector", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.copyCount, 1);
  assertEquals(payload.pasteCount, 2);
});

Deno.test("build includes events from collector", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const payload = builder.build();

  assertEquals(payload.events.length, 1);
  assertEquals(payload.events[0].type, "copy");
});

Deno.test("build sets timestamp to current time", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createMockCollector();
  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  const before = Date.now();
  const payload = builder.build();
  const after = Date.now();

  // Timestamp should be between before and after (within 100ms tolerance)
  assertEquals(payload.timestamp >= before, true);
  assertEquals(payload.timestamp <= after, true);
});

Deno.test("reset resets focus, input, and key accumulators", () => {
  const { focus, input, keys } = createMockAccumulators();
  // Set non-zero values
  focus.focusedTimeMs = 50000;
  focus.unfocusedTimeMs = 10000;
  focus.blurCount = 3;
  input.typedChars = 200;
  input.pastedChars = 50;
  input.deletedChars = 20;
  input.currentLength = 230;
  keys.keyDownCount = 500;
  keys.ctrlCount = 5;
  keys.altCount = 2;
  keys.shiftCount = 30;

  const collector = {
    start: () => {},
    stop: () => {},
    getEvents: () => [] as ExamEvent[],
    getCopyCount: () => 3,
    getPasteCount: () => 2,
    clearEvents: () => {},
  };

  const builder = createHeartbeatBuilder(
    "student1",
    "exam1",
    "question1",
    focus,
    input,
    keys,
    collector,
  );

  builder.reset();

  // Focus should be reset
  assertEquals(focus.focusedTimeMs, 0);
  assertEquals(focus.unfocusedTimeMs, 0);
  assertEquals(focus.blurCount, 0);

  // Input should be reset (except currentLength)
  assertEquals(input.typedChars, 0);
  assertEquals(input.pastedChars, 0);
  assertEquals(input.deletedChars, 0);
  assertEquals(input.currentLength, 230, "currentLength should NOT be reset");

  // Keys should be reset
  assertEquals(keys.keyDownCount, 0);
  assertEquals(keys.ctrlCount, 0);
  assertEquals(keys.altCount, 0);
  assertEquals(keys.shiftCount, 0);
});
