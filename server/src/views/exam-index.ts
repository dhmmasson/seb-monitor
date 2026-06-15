/**
 * Exam index view — lists all exams with student counts.
 * Server-side rendered inside the layout shell.
 */
import type { DB } from "sqlite";
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";
import { queryAll } from "../db/utils.ts";

/**
 * Render the exam index page — a table of all exams with student counts.
 */
export function renderExamIndex(db: DB): string {
  const rows = queryAll(
    db,
    `SELECT exam_id, COUNT(DISTINCT session_id) as student_count
     FROM sessions
     GROUP BY exam_id
     ORDER BY exam_id`,
  );

  const tableRows = rows.length > 0
    ? rows
      .map(
        (r) => `
      <tr>
        <td><a href="/dashboard/${escapeHtml(r[0] as string)}">${escapeHtml(r[0] as string)}</a></td>
        <td>${r[1]}</td>
      </tr>`,
      )
      .join("")
    : `<tr><td colspan="2" class="empty-state">No exams found. Send some heartbeats first!</td></tr>`;

  const content = `
    <h1 style="margin-bottom: 1rem;">📊 All Exams</h1>
    <table>
      <thead>
        <tr>
          <th>Exam</th>
          <th>Students</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>`;

  return renderLayout("All Exams — SEB Monitor", content);
}
