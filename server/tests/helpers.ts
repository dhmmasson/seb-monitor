/**
 * Test helpers — shared utilities for server tests.
 */
import { Database } from "deno:sqlite";
import { runMigrations } from "../src/db/schema.ts";

/**
 * Create an in-memory SQLite database with schema applied.
 * Each test gets a fresh, isolated database.
 */
export function createTestDb(): Database {
  const db = new Database(":memory:");
  runMigrations(db);
  return db;
}

/**
 * Close a test database.
 */
export function closeTestDb(db: Database): void {
  db.close();
}
