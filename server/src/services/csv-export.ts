/**
 * CSV export — generates a unified event+heartbeat timeline as CSV.
 * Used by the export.csv route for downloading student event logs.
 */
import type { DB } from "sqlite";
import { queryAll } from "../db/utils.ts";

interface CsvTimelineEntry {
  type: string;
  timestamp: number;
  hash: string;
  length: string;
  focus: string;
  content: string;
}

interface SnapshotInfo {
  content: string;
  length: number;
}

/**
 * Escape a value for CSV output. Wraps in quotes if the value contains
 * a comma, quote, or newline. Doubles any internal quotes.
 */
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Build a CSV timeline for a session, merging events and heartbeats
 * sorted by timestamp.
 */
export function buildCsvTimeline(db: DB, sessionId: string): string {
  // Query events
  const eventRows = queryAll(
    db,
    "SELECT type, timestamp, hash, length, matched_copy_hash FROM events WHERE session_id = ? ORDER BY timestamp",
    [sessionId],
  );

  // Query heartbeats
  const heartbeatRows = queryAll(
    db,
    "SELECT timestamp, focused_time_ms, unfocused_time_ms, input_content_hash FROM heartbeats WHERE session_id = ? ORDER BY timestamp",
    [sessionId],
  );

  // Query paste contents into a map
  const pasteMap = new Map<string, string>();
  for (const r of queryAll(
    db,
    "SELECT hash, content FROM paste_contents WHERE session_id = ?",
    [sessionId],
  )) {
    pasteMap.set(r[0] as string, r[1] as string);
  }

  // Query input snapshots into a map
  const snapshotMap = new Map<string, SnapshotInfo>();
  for (const r of queryAll(
    db,
    "SELECT hash, content, length FROM input_snapshots WHERE session_id = ?",
    [sessionId],
  )) {
    snapshotMap.set(r[0] as string, {
      content: r[1] as string,
      length: r[2] as number,
    });
  }

  // Build unified timeline
  const entries: CsvTimelineEntry[] = [];

  // Add events
  for (const r of eventRows) {
    const type = r[0] as string;
    const timestamp = r[1] as number;
    const hash = (r[2] as string) ?? "";
    const length = r[3] !== null && r[3] !== undefined ? String(r[3]) : "";

    let content = "";
    if (type === "paste" && hash && pasteMap.has(hash)) {
      content = pasteMap.get(hash)!;
    } else if (type === "copy") {
      content = "(copy)";
    }

    entries.push({ type, timestamp, hash, length, focus: "", content });
  }

  // Add heartbeats
  for (const r of heartbeatRows) {
    const timestamp = r[0] as number;
    const focusedMs = r[1] as number;
    const unfocusedMs = r[2] as number;
    const inputHash = (r[3] as string) ?? "";

    const total = focusedMs + unfocusedMs;
    const focusPct = total > 0 ? Math.round((focusedMs / total) * 100) : 0;

    let content = "";
    let length = "";
    if (inputHash && snapshotMap.has(inputHash)) {
      const snap = snapshotMap.get(inputHash)!;
      content = snap.content;
      length = String(snap.length);
    }

    entries.push({
      type: "heartbeat",
      timestamp,
      hash: inputHash,
      length,
      focus: `${focusPct}%`,
      content,
    });
  }

  // Sort by timestamp
  entries.sort((a, b) => a.timestamp - b.timestamp);

  // Build CSV
  const header = "type,time,hash,length,focus,content";
  const rows = entries.map((e) => {
    const time = new Date(e.timestamp).toISOString();
    return [
      e.type,
      time,
      e.hash,
      e.length,
      e.focus,
      escapeCsvField(e.content),
    ].join(",");
  });

  return [header, ...rows].join("\n") + "\n";
}
