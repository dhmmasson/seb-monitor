/**
 * Paste content storage — unified clipboard content for copy and paste events.
 * Stores raw content for both copy and paste, with event_type to distinguish.
 */
import type { DB } from "sqlite";
import type { PasteContentRequest } from "../../../shared/types.ts";

/**
 * Insert clipboard content (copy or paste). Idempotent — skips if hash already exists.
 */
export function insertPasteContent(
  db: DB,
  request: PasteContentRequest,
): void {
  const eventType = request.eventType ?? "paste";
  const stmt = db.prepareQuery(
    `INSERT OR IGNORE INTO paste_contents (hash, session_id, content, length, timestamp, exam_id, event_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    stmt.execute([
      request.hash,
      request.sessionId,
      request.content,
      request.length,
      request.timestamp,
      request.examId,
      eventType,
    ]);
  } finally {
    stmt.finalize();
  }
}

/**
 * Retrieve clipboard content by hash. Returns the first row if multiple exist.
 */
export function getPasteContent(
  db: DB,
  hash: string,
): { hash: string; eventType: string; content: string; length: number; sessionId: string; timestamp: number } | null {
  const stmt = db.prepareQuery(
    "SELECT hash, event_type, content, length, session_id, timestamp FROM paste_contents WHERE hash = ?"
  );
  try {
    const rows = [...stmt.all([hash])];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      hash: row[0] as string,
      eventType: row[1] as string,
      content: row[2] as string,
      length: row[3] as number,
      sessionId: row[4] as string,
      timestamp: row[5] as number,
    };
  } finally {
    stmt.finalize();
  }
}

/**
 * Get all clipboard content rows for a hash (multiple sessions/events).
 */
export function getAllClipboardContent(
  db: DB,
  hash: string,
): { hash: string; eventType: string; sessionId: string; content: string; length: number; timestamp: number; examId: string }[] {
  const stmt = db.prepareQuery(
    "SELECT hash, event_type, session_id, content, length, timestamp, exam_id FROM paste_contents WHERE hash = ? ORDER BY timestamp"
  );
  try {
    const rows = [...stmt.all([hash])];
    return rows.map((row) => ({
      hash: row[0] as string,
      eventType: row[1] as string,
      sessionId: row[2] as string,
      content: row[3] as string,
      length: row[4] as number,
      timestamp: row[5] as number,
      examId: row[6] as string,
    }));
  } finally {
    stmt.finalize();
  }
}

/**
 * Get hash usage statistics — ordered by usage count (most used first).
 */
export function getHashUsageStats(
  db: DB,
): { hash: string; usageCount: number; copyCount: number; pasteCount: number; firstSeen: number; lastSeen: number; examId: string }[] {
  const stmt = db.prepareQuery(
    `SELECT 
       hash,
       COUNT(*) as usage_count,
       SUM(CASE WHEN event_type = 'copy' THEN 1 ELSE 0 END) as copy_count,
       SUM(CASE WHEN event_type = 'paste' THEN 1 ELSE 0 END) as paste_count,
       MIN(timestamp) as first_seen,
       MAX(timestamp) as last_seen,
       exam_id
     FROM paste_contents
     GROUP BY hash
     ORDER BY usage_count DESC`
  );
  try {
    const rows = [...stmt.all()];
    return rows.map((row) => ({
      hash: row[0] as string,
      usageCount: row[1] as number,
      copyCount: row[2] as number,
      pasteCount: row[3] as number,
      firstSeen: row[4] as number,
      lastSeen: row[5] as number,
      examId: row[6] as string,
    }));
  } finally {
    stmt.finalize();
  }
}
