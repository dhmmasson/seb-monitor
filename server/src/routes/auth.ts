/**
 * Auth routes — GET /auth/login (login form), POST /auth/login (password check).
 * Sets a signed cookie on successful authentication.
 */
import type { DB } from "sqlite";
import { renderLoginPage } from "../views/login.ts";
import { hashPassword, verifyPassword, signCookie } from "../services/auth.ts";

const COOKIE_NAME = "seb_auth";

function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirect(location: string, headers: HeadersInit = {}): Response {
  return new Response(null, { status: 302, headers: { location, ...headers } });
}

function parseFormData(body: string): string {
  const params = new URLSearchParams(body);
  return params.get("password") ?? "";
}

/**
 * Create a handler for auth routes.
 * @param db Database instance (unused for now, reserved for audit logging)
 * @param secret Cookie signing secret
 * @param storedHash Pre-computed bcrypt/PBKDF2 hash of the dashboard password
 */
export function createAuthHandler(
  _db: DB,
  secret: string,
  storedHash?: string,
): (req: Request) => Promise<Response> {
  // If no pre-computed hash, hash from env var at startup
  const _storedHash = storedHash;

  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // GET /auth/login — show login form
    if (path === "/auth/login" && method === "GET") {
      return html(renderLoginPage());
    }

    // POST /auth/login — verify password
    if (path === "/auth/login" && method === "POST") {
      if (!_storedHash) {
        return html(renderLoginPage("Server configuration error"), 500);
      }

      const body = await req.text();
      const password = parseFormData(body);

      const valid = await verifyPassword(password, _storedHash);
      if (!valid) {
        return html(renderLoginPage("Invalid password"), 401);
      }

      // Set signed auth cookie and redirect to dashboard
      const signedValue = await signCookie("authenticated", secret);
      return redirect("/dashboard", {
        "Set-Cookie": `${COOKIE_NAME}=${signedValue}; Path=/; HttpOnly; SameSite=Strict`,
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

/**
 * Initialize the stored password hash from environment.
 * Call once at startup. Returns the hash string.
 */
export async function initPasswordHash(): Promise<string> {
  const hash = Deno.env.get("DASHBOARD_PASSWORD_HASH");
  if (hash) return hash;

  const password = Deno.env.get("DASHBOARD_PASSWORD");
  if (!password) {
    throw new Error("Either DASHBOARD_PASSWORD or DASHBOARD_PASSWORD_HASH must be set");
  }

  return await hashPassword(password);
}
