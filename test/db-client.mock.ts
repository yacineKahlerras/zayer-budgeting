/**
 * Jest replacement for `@/db/client` (wired via moduleNameMapper).
 *
 * The app's queries import a singleton `db`; tests need a FRESH in-memory
 * database per test for isolation. This module exports a forwarding proxy as
 * `db` and a `resetTestDb()` that swaps the underlying instance — called from
 * the global setup's `beforeEach`, so every test starts on clean, migrated
 * tables without production code changes (R1).
 */

import { createTestDb, type TestDb } from "./create-db";

let current: { db: TestDb; sqlite: import("better-sqlite3").Database } =
  createTestDb();

export function resetTestDb(): void {
  current.sqlite.close();
  current = createTestDb();
}

/** The live drizzle instance, for tests that want direct access. */
export function testDb(): TestDb {
  return current.db;
}

export const db = new Proxy({} as TestDb, {
  get(_target, prop) {
    const value = (current.db as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(current.db)
      : value;
  },
}) as TestDb;

// The app never uses `sqliteDb` outside client.ts, but export a stub so any
// accidental import fails loudly instead of silently.
export const sqliteDb = new Proxy(
  {},
  {
    get() {
      throw new Error("sqliteDb is not available in tests — use `db`.");
    },
  }
);
