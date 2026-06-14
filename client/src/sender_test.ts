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

// ===== Sender Creation Tests =====

Deno.test("createSender returns sender object", () => {
  const sender = createSender("http://localhost:8000", mockFetch);
  assertEquals(typeof sender.sendHeartbeat, "function");
  assertEquals(typeof sender.sendPasteContent, "function");
});

// ===== Heartbeat Sending Tests =====

Deno.test("sendHeartbeat sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendHeartbeat(sampleHeartbeat);

  assertEquals(lastFetchUrl, "http://localhost:8000/api/heartbeat");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendHeartbeat sends JSON payload", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendHeartbeat(sampleHeartbeat);

  assertEquals(lastFetchOptions?.headers, {
    "Content-Type": "application/json",
  });
  assertEquals(JSON.parse(lastFetchOptions?.body as string), sampleHeartbeat);
});

Deno.test("sendHeartbeat resolves on success", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendHeartbeat(sampleHeartbeat);

  assertEquals(fetchCallCount, 1);
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

// ===== Paste Content Sending Tests =====

Deno.test("sendPasteContent sends POST request to correct URL", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendPasteContent(samplePasteRequest);

  assertEquals(lastFetchUrl, "http://localhost:8000/api/paste");
  assertEquals(lastFetchOptions?.method, "POST");
});

Deno.test("sendPasteContent sends JSON payload", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

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

Deno.test("sendPasteContent resolves on success", async () => {
  resetMocks();
  mockFetchResponse = new Response(null, { status: 200 });

  const sender = createSender("http://localhost:8000", mockFetch);
  await sender.sendPasteContent(samplePasteRequest);

  assertEquals(fetchCallCount, 1);
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
