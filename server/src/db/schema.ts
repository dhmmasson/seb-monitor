/**
 * Database schema — SQL migrations for SQLite.
 * Creates all tables on first boot. Idempotent (uses IF NOT EXISTS).
 * Source of truth: plan.md Section 3
 */
import type { DB } from "sqlite";

const MIGRATIONS = [
  // Enable WAL mode
  `PRAGMA journal_mode = WAL;`,

  // Sessions table — one row per (student, exam, day)
  `CREATE TABLE IF NOT EXISTS sessions (
    session_id    TEXT PRIMARY KEY,
    student_id    TEXT NOT NULL,
    exam_id       TEXT NOT NULL,
    start_time    INTEGER NOT NULL,
    created_at    TEXT DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_sessions_exam ON sessions(exam_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);`,

  // Heartbeats table — one row per heartbeat received
  `CREATE TABLE IF NOT EXISTS heartbeats (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    timestamp       INTEGER NOT NULL,
    focused_time_ms   INTEGER NOT NULL DEFAULT 0,
    unfocused_time_ms INTEGER NOT NULL DEFAULT 0,
    blur_count        INTEGER NOT NULL DEFAULT 0,
    typed_chars     INTEGER NOT NULL DEFAULT 0,
    pasted_chars    INTEGER NOT NULL DEFAULT 0,
    deleted_chars   INTEGER NOT NULL DEFAULT 0,
    current_length  INTEGER NOT NULL DEFAULT 0,
    copy_count      INTEGER NOT NULL DEFAULT 0,
    paste_count     INTEGER NOT NULL DEFAULT 0,
    key_down_count  INTEGER NOT NULL DEFAULT 0,
    ctrl_count      INTEGER NOT NULL DEFAULT 0,
    alt_count       INTEGER NOT NULL DEFAULT 0,
    shift_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_heartbeats_session ON heartbeats(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_heartbeats_timestamp ON heartbeats(timestamp);`,

  // Events table — one row per discrete event
  `CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    timestamp       INTEGER NOT NULL,
    type            TEXT NOT NULL,
    hash            TEXT,
    length          INTEGER,
    matched_copy_hash TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);`,

  // Paste content store — isolated for access control + retention
  `CREATE TABLE IF NOT EXISTS paste_contents (
    hash            TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(session_id),
    content         TEXT NOT NULL,
    length          INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    exam_id         TEXT NOT NULL,
    created_at      TEXT DEFAULT (datetime('now'))
  );`,

  `CREATE INDEX IF NOT EXISTS idx_paste_contents_session ON paste_contents(session_id);`,
  `CREATE INDEX IF NOT EXISTS idx_paste_contents_exam ON paste_contents(exam_id);`,
];

/**
 * Run all migrations against the given database.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export function runMigrations(db: DB): void {
  for (const sql of MIGRATIONS) {
    db.execute(sql);
  }
}
