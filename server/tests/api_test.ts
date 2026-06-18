/**
 * Tests for API routes: POST /api/heartbeat, POST /api/paste, GET /api/paste/:hash.
 * Uses Deno.serve()-compatible handler (no Oak dependency).
 */
import { assertEquals, assertExists } from "@std/assert";
import { createHandler } from "../src/routes/api.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";

function makeHeartbeatPayload(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "student-1",
    examId: "exam-1",
    questionId: "q1",
    timestamp: Date.now(),
    focus: { focusedTimeMs: 58000, unfocusedTimeMs: 2000, blurCount: 1 },
    input: {
      typedChars: 100,
      pastedChars: 50,
      deletedChars: 10,
      currentLength: 140,
    },
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
    const stmt = db.prepareQuery(
      "SELECT * FROM heartbeats WHERE session_id = ?",
    );
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

// ===== POST /api/paste Before Heartbeat (no session yet) =====

Deno.test("POST /api/paste: accepts paste before any heartbeat creates a session", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Send paste content directly — no prior heartbeat
    const resp = await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "pre-session-hash",
        content: "Pasted before heartbeat",
        length: 22,
        sessionId: "client-predicted-session",
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });
    assertEquals(
      resp.status,
      200,
      "paste before heartbeat should succeed (no FK constraint)",
    );

    // Verify it was stored
    const stmt = db.prepareQuery(
      "SELECT content, length FROM paste_contents WHERE hash = ?",
    );
    try {
      const rows = [...stmt.all(["pre-session-hash"])];
      assertEquals(rows.length, 1, "paste should be stored");
      assertEquals(rows[0][0], "Pasted before heartbeat");
      assertEquals(rows[0][1], 22);
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

// ===== GET /api/paste/:hash requires dashboard authentication =====

Deno.test("GET /api/paste/:hash: returns paste content (dashboard-only per spec)", async () => {
  // NOTE: The vision spec says GET /api/paste/:hash is 'dashboard-only (requires
  // authentication)'. Currently the API endpoint has no auth middleware — auth is
  // only enforced at the dashboard route level. This test documents current behavior.
  // If auth is added to the API layer later, this test should be updated to verify
  // that unauthenticated requests are rejected.
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Create a session first
    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    // Store paste
    await sendRequest(app, "/api/paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "auth-test-hash",
        content: "Sensitive paste content",
        length: 23,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });

    // GET without auth — currently returns 200 (no auth middleware on API route)
    const resp = await sendRequest(app, "/api/paste/auth-test-hash");
    assertEquals(
      resp.status,
      200,
      "currently no auth on API endpoint (dashboard enforces it)",
    );
    const body = await resp.json();
    assertEquals(body.content, "Sensitive paste content");
  } finally {
    closeTestDb(db);
  }
});

// ===== POST /api/clipboard Tests =====

Deno.test("POST /api/clipboard: stores paste content", async () => {
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

    // Send clipboard content with eventType paste
    const resp = await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "clip-paste-1",
        content: "Pasted text",
        length: 11,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
        eventType: "paste",
      }),
    });
    assertEquals(resp.status, 200);

    // Verify stored with correct event_type
    const stmt = db.prepareQuery(
      "SELECT event_type, content FROM paste_contents WHERE hash = ?"
    );
    try {
      const rows = [...stmt.all(["clip-paste-1"])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "paste");
      assertEquals(rows[0][1], "Pasted text");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/clipboard: stores copy content", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    // Send clipboard content with eventType copy
    const resp = await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "clip-copy-1",
        content: "Copied text",
        length: 11,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
        eventType: "copy",
      }),
    });
    assertEquals(resp.status, 200);

    // Verify stored with correct event_type
    const stmt = db.prepareQuery(
      "SELECT event_type, content FROM paste_contents WHERE hash = ?"
    );
    try {
      const rows = [...stmt.all(["clip-copy-1"])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "copy");
      assertEquals(rows[0][1], "Copied text");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/clipboard: returns 400 for invalid payload", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "payload" }),
    });
    assertEquals(resp.status, 400);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/clipboard/:hash: returns all rows for hash", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Create two sessions
    const hbResp1 = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload({ studentId: "s1" })),
    });
    const { sessionId: s1 } = await hbResp1.json();

    const hbResp2 = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload({ studentId: "s2" })),
    });
    const { sessionId: s2 } = await hbResp2.json();

    // Store copy from s1
    await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "shared-hash",
        content: "Shared content",
        length: 14,
        sessionId: s1,
        examId: "exam-1",
        timestamp: 1000,
        eventType: "copy",
      }),
    });

    // Store paste from s2 with same hash
    await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "shared-hash",
        content: "Shared content",
        length: 14,
        sessionId: s2,
        examId: "exam-1",
        timestamp: 2000,
        eventType: "paste",
      }),
    });

    // GET should return both rows
    const resp = await sendRequest(app, "/api/clipboard/shared-hash");
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(Array.isArray(body), true);
    assertEquals(body.length, 2);
    assertEquals(body[0].eventType, "copy");
    assertEquals(body[1].eventType, "paste");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/clipboard/:hash: returns 404 for missing hash", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/clipboard/nonexistent");
    assertEquals(resp.status, 404);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/clipboard: works before any heartbeat (no FK)", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Send clipboard content directly — no prior heartbeat
    const resp = await sendRequest(app, "/api/clipboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "pre-session-hash",
        content: "Early content",
        length: 13,
        sessionId: "client-predicted-session",
        examId: "exam-1",
        timestamp: Date.now(),
        eventType: "copy",
      }),
    });
    assertEquals(resp.status, 200);

    // Verify stored
    const stmt = db.prepareQuery(
      "SELECT content, event_type FROM paste_contents WHERE hash = ?"
    );
    try {
      const rows = [...stmt.all(["pre-session-hash"])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "Early content");
      assertEquals(rows[0][1], "copy");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

// ===== POST /api/input-snapshot Tests =====

Deno.test("POST /api/input-snapshot: stores input content snapshot", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Create session
    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    // Send input snapshot
    const resp = await sendRequest(app, "/api/input-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "snap-abc123",
        content: "The student wrote this answer...",
        length: 31,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });
    assertEquals(resp.status, 200);

    // Verify stored
    const stmt = db.prepareQuery(
      "SELECT content, length FROM input_snapshots WHERE hash = ?",
    );
    try {
      const rows = [...stmt.all(["snap-abc123"])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "The student wrote this answer...");
      assertEquals(rows[0][1], 31);
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/input-snapshot: idempotent for same hash+session", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    const body = JSON.stringify({
      hash: "snap-idem",
      content: "First version",
      length: 13,
      sessionId,
      examId: "exam-1",
      timestamp: Date.now(),
    });

    await sendRequest(app, "/api/input-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    // Send again with different content but same hash+session
    const resp2 = await sendRequest(app, "/api/input-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "snap-idem",
        content: "Second version",
        length: 14,
        sessionId,
        examId: "exam-1",
        timestamp: Date.now(),
      }),
    });
    assertEquals(resp2.status, 200);

    // Should still have only one row (INSERT OR IGNORE)
    const stmt = db.prepareQuery(
      "SELECT content FROM input_snapshots WHERE hash = ?",
    );
    try {
      const rows = [...stmt.all(["snap-idem"])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "First version", "first insert should be kept");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/input-snapshot: returns 400 for invalid payload", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/input-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invalid: "payload" }),
    });
    assertEquals(resp.status, 400);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/heartbeat: stores inputContentHash in heartbeat", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload({
        inputContentHash: "abc123def456",
      })),
    });
    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Verify heartbeat has input_content_hash
    const stmt = db.prepareQuery(
      "SELECT input_content_hash FROM heartbeats WHERE session_id = ?",
    );
    try {
      const rows = [...stmt.all([body.sessionId])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], "abc123def456");
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /api/heartbeat: stores null inputContentHash when omitted", async () => {
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

    const stmt = db.prepareQuery(
      "SELECT input_content_hash FROM heartbeats WHERE session_id = ?",
    );
    try {
      const rows = [...stmt.all([body.sessionId])];
      assertEquals(rows.length, 1);
      assertEquals(rows[0][0], null);
    } finally {
      stmt.finalize();
    }
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/input-snapshot/:hash/:sessionId: retrieves snapshot", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);

    // Create session
    const hbResp = await sendRequest(app, "/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeHeartbeatPayload()),
    });
    const { sessionId } = await hbResp.json();

    // Store snapshot
    await sendRequest(app, "/api/input-snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: "snap-get-test",
        content: "Student answer content",
        length: 21,
        sessionId,
        examId: "exam-1",
        timestamp: 5000,
      }),
    });

    // GET should return the snapshot
    const resp = await sendRequest(
      app,
      `/api/input-snapshot/snap-get-test/${sessionId}`,
    );
    assertEquals(resp.status, 200);
    const result = await resp.json();
    assertEquals(result.content, "Student answer content");
    assertEquals(result.hash, "snap-get-test");
    assertEquals(result.sessionId, sessionId);
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /api/input-snapshot/:hash/:sessionId: returns 404 for missing", async () => {
  const db = createTestDb();
  try {
    const app = createHandler(db);
    const resp = await sendRequest(
      app,
      "/api/input-snapshot/nonexistent/some-session",
    );
    assertEquals(resp.status, 404);
  } finally {
    closeTestDb(db);
  }
});
