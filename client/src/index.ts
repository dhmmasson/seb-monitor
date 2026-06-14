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
  getElementById: GetElementByIdFn = document.getElementById.bind(document),
): InitResult {
  // Read student ID from DOM
  const userElement = getElementById("theuser");
  if (!userElement) {
    throw new Error("Required DOM element not found: theuser");
  }
  const studentId = userElement.textContent ?? "";

  // Read module ID from DOM (not used in current implementation)
  const moduleElement = getElementById("themodule");
  if (!moduleElement) {
    throw new Error("Required DOM element not found: themodule");
  }

  // Read exam ID from DOM
  const examElement = getElementById("theexam");
  if (!examElement) {
    throw new Error("Required DOM element not found: theexam");
  }
  const examId = examElement.textContent ?? "";

  // Default question ID (can be extended to read from DOM or config)
  const questionId = "default";

  return {
    studentId,
    examId,
    questionId,
    /** Start the heartbeat timer and event collection */
    start(): void {
      // TODO: Initialize accumulators, collector, heartbeat builder, sender
      // TODO: Start heartbeat timer
    },
    /** Stop the heartbeat timer and event collection */
    stop(): void {
      // TODO: Clear heartbeat timer
    },
  };
}
