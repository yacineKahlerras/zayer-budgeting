/**
 * Drizzle schema for the budgeting app (expo-sqlite).
 *
 * Design notes:
 * - Money is stored as INTEGER minor units (cents). $12.34 -> 1234. This avoids
 *   floating-point rounding bugs. Format to decimals in the UI layer.
 * - A wallet's balance is DERIVED (initialBalance + income - expense), never
 *   stored, so it can't drift out of sync.
 * - Categories are two fixed levels: `categories` (Food) -> `subcategories`
 *   (Groceries, Restaurant). A transaction tags a subcategory; its parent
 *   category is one join away.
 * - Deleting a subcategory keeps the transactions and sets them to
 *   uncategorized (onDelete: "set null").
 * - Each wallet has its own currency; there is no FX conversion. Budgets are
 *   therefore per-currency too.
 */

import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/* ----------------------------- Wallets ----------------------------- */

export const wallets = sqliteTable("wallets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** ISO 4217 code, e.g. "USD", "EUR". */
  currency: text("currency").notNull(),
  /** Starting balance in minor units, so a wallet can begin non-zero. */
  initialBalance: integer("initial_balance").notNull().default(0),
  icon: text("icon"),
  color: text("color"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* --------------------------- Categories ---------------------------- */
/* Level 1: "Food", "Housing", "Transport", "Income", ... */

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  /** Spending vs earning category. */
  kind: text("kind", { enum: ["expense", "income"] })
    .notNull()
    .default("expense"),
  /** True for the built-in defaults; false for user-created ones. */
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* -------------------------- Subcategories -------------------------- */
/* Level 2: under "Food" -> "Groceries", "Restaurant", "Fast Food", ... */

export const subcategories = sqliteTable("subcategories", {
  id: text("id").primaryKey(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  icon: text("icon"),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* -------------------------- Transactions --------------------------- */

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  walletId: text("wallet_id")
    .notNull()
    .references(() => wallets.id, { onDelete: "cascade" }),
  /** Nullable so a transaction can be left uncategorized (incl. after the
   *  subcategory it used is deleted). */
  subcategoryId: text("subcategory_id").references(() => subcategories.id, {
    onDelete: "set null",
  }),
  /** Positive magnitude in minor units; `direction` carries the sign. */
  amount: integer("amount").notNull(),
  direction: text("direction", { enum: ["expense", "income"] }).notNull(),
  /** Display title. Null means "fall back to the subcategory's name"; set it to
   *  override (e.g. "Weekly shop" instead of "Groceries"). */
  title: text("title"),
  /** Optional free-text memo for extra detail. */
  note: text("note"),
  /** When the transaction happened (ms epoch) — fast range/sort queries. */
  date: integer("date", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* ----------------------------- Budgets ----------------------------- */
/*
 * One flexible table covers all four scopes:
 *   - categoryId set, walletId null  -> per-category budget
 *   - walletId set, categoryId null  -> per-wallet budget
 *   - both null                      -> overall spending cap
 * `period` covers monthly (default), weekly, yearly, or a custom date range.
 */

export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(),
  name: text("name"),
  /** Limit in minor units. */
  amount: integer("amount").notNull(),
  categoryId: text("category_id").references(() => categories.id, {
    onDelete: "cascade",
  }),
  walletId: text("wallet_id").references(() => wallets.id, {
    onDelete: "cascade",
  }),
  period: text("period", { enum: ["week", "month", "year", "custom"] })
    .notNull()
    .default("month"),
  /** Only used when period = "custom". */
  startDate: integer("start_date", { mode: "timestamp_ms" }),
  endDate: integer("end_date", { mode: "timestamp_ms" }),
  /** Budgets are per-currency since wallets don't convert. */
  currency: text("currency").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/* ------------------------- Inferred types -------------------------- */

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Subcategory = typeof subcategories.$inferSelect;
export type NewSubcategory = typeof subcategories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
