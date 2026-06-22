/**
 * Student detail view — per-student dashboard page with metrics, charts, and event timeline.
 * Server-side rendered inside the layout shell. Uses Chart.js via CDN for visualizations.
 */
import type { DB } from "sqlite";
import { renderLayout } from "./layout.ts";
import { escapeHtml } from "./utils.ts";
import { computeSessionMetrics } from "../services/metrics.ts";
import { queryAll } from "../db/utils.ts";
import { encodeExamId } from "../routes/url-ids.ts";

interface HeartbeatRow {
  timestamp: number;
  focusedTimeMs: number;
  unfocusedTimeMs: number;
  blurCount: number;
  typedChars: number;
  pastedChars: number;
  deletedChars: number;
  copyCount: number;
  pasteCount: number;
  inputContentHash: string | null;
}

interface EventRow {
  type: string;
  timestamp: number;
  hash: string | null;
  length: number | null;
  matchedCopyHash: string | null;
}

interface PasteContentRow {
  hash: string;
  content: string;
  length: number;
  timestamp: number;
}

interface InputSnapshotRow {
  hash: string;
  content: string;
  length: number;
  timestamp: number;
}

function getStudentId(db: DB, sessionId: string): string {
  const rows = queryAll(
    db,
    "SELECT student_id FROM sessions WHERE session_id = ?",
    [sessionId],
  );
  return (rows[0]?.[0] as string) ?? "Unknown";
}

function getHeartbeats(db: DB, sessionId: string): HeartbeatRow[] {
  return queryAll(
    db,
    `SELECT timestamp, focused_time_ms, unfocused_time_ms, blur_count,
            typed_chars, pasted_chars, deleted_chars, copy_count, paste_count,
            input_content_hash
     FROM heartbeats WHERE session_id = ? ORDER BY timestamp`,
    [sessionId],
  ).map((r) => ({
    timestamp: r[0] as number,
    focusedTimeMs: r[1] as number,
    unfocusedTimeMs: r[2] as number,
    blurCount: r[3] as number,
    typedChars: r[4] as number,
    pastedChars: r[5] as number,
    deletedChars: r[6] as number,
    copyCount: r[7] as number,
    pasteCount: r[8] as number,
    inputContentHash: r[9] as string | null,
  }));
}

function getEvents(db: DB, sessionId: string): EventRow[] {
  return queryAll(
    db,
    "SELECT type, timestamp, hash, length, matched_copy_hash FROM events WHERE session_id = ? ORDER BY timestamp",
    [sessionId],
  ).map((r) => ({
    type: r[0] as string,
    timestamp: r[1] as number,
    hash: r[2] as string | null,
    length: r[3] as number | null,
    matchedCopyHash: r[4] as string | null,
  }));
}

function getPasteContents(
  db: DB,
  sessionId: string,
): Map<string, PasteContentRow> {
  const map = new Map<string, PasteContentRow>();
  for (
    const r of queryAll(
      db,
      "SELECT hash, content, length, timestamp FROM paste_contents WHERE session_id = ?",
      [sessionId],
    )
  ) {
    map.set(r[0] as string, {
      hash: r[0] as string,
      content: r[1] as string,
      length: r[2] as number,
      timestamp: r[3] as number,
    });
  }
  return map;
}

function getInputSnapshots(
  db: DB,
  sessionId: string,
): Map<string, InputSnapshotRow> {
  const map = new Map<string, InputSnapshotRow>();
  for (
    const r of queryAll(
      db,
      "SELECT hash, content, length, timestamp FROM input_snapshots WHERE session_id = ?",
      [sessionId],
    )
  ) {
    map.set(r[0] as string, {
      hash: r[0] as string,
      content: r[1] as string,
      length: r[2] as number,
      timestamp: r[3] as number,
    });
  }
  return map;
}

/**
 * Render the student detail page.
 */
export function renderStudentDetail(
  db: DB,
  examId: string,
  sessionId: string,
  basePath = "",
): string {
  const studentId = getStudentId(db, sessionId);
  const metrics = computeSessionMetrics(db, sessionId);
  const heartbeats = getHeartbeats(db, sessionId);
  const events = getEvents(db, sessionId);
  const pasteContents = getPasteContents(db, sessionId);
  const inputSnapshots = getInputSnapshots(db, sessionId);

  const focusPct = Math.round(metrics.focusRatio * 100);
  const pastePct = Math.round(metrics.pasteRatio * 100);

  // Metric cards
  const cardsHtml = `
    <div class="metrics-grid">
      ${metricCard(`${focusPct}%`, "Focus Ratio")}
      ${metricCard(`${pastePct}%`, "Paste Ratio")}
      ${metricCard(String(metrics.totalCopyCount), "Copies")}
      ${metricCard(String(metrics.totalPasteCount), "Pastes")}
      ${metricCard(String(metrics.unmatchedPasteCount), "Unmatched")}
      ${
    metricCard(
      metrics.largestPasteLength > 0
        ? `${metrics.largestPasteLength} chars`
        : "—",
      "Largest Paste",
    )
  }
    </div>`;

  // Chart section
  const chartHtml = heartbeats.length > 0
    ? renderChartSection(heartbeats)
    : '<p class="empty-state">No heartbeats recorded yet.</p>';

  // Events table (includes heartbeats interleaved by timestamp)
  const eventsHtml = renderEventsTable(events, pasteContents, inputSnapshots, heartbeats, basePath);

  const content = `
    <h1 style="margin-bottom: 0.5rem;">👤 ${escapeHtml(studentId)}</h1>
    <p style="color: #666; margin-bottom: 1.5rem;">Session: ${
    escapeHtml(sessionId)
  }</p>
    <p style="margin-bottom: 1.5rem;"><a href="${basePath}/dashboard/${escapeHtml(encodeExamId(examId))}/student/${escapeHtml(sessionId)}/export.csv" style="display: inline-block; padding: 0.4rem 0.8rem; background: #0d6efd; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.9rem;">📥 Download CSV</a></p>
    ${cardsHtml}
    <div class="card" style="margin-bottom: 1.5rem;">
      <h2 style="margin-bottom: 1rem;">📈 Activity Timeline</h2>
      ${chartHtml}
    </div>
    ${eventsHtml}
    <p style="margin-top: 1rem;"><a href="${basePath}/dashboard/${
    escapeHtml(encodeExamId(examId))
  }">← Back to exam overview</a></p>`;

  return renderLayout(`${studentId} — SEB Monitor`, content, basePath);
}

function metricCard(value: string, label: string): string {
  return `<div class="card metric">
    <div class="metric-value">${escapeHtml(value)}</div>
    <div class="metric-label">${escapeHtml(label)}</div>
  </div>`;
}

function renderChartSection(heartbeats: HeartbeatRow[]): string {
  const labels = heartbeats.map((h) =>
    new Date(h.timestamp).toLocaleTimeString()
  );
  const focusData = heartbeats.map((h) => {
    const total = h.focusedTimeMs + h.unfocusedTimeMs;
    return total > 0 ? Math.round((h.focusedTimeMs / total) * 100) : 0;
  });
  const typedData = heartbeats.map((h) => h.typedChars);
  const pastedData = heartbeats.map((h) => h.pastedChars);

  return `
    <canvas id="activityChart" height="200"></canvas>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      new Chart(document.getElementById('activityChart'), {
        type: 'line',
        data: {
          labels: ${JSON.stringify(labels)},
          datasets: [
            { label: 'Focus %', data: ${
    JSON.stringify(focusData)
  }, borderColor: '#28a745', tension: 0.3, yAxisID: 'y' },
            { label: 'Typed Chars', data: ${
    JSON.stringify(typedData)
  }, borderColor: '#0d6efd', tension: 0.3, yAxisID: 'y1' },
            { label: 'Pasted Chars', data: ${
    JSON.stringify(pastedData)
  }, borderColor: '#ffc107', tension: 0.3, yAxisID: 'y1' },
          ]
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { type: 'linear', position: 'left', min: 0, max: 100, title: { display: true, text: 'Focus %' } },
            y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Chars' } },
          }
        }
      });
    </script>`;
}

function renderEventsTable(
  events: EventRow[],
  pasteContents: Map<string, PasteContentRow>,
  inputSnapshots: Map<string, InputSnapshotRow>,
  heartbeats: HeartbeatRow[],
  basePath = "",
): string {
  // Build unified timeline: events + heartbeats, sorted by timestamp
  type TimelineEntry = { timestamp: number; html: string };
  const timeline: TimelineEntry[] = [];

  // Add events
  for (const e of events) {
    const isUnmatched = e.type === "paste" && e.matchedCopyHash === null;
    const rowClass = isUnmatched ? ' class="highlight-unmatched"' : "";
    const hashCell = e.hash
      ? `<a href="${basePath}/dashboard/hash/${escapeHtml(e.hash)}"><code>${escapeHtml(e.hash.substring(0, 12))}…</code></a>`
      : "—";
    const lengthCell = e.length !== null ? String(e.length) : "—";

    let contentCell = "";
    if (e.hash && pasteContents.has(e.hash)) {
      const content = pasteContents.get(e.hash)!;
      contentCell = `
        <span class="paste-expand" onclick="this.nextElementSibling.classList.toggle('show')">🔍 Show content</span>
        <div class="paste-content">${escapeHtml(content.content)}</div>`;
    } else if (e.type === "paste" && e.hash) {
      contentCell = `<span style="color: #999;">(not stored)</span>`;
    } else if (e.type === "copy" && e.hash) {
      contentCell = `<span style="color: #999;">(copy)</span>`;
    }

    timeline.push({
      timestamp: e.timestamp,
      html: `<tr${rowClass}>
        <td>${escapeHtml(e.type)}</td>
        <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
        <td>${hashCell}</td>
        <td>${lengthCell}</td>
        <td>${contentCell}</td>
        <td></td>
      </tr>`,
    });
  }

  // Add heartbeats
  for (const h of heartbeats) {
    const total = h.focusedTimeMs + h.unfocusedTimeMs;
    const focusPct = total > 0 ? Math.round((h.focusedTimeMs / total) * 100) : 0;

    let snapshotCell = "—";
    if (h.inputContentHash && inputSnapshots.has(h.inputContentHash)) {
      const snap = inputSnapshots.get(h.inputContentHash)!;
      snapshotCell = `
        <span class="paste-expand" onclick="this.nextElementSibling.classList.toggle('show')">📝 Show content (${snap.length} chars)</span>
        <div class="paste-content">${escapeHtml(snap.content)}</div>`;
    } else if (h.inputContentHash) {
      snapshotCell = `<span style="color: #999;">${escapeHtml(h.inputContentHash.substring(0, 8))}…</span>`;
    }

    timeline.push({
      timestamp: h.timestamp,
      html: `<tr>
        <td><strong>heartbeat</strong></td>
        <td>${new Date(h.timestamp).toLocaleTimeString()}</td>
        <td>—</td>
        <td>—</td>
        <td>Focus: ${focusPct}% · Typed: ${h.typedChars} chars</td>
        <td>${snapshotCell}</td>
      </tr>`,
    });
  }

  // Sort by timestamp
  timeline.sort((a, b) => a.timestamp - b.timestamp);

  if (timeline.length === 0) {
    return '<div class="card"><h2>📋 Events</h2><p class="empty-state">No events recorded.</p></div>';
  }

  const rows = timeline.map((entry) => entry.html).join("");

  return `
    <div class="card" style="margin-bottom: 1.5rem;">
      <h2 style="margin-bottom: 1rem;">📋 Events</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Time</th>
            <th>Hash</th>
            <th>Length</th>
            <th>Content</th>
            <th>Snapshot</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>`;
}
