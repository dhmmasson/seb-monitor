/**
 * Shared route utilities — response helpers, parameter extraction, CORS.
 */

/** CORS headers for API routes. */
export const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Create an HTML response. */
export function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Create a CSV response with Content-Disposition for download. */
export function csv(content: string, filename: string): Response {
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Create a JSON response (no CORS). */
export function json(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a JSON response with CORS headers (for API routes). */
export function jsonCors(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/** Create a 302 redirect response. */
export function redirect(
  location: string,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(null, {
    status: 302,
    headers: { location, ...extraHeaders },
  });
}

/** Extract a named parameter from a URL path using a pattern like "/api/paste/:hash". */
export function extractParam(
  path: string,
  pattern: string,
  name?: string,
): string | null {
  const regex = new RegExp(
    "^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$",
  );
  const match = path.match(regex);
  if (name && match?.groups) return match.groups[name] ?? null;
  return match?.groups ? Object.values(match.groups)[0] ?? null : null;
}
