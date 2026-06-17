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

// ===== Copy Hash Tracking Tests =====

Deno.test("collector starts with no copy hashes", () => {
  const collector = createCollector();
  assertEquals(collector.matchPasteHash("anything"), null);
});

Deno.test("recordCopyHash stores hash for matching", () => {
  const collector = createCollector();
  collector.recordCopyHash("abc123");
  assertEquals(collector.matchPasteHash("abc123"), "abc123");
});

Deno.test("matchPasteHash returns null when no matching copy", () => {
  const collector = createCollector();
  collector.recordCopyHash("abc123");
  assertEquals(collector.matchPasteHash("def456"), null);
});

Deno.test("recordCopyHash stores multiple hashes", () => {
  const collector = createCollector();
  collector.recordCopyHash("hash1");
  collector.recordCopyHash("hash2");
  collector.recordCopyHash("hash3");
  assertEquals(collector.matchPasteHash("hash1"), "hash1");
  assertEquals(collector.matchPasteHash("hash2"), "hash2");
  assertEquals(collector.matchPasteHash("hash3"), "hash3");
});

Deno.test("clearEvents clears copy hashes", () => {
  const collector = createCollector();
  collector.recordCopyHash("abc123");
  collector.clearEvents();
  assertEquals(collector.matchPasteHash("abc123"), null);
});

Deno.test("copy hash tracking bounded at 100 entries", () => {
  const collector = createCollector();
  // Add 100 hashes
  for (let i = 0; i < 100; i++) {
    collector.recordCopyHash(`hash-${i}`);
  }
  // All 100 should be present
  assertEquals(collector.matchPasteHash("hash-0"), "hash-0");
  assertEquals(collector.matchPasteHash("hash-99"), "hash-99");

  // Add one more — oldest (hash-0) should be evicted
  collector.recordCopyHash("hash-100");
  assertEquals(collector.matchPasteHash("hash-0"), null, "oldest hash should be evicted");
  assertEquals(collector.matchPasteHash("hash-100"), "hash-100", "newest hash should be present");
  assertEquals(collector.matchPasteHash("hash-99"), "hash-99", "recent hash should still be present");
});
