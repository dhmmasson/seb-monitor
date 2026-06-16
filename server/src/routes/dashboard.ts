/**
 * Dashboard routes — protected by cookie-based authentication.
 * GET /dashboard — exam index (all exams with student counts)
 * GET /dashboard/:encodedExamId — exam overview with student table
 * GET /dashboard/:encodedExamId/student/:sessionId — student detail
 *
 * Exam IDs are base64url-encoded in URLs (see url-ids.ts) so that
 * full URLs like "https://moodle.example.com/exam/123" work as path segments.
 */
import type { DB } from "sqlite";
import { verifyCookie } from "../services/auth.ts";
import { computeExamSummary } from "../services/metrics.ts";
import { renderExamList } from "../views/exam-list.ts";
import { renderStudentDetail } from "../views/student-detail.ts";
import { renderExamIndex } from "../views/exam-index.ts";
import { html, redirect, extractParam } from "./utils.ts";
import { decodeExamId } from "./url-ids.ts";

const COOKIE_NAME = "seb_auth";

/**
 * Check if a request has a valid auth cookie.
 */
async function isAuthenticated(req: Request, secret: string): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const authCookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!authCookie) return false;

  const value = authCookie.substring(COOKIE_NAME.length + 1);
  const result = await verifyCookie(value, secret);
  return result !== null;
}

/**
 * Create a handler for dashboard routes.
 * All /dashboard/* routes require authentication via signed cookie.
 */
export function createDashboardHandler(
  db: DB,
  secret: string,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // Only handle /dashboard/* routes
    if (!path.startsWith("/dashboard")) {
      return new Response("Not found", { status: 404 });
    }

    // Check authentication
    const authed = await isAuthenticated(req, secret);
    if (!authed) {
      return redirect("/auth/login");
    }

    // GET /dashboard — exam index showing all exams
    if (path === "/dashboard" || path === "/dashboard/") {
      return html(renderExamIndex(db));
    }

    // GET /dashboard/:examId — exam overview
    const examId = extractParam(path, "/dashboard/:examId", "examId");
    if (examId && !path.includes("/student/")) {
      const decodedExamId = decodeExamId(examId);
      const students = computeExamSummary(db, decodedExamId);
      return html(renderExamList(decodedExamId, students));
    }

    // GET /dashboard/:examId/student/:sessionId — student detail
    const eId = extractParam(
      path,
      "/dashboard/:examId/student/:sessionId",
      "examId",
    );
    const sId = extractParam(
      path,
      "/dashboard/:examId/student/:sessionId",
      "sessionId",
    );
    if (eId && sId) {
      const decodedEId = decodeExamId(eId);
      return html(renderStudentDetail(db, decodedEId, sId));
    }

    return new Response("Not found", { status: 404 });
  };
}
