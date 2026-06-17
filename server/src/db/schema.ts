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
    question_id     TEXT NOT NULL DEFAULT 'default',
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

  // Paste content store — unified clipboard content for copy and paste events.
  // No foreign key on session_id: content arrives via dedicated endpoint,
  // may arrive before the first heartbeat creates the session.
  // PRIMARY KEY is (hash, session_id, event_type) to allow:
  // - Same hash for different sessions (cross-student)
  // - Same hash for copy and paste in the same session
  `CREATE TABLE IF NOT EXISTS paste_contents (
    hash            TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    content         TEXT NOT NULL,
    length          INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    exam_id         TEXT NOT NULL,
    event_type      TEXT NOT NULL DEFAULT 'paste',
    created_at      TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (hash, session_id, event_type)
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
  // Apply incremental column additions for databases created before
  // these columns were introduced (ALTER TABLE IF NOT EXISTS is not
  // supported in SQLite, so we check PRAGMA table_info manually).
  addColumnIfMissing(
    db,
    "paste_contents",
    "event_type",
    "TEXT NOT NULL DEFAULT 'paste'",
  );
  // Ensure the index exists (idempotent)
  db.execute(
    `CREATE INDEX IF NOT EXISTS idx_paste_contents_type ON paste_contents(event_type);`,
  );
}

/**
 * Add a column to a table only if it does not already exist.
 * SQLite does not support ALTER TABLE ... ADD COLUMN IF NOT EXISTS,
 * so we query PRAGMA table_info to check first.
 */
function addColumnIfMissing(
  db: DB,
  table: string,
  column: string,
  definition: string,
): void {
  const cols = db.query(`PRAGMA table_info(${table})`);
  // PRAGMA table_info returns rows: (cid, name, type, notnull, dflt_value, pk)
  const exists = cols.some((row) => row[1] === column);
  if (!exists) {
    db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
