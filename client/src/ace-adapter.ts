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
  _options: AceAdapterOptions,
  _documentRef?: Document,
): AceAdapter {
  // TODO: implement in GREEN phase
  return {
    attach: () => 0,
    detach: () => {},
    attachedCount: () => 0,
  };
}
