/**
 * Adapter for Ace editor instances on the page.
 * Moodle's CodeRunner uses Ace Editor which intercepts paste events
 * before they reach document-level listeners. This module hooks into
 * Ace's event system to capture paste and input events.
 *
 * @module ace-adapter
 */

export interface AceAdapterOptions {
  /** Called when paste is detected in an Ace editor */
  onPaste: (text: string) => void;
  /** Called when content changes in an Ace editor */
  onChange: (delta: { action: "insert" | "remove"; text: string }) => void;
}

/** Represents an Ace editor instance with the subset of API we use */
interface AceEditorInstance {
  on(event: string, callback: (e: unknown) => void): void;
  off(event: string, callback: (e: unknown) => void): void;
}

/** Represents an Ace editor container element */
interface AceEditorContainer {
  env?: { editor?: AceEditorInstance };
}

/** Tracked editor with its event callbacks for clean detach */
interface TrackedEditor {
  editor: AceEditorInstance;
  pasteHandler: (e: unknown) => void;
  changeHandler: (e: unknown) => void;
}

export interface AceAdapter {
  /** Attach to all Ace editors found on the page. Returns count of attached editors. */
  attach(): number;
  /** Detach from all previously attached editors */
  detach(): void;
  /** Number of editors currently attached */
  attachedCount(): number;
}

/**
 * Create an Ace editor adapter that detects and hooks into Ace editor instances.
 *
 * @param options - Callbacks for paste and change events
 * @param documentRef - Document reference for querying editors (default: global document)
 * @returns AceAdapter instance
 */
export function createAceAdapter(
  options: AceAdapterOptions,
  documentRef?: Document,
): AceAdapter {
  const doc = documentRef ??
    (typeof document !== "undefined" ? document : null);
  const tracked: TrackedEditor[] = [];

  function attach(): number {
    // Find all Ace editor containers on the page
    const containers = doc?.querySelectorAll(".ace_editor") ?? [];
    let count = 0;

    for (const container of containers) {
      const aceContainer = container as unknown as AceEditorContainer;
      const editor = aceContainer.env?.editor;
      if (!editor) continue;

      // Create bound handlers so we can remove them later
      const pasteHandler = (e: unknown): void => {
        const event = e as { text?: string };
        if (event.text) {
          options.onPaste(event.text);
        }
      };

      const changeHandler = (e: unknown): void => {
        const delta = e as { action?: string; lines?: string[] };
        const action = delta.action;
        if (action === "insert" || action === "remove") {
          const text = delta.lines?.join("\n") ?? "";
          options.onChange({ action, text });
        }
      };

      editor.on("paste", pasteHandler);
      editor.on("change", changeHandler);

      tracked.push({ editor, pasteHandler, changeHandler });
      count++;
    }

    return count;
  }

  function detach(): void {
    for (const entry of tracked) {
      entry.editor.off("paste", entry.pasteHandler);
      entry.editor.off("change", entry.changeHandler);
    }
    tracked.length = 0;
  }

  function attachedCount(): number {
    return tracked.length;
  }

  return { attach, detach, attachedCount };
}
