/**
 * Collector module for monitoring browser events.
 * Attaches event listeners for copy, paste, focus, blur, keydown, and input events.
 * Maintains an event buffer that is sent with each heartbeat.
 *
 * @module collector
 */

import type {
  ExamEvent,
  FocusAccumulator,
  InputStats,
  KeyStats,
} from "../../shared/types.ts";

/** Callback type for sending paste content to server */
export type SendPasteContent = (content: string, hash: string) => Promise<void>;

/** Collector interface for managing event listeners and buffer */
export interface Collector {
  /** Start collecting events (attach listeners) */
  start(): void;
  /** Stop collecting events (detach listeners) */
  stop(): void;
  /** Get buffered events */
  getEvents(): ExamEvent[];
  /** Clear event buffer and reset counts */
  clearEvents(): void;
  /** Get total copy count since last clear */
  getCopyCount(): number;
  /** Get total paste count since last clear */
  getPasteCount(): number;
}

/**
 * Create a new event collector.
 *
 * @param focus - Focus accumulator to update on focus/blur events
 * @param input - Input stats to update on input events
 * @param keys - Key stats to update on keydown events
 * @param sendPasteContent - Callback to send paste content to server immediately
 * @returns Collector instance
 */
export function createCollector(
  _focus: FocusAccumulator,
  _input: InputStats,
  _keys: KeyStats,
  _sendPasteContent: SendPasteContent,
): Collector {
  // Internal state
  const events: ExamEvent[] = [];
  let copyCount = 0;
  let pasteCount = 0;
  let _started = false;

  // Public API
  return {
    start(): void {
      _started = true;
    },
    stop(): void {
      _started = false;
    },
    getEvents(): ExamEvent[] {
      // Return a copy to prevent external mutation
      return [...events];
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
