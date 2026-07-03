/**
 * First-run defaults. Unlike the old dev seed, this inserts only the minimum a
 * new user needs to start: one wallet and the default category tree. It runs
 * once (when the DB has no categories) so the pickers are never empty.
 *
 * All amounts are in MINOR UNITS (cents).
 */

import { count } from "drizzle-orm";

import type { db as Database } from "./client";
import { categories, subcategories, wallets } from "./schema";

type DB = typeof Database;

const DEFAULT_WALLET = {
  id: "w_default",
  name: "Cash",
  currency: "USD",
  initialBalance: 0,
  sortOrder: 0,
};

/** Level-1 category + its level-2 subcategories. `icon` is a lucide name. */
const DEFAULT_TREE: {
  id: string;
  name: string;
  kind: "expense" | "income";
  icon: string;
  subs: { id: string; name: string }[];
}[] = [
  {
    id: "c_food", name: "Food", kind: "expense", icon: "ShoppingCart",
    subs: [
      { id: "s_groceries", name: "Groceries" },
      { id: "s_restaurant", name: "Restaurant" },
      { id: "s_fastfood", name: "Fast Food" },
      { id: "s_drinks", name: "Drinks" },
    ],
  },
  {
    id: "c_housing", name: "Housing", kind: "expense", icon: "House",
    subs: [
      { id: "s_rent", name: "Rent" },
      { id: "s_utilities", name: "Utilities" },
      { id: "s_internet", name: "Internet" },
    ],
  },
  {
    id: "c_transport", name: "Transport", kind: "expense", icon: "Car",
    subs: [
      { id: "s_gas", name: "Gas" },
      { id: "s_transit", name: "Public Transit" },
      { id: "s_rideshare", name: "Rideshare" },
    ],
  },
  {
    id: "c_shopping", name: "Shopping", kind: "expense", icon: "ShoppingBag",
    subs: [
      { id: "s_clothing", name: "Clothing" },
      { id: "s_electronics", name: "Electronics" },
    ],
  },
  {
    id: "c_bills", name: "Bills", kind: "expense", icon: "Receipt",
    subs: [
      { id: "s_subscriptions", name: "Subscriptions" },
      { id: "s_phone", name: "Phone" },
    ],
  },
  {
    id: "c_health", name: "Health", kind: "expense", icon: "HeartPulse",
    subs: [
      { id: "s_pharmacy", name: "Pharmacy" },
      { id: "s_fitness", name: "Fitness" },
    ],
  },
  {
    id: "c_income", name: "Income", kind: "income", icon: "Wallet",
    subs: [
      { id: "s_salary", name: "Salary" },
      { id: "s_freelance", name: "Freelance" },
      { id: "s_refund", name: "Refund" },
    ],
  },
];

/** Insert defaults only if the DB has no categories yet. Safe every launch. */
export async function ensureDefaults(db: DB): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(categories);
  if (value > 0) return;

  await db.insert(wallets).values(DEFAULT_WALLET);

  for (const [ci, cat] of DEFAULT_TREE.entries()) {
    await db.insert(categories).values({
      id: cat.id,
      name: cat.name,
      kind: cat.kind,
      icon: cat.icon,
      isDefault: true,
      sortOrder: ci,
    });
    await db.insert(subcategories).values(
      cat.subs.map((s, i) => ({
        id: s.id,
        categoryId: cat.id,
        name: s.name,
        isDefault: true,
        sortOrder: i,
      }))
    );
  }
}
