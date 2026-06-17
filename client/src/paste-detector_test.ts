import { assertEquals, assertExists } from "@std/assert";
import {
  createPasteDetector,
  extractPastedText,
} from "./paste-detector.ts";

// ===== extractPastedText Tests =====

Deno.test("extractPastedText returns pasted text from diff", () => {
  assertEquals(extractPastedText("hello ", "hello world"), "world");
});

Deno.test("extractPastedText returns entire new content when before is empty", () => {
  assertEquals(extractPastedText("", "pasted content"), "pasted content");
});

Deno.test("extractPastedText returns empty string when no change", () => {
  assertEquals(extractPastedText("same", "same"), "");
});

Deno.test("extractPastedText returns empty string when after is shorter", () => {
  assertEquals(extractPastedText("hello", "hi"), "");
});

Deno.test("extractPastedText handles paste at beginning", () => {
  assertEquals(extractPastedText("world", "hello world"), "hello ");
});

Deno.test("extractPastedText handles paste in middle", () => {
  assertEquals(extractPastedText("hd", "hello d"), "ello ");
});

Deno.test("extractPastedText handles multiline content", () => {
  assertEquals(
    extractPastedText("line1\n", "line1\nline2\nline3"),
    "line2\nline3",
  );
});

// ===== createPasteDetector Tests =====

Deno.test("createPasteDetector returns detector with start/stop methods", () => {
  const detector = createPasteDetector({
    onPaste: () => {},
  });
  assertExists(detector);
  assertEquals(typeof detector.start, "function");
  assertEquals(typeof detector.stop, "function");
});

// ===== Keyboard Paste Detection (Layer 1) =====

Deno.test("detects Ctrl+V paste with content change", () => {
  let detectedText = "";
  const detector = createPasteDetector({
    onPaste: (text) => { detectedText = text; },
    answerFieldsFn: () => [
      { value: "before ", getAttribute: () => null },
    ],
  });

  // Snapshot before paste
  detector.snapshotAnswerFields();

  // Simulate content change (what the textarea looks like after paste)
  detector.answerFieldsFn = () => [
    { value: "before pasted text", getAttribute: () => null },
  ];

  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(detectedText, "pasted text");
});

Deno.test("detects Cmd+V (Mac) paste with content change", () => {
  let detectedText = "";
  const detector = createPasteDetector({
    onPaste: (text) => { detectedText = text; },
    answerFieldsFn: () => [
      { value: "before ", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();
  detector.answerFieldsFn = () => [
    { value: "before mac paste", getAttribute: () => null },
  ];

  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      metaKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(detectedText, "mac paste");
});

Deno.test("does not detect paste when content unchanged", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
    answerFieldsFn: () => [
      { value: "same", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();
  // No content change
  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(pasteDetected, false);
});

Deno.test("does not detect non-paste keyboard shortcuts", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
    answerFieldsFn: () => [
      { value: "before ", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();
  detector.answerFieldsFn = () => [
    { value: "before x", getAttribute: () => null },
  ];

  // Ctrl+C (copy, not paste)
  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(pasteDetected, false);
});

Deno.test("does not detect paste without modifier key", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
    answerFieldsFn: () => [
      { value: "before ", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();
  detector.answerFieldsFn = () => [
    { value: "before text", getAttribute: () => null },
  ];

  // Just 'v' without modifier
  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(pasteDetected, false);
});

// ===== beforeinput Detection (Layer 2) =====

Deno.test("detects paste via beforeinput with insertFromPaste", () => {
  let detectedText = "";
  const detector = createPasteDetector({
    onPaste: (text) => { detectedText = text; },
  });

  const event = new Event("beforeinput") as InputEvent;
  Object.defineProperty(event, "inputType", {
    value: "insertFromPaste",
    writable: false,
  });
  Object.defineProperty(event, "data", {
    value: "pasted via beforeinput",
    writable: false,
  });

  detector.handleBeforeInput(event);

  assertEquals(detectedText, "pasted via beforeinput");
});

Deno.test("ignores beforeinput with non-paste inputType", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
  });

  const event = new Event("beforeinput") as InputEvent;
  Object.defineProperty(event, "inputType", {
    value: "insertText",
    writable: false,
  });
  Object.defineProperty(event, "data", {
    value: "typed char",
    writable: false,
  });

  detector.handleBeforeInput(event);

  assertEquals(pasteDetected, false);
});

Deno.test("ignores beforeinput with null data", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
  });

  const event = new Event("beforeinput") as InputEvent;
  Object.defineProperty(event, "inputType", {
    value: "insertFromPaste",
    writable: false,
  });
  Object.defineProperty(event, "data", {
    value: null,
    writable: false,
  });

  detector.handleBeforeInput(event);

  assertEquals(pasteDetected, false);
});

// ===== Contenteditable Support =====

Deno.test("snapshot includes contenteditable elements", () => {
  let detectedText = "";
  const detector = createPasteDetector({
    onPaste: (text) => { detectedText = text; },
    answerFieldsFn: () => [
      {
        value: undefined,
        textContent: "before ",
        getAttribute: (name: string) =>
          name === "contenteditable" ? "true" : null,
      },
    ],
  });

  detector.snapshotAnswerFields();

  detector.answerFieldsFn = () => [
    {
      value: undefined,
      textContent: "before pasted",
      getAttribute: (name: string) =>
        name === "contenteditable" ? "true" : null,
    },
  ];

  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(detectedText, "pasted");
});

// ===== Multiple Fields =====

Deno.test("detects paste across multiple textarea fields", () => {
  let detectedText = "";
  const detector = createPasteDetector({
    onPaste: (text) => { detectedText = text; },
    answerFieldsFn: () => [
      { value: "field1 ", getAttribute: () => null },
      { value: "field2 ", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();

  // Paste happened in field2
  detector.answerFieldsFn = () => [
    { value: "field1 ", getAttribute: () => null },
    { value: "field2 pasted content", getAttribute: () => null },
  ];

  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(detectedText, "pasted content");
});

// ===== start/stop (event listener registration) =====

Deno.test("start registers keydown and beforeinput listeners", () => {
  const listeners: string[] = [];
  const mockDoc = {
    addEventListener: (type: string) => {
      listeners.push(type);
    },
    removeEventListener: () => {},
  };

  const detector = createPasteDetector({
    onPaste: () => {},
    documentRef: mockDoc as unknown as Document,
  });

  detector.start();
  assertEquals(listeners.includes("keydown"), true);
  assertEquals(listeners.includes("beforeinput"), true);
});

Deno.test("stop removes keydown and beforeinput listeners", () => {
  const removed: string[] = [];
  const mockDoc = {
    addEventListener: () => {},
    removeEventListener: (type: string) => {
      removed.push(type);
    },
  };

  const detector = createPasteDetector({
    onPaste: () => {},
    documentRef: mockDoc as unknown as Document,
  });

  detector.start();
  detector.stop();
  assertEquals(removed.includes("keydown"), true);
  assertEquals(removed.includes("beforeinput"), true);
});

// ===== Non-answer field content changes are ignored =====

Deno.test("ignores content changes in non-answer fields", () => {
  let pasteDetected = false;
  const detector = createPasteDetector({
    onPaste: () => { pasteDetected = true; },
    answerFieldsFn: () => [
      { value: "same", getAttribute: () => null },
    ],
  });

  detector.snapshotAnswerFields();

  // A non-answer field changed, but answer fields didn't
  detector.handleKeyboardPaste(
    new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
    }) as KeyboardEvent,
  );

  assertEquals(pasteDetected, false);
});
