/**
 * Typed data-access functions. Screens/hooks call these; nobody outside db/
 * writes SQL. All money is in MINOR UNITS (cents).
 */

import { desc, eq, sql } from "drizzle-orm";

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

export type WalletWithBalance = {
  id: string;
  name: string;
  currency: string;
  icon: string | null;
  color: string | null;
  initialBalance: number;
  balance: number; // derived, in cents
};

/**
 * All active wallets with their derived balance (initialBalance + income −
 * expense), computed in a SINGLE aggregate query. This is the one place the
 * balance SQL lives; single-wallet and total helpers reuse it.
 */
export async function listWalletsWithBalances(): Promise<WalletWithBalance[]> {
  const rows = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      currency: wallets.currency,
      icon: wallets.icon,
      color: wallets.color,
      initialBalance: wallets.initialBalance,
      income: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(wallets)
    .leftJoin(transactions, eq(transactions.walletId, wallets.id))
    .where(eq(wallets.archived, false))
    .groupBy(wallets.id)
    .orderBy(wallets.sortOrder);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    currency: r.currency,
    icon: r.icon,
    color: r.color,
    initialBalance: r.initialBalance,
    balance: r.initialBalance + r.income - r.expense,
  }));
}

/** Derived balance for a single wallet (cents). */
export async function getWalletBalance(walletId: string): Promise<number> {
  const all = await listWalletsWithBalances();
  return all.find((w) => w.id === walletId)?.balance ?? 0;
}

/** Total balance across all wallets (naive: ignores differing currencies). */
export async function getTotalBalance(): Promise<number> {
  const all = await listWalletsWithBalances();
  return all.reduce((sum, w) => sum + w.balance, 0);
}

export type WalletInput = {
  name: string;
  currency: string;
  initialBalance: number; // cents
};

export async function addWallet(input: WalletInput): Promise<string> {
  const id = newId("w");
  // place new wallet at the end
  const existing = await listWallets();
  await db.insert(wallets).values({
    id,
    name: input.name,
    currency: input.currency,
    initialBalance: input.initialBalance,
    sortOrder: existing.length,
  });
  return id;
}

export async function updateWallet(id: string, input: WalletInput) {
  await db
    .update(wallets)
    .set({
      name: input.name,
      currency: input.currency,
      initialBalance: input.initialBalance,
    })
    .where(eq(wallets.id, id));
}

/**
 * Delete a wallet. Its transactions are removed too (ON DELETE CASCADE in the
 * schema), so the caller should confirm with the user first.
 */
export async function deleteWallet(id: string) {
  await db.delete(wallets).where(eq(wallets.id, id));
}

export async function getWallet(id: string) {
  const [row] = await db.select().from(wallets).where(eq(wallets.id, id));
  return row ?? null;
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

/** Monotonic counter so IDs minted in the same millisecond don't collide. */
let idCounter = 0;

function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

export async function addTransaction(input: NewTransactionInput) {
  const id = newId("tx");
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

export async function updateTransaction(
  id: string,
  input: NewTransactionInput
) {
  await db
    .update(transactions)
    .set({
      walletId: input.walletId,
      subcategoryId: input.subcategoryId,
      amount: input.amount,
      direction: input.direction,
      title: input.title,
      note: input.note,
      date: input.date,
    })
    .where(eq(transactions.id, id));
}

export async function deleteTransaction(id: string) {
  await db.delete(transactions).where(eq(transactions.id, id));
}

/** Full detail of one transaction, for the detail/edit screen. */
export type TransactionDetail = {
  id: string;
  walletId: string;
  subcategoryId: string | null;
  amount: number; // positive cents
  direction: "expense" | "income";
  title: string | null;
  note: string | null;
  date: Date;
};

export async function getTransaction(
  id: string
): Promise<TransactionDetail | null> {
  const [row] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id));
  if (!row) return null;
  return {
    id: row.id,
    walletId: row.walletId,
    subcategoryId: row.subcategoryId,
    amount: row.amount,
    direction: row.direction,
    title: row.title,
    note: row.note,
    date: row.date,
  };
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
