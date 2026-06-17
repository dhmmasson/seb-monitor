/**
 * Hash detail view — shows all clipboard events for a specific hash.
 * Server-side rendered inside the layout shell.
 */
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";

interface ClipboardRow {
  hash: string;
  eventType: string;
  sessionId: string;
  content: string;
  length: number;
  timestamp: number;
  examId: string;
}

/**
 * Render the hash detail page — content preview + usage timeline.
 */
export function renderHashDetail(
  hash: string,
  rows: ClipboardRow[],
  basePath = "",
): string {
  if (rows.length === 0) {
    const content = `
      <h1 style="margin-bottom: 1rem;">🔍 Hash: ${escapeHtml(hash.substring(0, 12))}…</h1>
      <p class="empty-state">No content found for this hash.</p>
      <p style="margin-top: 1rem;"><a href="${basePath}/dashboard/hashes">← Back to hash list</a></p>`;
    return renderLayout(`Hash ${hash.substring(0, 12)}… — SEB Monitor`, content, basePath);
  }

  const firstRow = rows[0];
  const copyCount = rows.filter((r) => r.eventType === "copy").length;
  const pasteCount = rows.filter((r) => r.eventType === "paste").length;
  const totalUses = rows.length;

  // Content preview
  const contentPreview = escapeHtml(firstRow.content);

  // Timeline rows
  const timelineRows = rows
    .sort((a, b) => b.timestamp - a.timestamp) // newest first
    .map((r) => {
      const time = new Date(r.timestamp).toLocaleTimeString();
      const typeClass = r.eventType === "copy" ? "badge-good" : "badge-warn";
      return `<tr>
        <td>${time}</td>
        <td><a href="${basePath}/dashboard/${escapeHtml(r.examId)}/student/${escapeHtml(r.sessionId)}">${escapeHtml(r.sessionId.substring(0, 8))}…</a></td>
        <td><span class="badge ${typeClass}">${escapeHtml(r.eventType)}</span></td>
        <td>${escapeHtml(r.examId)}</td>
      </tr>`;
    })
    .join("");

  const content = `
    <h1 style="margin-bottom: 0.5rem;">🔍 Hash: ${escapeHtml(hash.substring(0, 12))}…</h1>
    <p style="color: #666; margin-bottom: 1.5rem;">Full hash: <code>${escapeHtml(hash)}</code></p>
    
    <div class="metrics-grid">
      <div class="card metric">
        <div class="metric-value">${totalUses}</div>
        <div class="metric-label">Total Uses</div>
      </div>
      <div class="card metric">
        <div class="metric-value">${copyCount}</div>
        <div class="metric-label">Copies</div>
      </div>
      <div class="card metric">
        <div class="metric-value">${pasteCount}</div>
        <div class="metric-label">Pastes</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 1.5rem;">
      <h2 style="margin-bottom: 1rem;">📄 Content</h2>
      <pre style="background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; white-space: pre-wrap;">${contentPreview}</pre>
    </div>

    <div class="card" style="margin-bottom: 1.5rem;">
      <h2 style="margin-bottom: 1rem;">📅 Usage Timeline</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Session</th>
            <th>Type</th>
            <th>Exam</th>
          </tr>
        </thead>
        <tbody>
          ${timelineRows}
        </tbody>
      </table>
    </div>

    <p style="margin-top: 1rem;"><a href="${basePath}/dashboard/hashes">← Back to hash list</a></p>`;

  return renderLayout(`Hash ${hash.substring(0, 12)}… — SEB Monitor`, content, basePath);
}
