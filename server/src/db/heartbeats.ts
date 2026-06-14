/**
 * Heartbeat storage — insert heartbeat payloads into the database.
 */
import type { DB } from "sqlite";
import type { HeartbeatPayload } from "../../../shared/types.ts";

/**
 * Insert a heartbeat row for the given session.
 */
export function insertHeartbeat(
  db: DB,
  sessionId: string,
  payload: HeartbeatPayload,
): void {
  const stmt = db.prepareQuery(
    `INSERT INTO heartbeats (
      session_id, timestamp,
      focused_time_ms, unfocused_time_ms, blur_count,
      typed_chars, pasted_chars, deleted_chars, current_length,
      copy_count, paste_count,
      key_down_count, ctrl_count, alt_count, shift_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  try {
    stmt.execute([
      sessionId,
      payload.timestamp,
      payload.focus.focusedTimeMs,
      payload.focus.unfocusedTimeMs,
      payload.focus.blurCount,
      payload.input.typedChars,
      payload.input.pastedChars,
      payload.input.deletedChars,
      payload.input.currentLength,
      payload.copyCount,
      payload.pasteCount,
      payload.keys.keyDownCount,
      payload.keys.ctrlCount,
      payload.keys.altCount,
      payload.keys.shiftCount,
    ]);
  } finally {
    stmt.finalize();
  }
}

/**
 * Get all heartbeats for a session.
 */
export function getHeartbeatsBySession(
  db: DB,
  sessionId: string,
): unknown[][] {
  const stmt = db.prepareQuery(
    "SELECT * FROM heartbeats WHERE session_id = ? ORDER BY timestamp"
  );
  try {
    return [...stmt.all([sessionId])];
  } finally {
    stmt.finalize();
  }
}
