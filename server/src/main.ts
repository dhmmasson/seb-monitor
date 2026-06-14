/**
 * Server entry point — boots the Oak HTTP server.
 * Configurable via environment variables.
 */
import { createApp } from "./routes/api.ts";
import { getDb, closeDb } from "./db/connection.ts";

// Configuration
const PORT = parseInt(Deno.env.get("PORT") ?? "8000");

// Initialize database
const db = getDb();

// Create app
const app = createApp(db);

// Graceful shutdown
const shutdown = () => {
  console.log("\nShutting down...");
  closeDb();
  Deno.exit(0);
};

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Start server
console.log(`SEB Monitor server starting on port ${PORT}...`);
console.log(`  Health: http://localhost:${PORT}/health`);
console.log(`  API:    http://localhost:${PORT}/api/heartbeat`);
console.log(`  Paste:  http://localhost:${PORT}/api/paste`);

await app.listen({ port: PORT });
