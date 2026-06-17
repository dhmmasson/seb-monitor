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
  /** Record a copy hash for paste matching */
  recordCopyHash(hash: string): void;
  /** Match a paste hash against previously recorded copies */
  matchPasteHash(pasteHash: string): string | null;
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

  // Copy hash tracking for paste matching (bounded at 100 entries)
  const copyHashes = new Map<string, number>(); // hash → timestamp
  const MAX_COPY_HASHES = 100;

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
    recordCopyHash(hash: string): void {
      copyHashes.set(hash, Date.now());
      // Evict oldest if over limit
      if (copyHashes.size > MAX_COPY_HASHES) {
        const oldest = [...copyHashes.entries()]
          .sort((a, b) => a[1] - b[1])[0];
        copyHashes.delete(oldest[0]);
      }
    },
    matchPasteHash(pasteHash: string): string | null {
      return copyHashes.has(pasteHash) ? pasteHash : null;
    },
    clearEvents(): void {
      events.length = 0;
      copyCount = 0;
      pasteCount = 0;
      copyHashes.clear();
    },
    getCopyCount(): number {
      return copyCount;
    },
    getPasteCount(): number {
      return pasteCount;
    },
  };
}
