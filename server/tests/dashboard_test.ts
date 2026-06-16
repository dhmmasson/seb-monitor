/**
 * Tests for auth routes and dashboard routes with cookie-based authentication.
 * RED phase: these tests should fail until implementation exists.
 */
import { assertEquals, assertExists } from "@std/assert";
import { createDashboardHandler } from "../src/routes/dashboard.ts";
import { createAuthHandler } from "../src/routes/auth.ts";
import { closeTestDb, createTestDb } from "./helpers.ts";
import { hashPassword } from "../src/services/auth.ts";
import { findOrCreate } from "../src/db/sessions.ts";
import { insertHeartbeat } from "../src/db/heartbeats.ts";
import { encodeExamId } from "../src/routes/url-ids.ts";
import type { HeartbeatPayload } from "../../shared/types.ts";

function makeHeartbeat(
  overrides: Partial<HeartbeatPayload> = {},
): HeartbeatPayload {
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

const TEST_SECRET = "test-secret-key-at-least-32-chars-long!!";

async function sendRequest(
  handler: (req: Request) => Promise<Response>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = new URL(path, "http://localhost:8000");
  const request = new Request(url.toString(), options);
  return await handler(request);
}

// ===== Auth Routes =====

Deno.test("GET /auth/login: returns login page HTML", async () => {
  const db = createTestDb();
  try {
    const app = createAuthHandler(db, TEST_SECRET);
    const resp = await sendRequest(app, "/auth/login");
    assertEquals(resp.status, 200);
    const html = await resp.text();
    assertEquals(
      html.includes("<!DOCTYPE html>"),
      true,
      "should return HTML page",
    );
    assertEquals(
      html.includes('type="password"'),
      true,
      "should have password field",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /auth/login: sets auth cookie on correct password and redirects", async () => {
  const db = createTestDb();
  try {
    const passwordHash = await hashPassword("exam-password-123");
    const app = createAuthHandler(db, TEST_SECRET, passwordHash);
    const resp = await sendRequest(app, "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=exam-password-123",
    });
    // Should redirect to /dashboard
    assertEquals(resp.status, 302, "should redirect");
    const location = resp.headers.get("location");
    assertEquals(location, "/dashboard", "should redirect to dashboard");
    const setCookie = resp.headers.get("set-cookie");
    assertExists(setCookie, "should set a cookie");
    assertEquals(
      setCookie.includes("seb_auth="),
      true,
      "cookie should be seb_auth",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /auth/login: returns login page with error on wrong password", async () => {
  const db = createTestDb();
  try {
    const passwordHash = await hashPassword("correct-password");
    const app = createAuthHandler(db, TEST_SECRET, passwordHash);
    const resp = await sendRequest(app, "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=wrong-password",
    });
    assertEquals(resp.status, 401);
    const html = await resp.text();
    assertEquals(html.includes("Invalid password"), true, "should show error");
  } finally {
    closeTestDb(db);
  }
});

// ===== Dashboard Routes — Auth Protection =====

Deno.test("GET /dashboard: redirects to login when no cookie", async () => {
  const db = createTestDb();
  try {
    const app = createDashboardHandler(db, TEST_SECRET);
    const resp = await sendRequest(app, "/dashboard");
    assertEquals(resp.status, 302, "should redirect");
    const location = resp.headers.get("location");
    assertEquals(location, "/auth/login", "should redirect to login");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /dashboard: returns exam index when authenticated", async () => {
  const db = createTestDb();
  try {
    // Create some data
    const session = findOrCreate(db, "student-1", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());

    const app = createDashboardHandler(db, TEST_SECRET);
    // Sign a cookie value
    const { signCookie } = await import("../src/services/auth.ts");
    const authCookie = await signCookie("authenticated", TEST_SECRET);

    const resp = await sendRequest(app, "/dashboard", {
      headers: { cookie: `seb_auth=${authCookie}` },
    });
    assertEquals(resp.status, 200);
    const html = await resp.text();
    assertEquals(html.includes("<!DOCTYPE html>"), true, "should return HTML");
    assertEquals(
      html.includes("All Exams"),
      true,
      "should show exam index heading",
    );
    assertEquals(
      html.includes("exam-1"),
      true,
      "should show exam ID",
    );
  } finally {
    closeTestDb(db);
  }
});

// ===== Dashboard Routes — Student Detail =====

Deno.test("GET /dashboard/:examId/student/:sessionId: returns student detail when authenticated", async () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    insertHeartbeat(db, session.sessionId, makeHeartbeat());

    const app = createDashboardHandler(db, TEST_SECRET);
    const { signCookie } = await import("../src/services/auth.ts");
    const authCookie = await signCookie("authenticated", TEST_SECRET);

    const resp = await sendRequest(
      app,
      `/dashboard/exam-1/student/${session.sessionId}`,
      { headers: { cookie: `seb_auth=${authCookie}` } },
    );
    assertEquals(resp.status, 200);
    const html = await resp.text();
    assertEquals(html.includes("Alice"), true, "should show student name");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /dashboard/:examId/student/:sessionId: redirects to login when not authenticated", async () => {
  const db = createTestDb();
  try {
    const session = findOrCreate(db, "Alice", "exam-1");
    const app = createDashboardHandler(db, TEST_SECRET);
    const resp = await sendRequest(
      app,
      `/dashboard/exam-1/student/${session.sessionId}`,
    );
    assertEquals(resp.status, 302, "should redirect");
    assertEquals(resp.headers.get("location"), "/auth/login");
  } finally {
    closeTestDb(db);
  }
});

Deno.test("GET /dashboard: shows exam index with all exams when multiple exist", async () => {
  const db = createTestDb();
  try {
    const s1 = findOrCreate(db, "Alice", "exam-1");
    const s2 = findOrCreate(db, "Charlie", "exam-2");
    insertHeartbeat(db, s1.sessionId, makeHeartbeat({ studentId: "Alice" }));
    insertHeartbeat(
      db,
      s2.sessionId,
      makeHeartbeat({ studentId: "Charlie" }),
    );

    const app = createDashboardHandler(db, TEST_SECRET);
    const { signCookie } = await import("../src/services/auth.ts");
    const authCookie = await signCookie("authenticated", TEST_SECRET);

    const resp = await sendRequest(app, "/dashboard", {
      headers: { cookie: `seb_auth=${authCookie}` },
    });
    assertEquals(resp.status, 200);
    const html = await resp.text();
    assertEquals(
      html.includes("All Exams"),
      true,
      "should show exam index heading",
    );
    assertEquals(html.includes("exam-1"), true, "should list exam-1");
    assertEquals(html.includes("exam-2"), true, "should list exam-2");
    assertEquals(
      html.includes(`/dashboard/${encodeExamId("exam-1")}`),
      true,
      "should link to exam-1",
    );
  } finally {
    closeTestDb(db);
  }
});

// ===== BASE_PATH — Reverse Proxy Support =====

Deno.test("GET /dashboard: redirects to basePath/auth/login when unauthenticated and basePath is set", async () => {
  const db = createTestDb();
  try {
    const app = createDashboardHandler(db, TEST_SECRET, "/seb-monitor");
    const resp = await sendRequest(app, "/dashboard");
    assertEquals(resp.status, 302, "should redirect");
    assertEquals(
      resp.headers.get("location"),
      "/seb-monitor/auth/login",
      "should redirect with base path prefix",
    );
  } finally {
    closeTestDb(db);
  }
});

Deno.test("POST /auth/login: redirects to basePath/dashboard on success when basePath is set", async () => {
  const db = createTestDb();
  try {
    const passwordHash = await hashPassword("exam-password-123");
    const app = createAuthHandler(db, TEST_SECRET, passwordHash, "/seb-monitor");
    const resp = await sendRequest(app, "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "password=exam-password-123",
    });
    assertEquals(resp.status, 302, "should redirect");
    assertEquals(
      resp.headers.get("location"),
      "/seb-monitor/dashboard",
      "should redirect to basePath/dashboard",
    );
    const setCookie = resp.headers.get("set-cookie");
    assertExists(setCookie, "should set a cookie");
    assertEquals(
      setCookie.includes("Path=/seb-monitor/"),
      true,
      "cookie Path should include base path",
    );
  } finally {
    closeTestDb(db);
  }
});
