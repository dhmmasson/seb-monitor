/**
 * IIFE entry point for the SEB monitoring library.
 * Reads all configuration from `data-*` attributes on the <script> tag.
 *
 * Usage in Moodle:
 * <script src="server/seb-monitor.js"
 *   data-student-id="{fullname}"
 *   data-module-id="{module}"
 *   data-exam-id="{thisurl}"
 *   data-server-url="https://monitor.example.com"
 *   data-question-id="q3"
 * ></script>
 *
 * @module index
 */

/** Result of initialization */
export interface InitResult {
  /** Student ID from data-student-id */
  studentId: string;
  /** Exam ID from data-exam-id */
  examId: string;
  /** Server URL from data-server-url */
  serverUrl: string;
  /** Question ID from data-question-id or URL params */
  questionId: string;
  /** Start the heartbeat timer */
  start(): void;
  /** Stop the heartbeat timer */
  stop(): void;
}

/**
 * Resolve the question ID from the script tag or page URL.
 * Priority:
 * 1. data-question-id attribute on the <script> tag
 * 2. "slot" query parameter (Moodle quiz URLs)
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
 * Read a required data attribute from the script element.
 * Throws if the attribute is missing or empty.
 */
function requireAttr(
  script: HTMLScriptElement,
  camelName: string,
): string {
  const value = script.dataset[camelName];
  if (!value) {
    // Convert camelCase to kebab-case for the error message
    const kebab = camelName.replace(/([A-Z])/g, "-$1").toLowerCase();
    throw new Error(`Missing required attribute on script tag: data-${kebab}`);
  }
  return value;
}

/**
 * Initialize the monitoring system from a <script> tag's data attributes.
 *
 * @param scriptElement - The <script> element (auto-discovered if not provided)
 * @param documentRef - Document reference for auto-discovery (default: global document)
 * @returns InitResult with start/stop methods
 * @throws Error if required data attributes are missing
 */
export function initialize(
  scriptElement?: HTMLScriptElement,
  documentRef?: { querySelector: (s: string) => Element | null },
): InitResult {
  // Find the script element
  const doc = documentRef ?? (typeof document !== "undefined" ? document : null);
  const script = scriptElement ?? doc?.querySelector("script[data-student-id]") as HTMLScriptElement | null;

  if (!script) {
    throw new Error("Could not find seb-monitor script tag with data-student-id attribute");
  }

  // Read required attributes
  const studentId = requireAttr(script, "studentId");
  const examId = requireAttr(script, "examId");
  const serverUrl = requireAttr(script, "serverUrl");

  // Read optional questionId (falls back to URL params or "default")
  const questionId = script.dataset.questionId ?? resolveQuestionId();

  return {
    studentId,
    examId,
    serverUrl,
    questionId,
    start(): void {
      // TODO: Initialize accumulators, collector, heartbeat builder, sender
      // TODO: Start heartbeat timer
    },
    stop(): void {
      // TODO: Clear heartbeat timer
    },
  };
}
