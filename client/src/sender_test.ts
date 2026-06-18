import { assertEquals, assertRejects } from "@std/assert";
import { createSender } from "./sender.ts";
import type {
  HeartbeatPayload,
  PasteContentRequest,
} from "../../shared/types.ts";

// Mock fetch responses
let mockFetchResponse: Response | null = null;
let mockFetchError: Error | null = null;
let fetchCallCount = 0;
let lastFetchUrl: string | null = null;
let lastFetchOptions: RequestInit | null = null;

// Create a mock JSON response
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Mock fetch function
function mockFetch(
  url: string | URL | Request,
  options?: RequestInit,
): Promise<Response> {
  fetchCallCount++;
  lastFetchUrl = url.toString();
  lastFetchOptions = options ?? null;

  if (mockFetchError) {
    return Promise.reject(mockFetchError);
  }

  return Promise.resolve(
    mockFetchResponse ?? new Response(null, { status: 200 }),
  );
}

// Reset mock state
function resetMocks() {
  mockFetchResponse = null;
  mockFetchError = null;
  fetchCallCount = 0;
  lastFetchUrl = null;
  lastFetchOptions = null;
}

// Sample heartbeat payload
const sampleHeartbeat: HeartbeatPayload = {
  studentId: "student1",
  examId: "exam1",
  questionId: "question1",
  timestamp: 1700000000,
  focus: {
    focusedTimeMs: 58000,
    unfocusedTimeMs: 2000,
    blurCount: 1,
  },
  input: {
    typedChars: 340,
    pastedChars: 120,
    deletedChars: 25,
    currentLength: 435,
  },
  keys: {
    keyDownCount: 890,
    ctrlCount: 4,
    altCount: 0,
    shiftCount: 82,
  },
  copyCount: 1,
  pasteCount: 2,
  events: [
    { type: "copy", timestamp: 123456, hash: "abc123", length: 84 },
  ],
};

// Sample paste content request
const samplePasteRequest: PasteContentRequest = {
  hash: "abc123",
  content: "pasted text content",
  length: 19,
  sessionId: "session1",
  examId: "exam1",
  timestamp: 124001,
};

// ===== Heartbeat Sending Tests =====

Deno.test("sendHeartbeat sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendHeartbeat(sampleHeartbeat);

  assertEquals(lastFetchUrl, "http://localhost:8000/api/heartbeat");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendHeartbeat sends JSON payload", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendHeartbeat(sampleHeartbeat);

  assertEquals(lastFetchOptions?.headers, {
    "Content-Type": "application/json",
  });
  assertEquals(JSON.parse(lastFetchOptions?.body as string), sampleHeartbeat);
});

Deno.test("sendHeartbeat retries on failure", async () => {
  resetMocks();
  mockFetchError = new Error("Network error");

  const sender = createSender("http://localhost:8000", mockFetch, {
    maxRetries: 2,
  });

  try {
    await sender.sendHeartbeat(sampleHeartbeat);
  } catch {
    // Expected to fail after retries
  }

  // Should have tried 3 times (initial + 2 retries)
  assertEquals(fetchCallCount, 3);
});

// ===== HTTP 5xx Retry Tests =====

Deno.test("sendHeartbeat retries on HTTP 500 response", async () => {
  let callCount = 0;
  const http500Fetch = (
    _url: string | URL | Request,
    _options?: RequestInit,
  ): Promise<Response> => {
    callCount++;
    // First two calls return 500, third succeeds
    if (callCount <= 2) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          statusText: "Internal Server Error",
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(jsonResponse({ ok: true }));
  };

  const sender = createSender("http://localhost:8000", http500Fetch, {
    maxRetries: 2,
  });

  await sender.sendHeartbeat(sampleHeartbeat);
  assertEquals(callCount, 3, "should retry on 500 and succeed on 3rd attempt");
});

// ===== Paste Content Sending Tests =====

Deno.test("sendPasteContent sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendPasteContent(samplePasteRequest);

  assertEquals(lastFetchUrl, "http://localhost:8000/api/paste");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendPasteContent sends JSON payload", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendPasteContent(samplePasteRequest);

  assertEquals(lastFetchOptions?.headers, {
    "Content-Type": "application/json",
  });
  assertEquals(
    JSON.parse(lastFetchOptions?.body as string),
    samplePasteRequest,
  );
});

Deno.test("sendPasteContent retries on failure", async () => {
  resetMocks();
  mockFetchError = new Error("Network error");

  const sender = createSender("http://localhost:8000", mockFetch, {
    maxRetries: 2,
  });

  try {
    await sender.sendPasteContent(samplePasteRequest);
  } catch {
    // Expected to fail after retries
  }

  // Should have tried 3 times (initial + 2 retries)
  assertEquals(fetchCallCount, 3);
});

Deno.test("sendPasteContent throws after max retries", async () => {
  resetMocks();
  mockFetchError = new Error("Network error");

  const sender = createSender("http://localhost:8000", mockFetch, {
    maxRetries: 1,
  });

  await assertRejects(
    () => sender.sendPasteContent(samplePasteRequest),
    Error,
    "Network error",
  );
});

// ===== Clipboard Content Sending Tests =====

Deno.test("sendClipboardContent sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendClipboardContent({
    ...samplePasteRequest,
    eventType: "paste",
  });

  assertEquals(lastFetchUrl, "http://localhost:8000/api/clipboard");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendClipboardContent includes eventType in payload", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  const request = { ...samplePasteRequest, eventType: "copy" as const };
  await sender.sendClipboardContent(request);

  const body = JSON.parse(lastFetchOptions?.body as string);
  assertEquals(body.eventType, "copy");
  assertEquals(body.hash, "abc123");
  assertEquals(body.content, "pasted text content");
});

Deno.test("sendClipboardContent works with paste eventType", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  const request = { ...samplePasteRequest, eventType: "paste" as const };
  await sender.sendClipboardContent(request);

  const body = JSON.parse(lastFetchOptions?.body as string);
  assertEquals(body.eventType, "paste");
});

Deno.test("sendClipboardContent retries on failure", async () => {
  resetMocks();
  mockFetchError = new Error("Network error");

  const sender = createSender("http://localhost:8000", mockFetch, {
    maxRetries: 2,
  });

  try {
    await sender.sendClipboardContent({
      ...samplePasteRequest,
      eventType: "paste",
    });
  } catch {
    // Expected to fail after retries
  }

  assertEquals(fetchCallCount, 3);
});

// ===== Input Snapshot Sending Tests =====

Deno.test("sendInputSnapshot sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendInputSnapshot({
    hash: "snap123",
    content: "student answer text",
    length: 18,
    sessionId: "session-1",
    examId: "exam-1",
    timestamp: 1000,
  });

  assertEquals(lastFetchUrl, "http://localhost:8000/api/input-snapshot");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendInputSnapshot sends JSON payload", async () => {
  resetMocks();
  mockFetchResponse = jsonResponse({ ok: true });

  const sender = createSender("http://localhost:8000", mockFetch);
  const request = {
    hash: "snap456",
    content: "full answer here",
    length: 16,
    sessionId: "session-2",
    examId: "exam-2",
    timestamp: 2000,
  };
  await sender.sendInputSnapshot(request);

  assertEquals(lastFetchOptions?.headers, {
    "Content-Type": "application/json",
  });
  assertEquals(JSON.parse(lastFetchOptions?.body as string), request);
});

Deno.test("sendInputSnapshot retries on failure", async () => {
  resetMocks();
  mockFetchError = new Error("Network error");

  const sender = createSender("http://localhost:8000", mockFetch, {
    maxRetries: 2,
  });

  try {
    await sender.sendInputSnapshot({
      hash: "snap789",
      content: "test content",
      length: 12,
      sessionId: "session-3",
      examId: "exam-3",
      timestamp: 3000,
    });
  } catch {
    // Expected to fail after retries
  }

  assertEquals(fetchCallCount, 3);
});
