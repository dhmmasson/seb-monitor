import { assertEquals, assertExists } from "@std/assert";
import { initialize, resolveQuestionId } from "./index.ts";

// Mock script element with dataset (simulates <script data-student-id="..." ...>)
function createMockScript(attrs: Record<string, string>): HTMLScriptElement {
  return {
    dataset: attrs,
    getAttribute: (name: string) => attrs[name] ?? null,
  } as unknown as HTMLScriptElement;
}

// ===== IIFE Entry Point Tests (script data-attribute based) =====

Deno.test("initialize returns initialization result from script attributes", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "https://moodle.example.com/exam/123",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);

  assertExists(result);
  assertEquals(typeof result.start, "function");
  assertEquals(typeof result.stop, "function");
});

Deno.test("initialize extracts studentId from data-student-id", () => {
  const script = createMockScript({
    studentId: "Jean Dupont",
    moduleId: "CS101",
    examId: "https://moodle.example.com/exam/42",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  assertEquals(result.studentId, "Jean Dupont");
});

Deno.test("initialize extracts examId from data-exam-id", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "https://moodle.example.com/exam/42",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  assertEquals(result.examId, "https://moodle.example.com/exam/42");
});

Deno.test("initialize extracts serverUrl from data-server-url", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "https://monitor.university.edu:9000",
  });

  const result = initialize(script);
  assertEquals(result.serverUrl, "https://monitor.university.edu:9000");
});

Deno.test("initialize throws when data-student-id is missing", () => {
  const script = createMockScript({
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  try {
    initialize(script);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message,
      "Missing required attribute on script tag: data-student-id",
    );
  }
});

Deno.test("initialize throws when data-exam-id is missing", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    serverUrl: "http://localhost:8000",
  });

  try {
    initialize(script);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message,
      "Missing required attribute on script tag: data-exam-id",
    );
  }
});

Deno.test("initialize throws when data-server-url is missing", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
  });

  try {
    initialize(script);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message,
      "Missing required attribute on script tag: data-server-url",
    );
  }
});

Deno.test("initialize uses default questionId when not on script", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  assertEquals(result.questionId, "default");
});

Deno.test("initialize reads questionId from data-question-id", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
    questionId: "q3",
  });

  const result = initialize(script);
  assertEquals(result.questionId, "q3");
});

Deno.test("initialize auto-discovers script via querySelector when not provided", () => {
  // Simulate document.querySelector finding the script
  const mockScript = createMockScript({
    studentId: "Auto Student",
    moduleId: "M101",
    examId: "exam-auto",
    serverUrl: "http://localhost:8000",
  });

  const mockDoc = {
    querySelector: (selector: string) => {
      if (selector === "script[data-student-id]") return mockScript;
      return null;
    },
  };

  const result = initialize(undefined, mockDoc as unknown as Document);
  assertEquals(result.studentId, "Auto Student");
});

Deno.test("initialize throws when script cannot be found", () => {
  const mockDoc = {
    querySelector: () => null,
  };

  try {
    initialize(undefined, mockDoc as unknown as Document);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message,
      "Could not find seb-monitor script tag with data-student-id attribute",
    );
  }
});

// ===== Stop Behavior Tests =====

Deno.test("stop prevents further heartbeat sends", async () => {
  // Mock global fetch to count heartbeat calls
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalls++;
    return Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  // Mock setInterval to capture the timer
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const originalSetInterval = globalThis.setInterval;
  globalThis.setInterval = ((fn: () => void, ms: number) => {
    intervalId = originalSetInterval(fn, ms);
    return intervalId;
  }) as typeof globalThis.setInterval;

  const originalClearInterval = globalThis.clearInterval;
  let clearIntervalCalled = false;
  globalThis.clearInterval = ((id: ReturnType<typeof setInterval>) => {
    clearIntervalCalled = true;
    originalClearInterval(id);
  }) as typeof globalThis.clearInterval;

  try {
    const script = createMockScript({
      studentId: "John Doe",
      moduleId: "CS101",
      examId: "exam-1",
      serverUrl: "http://localhost:8000",
    });

    const result = initialize(script);
    result.start();
    // Wait for initial heartbeat
    await new Promise((r) => setTimeout(r, 50));
    const callsAfterStart = fetchCalls;

    result.stop();
    assertEquals(clearIntervalCalled, true, "stop() should call clearInterval");

    // Wait to verify no more heartbeats
    await new Promise((r) => setTimeout(r, 150));
    assertEquals(
      fetchCalls,
      callsAfterStart,
      "no heartbeats should be sent after stop()",
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  }
});

Deno.test("stop() is idempotent — calling twice does not throw", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  result.stop();
  result.stop(); // Should not throw
});

// ===== resolveQuestionId Tests =====

Deno.test("resolveQuestionId returns 'default' when no URL or document", () => {
  assertEquals(resolveQuestionId("", undefined), "default");
});

Deno.test("resolveQuestionId extracts 'slot' from Moodle quiz URL", () => {
  const url =
    "https://moodle.example.com/mod/quiz/attempt.php?attempt=123&slot=3&page=2";
  assertEquals(resolveQuestionId(url, undefined), "3");
});

Deno.test("resolveQuestionId extracts 'questionId' from generic URL", () => {
  const url = "https://example.com/exam?q=hello&questionId=q42";
  assertEquals(resolveQuestionId(url, undefined), "q42");
});

Deno.test("resolveQuestionId prefers 'slot' over 'questionId'", () => {
  const url = "https://moodle.example.com/quiz?slot=5&questionId=q42";
  assertEquals(resolveQuestionId(url, undefined), "5");
});

Deno.test("resolveQuestionId falls back to 'default' for URL without params", () => {
  const url = "https://moodle.example.com/mod/quiz/attempt.php";
  assertEquals(resolveQuestionId(url, undefined), "default");
});

Deno.test("resolveQuestionId reads data-question-id from script tag", () => {
  const mockDoc = {
    querySelector: (selector: string) => {
      if (selector === "script[data-question-id]") {
        return {
          getAttribute: (attr: string) =>
            attr === "data-question-id" ? "q7" : null,
        } as unknown as Element;
      }
      return null;
    },
  };
  assertEquals(
    resolveQuestionId("https://example.com", mockDoc),
    "q7",
  );
});

// ===== Immediate Heartbeat on Copy/Paste Tests =====

/** Create a mock document with event dispatching for tests */
function createMockDocument() {
  const listeners: Record<string, ((e: Event) => void)[]> = {};
  return {
    querySelector: () => null,
    querySelectorAll: () => [],
    visibilityState: "visible" as DocumentVisibilityState,
    addEventListener: (type: string, handler: (e: Event) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(handler);
    },
    removeEventListener: (type: string, handler: (e: Event) => void) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((h) => h !== handler);
      }
    },
    dispatchEvent: (event: Event) => {
      if (listeners[event.type]) {
        for (const handler of listeners[event.type]) {
          handler(event);
        }
      }
    },
  };
}

/** Set up global mocks for immediate heartbeat tests, returns cleanup fn */
function setupGlobals(mockDoc: ReturnType<typeof createMockDocument>) {
  const originalFetch = globalThis.fetch;
  const originalDoc = (globalThis as Record<string, unknown>).document;
  const originalGetSelection =
    (globalThis as Record<string, unknown>).getSelection;

  let heartbeatCount = 0;
  let pasteContentCount = 0;
  (globalThis as Record<string, unknown>).document = mockDoc;
  (globalThis as Record<string, unknown>).getSelection = () => ({
    toString: () => "selected text",
  });
  globalThis.fetch = (url: string | URL | Request) => {
    const urlStr = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.href
      : url.url;
    if (urlStr.includes("/api/paste") || urlStr.includes("/api/clipboard") || urlStr.includes("/api/input-snapshot")) {
      pasteContentCount++;
    } else {
      heartbeatCount++;
    }
    return Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  return {
    getHeartbeatCount: () => heartbeatCount,
    getPasteContentCount: () => pasteContentCount,
    cleanup: () => {
      globalThis.fetch = originalFetch;
      if (originalDoc !== undefined) {
        (globalThis as Record<string, unknown>).document = originalDoc;
      } else {
        delete (globalThis as Record<string, unknown>).document;
      }
      if (originalGetSelection !== undefined) {
        (globalThis as Record<string, unknown>).getSelection =
          originalGetSelection;
      } else {
        delete (globalThis as Record<string, unknown>).getSelection;
      }
    },
  };
}

Deno.test("paste event triggers immediate heartbeat after debounce delay", async () => {
  const mockDoc = createMockDocument();
  const { getHeartbeatCount, getPasteContentCount, cleanup } = setupGlobals(
    mockDoc,
  );

  try {
    const mockScript = createMockScript({
      studentId: "John Doe",
      moduleId: "CS101",
      examId: "exam-1",
      serverUrl: "http://localhost:8000",
    });

    const result = initialize(mockScript);
    result.start();
    // Wait for initial heartbeat to fully complete
    await new Promise((r) => setTimeout(r, 200));
    const countAfterStart = getHeartbeatCount();

    // Simulate a paste event
    const pasteEvent = new Event("paste") as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "pasted text" },
    });
    mockDoc.dispatchEvent(pasteEvent);

    // Should not send immediately (debounce)
    assertEquals(getHeartbeatCount(), countAfterStart);

    // Wait for debounce delay (500ms + buffer)
    await new Promise((r) => setTimeout(r, 600));
    // Exactly 1 additional heartbeat from the paste
    assertEquals(getHeartbeatCount(), countAfterStart + 1);
    // Paste content should also have been sent (1 pending paste flushed)
    assertEquals(getPasteContentCount(), 1);

    result.stop();
  } finally {
    cleanup();
  }
});

Deno.test("copy event triggers immediate heartbeat after debounce delay", async () => {
  const mockDoc = createMockDocument();
  const { getHeartbeatCount, cleanup } = setupGlobals(mockDoc);

  try {
    const mockScript = createMockScript({
      studentId: "John Doe",
      moduleId: "CS101",
      examId: "exam-1",
      serverUrl: "http://localhost:8000",
    });

    const result = initialize(mockScript);
    result.start();
    // Wait for initial heartbeat to fully complete
    await new Promise((r) => setTimeout(r, 200));
    const countAfterStart = getHeartbeatCount();

    // Simulate a copy event — handleCopy uses globalThis.getSelection()
    mockDoc.dispatchEvent(new Event("copy"));

    // Should not send immediately (debounce)
    assertEquals(getHeartbeatCount(), countAfterStart);

    // Wait for debounce delay (500ms + buffer)
    await new Promise((r) => setTimeout(r, 600));
    // Exactly 1 additional heartbeat from the copy
    assertEquals(getHeartbeatCount(), countAfterStart + 1);

    result.stop();
  } finally {
    cleanup();
  }
});

Deno.test("rapid paste events are batched into single heartbeat", async () => {
  const mockDoc = createMockDocument();
  const { getHeartbeatCount, getPasteContentCount, cleanup } = setupGlobals(
    mockDoc,
  );

  try {
    const mockScript = createMockScript({
      studentId: "John Doe",
      moduleId: "CS101",
      examId: "exam-1",
      serverUrl: "http://localhost:8000",
    });

    const result = initialize(mockScript);
    result.start();
    // Wait for initial heartbeat to fully complete
    await new Promise((r) => setTimeout(r, 200));
    const countAfterStart = getHeartbeatCount();

    // Fire 3 paste events in rapid succession (faster than debounce window)
    for (let i = 0; i < 3; i++) {
      const pasteEvent = new Event("paste") as ClipboardEvent;
      Object.defineProperty(pasteEvent, "clipboardData", {
        value: { getData: () => `pasted text ${i}` },
      });
      mockDoc.dispatchEvent(pasteEvent);
      await new Promise((r) => setTimeout(r, 100));
    }

    // Wait for debounce to settle (500ms after last event + buffer)
    await new Promise((r) => setTimeout(r, 600));
    // Should only have 1 additional heartbeat (all 3 pastes batched)
    assertEquals(getHeartbeatCount(), countAfterStart + 1);
    // Only 1 paste recorded — dedup suppresses the other 2 within 300ms window
    assertEquals(getPasteContentCount(), 1);

    result.stop();
  } finally {
    cleanup();
  }
});

Deno.test("stop() clears immediate heartbeat timer", async () => {
  const mockDoc = createMockDocument();
  const { getHeartbeatCount, cleanup } = setupGlobals(mockDoc);

  try {
    const mockScript = createMockScript({
      studentId: "John Doe",
      moduleId: "CS101",
      examId: "exam-1",
      serverUrl: "http://localhost:8000",
    });

    const result = initialize(mockScript);
    result.start();
    // Wait for initial heartbeat to fully complete
    await new Promise((r) => setTimeout(r, 200));
    const countAfterStart = getHeartbeatCount();

    // Fire a paste event
    const pasteEvent = new Event("paste") as ClipboardEvent;
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "pasted text" },
    });
    mockDoc.dispatchEvent(pasteEvent);

    // Stop immediately (before debounce fires)
    result.stop();

    // Wait past the debounce delay
    await new Promise((r) => setTimeout(r, 600));
    // Should NOT have sent the immediate heartbeat
    assertEquals(getHeartbeatCount(), countAfterStart);
  } finally {
    cleanup();
  }
});

// ===== Ace Editor Adapter Integration Tests =====

Deno.test("initialize with aceAdapterFactory creates adapter on start()", async () => {
  let adapterAttached = false;
  let adapterDetached = false;

  const mockScript = createMockScript({
    studentId: "John Doe",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const mockAceFactory = () => ({
    attach: () => {
      adapterAttached = true;
      return 1;
    },
    detach: () => {
      adapterDetached = true;
    },
    attachedCount: () => (adapterAttached ? 1 : 0),
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

  try {
    const result = initialize(mockScript, undefined, mockAceFactory);
    result.start();
    await new Promise((r) => setTimeout(r, 50));

    assertEquals(
      adapterAttached,
      true,
      "Adapter should be attached on start()",
    );

    result.stop();
    assertEquals(adapterDetached, true, "Adapter should be detached on stop()");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("initialize without aceAdapterFactory does not crash", async () => {
  const mockScript = createMockScript({
    studentId: "John Doe",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

  try {
    const result = initialize(mockScript);
    result.start();
    await new Promise((r) => setTimeout(r, 50));
    result.stop();
    // Should not throw
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ===== Paste Detector Integration Tests =====

Deno.test("initialize with pasteDetectorFactory creates detector on start()", async () => {
  let detectorAttached = false;
  let detectorDetached = false;

  const mockScript = createMockScript({
    studentId: "John Doe",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const mockPasteDetectorFactory = () => ({
    start: () => {
      detectorAttached = true;
    },
    stop: () => {
      detectorDetached = true;
    },
    handleBeforeInput: () => {},
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

  try {
    const result = initialize(
      mockScript,
      undefined,
      undefined,
      mockPasteDetectorFactory,
    );
    result.start();
    await new Promise((r) => setTimeout(r, 50));

    assertEquals(
      detectorAttached,
      true,
      "Paste detector should be attached on start()",
    );

    result.stop();
    assertEquals(
      detectorDetached,
      true,
      "Paste detector should be detached on stop()",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("paste detector beforeinput callback triggers paste detection", async () => {
  const mockDoc = createMockDocument();
  const { getPasteContentCount, cleanup } = setupGlobals(mockDoc);

  let capturedOnPaste: ((text: string) => void) | null = null;

  const mockScript = createMockScript({
    studentId: "John Doe",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const mockPasteDetectorFactory = (
    opts: { onPaste: (text: string) => void },
  ) => {
    capturedOnPaste = opts.onPaste;
    return {
      start: () => {},
      stop: () => {},
      handleBeforeInput: () => {},
    };
  };

  try {
    const result = initialize(
      mockScript,
      undefined,
      undefined,
      mockPasteDetectorFactory,
    );
    result.start();
    // Wait for initial heartbeat
    await new Promise((r) => setTimeout(r, 200));

    // Simulate a paste detected by the paste detector (beforeinput layer)
    capturedOnPaste!("pasted via beforeinput");

    // Wait for debounce + flush
    await new Promise((r) => setTimeout(r, 600));

    // Paste content should have been sent
    assertEquals(getPasteContentCount(), 1);

    result.stop();
  } finally {
    cleanup();
  }
});

Deno.test("initialize without pasteDetectorFactory does not crash", async () => {
  const mockScript = createMockScript({
    studentId: "John Doe",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ sessionId: "test" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

  try {
    const result = initialize(mockScript);
    result.start();
    await new Promise((r) => setTimeout(r, 50));
    result.stop();
    // Should not throw
  } finally {
    globalThis.fetch = originalFetch;
  }
});
