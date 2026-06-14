/**
 * Database connection singleton — creates and manages the SQLite connection.
 * Uses WAL mode for concurrent read/write access.
 */
import { DB } from "sqlite";
import { runMigrations } from "./schema.ts";

let _db: DB | null = null;

/**
 * Get or create the database connection.
 * Runs migrations on first call.
 */
export function getDb(path?: string): DB {
  if (!_db) {
    const dbPath = path ?? Deno.env.get("DB_PATH") ?? ":memory:";
    _db = new DB(dbPath);
    _db.execute("PRAGMA journal_mode = WAL");
    _db.execute("PRAGMA foreign_keys = ON");
    runMigrations(_db);
  }
  return _db;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
