/**
 * Paste content storage — the most sensitive data.
 * Isolated from events for access control and retention policies.
 */
import type { DB } from "sqlite";
import type { PasteContentRequest } from "../../../shared/types.ts";

/**
 * Insert paste content. Idempotent — skips if hash already exists.
 */
export function insertPasteContent(
  db: DB,
  request: PasteContentRequest,
): void {
  const stmt = db.prepareQuery(
    `INSERT OR IGNORE INTO paste_contents (hash, session_id, content, length, timestamp, exam_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  try {
    stmt.execute([
      request.hash,
      request.sessionId,
      request.content,
      request.length,
      request.timestamp,
      request.examId,
    ]);
  } finally {
    stmt.finalize();
  }
}

/**
 * Retrieve paste content by hash. Returns null if not found.
 */
export function getPasteContent(
  db: DB,
  hash: string,
): { hash: string; content: string; length: number; sessionId: string; timestamp: number } | null {
  const stmt = db.prepareQuery(
    "SELECT hash, session_id, content, length, timestamp FROM paste_contents WHERE hash = ?"
  );
  try {
    const rows = [...stmt.all([hash])];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      hash: row[0] as string,
      sessionId: row[1] as string,
      content: row[2] as string,
      length: row[3] as number,
      timestamp: row[4] as number,
    };
  } finally {
    stmt.finalize();
  }
}
