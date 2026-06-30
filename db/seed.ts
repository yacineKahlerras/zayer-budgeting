/**
 * Seed data + an idempotent seeding function.
 *
 * `seedIfEmpty(db)` only fills the database when it's empty, so it's safe to
 * call on every app launch. `resetAndReseed(db)` wipes everything and refills —
 * useful during development.
 *
 * All amounts are in MINOR UNITS (cents). $12.34 -> 1234. See
 * docs/database-explained.md for why.
 */

import { count } from "drizzle-orm";

import type { db as Database } from "./client";
import {
  budgets,
  categories,
  subcategories,
  transactions,
  wallets,
} from "./schema";

type DB = typeof Database;

/* ----------------------------- Wallets ----------------------------- */

const SEED_WALLETS = [
  { id: "w_cash", name: "Cash", currency: "USD", initialBalance: 40000, icon: "💵", color: "#34D399", sortOrder: 0 },
  { id: "w_bank", name: "Bank Card", currency: "USD", initialBalance: 250000, icon: "🏦", color: "#3B82F6", sortOrder: 1 },
  { id: "w_travel", name: "Travel (EUR)", currency: "EUR", initialBalance: 60000, icon: "✈️", color: "#F59E0B", sortOrder: 2 },
];

/* --------------------- Categories + subcategories ------------------ */
/* The default tree. Each category lists its level-2 subcategories. */

const SEED_TREE: {
  id: string;
  name: string;
  kind: "expense" | "income";
  icon: string;
  subs: { id: string; name: string; icon?: string }[];
}[] = [
  {
    id: "c_food", name: "Food", kind: "expense", icon: "🍽️",
    subs: [
      { id: "s_groceries", name: "Groceries", icon: "🛒" },
      { id: "s_restaurant", name: "Restaurant", icon: "🍽️" },
      { id: "s_fastfood", name: "Fast Food", icon: "🍔" },
      { id: "s_drinks", name: "Drinks", icon: "🥤" },
    ],
  },
  {
    id: "c_housing", name: "Housing", kind: "expense", icon: "🏠",
    subs: [
      { id: "s_rent", name: "Rent", icon: "🏠" },
      { id: "s_utilities", name: "Utilities", icon: "💡" },
      { id: "s_internet", name: "Internet", icon: "🌐" },
    ],
  },
  {
    id: "c_transport", name: "Transport", kind: "expense", icon: "🚗",
    subs: [
      { id: "s_gas", name: "Gas", icon: "⛽" },
      { id: "s_transit", name: "Public Transit", icon: "🚌" },
      { id: "s_rideshare", name: "Rideshare", icon: "🚕" },
    ],
  },
  {
    id: "c_shopping", name: "Shopping", kind: "expense", icon: "🛍️",
    subs: [
      { id: "s_clothing", name: "Clothing", icon: "👕" },
      { id: "s_electronics", name: "Electronics", icon: "💻" },
    ],
  },
  {
    id: "c_subscriptions", name: "Subscriptions", kind: "expense", icon: "🔁",
    subs: [
      { id: "s_streaming", name: "Streaming", icon: "📺" },
      { id: "s_software", name: "Software", icon: "🧩" },
    ],
  },
  {
    id: "c_health", name: "Health", kind: "expense", icon: "💊",
    subs: [
      { id: "s_pharmacy", name: "Pharmacy", icon: "💊" },
      { id: "s_fitness", name: "Fitness", icon: "🏋️" },
    ],
  },
  {
    id: "c_income", name: "Income", kind: "income", icon: "💰",
    subs: [
      { id: "s_salary", name: "Salary", icon: "💼" },
      { id: "s_freelance", name: "Freelance", icon: "🧾" },
      { id: "s_refund", name: "Refund", icon: "↩️" },
    ],
  },
];

/* --------------------------- Transactions -------------------------- */
/*
 * A fixed anchor so the seed is deterministic (no `new Date()` — banned in this
 * environment and non-deterministic anyway). `daysAgo` is subtracted from it.
 */
const ANCHOR = new Date(2026, 5, 30); // Jun 30, 2026

function dateMs(daysAgo: number): number {
  const d = new Date(ANCHOR);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

type SeedTx = {
  walletId: string;
  subcategoryId: string;
  amount: number; // cents
  direction: "expense" | "income";
  daysAgo: number;
  title?: string; // optional override; otherwise UI falls back to subcategory name
  note?: string;
};

const SEED_TX: SeedTx[] = [
  { walletId: "w_bank", subcategoryId: "s_salary", amount: 320000, direction: "income", daysAgo: 0, note: "June paycheck" },
  { walletId: "w_bank", subcategoryId: "s_rent", amount: 124300, direction: "expense", daysAgo: 0 },
  { walletId: "w_cash", subcategoryId: "s_groceries", amount: 8432, direction: "expense", daysAgo: 1, title: "Weekly shop" },
  { walletId: "w_cash", subcategoryId: "s_fastfood", amount: 1290, direction: "expense", daysAgo: 1 },
  { walletId: "w_bank", subcategoryId: "s_streaming", amount: 1599, direction: "expense", daysAgo: 2, note: "Netflix" },
  { walletId: "w_bank", subcategoryId: "s_gas", amount: 4400, direction: "expense", daysAgo: 2 },
  { walletId: "w_travel", subcategoryId: "s_restaurant", amount: 3120, direction: "expense", daysAgo: 3, note: "Dinner in Lisbon" },
  { walletId: "w_travel", subcategoryId: "s_transit", amount: 540, direction: "expense", daysAgo: 3 },
  { walletId: "w_bank", subcategoryId: "s_electronics", amount: 12999, direction: "expense", daysAgo: 4, title: "Headphones" },
  { walletId: "w_cash", subcategoryId: "s_drinks", amount: 650, direction: "expense", daysAgo: 4 },
  { walletId: "w_bank", subcategoryId: "s_freelance", amount: 75000, direction: "income", daysAgo: 5, note: "Logo project" },
  { walletId: "w_bank", subcategoryId: "s_utilities", amount: 6800, direction: "expense", daysAgo: 5 },
  { walletId: "w_cash", subcategoryId: "s_groceries", amount: 5210, direction: "expense", daysAgo: 6 },
  { walletId: "w_bank", subcategoryId: "s_pharmacy", amount: 2340, direction: "expense", daysAgo: 7 },
  { walletId: "w_bank", subcategoryId: "s_software", amount: 999, direction: "expense", daysAgo: 8, note: "iCloud" },
  { walletId: "w_cash", subcategoryId: "s_rideshare", amount: 1840, direction: "expense", daysAgo: 9 },
  { walletId: "w_travel", subcategoryId: "s_clothing", amount: 4500, direction: "expense", daysAgo: 10 },
  { walletId: "w_bank", subcategoryId: "s_fitness", amount: 3500, direction: "expense", daysAgo: 12, note: "Gym membership" },
  { walletId: "w_bank", subcategoryId: "s_refund", amount: 2000, direction: "income", daysAgo: 14, note: "Returned shoes" },
  { walletId: "w_cash", subcategoryId: "s_restaurant", amount: 6730, direction: "expense", daysAgo: 16 },
];

/* ----------------------------- Budgets ----------------------------- */

const SEED_BUDGETS = [
  { id: "b_food", name: "Food budget", amount: 60000, categoryId: "c_food", walletId: null, period: "month" as const, currency: "USD" },
  { id: "b_transport", name: "Transport", amount: 20000, categoryId: "c_transport", walletId: null, period: "month" as const, currency: "USD" },
  { id: "b_cash_wallet", name: "Cash spending", amount: 30000, categoryId: null, walletId: "w_cash", period: "month" as const, currency: "USD" },
  { id: "b_overall", name: "Overall cap", amount: 250000, categoryId: null, walletId: null, period: "month" as const, currency: "USD" },
];

/* --------------------------- Seed runner --------------------------- */

let txCounter = 0;
function txId() {
  txCounter += 1;
  return `tx_seed_${txCounter}`;
}

/** Insert all seed rows. Assumes the tables are empty. */
async function insertSeed(db: DB) {
  await db.insert(wallets).values(SEED_WALLETS);

  for (const cat of SEED_TREE) {
    await db.insert(categories).values({
      id: cat.id,
      name: cat.name,
      kind: cat.kind,
      icon: cat.icon,
      isDefault: true,
    });
    await db.insert(subcategories).values(
      cat.subs.map((s, i) => ({
        id: s.id,
        categoryId: cat.id,
        name: s.name,
        icon: s.icon,
        isDefault: true,
        sortOrder: i,
      }))
    );
  }

  await db.insert(transactions).values(
    SEED_TX.map((t) => ({
      id: txId(),
      walletId: t.walletId,
      subcategoryId: t.subcategoryId,
      amount: t.amount,
      direction: t.direction,
      title: t.title ?? null,
      note: t.note ?? null,
      date: new Date(dateMs(t.daysAgo)),
    }))
  );

  await db.insert(budgets).values(SEED_BUDGETS);
}

/**
 * Seed only if the database has no wallets yet. Safe to call on every launch.
 * Returns true if it actually seeded.
 */
export async function seedIfEmpty(db: DB): Promise<boolean> {
  const [{ value }] = await db.select({ value: count() }).from(wallets);
  if (value > 0) return false;
  await insertSeed(db);
  return true;
}

/** Wipe every table and reseed. For development use. */
export async function resetAndReseed(db: DB): Promise<void> {
  // Delete children before parents to respect foreign keys.
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(subcategories);
  await db.delete(categories);
  await db.delete(wallets);
  txCounter = 0;
  await insertSeed(db);
}
