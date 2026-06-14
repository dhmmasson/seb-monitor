/**
 * IIFE entry point for the SEB monitoring library.
 * This is the main module that initializes and starts the monitoring system.
 *
 * @module index
 */

/** Result of initialization */
export interface InitResult {
  /** Student ID extracted from DOM */
  studentId: string;
  /** Exam ID extracted from DOM */
  examId: string;
  /** Question ID (default: "default") */
  questionId: string;
  /** Start the heartbeat timer */
  start(): void;
  /** Stop the heartbeat timer */
  stop(): void;
}

/** Get element by ID function type for dependency injection */
export type GetElementByIdFn = (id: string) => HTMLElement | null;

/**
 * Initialize the monitoring system.
 * Reads student/exam IDs from DOM elements and sets up the heartbeat system.
 *
 * @param serverUrl - URL of the monitoring server
 * @param getElementById - Function to get DOM elements (default: document.getElementById)
 * @returns InitResult with start/stop methods
 * @throws Error if required DOM elements are not found
 */
export function initialize(
  _serverUrl: string,
  _getElementById: GetElementByIdFn = document.getElementById.bind(document),
): InitResult {
  // TODO: Implement
  throw new Error("Not implemented");
}
