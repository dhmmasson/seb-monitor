/**
 * Demo server for testing the SEB monitoring client.
 * Receives heartbeats and paste content, displays them in the terminal.
 *
 * Usage: deno run --allow-net demo/server.ts
 */

const PORT = 8000;

// Store received messages for display
interface LogEntry {
  timestamp: string;
  type: "heartbeat" | "paste";
  data: unknown;
}

const log: LogEntry[] = [];

function addLog(type: "heartbeat" | "paste", data: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    type,
    data,
  };
  log.push(entry);

  // Pretty print to terminal
  console.log("\n" + "=".repeat(60));
  console.log(`📨 ${type.toUpperCase()} received at ${entry.timestamp}`);
  console.log("=".repeat(60));
  console.log(JSON.stringify(data, null, 2));
  console.log("=".repeat(60) + "\n");
}

// CORS headers for browser requests
function corsHeaders(): Headers {
  return new Headers({
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // POST /api/heartbeat
  if (url.pathname === "/api/heartbeat" && req.method === "POST") {
    try {
      const body = await req.json();
      addLog("heartbeat", body);
      return new Response(
        JSON.stringify({ sessionId: `session-${Date.now()}` }),
        { status: 200, headers: corsHeaders() },
      );
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  // POST /api/paste
  if (url.pathname === "/api/paste" && req.method === "POST") {
    try {
      const body = await req.json();
      addLog("paste", body);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders() },
      );
    } catch (_error) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: corsHeaders() },
      );
    }
  }

  // GET /api/logs - View received messages
  if (url.pathname === "/api/logs" && req.method === "GET") {
    return new Response(
      JSON.stringify(log, null, 2),
      { status: 200, headers: corsHeaders() },
    );
  }

  // GET / - Serve a simple status page
  if (url.pathname === "/" && req.method === "GET") {
    const html = `<!DOCTYPE html>
<html>
<head><title>SEB Monitor - Demo Server</title></head>
<body>
  <h1>SEB Monitor Demo Server</h1>
  <p>Server is running on port ${PORT}</p>
  <p>Messages received: ${log.length}</p>
  <ul>
    <li>POST /api/heartbeat - Receive heartbeats</li>
    <li>POST /api/paste - Receive paste content</li>
    <li>GET /api/logs - View received messages</li>
  </ul>
</body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: new Headers({ "Content-Type": "text/html" }),
    });
  }

  return new Response(
    JSON.stringify({ error: "Not found" }),
    { status: 404, headers: corsHeaders() },
  );
}

console.log(`🚀 SEB Monitor Demo Server running on http://localhost:${PORT}`);
console.log(`   - POST http://localhost:${PORT}/api/heartbeat`);
console.log(`   - POST http://localhost:${PORT}/api/paste`);
console.log(`   - GET  http://localhost:${PORT}/api/logs`);
console.log("\nWaiting for messages...\n");

Deno.serve({ port: PORT }, handler);
