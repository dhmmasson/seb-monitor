/**
 * Event storage — insert discrete events (copy, paste, focus, blur).
 */
import type { DB } from "sqlite";
import type { ExamEvent } from "../../../shared/types.ts";

/**
 * Insert a batch of events for the given session.
 */
export function insertEvents(
  db: DB,
  sessionId: string,
  events: ExamEvent[],
): void {
  const stmt = db.prepareQuery(
    `INSERT INTO events (session_id, timestamp, type, hash, length, matched_copy_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  try {
    for (const event of events) {
      const hash = "hash" in event ? event.hash : null;
      const length = "length" in event ? event.length : null;
      const matchedCopyHash = "matchedCopyHash" in event ? event.matchedCopyHash : null;

      stmt.execute([sessionId, event.timestamp, event.type, hash, length, matchedCopyHash]);
    }
  } finally {
    stmt.finalize();
  }
}

/**
 * Get all events for a session.
 */
export function getEventsBySession(
  db: DB,
  sessionId: string,
): unknown[][] {
  const stmt = db.prepareQuery(
    "SELECT * FROM events WHERE session_id = ? ORDER BY timestamp"
  );
  try {
    return [...stmt.all([sessionId])];
  } finally {
    stmt.finalize();
  }
}
