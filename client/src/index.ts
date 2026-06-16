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

import {
  createFocusAccumulator,
  createInputStats,
  createKeyStats,
  recordBlur,
  recordInput,
  recordKey,
  resetAccumulators,
} from "./accumulator.ts";
import { sha256 } from "./crypto.ts";
import { createCollector } from "./collector.ts";
import { createHeartbeatBuilder } from "./heartbeat.ts";
import { createSender } from "./sender.ts";
import type { FocusAccumulator, InputStats } from "../../shared/types.ts";

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
  /** Start the heartbeat timer and event listeners */
  start(): void;
  /** Stop the heartbeat timer and event listeners */
  stop(): void;
}

/** Default heartbeat interval in milliseconds */
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60_000;

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
  const url = currentUrl ??
    (typeof location !== "undefined" ? location.href : "");
  const doc = documentRef ??
    (typeof document !== "undefined" ? document : null);

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
 * Sets up accumulators, event listeners, heartbeat timer, and sender.
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
  const doc = documentRef ??
    (typeof document !== "undefined" ? document : null);
  const script = scriptElement ??
    doc?.querySelector("script[data-student-id]") as HTMLScriptElement | null;

  if (!script) {
    throw new Error(
      "Could not find seb-monitor script tag with data-student-id attribute",
    );
  }

  // Read required attributes
  const studentId = requireAttr(script, "studentId");
  const examId = requireAttr(script, "examId");
  const serverUrl = requireAttr(script, "serverUrl");

  // Read optional questionId (falls back to URL params or "default")
  const questionId = script.dataset.questionId ?? resolveQuestionId();

  // Create accumulators
  const focus: FocusAccumulator = createFocusAccumulator();
  const input: InputStats = createInputStats();
  const keys = createKeyStats();
  const collector = createCollector();

  // State
  const pendingPastes: {
    hash: string;
    content: string;
    length: number;
    timestamp: number;
  }[] = [];
  let lastFocusTime = Date.now();
  let isFocused = typeof document !== "undefined"
    ? document.visibilityState === "visible"
    : true;
  let lastInputWasPaste = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let immediateHeartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  const IMMEDIATE_HEARTBEAT_DELAY_MS = 500;
  let _started = false;
  let sessionId = ""; // Set from first heartbeat response

  // Sender
  const sender = createSender(serverUrl);

  /**
   * Schedule an immediate heartbeat send with debounce.
   * Called after copy/paste events to ensure they are captured promptly.
   * Multiple rapid events within the delay window are batched into a single heartbeat.
   */
  function scheduleImmediateHeartbeat(): void {
    if (!_started) return;
    if (immediateHeartbeatTimer !== null) {
      clearTimeout(immediateHeartbeatTimer);
    }
    immediateHeartbeatTimer = setTimeout(() => {
      immediateHeartbeatTimer = null;
      if (!_started) return;
      sendHeartbeat().catch(() => {});
    }, IMMEDIATE_HEARTBEAT_DELAY_MS);
  }

  // Heartbeat builder
  const heartbeat = createHeartbeatBuilder(
    studentId,
    examId,
    questionId,
    focus,
    input,
    keys,
    collector,
  );

  // --- Event Handlers ---

  function handleVisibilityChange(): void {
    if (!doc) return;
    const now = Date.now();
    if (doc.visibilityState === "visible") {
      if (!isFocused) {
        focus.unfocusedTimeMs += now - lastFocusTime;
        isFocused = true;
        lastFocusTime = now;
        collector.record({ type: "focus", timestamp: now });
      }
    } else {
      if (isFocused) {
        focus.focusedTimeMs += now - lastFocusTime;
        isFocused = false;
        lastFocusTime = now;
        collector.record({ type: "blur", timestamp: now });
      }
    }
  }

  function handleFocus(): void {
    if (!isFocused) {
      const now = Date.now();
      focus.unfocusedTimeMs += now - lastFocusTime;
      isFocused = true;
      lastFocusTime = now;
      collector.record({ type: "focus", timestamp: now });
    }
  }

  function handleBlur(): void {
    if (isFocused) {
      const now = Date.now();
      focus.focusedTimeMs += now - lastFocusTime;
      isFocused = false;
      recordBlur(focus);
      lastFocusTime = now;
      collector.record({ type: "blur", timestamp: now });
    }
  }

  async function handleCopy(): Promise<void> {
    const selection = typeof globalThis !== "undefined" &&
        typeof globalThis.getSelection === "function"
      ? globalThis.getSelection()?.toString() ?? ""
      : "";
    if (selection) {
      const hash = await sha256(selection);
      collector.recordCopy();
      collector.record({
        type: "copy",
        timestamp: Date.now(),
        hash,
        length: selection.length,
      });
      scheduleImmediateHeartbeat();
    }
  }

  async function handlePaste(e: ClipboardEvent): Promise<void> {
    const pastedText = e.clipboardData?.getData("text") ?? "";
    if (pastedText) {
      const hash = await sha256(pastedText);
      collector.recordPaste();
      lastInputWasPaste = true;

      collector.record({
        type: "paste",
        timestamp: Date.now(),
        hash,
        length: pastedText.length,
        matchedCopyHash: null,
      });

      // Buffer paste content — will be sent after heartbeat establishes sessionId
      pendingPastes.push({
        hash,
        content: pastedText,
        length: pastedText.length,
        timestamp: Date.now(),
      });
      scheduleImmediateHeartbeat();
    }
  }

  function handleInput(): void {
    // Find answer fields (textarea, contenteditable)
    const answerFields = doc
      ? doc.querySelectorAll("textarea, [contenteditable='true']")
      : [];
    let totalLength = 0;
    for (const field of answerFields) {
      totalLength += (field as HTMLTextAreaElement).value?.length ?? 0;
    }
    const delta = totalLength - input.currentLength;
    if (delta !== 0) {
      recordInput(input, delta, lastInputWasPaste);
      lastInputWasPaste = false;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    recordKey(keys, e);
  }

  // --- Heartbeat Send ---

  async function sendHeartbeat(): Promise<void> {
    // Update focus time if currently focused
    if (isFocused) {
      const now = Date.now();
      focus.focusedTimeMs += now - lastFocusTime;
      lastFocusTime = now;
    }

    const payload = heartbeat.build();

    try {
      const result = await sender.sendHeartbeat(payload);
      sessionId = result.sessionId ?? sessionId;

      // Flush any buffered paste content now that we have a sessionId
      for (const paste of pendingPastes) {
        await sender.sendPasteContent({
          hash: paste.hash,
          content: paste.content,
          length: paste.length,
          sessionId,
          examId,
          timestamp: paste.timestamp,
        });
      }
      pendingPastes.length = 0;

      // Reset after successful send
      resetAccumulators(focus, input, keys);
      collector.clearEvents();
    } catch {
      // Silent failure — will retry on next interval
    }
  }

  // --- Start/Stop ---

  return {
    studentId,
    examId,
    serverUrl,
    questionId,
    start(): void {
      if (_started) return;
      _started = true;

      // Attach event listeners
      if (typeof globalThis.addEventListener === "function") {
        globalThis.addEventListener("focus", handleFocus);
        globalThis.addEventListener("blur", handleBlur);
      }
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("copy", handleCopy);
        document.addEventListener("paste", handlePaste as EventListener);
        document.addEventListener("keydown", handleKeydown as EventListener);
        document.addEventListener("input", handleInput);
      }

      // Send initial heartbeat immediately to register the student
      sendHeartbeat().catch(() => {});

      // Start heartbeat timer
      heartbeatTimer = setInterval(() => {
        sendHeartbeat();
      }, DEFAULT_HEARTBEAT_INTERVAL_MS);

      lastFocusTime = Date.now();
    },
    stop(): void {
      if (!_started) return;
      _started = false;

      // Detach event listeners
      if (typeof globalThis.removeEventListener === "function") {
        globalThis.removeEventListener("focus", handleFocus);
        globalThis.removeEventListener("blur", handleBlur);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
        document.removeEventListener("copy", handleCopy);
        document.removeEventListener("paste", handlePaste as EventListener);
        document.removeEventListener("keydown", handleKeydown as EventListener);
        document.removeEventListener("input", handleInput);
      }

      // Clear heartbeat timer
      if (heartbeatTimer !== null) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }

      // Clear immediate heartbeat timer
      if (immediateHeartbeatTimer !== null) {
        clearTimeout(immediateHeartbeatTimer);
        immediateHeartbeatTimer = null;
      }
    },
  };
}

/**
 * Auto-initialize and start monitoring.
 * Called when the script loads as an IIFE in the browser.
 * Exposes the result on `window.__sebMonitor` for external access.
 */
function autoStart(): void {
  try {
    const result = initialize();
    result.start();
    // Expose for external access (demo, debugging)
    if (typeof globalThis !== "undefined") {
      (globalThis as unknown as Record<string, unknown>).__sebMonitor = result;
    }
    console.log(
      `[SEB Monitor] Monitoring started for ${result.studentId} on ${result.examId}`,
    );
  } catch (error) {
    console.error(
      "[SEB Monitor] Failed to initialize:",
      (error as Error).message,
    );
  }
}

// Auto-start when loaded as an IIFE in a browser environment
if (
  typeof document !== "undefined" &&
  typeof document.addEventListener === "function"
) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart);
  } else {
    autoStart();
  }
}
