/**
 * Dashboard routes — protected by cookie-based authentication.
 * GET /dashboard — exam list
 * GET /dashboard/:examId — exam overview with student table
 * GET /dashboard/:examId/student/:sessionId — student detail
 */
import type { DB } from "sqlite";
import { verifyCookie } from "../services/auth.ts";
import { computeExamSummary } from "../services/metrics.ts";
import { renderExamList } from "../views/exam-list.ts";
import { renderStudentDetail } from "../views/student-detail.ts";
import { html, redirect, extractParam } from "./utils.ts";

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

    // GET /dashboard — list all exams (for now, redirect to first exam or show overview)
    if (path === "/dashboard" || path === "/dashboard/") {
      // Show all exams — find all unique exam_ids
      const stmt = db.prepareQuery("SELECT DISTINCT exam_id FROM sessions");
      try {
        const examRows = [...stmt.all()];
        if (examRows.length > 0) {
          const examId = examRows[0][0] as string;
          const students = computeExamSummary(db, examId);
          return html(renderExamList(examId, students));
        }
        return html(renderExamList("", []));
      } finally {
        stmt.finalize();
      }
    }

    // GET /dashboard/:examId — exam overview
    const examId = extractParam(path, "/dashboard/:examId", "examId");
    if (examId && !path.includes("/student/")) {
      const students = computeExamSummary(db, examId);
      return html(renderExamList(examId, students));
    }

    // GET /dashboard/:examId/student/:sessionId — student detail
    const studentMatch = path.match(/^\/dashboard\/([^/]+)\/student\/([^/]+)$/);
    if (studentMatch) {
      const eId = studentMatch[1];
      const sId = studentMatch[2];
      return html(renderStudentDetail(db, eId, sId));
    }

    return new Response("Not found", { status: 404 });
  };
}
