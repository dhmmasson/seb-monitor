/**
 * API routes — POST /api/heartbeat, POST /api/paste, GET /api/paste/:hash
 * Uses Deno's built-in Deno.serve() — zero external HTTP dependencies.
 */
import type { DB } from "sqlite";
import type { HeartbeatPayload, PasteContentRequest } from "../../../shared/types.ts";
import { findOrCreate } from "../db/sessions.ts";
import { insertHeartbeat } from "../db/heartbeats.ts";
import { insertEvents } from "../db/events.ts";
import { insertPasteContent, getPasteContent } from "../db/paste_contents.ts";

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

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
 * Extract path parameter from URL pattern match.
 * e.g. extractParam("/api/paste/abc123", "/api/paste/:hash") → "abc123"
 */
function extractParam(url: string, pattern: string): string | null {
  const regex = new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$");
  const match = url.match(regex);
  return match?.groups ? Object.values(match.groups)[0] ?? null : null;
}

/**
 * Create a fetch handler with all API routes.
 * Accepts a Database instance for dependency injection (testability).
 * Compatible with Deno.serve() — returns a standard fetch handler.
 */
export function createHandler(db: DB): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET /health
    if (path === "/health" && method === "GET") {
      return json({ status: "ok" });
    }

    // POST /api/heartbeat
    if (path === "/api/heartbeat" && method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!isValidHeartbeatPayload(body)) {
        return json({ error: "Invalid heartbeat payload" }, 400);
      }

      const session = findOrCreate(db, body.studentId, body.examId);
      insertHeartbeat(db, session.sessionId, body);
      insertEvents(db, session.sessionId, body.events);

      return json({ sessionId: session.sessionId });
    }

    // POST /api/paste
    if (path === "/api/paste" && method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      if (!isValidPasteRequest(body)) {
        return json({ error: "Invalid paste content request" }, 400);
      }

      insertPasteContent(db, body);
      return json({ ok: true });
    }

    // GET /api/paste/:hash
    const pasteHash = extractParam(path, "/api/paste/:hash");
    if (pasteHash && method === "GET") {
      const result = getPasteContent(db, pasteHash);
      if (!result) {
        return json({ error: "Paste content not found" }, 404);
      }
      return json(result);
    }

    return json({ error: "Not found" }, 404);
  };
}
