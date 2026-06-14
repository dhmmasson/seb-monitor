/**
 * Session CRUD — find or create sessions for (studentId, examId) pairs.
 * A session is unique per (student, exam, day).
 */
import type { DB } from "sqlite";
import type { Session } from "../../../shared/types.ts";

/**
 * Find an existing session or create a new one.
 * Session key: (studentId, examId, startOfDay).
 */
export function findOrCreate(
  db: DB,
  studentId: string,
  examId: string,
): Session {
  // Look for existing session created today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.getTime();

  const stmt = db.prepareQuery(
    "SELECT session_id, student_id, exam_id, start_time FROM sessions WHERE student_id = ? AND exam_id = ? AND start_time >= ? LIMIT 1"
  );
  try {
    const existing = [...stmt.all([studentId, examId, startOfDay])];
    
    if (existing.length > 0) {
      const row = existing[0];
      return {
        sessionId: row[0] as string,
        studentId: row[1] as string,
        examId: row[2] as string,
        startTime: row[3] as number,
      };
    }
  } finally {
    stmt.finalize();
  }

  // Create new session
  const sessionId = crypto.randomUUID();
  const startTime = Date.now();

  const insertStmt = db.prepareQuery(
    "INSERT INTO sessions (session_id, student_id, exam_id, start_time) VALUES (?, ?, ?, ?)"
  );
  try {
    insertStmt.execute([sessionId, studentId, examId, startTime]);
  } finally {
    insertStmt.finalize();
  }

  return { sessionId, studentId, examId, startTime };
}

/**
 * Find a session by its ID.
 */
export function findById(db: DB, sessionId: string): Session | null {
  const stmt = db.prepareQuery(
    "SELECT session_id, student_id, exam_id, start_time FROM sessions WHERE session_id = ?"
  );
  try {
    const rows = [...stmt.all([sessionId])];
    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      sessionId: row[0] as string,
      studentId: row[1] as string,
      examId: row[2] as string,
      startTime: row[3] as number,
    };
  } finally {
    stmt.finalize();
  }
}
