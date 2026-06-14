/**
 * Test helpers — shared utilities for server tests.
 */
import { DB } from "sqlite";
import { runMigrations } from "../src/db/schema.ts";

/**
 * Create an in-memory SQLite database with schema applied.
 * Each test gets a fresh, isolated database.
 */
export function createTestDb(): DB {
  const db = new DB(":memory:");
  runMigrations(db);
  return db;
}

/**
 * Close a test database.
 */
export function closeTestDb(db: DB): void {
  db.close();
}
