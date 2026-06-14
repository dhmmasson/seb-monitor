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

Deno.test("start begins heartbeat timer", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  // start() should not throw
  result.start();
});

Deno.test("stop ends heartbeat timer", () => {
  const script = createMockScript({
    studentId: "John Doe",
    moduleId: "CS101",
    examId: "exam-1",
    serverUrl: "http://localhost:8000",
  });

  const result = initialize(script);
  // stop() should not throw even if not started
  result.stop();
});

// ===== resolveQuestionId Tests =====

Deno.test("resolveQuestionId returns 'default' when no URL or document", () => {
  assertEquals(resolveQuestionId("", undefined), "default");
});

Deno.test("resolveQuestionId extracts 'slot' from Moodle quiz URL", () => {
  const url = "https://moodle.example.com/mod/quiz/attempt.php?attempt=123&slot=3&page=2";
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
          getAttribute: (attr: string) => attr === "data-question-id" ? "q7" : null,
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
