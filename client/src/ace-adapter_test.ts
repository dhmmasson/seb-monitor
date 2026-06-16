import { assertEquals, assertExists } from "@std/assert";
import { createAceAdapter } from "./ace-adapter.ts";

// ===== Mock Ace Editor =====

/** Simple event emitter for mocking Ace editor events */
class MockAceEmitter {
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx >= 0) cbs.splice(idx, 1);
    }
  }

  /** Simulate an event being fired by Ace */
  emit(event: string, ...args: unknown[]): void {
    const cbs = this.listeners.get(event) ?? [];
    for (const cb of cbs) {
      cb(...args);
    }
  }
}

function createMockAceEditor(content = "") {
  const emitter = new MockAceEmitter();
  return {
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter),
    emit: emitter.emit.bind(emitter),
    getValue: () => content,
    _emitter: emitter,
  };
}

function createMockAceContainer(editor: ReturnType<typeof createMockAceEditor>) {
  return {
    env: { editor },
    classList: { contains: () => true },
  };
}

// ===== Tests =====

Deno.test("createAceAdapter returns an adapter with attach/detach methods", () => {
  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => {},
  });

  assertExists(adapter);
  assertEquals(typeof adapter.attach, "function");
  assertEquals(typeof adapter.detach, "function");
  assertEquals(typeof adapter.attachedCount, "function");
});

Deno.test("attach returns 0 when no Ace editors are on the page", () => {
  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => {},
  });

  // No globalThis.ace → should return 0
  const count = adapter.attach();
  assertEquals(count, 0);
});

Deno.test("attach returns 0 when globalThis.ace exists but no editors found", () => {
  const originalAce = (globalThis as Record<string, unknown>).ace;

  // Set up ace namespace but with no editors on the page
  (globalThis as Record<string, unknown>).ace = { edit: () => {} };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => {},
  });

  const count = adapter.attach();
  assertEquals(count, 0);

  // Cleanup
  if (originalAce !== undefined) {
    (globalThis as Record<string, unknown>).ace = originalAce;
  } else {
    delete (globalThis as Record<string, unknown>).ace;
  }
});

Deno.test("attach detects Ace editors from .ace_editor containers", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);

  // Mock document.querySelectorAll to return our mock container
  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") {
        return [mockContainer];
      }
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => {},
  }, mockDoc as unknown as Document);

  const count = adapter.attach();
  assertEquals(count, 1);
});

Deno.test("adapter calls onPaste when Ace editor fires paste event", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let pastedText = "";

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: (text: string) => { pastedText = text; },
    onChange: () => {},
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Simulate Ace firing a paste event
  mockEditor.emit("paste", { text: "hello world" });

  assertEquals(pastedText, "hello world");
});

Deno.test("adapter calls onChange with insert delta", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let changeDelta: { action: string; text: string } | null = null;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: (delta) => { changeDelta = delta; },
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Simulate Ace firing a change event (insert)
  mockEditor.emit("change", {
    action: "insert",
    lines: ["new code here"],
  });

  assertExists(changeDelta);
  assertEquals(changeDelta!.action, "insert");
  assertEquals(changeDelta!.text, "new code here");
});

Deno.test("adapter calls onChange with remove delta", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let changeDelta: { action: string; text: string } | null = null;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: (delta) => { changeDelta = delta; },
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Simulate Ace firing a change event (remove)
  mockEditor.emit("change", {
    action: "remove",
    lines: ["deleted text"],
  });

  assertExists(changeDelta);
  assertEquals(changeDelta!.action, "remove");
  assertEquals(changeDelta!.text, "deleted text");
});

Deno.test("adapter handles multi-line changes by joining lines", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let changeDelta: { action: string; text: string } | null = null;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: (delta) => { changeDelta = delta; },
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Multi-line insert
  mockEditor.emit("change", {
    action: "insert",
    lines: ["line 1", "line 2", "line 3"],
  });

  assertEquals(changeDelta!.text, "line 1\nline 2\nline 3");
});

Deno.test("adapter handles change events without lines property", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let changeDelta: { action: string; text: string } | null = null;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: (delta) => { changeDelta = delta; },
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Change event without lines (edge case)
  mockEditor.emit("change", {
    action: "insert",
  });

  assertEquals(changeDelta!.text, "");
});

Deno.test("detach removes event listeners from all attached editors", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let pasteCount = 0;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => { pasteCount++; },
    onChange: () => {},
  }, mockDoc as unknown as Document);

  adapter.attach();
  assertEquals(adapter.attachedCount(), 1);

  adapter.detach();
  assertEquals(adapter.attachedCount(), 0);

  // After detach, paste events should not trigger callback
  mockEditor.emit("paste", { text: "should not fire" });
  assertEquals(pasteCount, 0);
});

Deno.test("attach ignores containers without env.editor", () => {
  const badContainer = {
    env: undefined,
    classList: { contains: () => true },
  };

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [badContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => {},
  }, mockDoc as unknown as Document);

  const count = adapter.attach();
  assertEquals(count, 0);
});

Deno.test("adapter ignores Ace 'unknown' change actions", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let changeCalled = false;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => {},
    onChange: () => { changeCalled = true; },
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Ace can fire changes with action "unknown" — should be ignored
  mockEditor.emit("change", { action: "unknown", lines: ["x"] });

  assertEquals(changeCalled, false);
});

Deno.test("adapter supports multiple Ace editors", () => {
  const editor1 = createMockAceEditor();
  const editor2 = createMockAceEditor();
  const container1 = createMockAceContainer(editor1);
  const container2 = createMockAceContainer(editor2);
  const pastedTexts: string[] = [];

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [container1, container2];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: (text: string) => { pastedTexts.push(text); },
    onChange: () => {},
  }, mockDoc as unknown as Document);

  const count = adapter.attach();
  assertEquals(count, 2);

  // Paste in editor1
  editor1.emit("paste", { text: "from editor 1" });
  assertEquals(pastedTexts.length, 1);
  assertEquals(pastedTexts[0], "from editor 1");

  // Paste in editor2
  editor2.emit("paste", { text: "from editor 2" });
  assertEquals(pastedTexts.length, 2);
  assertEquals(pastedTexts[1], "from editor 2");
});

Deno.test("adapter handles empty paste event gracefully", () => {
  const mockEditor = createMockAceEditor();
  const mockContainer = createMockAceContainer(mockEditor);
  let pasteCalled = false;

  const mockDoc = {
    querySelectorAll: (selector: string) => {
      if (selector === ".ace_editor") return [mockContainer];
      return [];
    },
  };

  const adapter = createAceAdapter({
    onPaste: () => { pasteCalled = true; },
    onChange: () => {},
  }, mockDoc as unknown as Document);

  adapter.attach();

  // Paste with empty text — should not call onPaste
  mockEditor.emit("paste", { text: "" });
  assertEquals(pasteCalled, false);
});
