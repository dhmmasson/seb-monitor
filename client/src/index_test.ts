import { assertEquals, assertExists } from "@std/assert";
import { initialize } from "./index.ts";

// Mock DOM elements
let mockElements: Record<string, HTMLElement> = {};

function createMockElement(id: string, textContent: string): HTMLElement {
  return {
    id,
    textContent,
    innerHTML: "",
  } as HTMLElement;
}

// Mock document.getElementById
function mockGetElementById(id: string): HTMLElement | null {
  return mockElements[id] ?? null;
}

// Reset mock state
function resetMocks() {
  mockElements = {};
}

// ===== IIFE Entry Point Tests =====

Deno.test("initialize returns initialization result", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  assertExists(result);
  assertEquals(typeof result.start, "function");
  assertEquals(typeof result.stop, "function");
});

Deno.test("initialize extracts student ID from DOM", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  assertEquals(result.studentId, "John Doe");
});

Deno.test("initialize extracts exam ID from DOM", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  assertEquals(result.examId, "https://moodle.example.com/exam/123");
});

Deno.test("initialize uses default question ID", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  assertEquals(result.questionId, "default");
});

Deno.test("initialize throws when theuser element not found", () => {
  resetMocks();
  mockElements = {
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  try {
    initialize("http://localhost:8000", mockGetElementById);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message, "Required DOM element not found: theuser");
  }
});

Deno.test("initialize throws when themodule element not found", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  try {
    initialize("http://localhost:8000", mockGetElementById);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message, "Required DOM element not found: themodule");
  }
});

Deno.test("initialize throws when theexam element not found", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
  };

  try {
    initialize("http://localhost:8000", mockGetElementById);
    assertEquals(true, false, "Should have thrown");
  } catch (error) {
    assertEquals((error as Error).message, "Required DOM element not found: theexam");
  }
});

Deno.test("start begins heartbeat timer", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  // start() should not throw
  result.start();
});

Deno.test("stop ends heartbeat timer", () => {
  resetMocks();
  mockElements = {
    theuser: createMockElement("theuser", "John Doe"),
    themodule: createMockElement("themodule", "CS101"),
    theexam: createMockElement("theexam", "https://moodle.example.com/exam/123"),
  };

  const result = initialize(
    "http://localhost:8000",
    mockGetElementById,
  );

  // stop() should not throw even if not started
  result.stop();
});
