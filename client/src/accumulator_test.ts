import { assertEquals } from "@std/assert";
import {
  createFocusAccumulator,
  createInputStats,
  createKeyStats,
  recordBlur,
  getFocusRatio,
  recordInput,
  recordKey,
  resetAccumulators,
  recordFocusTime,
  recordUnfocusedTime,
} from "./accumulator.ts";
import type { FocusAccumulator, InputStats, KeyStats } from "../../shared/types.ts";

// ===== Focus Accumulator Tests =====

Deno.test("createFocusAccumulator returns zeroed accumulator", () => {
  const focus = createFocusAccumulator();
  assertEquals(focus.focusedTimeMs, 0);
  assertEquals(focus.unfocusedTimeMs, 0);
  assertEquals(focus.blurCount, 0);
});

Deno.test("recordBlur increments blur count", () => {
  const focus = createFocusAccumulator();
  recordBlur(focus);
  assertEquals(focus.blurCount, 1);
  recordBlur(focus);
  assertEquals(focus.blurCount, 2);
});

Deno.test("getFocusRatio returns 1 when fully focused", () => {
  const focus: FocusAccumulator = {
    focusedTimeMs: 60000,
    unfocusedTimeMs: 0,
    blurCount: 0,
  };
  assertEquals(getFocusRatio(focus), 1);
});

Deno.test("getFocusRatio returns 0 when fully unfocused", () => {
  const focus: FocusAccumulator = {
    focusedTimeMs: 0,
    unfocusedTimeMs: 60000,
    blurCount: 0,
  };
  assertEquals(getFocusRatio(focus), 0);
});

Deno.test("getFocusRatio returns 0.5 when equally focused and unfocused", () => {
  const focus: FocusAccumulator = {
    focusedTimeMs: 30000,
    unfocusedTimeMs: 30000,
    blurCount: 0,
  };
  assertEquals(getFocusRatio(focus), 0.5);
});

Deno.test("getFocusRatio returns 1 when no time recorded", () => {
  const focus = createFocusAccumulator();
  assertEquals(getFocusRatio(focus), 1);
});

// ===== Input Stats Tests =====

Deno.test("createInputStats returns zeroed stats", () => {
  const input = createInputStats();
  assertEquals(input.typedChars, 0);
  assertEquals(input.pastedChars, 0);
  assertEquals(input.deletedChars, 0);
  assertEquals(input.currentLength, 0);
});

Deno.test("recordInput with positive delta increments typedChars", () => {
  const input = createInputStats();
  recordInput(input, 10, false);
  assertEquals(input.typedChars, 10);
  assertEquals(input.currentLength, 10);
});

Deno.test("recordInput with negative delta increments deletedChars", () => {
  const input = createInputStats();
  input.currentLength = 20;
  recordInput(input, -5, false);
  assertEquals(input.deletedChars, 5);
  assertEquals(input.currentLength, 15);
});

Deno.test("recordInput with positive delta after paste increments pastedChars", () => {
  const input = createInputStats();
  recordInput(input, 100, true);
  assertEquals(input.pastedChars, 100);
  assertEquals(input.currentLength, 100);
});

// ===== Key Stats Tests =====

Deno.test("createKeyStats returns zeroed stats", () => {
  const keys = createKeyStats();
  assertEquals(keys.keyDownCount, 0);
  assertEquals(keys.ctrlCount, 0);
  assertEquals(keys.altCount, 0);
  assertEquals(keys.shiftCount, 0);
});

Deno.test("recordKey increments keyDownCount", () => {
  const keys = createKeyStats();
  recordKey(keys, {});
  assertEquals(keys.keyDownCount, 1);
});

Deno.test("recordKey with ctrlKey increments ctrlCount", () => {
  const keys = createKeyStats();
  recordKey(keys, { ctrlKey: true });
  assertEquals(keys.ctrlCount, 1);
  assertEquals(keys.keyDownCount, 1);
});

Deno.test("recordKey with altKey increments altCount", () => {
  const keys = createKeyStats();
  recordKey(keys, { altKey: true });
  assertEquals(keys.altCount, 1);
});

Deno.test("recordKey with shiftKey increments shiftCount", () => {
  const keys = createKeyStats();
  recordKey(keys, { shiftKey: true });
  assertEquals(keys.shiftCount, 1);
});

// ===== Reset Tests =====

Deno.test("resetAccumulators zeros all counters", () => {
  const focus: FocusAccumulator = {
    focusedTimeMs: 50000,
    unfocusedTimeMs: 10000,
    blurCount: 3,
  };
  const input: InputStats = {
    typedChars: 100,
    pastedChars: 50,
    deletedChars: 20,
    currentLength: 130,
  };
  const keys: KeyStats = {
    keyDownCount: 200,
    ctrlCount: 5,
    altCount: 2,
    shiftCount: 30,
  };

  resetAccumulators(focus, input, keys);

  assertEquals(focus.focusedTimeMs, 0);
  assertEquals(focus.unfocusedTimeMs, 0);
  assertEquals(focus.blurCount, 0);
  assertEquals(input.typedChars, 0);
  assertEquals(input.pastedChars, 0);
  assertEquals(input.deletedChars, 0);
  assertEquals(input.currentLength, 130); // currentLength should NOT reset
  assertEquals(keys.keyDownCount, 0);
  assertEquals(keys.ctrlCount, 0);
  assertEquals(keys.altCount, 0);
  assertEquals(keys.shiftCount, 0);
});
