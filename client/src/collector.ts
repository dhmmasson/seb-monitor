/**
 * Collector interface for managing event listeners and buffer.
 * Used by the heartbeat builder to access event state.
 *
 * @module collector
 */

import type { ExamEvent } from "../../shared/types.ts";

/** Collector interface for managing event listeners and buffer */
export interface Collector {
  /** Start collecting events (attach listeners) */
  start(): void;
  /** Stop collecting events (detach listeners) */
  stop(): void;
  /** Get buffered events */
  getEvents(): ExamEvent[];
  /** Record an event in the buffer */
  record(event: ExamEvent): void;
  /** Record a copy event */
  recordCopy(): void;
  /** Record a paste event */
  recordPaste(): void;
  /** Clear event buffer and reset counts */
  clearEvents(): void;
  /** Get total copy count since last clear */
  getCopyCount(): number;
  /** Get total paste count since last clear */
  getPasteCount(): number;
}

/**
 * Create a new event collector.
 * Manages the event buffer and copy/paste counts for heartbeat reporting.
 * Event listeners are attached by the caller (index.ts).
 *
 * @returns Collector instance
 */
export function createCollector(): Collector {
  // Internal state
  const events: ExamEvent[] = [];
  let copyCount = 0;
  let pasteCount = 0;
  let _started = false;

  return {
    start(): void {
      _started = true;
    },
    stop(): void {
      _started = false;
    },
    getEvents(): ExamEvent[] {
      return [...events];
    },
    record(event: ExamEvent): void {
      events.push(event);
    },
    recordCopy(): void {
      copyCount++;
    },
    recordPaste(): void {
      pasteCount++;
    },
    clearEvents(): void {
      events.length = 0;
      copyCount = 0;
      pasteCount = 0;
    },
    getCopyCount(): number {
      return copyCount;
    },
    getPasteCount(): number {
      return pasteCount;
    },
  };
}
