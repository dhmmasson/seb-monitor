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

// Combined request handler
const handler = (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

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

Deno.serve({ port: PORT }, handler);
