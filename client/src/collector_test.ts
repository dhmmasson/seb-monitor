import { assertEquals, assertExists } from "@std/assert";
import { createCollector } from "./collector.ts";
import type { ExamEvent } from "../../shared/types.ts";

// ===== Collector Creation Tests =====

Deno.test("createCollector returns collector object", () => {
  const collector = createCollector();
  assertExists(collector);
  assertEquals(typeof collector.start, "function");
  assertEquals(typeof collector.stop, "function");
  assertEquals(typeof collector.getEvents, "function");
  assertEquals(typeof collector.record, "function");
  assertEquals(typeof collector.recordCopy, "function");
  assertEquals(typeof collector.recordPaste, "function");
  assertEquals(typeof collector.clearEvents, "function");
  assertEquals(typeof collector.getCopyCount, "function");
  assertEquals(typeof collector.getPasteCount, "function");
});

// ===== Empty State Tests =====

Deno.test("collector starts with empty events", () => {
  const collector = createCollector();
  assertEquals(collector.getEvents().length, 0);
});

Deno.test("collector starts with zero copy count", () => {
  const collector = createCollector();
  assertEquals(collector.getCopyCount(), 0);
});

Deno.test("collector starts with zero paste count", () => {
  const collector = createCollector();
  assertEquals(collector.getPasteCount(), 0);
});

// ===== Record Tests =====

Deno.test("record adds event to buffer", () => {
  const collector = createCollector();
  const event: ExamEvent = { type: "focus", timestamp: 1000 };
  collector.record(event);
  const events = collector.getEvents();
  assertEquals(events.length, 1);
  assertEquals(events[0].type, "focus");
  assertEquals(events[0].timestamp, 1000);
});

Deno.test("record adds multiple events", () => {
  const collector = createCollector();
  collector.record({ type: "focus", timestamp: 1000 });
  collector.record({ type: "blur", timestamp: 2000 });
  collector.record({ type: "focus", timestamp: 3000 });
  assertEquals(collector.getEvents().length, 3);
});

Deno.test("recordCopy increments copy count", () => {
  const collector = createCollector();
  collector.recordCopy();
  assertEquals(collector.getCopyCount(), 1);
  collector.recordCopy();
  assertEquals(collector.getCopyCount(), 2);
});

Deno.test("recordPaste increments paste count", () => {
  const collector = createCollector();
  collector.recordPaste();
  assertEquals(collector.getPasteCount(), 1);
  collector.recordPaste();
  assertEquals(collector.getPasteCount(), 2);
});

// ===== getEvents Returns Copy =====

Deno.test("getEvents returns a copy of the buffer", () => {
  const collector = createCollector();
  collector.record({ type: "focus", timestamp: 1000 });
  const events1 = collector.getEvents();
  const events2 = collector.getEvents();
  assertEquals(events1.length, 1);
  assertEquals(events2.length, 1);
  // Modifying the returned array should not affect internal state
  events1.push({ type: "blur", timestamp: 2000 });
  assertEquals(collector.getEvents().length, 1);
});

// ===== Clear Tests =====

Deno.test("clearEvents empties the event buffer", () => {
  const collector = createCollector();
  collector.record({ type: "focus", timestamp: 1000 });
  collector.record({ type: "blur", timestamp: 2000 });
  collector.clearEvents();
  assertEquals(collector.getEvents().length, 0);
});

Deno.test("clearEvents resets copy and paste counts", () => {
  const collector = createCollector();
  collector.recordCopy();
  collector.recordCopy();
  collector.recordPaste();
  collector.clearEvents();
  assertEquals(collector.getCopyCount(), 0);
  assertEquals(collector.getPasteCount(), 0);
});

// ===== Integration Test =====

Deno.test("collector records events and counts together", () => {
  const collector = createCollector();

  // Simulate some activity
  collector.record({ type: "focus", timestamp: 1000 });
  collector.recordCopy();
  collector.record({
    type: "copy",
    timestamp: 1500,
    hash: "abc123",
    length: 10,
  });
  collector.recordPaste();
  collector.record({
    type: "paste",
    timestamp: 2000,
    hash: "def456",
    length: 20,
    matchedCopyHash: null,
  });
  collector.record({ type: "blur", timestamp: 3000 });

  assertEquals(collector.getEvents().length, 4);
  assertEquals(collector.getCopyCount(), 1);
  assertEquals(collector.getPasteCount(), 1);

  // Clear and verify reset
  collector.clearEvents();
  assertEquals(collector.getEvents().length, 0);
  assertEquals(collector.getCopyCount(), 0);
  assertEquals(collector.getPasteCount(), 0);
});
