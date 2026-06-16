/**
 * Server entry point — boots the HTTP server using Deno.serve().
 * No external HTTP framework needed — zero dependencies beyond sqlite.
 */
import { createHandler } from "./routes/api.ts";
import { createAuthHandler, initPasswordHash } from "./routes/auth.ts";
import { createDashboardHandler } from "./routes/dashboard.ts";
import { getDb, closeDb } from "./db/connection.ts";

// Configuration
const PORT = parseInt(Deno.env.get("PORT") ?? "8000");
const SECRET = Deno.env.get("COOKIE_SECRET") ?? "change-me-in-production-32chars!!";

// Resolve project root (server/ is one level deep)
const PROJECT_ROOT = new URL("..", import.meta.url).pathname;

// Static file map — paths relative to project root
const STATIC_FILES: Record<string, { path: string; type: string }> = {
  "/seb-monitor.js": {
    path: `${PROJECT_ROOT}client/dist/seb-monitor.js`,
    type: "application/javascript",
  },
  "/exam.html": {
    path: `${PROJECT_ROOT}docs/demos/exam.html`,
    type: "text/html",
  },
};

// Initialize database and handlers
const db = getDb();
const apiHandler = createHandler(db);

// Initialize password hash
let passwordHash: string;
try {
  passwordHash = await initPasswordHash();
} catch (e) {
  console.error("⚠️  Dashboard auth not configured:", (e as Error).message);
  console.error("   Set DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH env var.");
  console.error("   Dashboard routes will not be available.");
  passwordHash = "";
}

const authHandler = createAuthHandler(db, SECRET, passwordHash);
const dashboardHandler = createDashboardHandler(db, SECRET);

// Graceful shutdown
const shutdown = () => {
  console.log("\nShutting down...");
  closeDb();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

/** Serve a static file from disk. */
async function serveStatic(filePath: string, contentType: string): Promise<Response> {
  try {
    const content = await Deno.readFile(filePath);
    return new Response(content, {
      headers: { "Content-Type": `${contentType}; charset=utf-8` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

// Combined request handler
const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Static files
  const staticFile = STATIC_FILES[path];
  if (staticFile && req.method === "GET") {
    return await serveStatic(staticFile.path, staticFile.type);
  }

  // Auth routes
  if (path.startsWith("/auth/")) {
    return authHandler(req);
  }

  // Dashboard routes
  if (path.startsWith("/dashboard")) {
    return dashboardHandler(req);
  }

  // API routes (heartbeat, paste, health)
  return apiHandler(req);
};

// Start server
console.log(`SEB Monitor server starting on port ${PORT}...`);
console.log(`  Health:    http://localhost:${PORT}/health`);
console.log(`  API:       http://localhost:${PORT}/api/heartbeat`);
console.log(`  Paste:     http://localhost:${PORT}/api/paste`);
console.log(`  Dashboard: http://localhost:${PORT}/dashboard`);
console.log(`  Login:     http://localhost:${PORT}/auth/login`);
console.log(`  Exam:      http://localhost:${PORT}/exam.html`);
console.log(`  Client JS: http://localhost:${PORT}/seb-monitor.js`);

Deno.serve({ port: PORT }, handler);
