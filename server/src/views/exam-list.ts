/**
 * Exam list view — table of all students for an exam with key metrics.
 * Server-side rendered inside the layout shell. Includes client-side sorting.
 */
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";
import { encodeExamId } from "../routes/url-ids.ts";
import type { ExamSummaryEntry } from "../services/metrics.ts";

export function renderExamList(
  examId: string,
  students: ExamSummaryEntry[],
  basePath = "",
): string {
  const rows = students.length > 0
    ? students.map((s) => renderStudentRow(examId, s, basePath)).join("")
    : `<tr><td colspan="7" class="empty-state">No students found for this exam.</td></tr>`;

  const content = `
    <h1 style="margin-bottom: 1rem;">📋 Exam: ${escapeHtml(examId)}</h1>
    <table id="examTable">
      <thead>
        <tr>
          <th class="sortable" data-sort-key="name" onclick="sortTable('name')">Student ↕</th>
          <th class="sortable" data-sort-key="focus" onclick="sortTable('focus')">Focus Ratio ↕</th>
          <th class="sortable" data-sort-key="paste" onclick="sortTable('paste')">Paste Ratio ↕</th>
          <th class="sortable" data-sort-key="copies" onclick="sortTable('copies')">Copies ↕</th>
          <th class="sortable" data-sort-key="pastes" onclick="sortTable('pastes')">Pastes ↕</th>
          <th class="sortable" data-sort-key="unmatched" onclick="sortTable('unmatched')">Unmatched ↕</th>
          <th class="sortable" data-sort-key="largestPaste" onclick="sortTable('largestPaste')">Largest Paste ↕</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <script>
      (function() {
        var currentSort = { key: null, asc: true };
        window.sortTable = function(key) {
          var table = document.getElementById('examTable');
          var tbody = table.querySelector('tbody');
          var rows = Array.from(tbody.querySelectorAll('tr'));
          if (rows.length === 0) return;
          if (currentSort.key === key) {
            currentSort.asc = !currentSort.asc;
          } else {
            currentSort.key = key;
            currentSort.asc = true;
          }
          rows.sort(function(a, b) {
            var aEl = a.querySelector('[data-sort-key="' + key + '"]');
            var bEl = b.querySelector('[data-sort-key="' + key + '"]');
            var aVal = aEl ? aEl.getAttribute('data-sort') : '';
            var bVal = bEl ? bEl.getAttribute('data-sort') : '';
            var aNum = parseFloat(aVal);
            var bNum = parseFloat(bVal);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return currentSort.asc ? aNum - bNum : bNum - aNum;
            }
            return currentSort.asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          });
          rows.forEach(function(row) { tbody.appendChild(row); });
          table.querySelectorAll('th.sortable').forEach(function(th) {
            var k = th.getAttribute('data-sort-key');
            var base = th.textContent.replace(/[ ↑↓↕]/g, '').trim();
            if (k === key) {
              th.textContent = base + (currentSort.asc ? ' ↑' : ' ↓');
            } else {
              th.textContent = base + ' ↕';
            }
          });
        };
      })();
    </script>`;

  return renderLayout(`Exam ${examId} — SEB Monitor`, content, basePath);
}

/** Badge class based on value thresholds. */
function badgeClass(value: number, goodMax: number, warnMax: number): string {
  return value <= goodMax
    ? "badge-good"
    : value <= warnMax
    ? "badge-warn"
    : "badge-bad";
}

function renderStudentRow(examId: string, student: ExamSummaryEntry, basePath = ""): string {
  const focusPct = Math.round(student.focusRatio * 100);
  const pastePct = Math.round(student.pasteRatio * 100);
  const encodedExamId = encodeExamId(examId);

  return `<tr>
    <td data-sort-key="name" data-sort="${escapeHtml(student.studentId)}"><a href="${basePath}/dashboard/${escapeHtml(encodedExamId)}/student/${
    escapeHtml(student.sessionId)
  }">${escapeHtml(student.studentId)}</a></td>
    <td data-sort-key="focus" data-sort="${focusPct}"><span class="badge ${
    badgeClass(100 - focusPct, 10, 50)
  }">${focusPct}%</span></td>
    <td data-sort-key="paste" data-sort="${pastePct}"><span class="badge ${
    badgeClass(pastePct, 20, 50)
  }">${pastePct}%</span></td>
    <td data-sort-key="copies" data-sort="${student.totalCopyCount}">${student.totalCopyCount}</td>
    <td data-sort-key="pastes" data-sort="${student.totalPasteCount}">${student.totalPasteCount}</td>
    <td data-sort-key="unmatched" data-sort="${student.unmatchedPasteCount}">${
    student.unmatchedPasteCount > 0
      ? `<span class="badge badge-warn">${student.unmatchedPasteCount}</span>`
      : "0"
  }</td>
    <td data-sort-key="largestPaste" data-sort="${student.largestPasteLength}">${
    student.largestPasteLength > 0 ? `${student.largestPasteLength} chars` : "—"
  }</td>
  </tr>`;
}
