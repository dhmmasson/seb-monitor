/**
 * Exam list view — table of all students for an exam with key metrics.
 * Server-side rendered inside the layout shell.
 */
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";
import { encodeExamId } from "../routes/url-ids.ts";
import type { ExamSummaryEntry } from "../services/metrics.ts";

export function renderExamList(
  examId: string,
  students: ExamSummaryEntry[],
): string {
  const rows = students.length > 0
    ? students.map((s) => renderStudentRow(examId, s)).join("")
    : `<tr><td colspan="7" class="empty-state">No students found for this exam.</td></tr>`;

  const content = `
    <h1 style="margin-bottom: 1rem;">📋 Exam: ${escapeHtml(examId)}</h1>
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Focus Ratio</th>
          <th>Paste Ratio</th>
          <th>Copies</th>
          <th>Pastes</th>
          <th>Unmatched</th>
          <th>Largest Paste</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;

  return renderLayout(`Exam ${examId} — SEB Monitor`, content);
}

/** Badge class based on value thresholds. */
function badgeClass(value: number, goodMax: number, warnMax: number): string {
  return value <= goodMax
    ? "badge-good"
    : value <= warnMax
    ? "badge-warn"
    : "badge-bad";
}

function renderStudentRow(examId: string, student: ExamSummaryEntry): string {
  const focusPct = Math.round(student.focusRatio * 100);
  const pastePct = Math.round(student.pasteRatio * 100);
  const encodedExamId = encodeExamId(examId);

  return `<tr>
    <td><a href="/dashboard/${escapeHtml(encodedExamId)}/student/${
    escapeHtml(student.sessionId)
  }">${escapeHtml(student.studentId)}</a></td>
    <td><span class="badge ${
    badgeClass(100 - focusPct, 10, 50)
  }">${focusPct}%</span></td>
    <td><span class="badge ${
    badgeClass(pastePct, 20, 50)
  }">${pastePct}%</span></td>
    <td>${student.totalCopyCount}</td>
    <td>${student.totalPasteCount}</td>
    <td>${
    student.unmatchedPasteCount > 0
      ? `<span class="badge badge-warn">${student.unmatchedPasteCount}</span>`
      : "0"
  }</td>
    <td>${
    student.largestPasteLength > 0 ? `${student.largestPasteLength} chars` : "—"
  }</td>
  </tr>`;
}
