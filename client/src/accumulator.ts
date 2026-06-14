/**
 * Accumulator module for tracking focus time, input stats, and keyboard stats.
 * These counters are maintained client-side and reset after each heartbeat.
 *
 * @module accumulator
 */

import type {
  FocusAccumulator,
  InputStats,
  KeyStats,
} from "../../shared/types.ts";

/**
 * Create a new FocusAccumulator with zeroed values.
 */
export function createFocusAccumulator(): FocusAccumulator {
  return {
    focusedTimeMs: 0,
    unfocusedTimeMs: 0,
    blurCount: 0,
  };
}

/**
 * Record a blur event (page lost focus).
 */
export function recordBlur(focus: FocusAccumulator): void {
  focus.blurCount++;
}

/**
 * Calculate focus ratio: focusedTime / (focusedTime + unfocusedTime).
 * Returns 1 if no time has been recorded yet.
 */
export function getFocusRatio(focus: FocusAccumulator): number {
  const total = focus.focusedTimeMs + focus.unfocusedTimeMs;
  if (total === 0) return 1;
  return focus.focusedTimeMs / total;
}

/**
 * Create a new InputStats with zeroed values.
 */
export function createInputStats(): InputStats {
  return {
    typedChars: 0,
    pastedChars: 0,
    deletedChars: 0,
    currentLength: 0,
  };
}

/**
 * Record input event (text change in an answer field).
 * @param delta - Change in text length (positive for insert, negative for delete)
 * @param isPaste - Whether this input immediately follows a paste event
 */
export function recordInput(
  input: InputStats,
  delta: number,
  isPaste: boolean,
): void {
  input.currentLength += delta;
  if (delta > 0) {
    if (isPaste) {
      input.pastedChars += delta;
    } else {
      input.typedChars += delta;
    }
  } else if (delta < 0) {
    input.deletedChars += Math.abs(delta);
  }
}

/**
 * Create a new KeyStats with zeroed values.
 */
export function createKeyStats(): KeyStats {
  return {
    keyDownCount: 0,
    ctrlCount: 0,
    altCount: 0,
    shiftCount: 0,
  };
}

/**
 * Record a keydown event with modifier key state.
 * Only stores counts, never actual key values.
 *
 * @param keys - The KeyStats accumulator to update
 * @param event - Object indicating which modifier keys were pressed
 */
export function recordKey(
  keys: KeyStats,
  event: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean },
): void {
  keys.keyDownCount++;
  keys.ctrlCount += event.ctrlKey ? 1 : 0;
  keys.altCount += event.altKey ? 1 : 0;
  keys.shiftCount += event.shiftKey ? 1 : 0;
}

/**
 * Reset accumulators for next heartbeat.
 * Note: currentLength is NOT reset as it represents the current state.
 */
export function resetAccumulators(
  focus: FocusAccumulator,
  input: InputStats,
  keys: KeyStats,
): void {
  const savedLength = input.currentLength;
  focus.focusedTimeMs = 0;
  focus.unfocusedTimeMs = 0;
  focus.blurCount = 0;
  input.typedChars = 0;
  input.pastedChars = 0;
  input.deletedChars = 0;
  input.currentLength = savedLength;
  keys.keyDownCount = 0;
  keys.ctrlCount = 0;
  keys.altCount = 0;
  keys.shiftCount = 0;
}

/**
 * Record focus time increment (called periodically while page is visible).
 * @param ms - Milliseconds to add to focused time
 */
export function recordFocusTime(focus: FocusAccumulator, ms: number): void {
  focus.focusedTimeMs += ms;
}

/**
 * Record unfocused time increment (called periodically while page is hidden).
 * @param ms - Milliseconds to add to unfocused time
 */
export function recordUnfocusedTime(focus: FocusAccumulator, ms: number): void {
  focus.unfocusedTimeMs += ms;
}
