/**
 * Multi-layer paste detector for SEB-compatible paste capture.
 *
 * Safe Exam Browser (SEB) intercepts Ctrl+V at the OS level and blocks
 * the native DOM `paste` event. This module detects pastes through
 * alternative mechanisms:
 *
 * Layer 1: Keyboard shortcut (Ctrl+V / Cmd+V) + content diff
 *   - keydown fires at keyboard level (harder for SEB to block)
 *   - Snapshot answer fields before the paste modifies content
 *   - Diff after browser inserts the pasted text
 *
 * Layer 2: `beforeinput` event with `inputType: "insertFromPaste"`
 *   - Fires before content is committed; carries `event.data` directly
 *   - Provides the pasted text without needing a diff
 *
 * @module paste-detector
 */

/** Answer field element interface (works with both textarea and contenteditable) */
export interface AnswerField {
  value?: string;
  textContent?: string | null;
  getAttribute?(name: string): string | null;
}

/** Dedup window in milliseconds — paste events within this window are considered duplicates */
export const PASTE_DEDUP_WINDOW_MS = 300;

/** Shared mutable timestamp across paste detection layers */
export interface PasteTimestamp {
  /** Timestamp (ms) of the last recorded paste, 0 if none */
  value: number;
}

/** Options for creating a paste detector */
export interface PasteDetectorOptions {
  /** Called when paste text is detected (from any layer) */
  onPaste: (text: string) => void;
  /** Document reference for event listeners (default: global document) */
  documentRef?: Document;
  /** Function that returns current answer fields (default: queries DOM) */
  answerFieldsFn?: () => AnswerField[];
  /** Shared dedup timestamp — checked before recording, updated after */
  lastPasteDetectedAt?: PasteTimestamp;
}

/** Get text content from an answer field */
function getFieldText(field: AnswerField): string {
  if (
    field.getAttribute?.("contenteditable") === "true" ||
    field.getAttribute?.("contenteditable") === ""
  ) {
    return field.textContent ?? "";
  }
  return field.value ?? "";
}

/**
 * Extract the pasted text by diffing before/after content.
 * Returns the text that was inserted, or empty string if no paste detected.
 *
 * Detects three paste positions:
 * - Append (after starts with before) — returns the suffix
 * - Prepend (after ends with before) — returns the prefix
 * - Insert (before is a substring) — returns the text inserted around it
 *
 * Returns empty string if content was deleted or unchanged.
 *
 * Pure function — no side effects, easy to test.
 */
export function extractPastedText(
  before: string,
  after: string,
): string {
  if (after.length <= before.length) return "";

  // Case 1: Appended at end (most common — Ctrl+V at cursor)
  if (after.startsWith(before)) {
    return after.slice(before.length);
  }

  // Case 2: Prepended at beginning
  if (after.endsWith(before)) {
    return after.slice(0, after.length - before.length);
  }

  // Case 3: Inserted in the middle (before content split across after)
  const idx = after.indexOf(before);
  if (idx > 0 && idx + before.length < after.length) {
    const prefix = after.slice(0, idx);
    const suffix = after.slice(idx + before.length);
    return prefix + suffix;
  }

  // Cannot determine paste location — return full new content
  return after;
}

/** Paste detector interface */
export interface PasteDetector {
  /** Start listening for paste-related events */
  start(): void;
  /** Stop listening and clean up */
  stop(): void;
  /** Snapshot current answer field content (call before paste action) */
  snapshotAnswerFields(): void;
  /** Handle a keyboard paste event (called from keydown handler) */
  handleKeyboardPaste(event: KeyboardEvent): void;
  /** Handle a beforeinput event */
  handleBeforeInput(event: InputEvent): void;
  /** Default answer fields query function */
  answerFieldsFn: () => AnswerField[];
}

/**
 * Create a paste detector with multi-layer detection.
 *
 * @param options - Configuration options
 * @returns PasteDetector instance
 */
export function createPasteDetector(
  options: PasteDetectorOptions,
): PasteDetector {
  const doc = options.documentRef ??
    (typeof document !== "undefined" ? document : null);

  let snapshotBefore = "";
  let keydownBound: ((e: KeyboardEvent) => void) | null = null;
  let beforeInputBound: ((e: Event) => void) | null = null;

  /** Default answer fields query */
  function defaultAnswerFieldsFn(): AnswerField[] {
    if (!doc) return [];
    const elements = doc.querySelectorAll(
      "textarea, [contenteditable='true']",
    );
    return Array.from(elements) as unknown as AnswerField[];
  }

  const answerFieldsFn = options.answerFieldsFn ?? defaultAnswerFieldsFn;

  /** Snapshot content of all answer fields */
  function snapshotAnswerFields(): void {
    const fields = answerFieldsFn();
    snapshotBefore = fields.map(getFieldText).join("\n");
  }

  /**
   * Diff against snapshot to extract pasted text.
   * Does NOT update snapshot — caller controls when to snapshot.
   */
  function diffAfterSnapshot(): string {
    const fields = answerFieldsFn();
    const snapshotAfter = fields.map(getFieldText).join("\n");
    return extractPastedText(snapshotBefore, snapshotAfter);
  }

  /** Handle keyboard paste event (Ctrl+V / Cmd+V) — diff-based */
  function handleKeyboardPaste(event: KeyboardEvent): void {
    const isPasteKey = event.key === "v" &&
      (event.ctrlKey || event.metaKey);
    if (!isPasteKey) return;

    const text = diffAfterSnapshot();
    if (text) {
      const now = Date.now();
      if (
        !options.lastPasteDetectedAt ||
        now - options.lastPasteDetectedAt.value >= PASTE_DEDUP_WINDOW_MS
      ) {
        if (options.lastPasteDetectedAt) {
          options.lastPasteDetectedAt.value = now;
        }
        options.onPaste(text);
      }
    }
  }

  /** Handle beforeinput event — direct text from event.data */
  function handleBeforeInput(event: InputEvent): void {
    if (event.inputType !== "insertFromPaste") return;
    const data = event.data;
    if (!data) return;
    const now = Date.now();
    if (
      !options.lastPasteDetectedAt ||
      now - options.lastPasteDetectedAt.value >= PASTE_DEDUP_WINDOW_MS
    ) {
      if (options.lastPasteDetectedAt) {
        options.lastPasteDetectedAt.value = now;
      }
      options.onPaste(data);
    }
  }

  return {
    start(): void {
      if (!doc) return;

      keydownBound = (e: KeyboardEvent) => {
        // Snapshot before the paste modifies content
        snapshotAnswerFields();
        // Use microtask to run diff after the browser inserts content
        queueMicrotask(() => handleKeyboardPaste(e));
      };
      beforeInputBound = (e: Event) => handleBeforeInput(e as InputEvent);

      doc.addEventListener("keydown", keydownBound as EventListener);
      doc.addEventListener("beforeinput", beforeInputBound as EventListener);
    },

    stop(): void {
      if (!doc) return;
      if (keydownBound) {
        doc.removeEventListener(
          "keydown",
          keydownBound as EventListener,
        );
        keydownBound = null;
      }
      if (beforeInputBound) {
        doc.removeEventListener(
          "beforeinput",
          beforeInputBound as EventListener,
        );
        beforeInputBound = null;
      }
    },

    snapshotAnswerFields,

    /** Handle keyboard paste directly — diff against existing snapshot */
    handleKeyboardPaste(event: KeyboardEvent): void {
      handleKeyboardPaste(event);
    },

    handleBeforeInput,

    answerFieldsFn,
  };
}
