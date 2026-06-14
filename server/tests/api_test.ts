/**
 * Tests for API routes: POST /api/heartbeat, POST /api/paste, GET /api/paste/:hash.
 * Uses Deno.serve()-compatible handler (no Oak dependency).
 */
import { assertEquals, assertExists } from "@std/assert";
import { createHandler } from "../src/routes/api.ts";
import { createTestDb, closeTestDb } from "./helpers.ts";

function makeHeartbeatPayload(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "student-1",
    examId: "exam-1",
    questionId: "q1",
    timestamp: Date.now(),
    focus: { focusedTimeMs: 58000, unfocusedTimeMs: 2000, blurCount: 1 },
    input: { typedChars: 100, pastedChars: 50, deletedChars: 10, currentLength: 140 },
    keys: { keyDownCount: 200, ctrlCount: 2, altCount: 0, shiftCount: 20 },
    copyCount: 1,
    pasteCount: 1,
    events: [],
    ...overrides,
  };
}

// Helper: send a request through the handler
async function sendRequest(
  handler: (req: Request) => Promise<Response>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = new URL(path, "http://localhost:8000");
  const request = new Request(url.toString(), options);
  return await handler(request);
}

Deno.test("POST /api/heartbeat: accepts valid heartbeat and returns 200", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertExists(body.sessionId, "response should contain sessionId");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/heartbeat: stores heartbeat in database", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const body = await resp.json();

    // Verify heartbeat was stored using prepareQuery
    const stmt = db.prepareQuery("SELECT * FROM heartbeats WHERE session_id = ?");
    try {
      const rows = [...stmt.all([body.sessionId])];
      assertEquals(rows.length, 1, "heartbeat should be stored");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/heartbeat: stores events from payload", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload({
        events: [
          { type: "copy", timestamp: 1000, hash: "abc", length: 10 },
          { type: "focus", timestamp: 2000 },
        ],
      })),
    });
    const body = await resp.json();

    const stmt = db.prepareQuery("SELECT * FROM events WHERE session_id = ?");
    try {
      const rows = [...stmt.all([body.sessionId])];
      assertEquals(rows.length, 2, "events should be stored");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/heartbeat: returns 400 for invalid payload", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "payload" }),
    });
    assertEquals(resp.status, 400);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/paste: stores paste content", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // First create a session via heartbeat
    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    // Now send paste content
    const resp = await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "abc123",
        content: "Hello world pasted text",
        length: 22,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });
    assertEquals(resp.status, 200);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/paste: idempotent for same hash", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    const pasteBody = JSON.stringify({
      hash: "abc123",
      content: "Hello world",
      length: 11,
      sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
    });

    await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: pasteBody,
    });

    const resp2 = await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: pasteBody,
    });
    assertEquals(resp2.status, 200);

    const stmt = db.prepareQuery("SELECT * FROM paste_contents WHERE hash = ?");
    try {
      const rows = [...stmt.all(["abc123"])];
      assertEquals(rows.length, 1, "should have only one row");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/paste/:hash: retrieves paste content", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "abc123",
        content: "Hello world",
        length: 11,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });

    const resp = await sendRequest(app, "/api/paste/abc123");
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.content, "Hello world");
    assertEquals(body.hash, "abc123");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/paste/:hash: returns 404 for missing hash", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/paste/nonexistent");
    assertEquals(resp.status, 404);
  } finally {
    closeTestDb(db);
  }
});
