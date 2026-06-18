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

import diff from "fast-diff";

/** Diff tuple type constants from fast-diff */
const INSERT = diff.INSERT;

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
 * Extract the pasted text by diffing before/after content using fast-diff.
 * Returns the inserted text, or empty string if no paste detected.
 *
 * Uses the Myers O(ND) diff algorithm (via fast-diff) with semantic cleanup
 * to produce a clean edit script, then concatenates all INSERT segments.
 * Semantic cleanup ensures that DELETE and INSERT segments are cleanly
 * separated (no interleaved EQUAL characters from character-level alignment).
 *
 * This correctly handles:
 * - Append at cursor (most common)
 * - Prepend at beginning
 * - Insert in the middle of existing text
 * - Paste over selected text (DELETE + INSERT in the diff)
 * - Repeating text patterns (where substring matching fails)
 *
 * Returns empty string if content was deleted or unchanged.
 *
 * Pure function — no side effects, easy to test.
 */
export function extractPastedText(
  before: string,
  after: string,
): string {
  if (after.length < before.length) return "";

  // Run Myers diff with semantic cleanup (4th arg = true).
  // Cleanup merges adjacent equalities and cleanly separates DELETE/INSERT
  // blocks, preventing character-level interleaving that would fragment
  // the pasted text across multiple INSERT tuples.
  const diffs = diff(before, after, undefined, true);

  // Extract only INSERT segments — these are the pasted text.
  // DELETE segments represent selected text being replaced, not pasted content.
  return diffs
    .filter(([type]) => type === INSERT)
    .map(([, text]) => text)
    .join("");
}

/** Paste detector interface */
export interface PasteDetector {
  /** Start listening for paste-related events */
  start(): void;
  /** Stop listening and clean up */
  stop(): void;
  /** Snapshot current answer field content (call before paste action) */
  snapshotAnswerFields(): void;
  /**
   * Handle a keyboard paste event (called from keydown handler).
   * Returns true if a paste was detected (content changed), false otherwise.
   * Returning false allows the caller to retry after a delay (SEB async injection).
   */
  handleKeyboardPaste(event: KeyboardEvent): boolean;
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

  /** Handle keyboard paste event (Ctrl+V / Cmd+V) — diff-based.
   * Returns true if a paste was detected (content diff found), false otherwise.
   * Callers can retry on false to handle SEB's async clipboard injection.
   */
  function handleKeyboardPaste(event: KeyboardEvent): boolean {
    const isPasteKey = event.key === "v" &&
      (event.ctrlKey || event.metaKey);
    if (!isPasteKey) return false;

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
      return true;
    }
    return false;
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
        // Phase 1: microtask — works for standard browsers where paste is synchronous
        queueMicrotask(() => {
          if (!handleKeyboardPaste(e)) {
            // Phase 2: delayed retry — handles SEB on Windows, which injects
            // clipboard content asynchronously after the keydown event fires.
            // 150 ms is long enough for SEB to complete injection but short
            // enough not to pick up unrelated keystrokes.
            setTimeout(() => handleKeyboardPaste(e), 150);
          }
        });
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

    /** Handle keyboard paste directly — diff against existing snapshot.
     * Returns true if paste was detected, false otherwise. */
    handleKeyboardPaste(event: KeyboardEvent): boolean {
      return handleKeyboardPaste(event);
    },

    handleBeforeInput,

    answerFieldsFn,
  };
}
