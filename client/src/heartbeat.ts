/**
 * Heartbeat module for constructing heartbeat payloads.
 * Builds HeartbeatPayload from accumulators and collector data.
 *
 * @module heartbeat
 */

import type {
  FocusAccumulator,
  InputStats,
  KeyStats,
  HeartbeatPayload,
} from "../../shared/types.ts";
import type { Collector } from "./collector.ts";

/** Heartbeat builder interface */
export interface HeartbeatBuilder {
  /** Build a heartbeat payload from current state */
  build(): HeartbeatPayload;
  /** Reset accumulators and clear event buffer after successful send */
  reset(): void;
}

/**
 * Create a heartbeat builder.
 *
 * @param studentId - Student identifier
 * @param examId - Exam identifier
 * @param questionId - Question identifier
 * @param focus - Focus accumulator
 * @param input - Input stats
 * @param keys - Key stats
 * @param collector - Event collector
 * @returns HeartbeatBuilder instance
 */
export function createHeartbeatBuilder(
  studentId: string,
  examId: string,
  questionId: string,
  focus: FocusAccumulator,
  input: InputStats,
  keys: KeyStats,
  collector: Collector,
): HeartbeatBuilder {
  return {
    /**
     * Build a heartbeat payload from current accumulator and collector state.
     * Uses spread operators to create shallow copies of accumulators.
     */
    build(): HeartbeatPayload {
      return {
        studentId,
        examId,
        questionId,
        timestamp: Date.now(),
        // Create copies to prevent external mutation
        focus: { ...focus },
        input: { ...input },
        keys: { ...keys },
        copyCount: collector.getCopyCount(),
        pasteCount: collector.getPasteCount(),
        events: collector.getEvents(),
      };
    },

    /**
     * Reset state after successful heartbeat send.
     * Clears the event buffer in the collector.
     */
    reset(): void {
      collector.clearEvents();
    },
  };
}
