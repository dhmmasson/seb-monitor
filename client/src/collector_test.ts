import { assertEquals, assertExists } from "@std/assert";
import { createCollector } from "./collector.ts";
import type { FocusAccumulator, InputStats, KeyStats } from "../../shared/types.ts";

// Helper to create mock accumulators
function createMockAccumulators() {
  return {
    focus: {
      focusedTimeMs: 0,
      unfocusedTimeMs: 0,
      blurCount: 0,
    } as FocusAccumulator,
    input: {
      typedChars: 0,
      pastedChars: 0,
      deletedChars: 0,
      currentLength: 0,
    } as InputStats,
    keys: {
      keyDownCount: 0,
      ctrlCount: 0,
      altCount: 0,
      shiftCount: 0,
    } as KeyStats,
  };
}

// Mock paste sender
const mockSendPaste = async (_content: string, _hash: string): Promise<void> => {};

// ===== Collector Creation Tests =====

Deno.test("createCollector returns collector object", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  assertExists(collector);
  assertEquals(typeof collector.start, "function");
  assertEquals(typeof collector.stop, "function");
  assertEquals(typeof collector.getEvents, "function");
  assertEquals(typeof collector.clearEvents, "function");
});

Deno.test("collector starts with empty events", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  const events = collector.getEvents();
  assertEquals(events.length, 0);
});

Deno.test("collector starts with zero copy count", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  assertEquals(collector.getCopyCount(), 0);
});

Deno.test("collector starts with zero paste count", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  assertEquals(collector.getPasteCount(), 0);
});

Deno.test("clearEvents empties the event buffer", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  collector.clearEvents();
  assertEquals(collector.getEvents().length, 0);
});

Deno.test("clearEvents resets copy and paste counts", () => {
  const { focus, input, keys } = createMockAccumulators();
  const collector = createCollector(focus, input, keys, mockSendPaste);
  collector.clearEvents();
  assertEquals(collector.getCopyCount(), 0);
  assertEquals(collector.getPasteCount(), 0);
});
