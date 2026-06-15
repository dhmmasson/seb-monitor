/**
 * Derived metrics computation — focus ratio, paste ratio, unmatched pastes, etc.
 * Reads from the database and computes aggregated metrics per session and per exam.
 */
import type { DB } from "sqlite";

// ===== Types =====

export interface SessionMetrics {
  focusRatio: number;
  pasteRatio: number;
  totalCopyCount: number;
  totalPasteCount: number;
  unmatchedPasteCount: number;
  largestPasteLength: number;
  largestPasteHash: string;
}

export interface ExamSummaryEntry {
  sessionId: string;
  studentId: string;
  focusRatio: number;
  pasteRatio: number;
  totalCopyCount: number;
  totalPasteCount: number;
  unmatchedPasteCount: number;
  largestPasteLength: number;
  largestPasteHash: string;
}

// ===== Query helpers =====

function queryAll(db: DB, sql: string, args: unknown[] = []): unknown[][] {
  const stmt = db.prepareQuery(sql);
  try {
    return [...stmt.all(args)];
  } finally {
    stmt.finalize();
  }
}

// ===== Session Metrics =====

/**
 * Compute derived metrics for a single session from its heartbeats, events, and paste contents.
 */
export function computeSessionMetrics(db: DB, sessionId: string): SessionMetrics {
  // Aggregate heartbeats
  const hbRows = queryAll(db,
    `SELECT
       COALESCE(SUM(focused_time_ms), 0) AS focused,
       COALESCE(SUM(unfocused_time_ms), 0) AS unfocused,
       COALESCE(SUM(copy_count), 0) AS copies,
       COALESCE(SUM(paste_count), 0) AS pastes,
       COALESCE(SUM(typed_chars), 0) AS typed,
       COALESCE(SUM(pasted_chars), 0) AS pasted_chars,
       COALESCE(SUM(deleted_chars), 0) AS deleted
     FROM heartbeats WHERE session_id = ?`,
    [sessionId],
  );

  const focused = Number(hbRows[0]?.[0] ?? 0);
  const unfocused = Number(hbRows[0]?.[1] ?? 0);
  const totalCopyCount = Number(hbRows[0]?.[2] ?? 0);
  const totalPasteCount = Number(hbRows[0]?.[3] ?? 0);
  const typed = Number(hbRows[0]?.[4] ?? 0);
  const pastedChars = Number(hbRows[0]?.[5] ?? 0);
  const deleted = Number(hbRows[0]?.[6] ?? 0);

  const totalFocusTime = focused + unfocused;
  const focusRatio = totalFocusTime > 0 ? focused / totalFocusTime : 0;

  const totalInput = typed + pastedChars + deleted;
  const pasteRatio = totalInput > 0 ? pastedChars / totalInput : 0;

  // Count unmatched pastes from events
  const unmatchedRows = queryAll(db,
    `SELECT COUNT(*) FROM events
     WHERE session_id = ? AND type = 'paste' AND matched_copy_hash IS NULL`,
    [sessionId],
  );
  const unmatchedPasteCount = Number(unmatchedRows[0]?.[0] ?? 0);

  // Largest paste from stored content
  const largestRows = queryAll(db,
    `SELECT hash, length FROM paste_contents
     WHERE session_id = ? ORDER BY length DESC LIMIT 1`,
    [sessionId],
  );
  const largestPasteHash = (largestRows[0]?.[0] as string) ?? "";
  const largestPasteLength = Number(largestRows[0]?.[1] ?? 0);

  return {
    focusRatio,
    pasteRatio,
    totalCopyCount,
    totalPasteCount,
    unmatchedPasteCount,
    largestPasteLength,
    largestPasteHash,
  };
}

// ===== Exam Summary =====

/**
 * Compute per-student metrics for all sessions in an exam.
 */
export function computeExamSummary(db: DB, examId: string): ExamSummaryEntry[] {
  const sessionRows = queryAll(db,
    "SELECT session_id, student_id FROM sessions WHERE exam_id = ?",
    [examId],
  );

  return sessionRows.map((row) => {
    const sessionId = row[0] as string;
    const studentId = row[1] as string;
    const metrics = computeSessionMetrics(db, sessionId);
    return { sessionId, studentId, ...metrics };
  });
}
