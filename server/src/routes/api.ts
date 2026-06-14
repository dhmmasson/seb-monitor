/**
 * API routes — POST /api/heartbeat, POST /api/paste, GET /api/paste/:hash
 * Uses Oak framework for HTTP handling.
 */
import { Application, Router } from "@oak/oak";
import type { DB } from "sqlite";
import type { HeartbeatPayload, PasteContentRequest } from "../../../shared/types.ts";
import { findOrCreate } from "../db/sessions.ts";
import { insertHeartbeat } from "../db/heartbeats.ts";
import { insertEvents } from "../db/events.ts";
import { insertPasteContent, getPasteContent } from "../db/paste_contents.ts";

/**
 * Validate a heartbeat payload — checks required fields exist.
 */
function isValidHeartbeatPayload(body: unknown): body is HeartbeatPayload {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.studentId === "string" &&
    typeof obj.examId === "string" &&
    typeof obj.questionId === "string" &&
    typeof obj.timestamp === "number" &&
    typeof obj.focus === "object" && obj.focus !== null &&
    typeof obj.input === "object" && obj.input !== null &&
    typeof obj.keys === "object" && obj.keys !== null &&
    typeof obj.copyCount === "number" &&
    typeof obj.pasteCount === "number" &&
    Array.isArray(obj.events)
  );
}

/**
 * Validate a paste content request.
 */
function isValidPasteRequest(body: unknown): body is PasteContentRequest {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.hash === "string" &&
    typeof obj.content === "string" &&
    typeof obj.length === "number" &&
    typeof obj.sessionId === "string" &&
    typeof obj.examId === "string" &&
    typeof obj.timestamp === "number"
  );
}

/**
 * Create the Oak application with all API routes.
 * Accepts a Database instance for dependency injection (testability).
 */
export function createApp(db: DB): Application {
  const router = new Router();

  // POST /api/heartbeat — receive telemetry
  router.post("/api/heartbeat", async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid JSON body" };
      return;
    }

    if (!isValidHeartbeatPayload(body)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid heartbeat payload" };
      return;
    }

    // Find or create session
    const session = findOrCreate(db, body.studentId, body.examId);

    // Store heartbeat
    insertHeartbeat(db, session.sessionId, body);

    // Store events
    insertEvents(db, session.sessionId, body.events);

    ctx.response.status = 200;
    ctx.response.body = { sessionId: session.sessionId };
  });

  // POST /api/paste — receive paste content
  router.post("/api/paste", async (ctx) => {
    let body: unknown;
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid JSON body" };
      return;
    }

    if (!isValidPasteRequest(body)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid paste content request" };
      return;
    }

    insertPasteContent(db, body);

    ctx.response.status = 200;
    ctx.response.body = { ok: true };
  });

  // GET /api/paste/:hash — retrieve paste content
  router.get("/api/paste/:hash", (ctx) => {
    const hash = ctx.params.hash;
    if (!hash) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing hash parameter" };
      return;
    }

    const result = getPasteContent(db, hash);
    if (!result) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Paste content not found" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = result;
  });

  // Health check
  router.get("/health", (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = { status: "ok" };
  });

  const app = new Application();

  // CORS middleware
  app.use(async (ctx, next) => {
    ctx.response.headers.set("Access-Control-Allow-Origin", "*");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    
    if (ctx.request.method === "OPTIONS") {
      ctx.response.status = 204;
      return;
    }

    await next();
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
