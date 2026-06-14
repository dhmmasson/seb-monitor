/**
 * Server entry point — boots the HTTP server using Deno.serve().
 * No external HTTP framework needed — zero dependencies beyond sqlite.
 */
import { createHandler } from "./routes/api.ts";
import { getDb, closeDb } from "./db/connection.ts";

// Configuration
const PORT = parseInt(Deno.env.get("PORT") ?? "8000");

// Initialize database and handler
const db = getDb();
const handler = createHandler(db);

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

Deno.serve({ port: PORT }, handler);
