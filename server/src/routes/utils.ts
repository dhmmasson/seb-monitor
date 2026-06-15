/**
 * Shared route utilities — response helpers, parameter extraction, authentication.
 */

/** Create an HTML response. */
export function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Create a JSON response. */
export function json(
  data: unknown,
  status = 200,
  corsHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
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
