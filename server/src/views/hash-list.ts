/**
 * Hash list view — lists all clipboard hashes sorted by usage count.
 * Server-side rendered inside the layout shell.
 */
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";

interface HashStats {
  hash: string;
  usageCount: number;
  copyCount: number;
  pasteCount: number;
  firstSeen: number;
  lastSeen: number;
  examId: string;
}

/**
 * Render the hash list page — a table of all hashes sorted by usage.
 */
export function renderHashList(
  stats: HashStats[],
  basePath = "",
): string {
  const rows = stats.length > 0
    ? stats.map((s) => renderHashRow(s, basePath)).join("")
    : `<tr><td colspan="7" class="empty-state">No hashes found. Copy/paste events will appear here.</td></tr>`;

  const content = `
    <h1 style="margin-bottom: 1rem;">🔍 Clipboard Hashes</h1>
    <table>
      <thead>
        <tr>
          <th>Hash</th>
          <th>Uses</th>
          <th>Copies</th>
          <th>Pastes</th>
          <th>First Seen</th>
          <th>Last Seen</th>
          <th>Exam</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;

  return renderLayout("Clipboard Hashes — SEB Monitor", content, basePath);
}

function renderHashRow(stat: HashStats, basePath: string): string {
  const truncatedHash = stat.hash.length > 12
    ? stat.hash.substring(0, 12) + "…"
    : stat.hash;
  const firstSeen = new Date(stat.firstSeen).toLocaleTimeString();
  const lastSeen = new Date(stat.lastSeen).toLocaleTimeString();

  return `<tr>
    <td><a href="${basePath}/dashboard/hash/${escapeHtml(stat.hash)}">${escapeHtml(truncatedHash)}</a></td>
    <td><strong>${stat.usageCount}</strong></td>
    <td>${stat.copyCount}</td>
    <td>${stat.pasteCount}</td>
    <td>${firstSeen}</td>
    <td>${lastSeen}</td>
    <td>${escapeHtml(stat.examId)}</td>
  </tr>`;
}
