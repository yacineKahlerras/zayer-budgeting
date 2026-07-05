/**
 * Builds a real in-memory SQLite database for tests by executing the SAME
 * migration files the app ships (drizzle/*.sql, in journal order). If the
 * schema drifts from the migrations, the tests break — by design (R2).
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";

import * as schema from "@/db/schema";

export type TestDb = BetterSQLite3Database<typeof schema>;

const DRIZZLE_DIR = path.join(__dirname, "..", "drizzle");

/** Migration SQL, loaded once, in journal order. */
const MIGRATIONS: string[][] = (() => {
  const journal = JSON.parse(
    fs.readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8")
  ) as { entries: { tag: string }[] };
  return journal.entries.map((e) =>
    fs
      .readFileSync(path.join(DRIZZLE_DIR, `${e.tag}.sql`), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
  );
})();

export function createTestDb(): { db: TestDb; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  // Match the app's connection config (db/client.ts) — FK enforcement ON so
  // ON DELETE CASCADE / SET NULL behave like production.
  sqlite.pragma("foreign_keys = ON");
  for (const statements of MIGRATIONS) {
    for (const stmt of statements) sqlite.exec(stmt);
  }
  return { db: drizzle(sqlite, { schema }), sqlite };
}
