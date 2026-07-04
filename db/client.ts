/**
 * Database client: opens the SQLite file and wires up Drizzle.
 *
 * This is the single place the rest of the app imports `db` from. Everything
 * else (queries, seed) talks to this `db` object, never to expo-sqlite directly.
 */

import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

/**
 * Open (or create) the physical database file on the device.
 * `enableChangeListener: true` lets Drizzle's `useLiveQuery` hook auto-refresh
 * the UI when data changes — handy once we wire screens to live data.
 */
export const sqliteDb = openDatabaseSync("budget.db", {
  enableChangeListener: true,
});

// SQLite defaults foreign-key enforcement OFF per connection. Turn it on so the
// schema's ON DELETE CASCADE / SET NULL actually fire (e.g. deleting a wallet
// deletes its transactions; deleting a subcategory nulls the reference).
sqliteDb.execSync("PRAGMA foreign_keys = ON;");

/**
 * The Drizzle instance. Passing `{ schema }` gives us the typed query API and
 * relational helpers. Import THIS in queries/seed, e.g.:
 *   import { db } from "@/db/client";
 */
export const db = drizzle(sqliteDb, { schema });
