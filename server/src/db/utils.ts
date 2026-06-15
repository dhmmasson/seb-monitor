/**
 * Shared database query utilities.
 */
import type { DB } from "sqlite";

/** Execute a parameterized query and return all rows. */
export function queryAll(db: DB, sql: string, args: unknown[] = []): unknown[][] {
  const stmt = db.prepareQuery(sql);
  try {
    return [...stmt.all(args)];
  } finally {
    stmt.finalize();
  }
}
