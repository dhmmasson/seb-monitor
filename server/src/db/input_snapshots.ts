/**
 * Input snapshot storage — captures the combined answer field content
 * at each heartbeat. Stores raw content linked by SHA-256 hash and session.
 */
import type { DB } from "sqlite";
import type { InputSnapshotRequest } from "../../../shared/types.ts";

/**
 * Insert an input content snapshot. Idempotent — skips if hash already exists for this session.
 */
export function insertInputSnapshot(
  db: DB,
  request: InputSnapshotRequest,
): void {
  const stmt = db.prepareQuery(
    `INSERT OR IGNORE INTO input_snapshots (hash, session_id, content, length, timestamp, exam_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
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
 * Retrieve an input snapshot by hash and session.
 */
export function getInputSnapshot(
  db: DB,
  hash: string,
  sessionId: string,
): { hash: string; content: string; length: number; sessionId: string; timestamp: number; examId: string } | null {
  const stmt = db.prepareQuery(
    "SELECT hash, content, length, session_id, timestamp, exam_id FROM input_snapshots WHERE hash = ? AND session_id = ?",
  );
  try {
    const rows = [...stmt.all([hash, sessionId])];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      hash: row[0] as string,
      content: row[1] as string,
      length: row[2] as number,
      sessionId: row[3] as string,
      timestamp: row[4] as number,
      examId: row[5] as string,
    };
  } finally {
    stmt.finalize();
  }
}

/**
 * Get all input snapshots for a session, ordered by timestamp.
 */
export function getInputSnapshotsBySession(
  db: DB,
  sessionId: string,
): { hash: string; content: string; length: number; timestamp: number }[] {
  const stmt = db.prepareQuery(
    "SELECT hash, content, length, timestamp FROM input_snapshots WHERE session_id = ? ORDER BY timestamp",
  );
  try {
    const rows = [...stmt.all([sessionId])];
    return rows.map((row) => ({
      hash: row[0] as string,
      content: row[1] as string,
      length: row[2] as number,
      timestamp: row[3] as number,
    }));
  } finally {
    stmt.finalize();
  }
}

/**
 * Get all input snapshots for an exam, grouped by session.
 */
export function getInputSnapshotsByExam(
  db: DB,
  examId: string,
): { hash: string; sessionId: string; content: string; length: number; timestamp: number }[] {
  const stmt = db.prepareQuery(
    "SELECT hash, session_id, content, length, timestamp FROM input_snapshots WHERE exam_id = ? ORDER BY timestamp",
  );
  try {
    const rows = [...stmt.all([examId])];
    return rows.map((row) => ({
      hash: row[0] as string,
      sessionId: row[1] as string,
      content: row[2] as string,
      length: row[3] as number,
      timestamp: row[4] as number,
    }));
  } finally {
    stmt.finalize();
  }
}
