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
 * Resolve the question ID from the page context.
 * Tries multiple sources in order:
 * 1. data-question-id attribute on the <script> tag that loaded this library
 * 2. "slot" query parameter (Moodle quiz URLs: /mod/quiz/attempt.php?slot=3)
 * 3. "questionId" query parameter (generic)
 * 4. Falls back to "default"
 */
export function resolveQuestionId(
  currentUrl?: string,
  documentRef?: { querySelector: (s: string) => Element | null },
): string {
  const url = currentUrl ?? (typeof location !== "undefined" ? location.href : "");
  const doc = documentRef ?? (typeof document !== "undefined" ? document : null);

  // 1. Check data-question-id on the script tag
  if (doc) {
    const scriptEl = doc.querySelector("script[data-question-id]");
    if (scriptEl) {
      const qid = scriptEl.getAttribute("data-question-id");
      if (qid) return qid;
    }
  }

  // 2. Check URL query parameters
  try {
    const params = new URL(url).searchParams;
    return params.get("slot") ?? params.get("questionId") ?? "default";
  } catch {
    return "default";
  }
}

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

  // Read question ID with fallback chain:
  // 1. data-question-id attribute on the <script> tag
  // 2. "slot" query parameter from Moodle quiz URLs
  //    (e.g., /mod/quiz/attempt.php?attempt=123&slot=3)
  // 3. "questionId" query parameter (generic)
  // 4. Default: "default"
  const questionId = resolveQuestionId();

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
