/**
 * Typed data-access functions. Screens/hooks call these; nobody outside db/
 * writes SQL. All money is in MINOR UNITS (cents).
 */

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "./client";
import {
  categories,
  subcategories,
  transactions,
  wallets,
} from "./schema";

/* ------------------------------- Wallets --------------------------------- */

export async function listWallets() {
  return db
    .select()
    .from(wallets)
    .where(eq(wallets.archived, false))
    .orderBy(wallets.sortOrder);
}

/**
 * Derived balance: initialBalance + income - expense (all in cents).
 * Computed in SQL so it's always correct and never stored.
 */
export async function getWalletBalance(walletId: string): Promise<number> {
  const [row] = await db
    .select({
      initial: wallets.initialBalance,
      income: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(wallets)
    .leftJoin(transactions, eq(transactions.walletId, wallets.id))
    .where(eq(wallets.id, walletId))
    .groupBy(wallets.id);

  if (!row) return 0;
  return row.initial + row.income - row.expense;
}

/** Total balance across all wallets (naive: ignores differing currencies). */
export async function getTotalBalance(): Promise<number> {
  const all = await listWallets();
  const balances = await Promise.all(all.map((w) => getWalletBalance(w.id)));
  return balances.reduce((sum, b) => sum + b, 0);
}

/* ------------------------------ Categories ------------------------------- */

export type CategoryWithSubs = {
  id: string;
  name: string;
  kind: "expense" | "income";
  icon: string | null;
  subs: { id: string; name: string; icon: string | null }[];
};

/** All categories (optionally filtered by kind) with their subcategories. */
export async function listCategoryTree(
  kind?: "expense" | "income"
): Promise<CategoryWithSubs[]> {
  const cats = await db
    .select()
    .from(categories)
    .where(kind ? eq(categories.kind, kind) : undefined)
    .orderBy(categories.sortOrder);

  const subs = await db
    .select()
    .from(subcategories)
    .orderBy(subcategories.sortOrder);

  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    icon: c.icon,
    subs: subs
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({ id: s.id, name: s.name, icon: s.icon })),
  }));
}

/* ----------------------------- Transactions ------------------------------ */

export type NewTransactionInput = {
  walletId: string;
  subcategoryId: string | null;
  amount: number; // cents, positive
  direction: "expense" | "income";
  title: string | null;
  note: string | null;
  date: Date;
};

export async function addTransaction(input: NewTransactionInput) {
  const id = `tx_${input.date.getTime()}_${Math.floor(
    // deterministic-enough unique suffix without Math.random dependence
    (input.amount * 31 + input.walletId.length) % 100000
  )}`;
  await db.insert(transactions).values({
    id,
    walletId: input.walletId,
    subcategoryId: input.subcategoryId,
    amount: input.amount,
    direction: input.direction,
    title: input.title,
    note: input.note,
    date: input.date,
  });
  return id;
}

/** A transaction joined with its display name (title || subcategory name). */
export type TransactionListItem = {
  id: string;
  amount: number; // signed cents: negative for expense
  title: string;
  categoryName: string;
  date: Date;
};

/**
 * One page of transactions, newest first, joined to their subcategory/category
 * for display. Uses LIMIT/OFFSET paging.
 */
export async function getTransactionsPage(
  page: number,
  pageSize: number
): Promise<TransactionListItem[]> {
  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      direction: transactions.direction,
      title: transactions.title,
      subName: subcategories.name,
      catName: categories.name,
      date: transactions.date,
    })
    .from(transactions)
    .leftJoin(
      subcategories,
      eq(transactions.subcategoryId, subcategories.id)
    )
    .leftJoin(categories, eq(subcategories.categoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  return rows.map((r) => ({
    id: r.id,
    // sign the amount for display: expense negative, income positive
    amount: r.direction === "expense" ? -r.amount : r.amount,
    title: r.title ?? r.subName ?? "Uncategorized",
    categoryName: r.catName ?? "Uncategorized",
    date: r.date,
  }));
}
