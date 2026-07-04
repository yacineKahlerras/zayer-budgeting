/**
 * Typed data-access functions. Screens/hooks call these; nobody outside db/
 * writes SQL. All money is in MINOR UNITS (cents).
 */

import { and, desc, eq, gte, like, lt, or, sql } from "drizzle-orm";

import { db } from "./client";
import {
  budgets,
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
 * schema), so the caller should confirm with the user first. Refuses to delete
 * the last wallet — the app always needs at least one to record transactions.
 */
export async function deleteWallet(id: string) {
  const active = await listWallets();
  if (active.length <= 1) {
    throw new Error(
      "You need at least one wallet. Add another before deleting this one."
    );
  }
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
  pageSize: number,
  walletId?: string
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
    .where(walletId ? eq(transactions.walletId, walletId) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  return rows.map((r) => ({
    id: r.id,
    // sign the amount for display: expense negative, income positive
    amount: r.direction === "expense" ? -r.amount : r.amount,
    // Display fallback, computed at read time so it can never go stale:
    // custom title > subcategory name > direction label.
    title:
      r.title ??
      r.subName ??
      (r.direction === "expense" ? "Expense" : "Income"),
    categoryName: r.catName ?? "Uncategorized",
    date: r.date,
  }));
}

/* --------------------------------- Stats --------------------------------- */
/*
 * Stats are scoped to a single wallet (walletId) so all amounts share one
 * currency — summing across differing currencies would be meaningless. The
 * Stats screen picks a wallet; "all wallets" is offered only per-currency.
 */

/** Build a [start, end) date window from a period + an anchor date. */
export function periodRange(
  period: "week" | "month" | "year",
  anchor: Date
): { start: Date; end: Date } {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const d = anchor.getDate();
  if (period === "year") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }
  if (period === "week") {
    // week starts Monday
    const day = anchor.getDay(); // 0=Sun..6=Sat
    const diffToMonday = (day + 6) % 7;
    const start = new Date(y, m, d - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
}

/** Combine an optional wallet filter with a date window into one WHERE clause. */
function scopeWhere(walletId: string, start: Date, end: Date) {
  return and(
    eq(transactions.walletId, walletId),
    gte(transactions.date, start),
    lt(transactions.date, end)
  );
}

export type PeriodSummary = {
  income: number; // cents
  expense: number; // cents
  net: number; // income - expense
};

/** Income / expense / net for one wallet within a date window. */
export async function getPeriodSummary(
  walletId: string,
  start: Date,
  end: Date
): Promise<PeriodSummary> {
  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.direction} = 'income' then ${transactions.amount} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.direction} = 'expense' then ${transactions.amount} else 0 end), 0)`,
    })
    .from(transactions)
    .where(scopeWhere(walletId, start, end));

  const income = row?.income ?? 0;
  const expense = row?.expense ?? 0;
  return { income, expense, net: income - expense };
}

export type CategorySlice = {
  categoryId: string;
  categoryName: string;
  icon: string | null;
  amount: number; // cents spent (expense)
};

/**
 * Expense totals grouped by top-level category for one wallet + window,
 * largest first. Uncategorized spending is folded into an "Uncategorized" slice.
 */
export async function getCategoryBreakdown(
  walletId: string,
  start: Date,
  end: Date
): Promise<CategorySlice[]> {
  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      icon: categories.icon,
      amount: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .leftJoin(categories, eq(subcategories.categoryId, categories.id))
    .where(
      and(scopeWhere(walletId, start, end), eq(transactions.direction, "expense"))
    )
    .groupBy(categories.id);

  return rows
    .map((r) => ({
      categoryId: r.categoryId ?? "uncategorized",
      categoryName: r.categoryName ?? "Uncategorized",
      icon: r.icon,
      amount: r.amount,
    }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export type MonthlyTotal = {
  year: number;
  month: number; // 0-based
  income: number;
  expense: number;
};

/**
 * Income/expense per month for one wallet over the last `months` months
 * (oldest first), for the trend chart.
 */
export async function getMonthlyTotals(
  walletId: string,
  months: number,
  anchor: Date
): Promise<MonthlyTotal[]> {
  const start = new Date(anchor.getFullYear(), anchor.getMonth() - (months - 1), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);

  const rows = await db
    .select({
      amount: transactions.amount,
      direction: transactions.direction,
      date: transactions.date,
    })
    .from(transactions)
    .where(scopeWhere(walletId, start, end));

  // Bucket into months in JS (SQLite date math on ms-epoch is awkward).
  const buckets = new Map<string, MonthlyTotal>();
  for (let i = 0; i < months; i++) {
    const dt = new Date(anchor.getFullYear(), anchor.getMonth() - (months - 1) + i, 1);
    buckets.set(`${dt.getFullYear()}-${dt.getMonth()}`, {
      year: dt.getFullYear(),
      month: dt.getMonth(),
      income: 0,
      expense: 0,
    });
  }
  for (const r of rows) {
    const key = `${r.date.getFullYear()}-${r.date.getMonth()}`;
    const b = buckets.get(key);
    if (!b) continue;
    if (r.direction === "income") b.income += r.amount;
    else b.expense += r.amount;
  }
  return [...buckets.values()];
}

/* -------------------------------- Budgets -------------------------------- */
/*
 * Budgets are monthly and per-currency. A budget is either scoped to one
 * top-level category (categoryId set) or is an overall cap (categoryId null).
 * "Actual" spending is the sum of expenses in the current month whose wallet
 * matches the budget's currency (and category, when scoped).
 */

export type BudgetInput = {
  name: string | null;
  amount: number; // cents
  categoryId: string | null; // null = overall cap
  currency: string;
};

export type BudgetWithProgress = {
  id: string;
  name: string | null;
  amount: number; // limit, cents
  categoryId: string | null;
  categoryName: string | null;
  icon: string | null;
  currency: string;
  spent: number; // cents spent this month
  remaining: number; // amount - spent (can be negative)
};

export async function addBudget(input: BudgetInput): Promise<string> {
  const id = newId("b");
  await db.insert(budgets).values({
    id,
    name: input.name,
    amount: input.amount,
    categoryId: input.categoryId,
    walletId: null,
    period: "month",
    currency: input.currency,
  });
  return id;
}

export async function updateBudget(id: string, input: BudgetInput) {
  await db
    .update(budgets)
    .set({
      name: input.name,
      amount: input.amount,
      categoryId: input.categoryId,
      currency: input.currency,
    })
    .where(eq(budgets.id, id));
}

export async function deleteBudget(id: string) {
  await db.delete(budgets).where(eq(budgets.id, id));
}

export async function getBudget(id: string) {
  const [row] = await db.select().from(budgets).where(eq(budgets.id, id));
  return row ?? null;
}

/**
 * All budgets with their spent/remaining for the CURRENT month. Spending is
 * matched by the budget's currency (via the transaction's wallet) and, when the
 * budget is category-scoped, by that category.
 */
export async function listBudgetsWithProgress(
  anchor: Date
): Promise<BudgetWithProgress[]> {
  const rows = await db.select().from(budgets).orderBy(budgets.createdAt);
  const { start, end } = periodRange("month", anchor);

  // Pull this month's expenses once, with each transaction's currency + category.
  const spend = await db
    .select({
      amount: transactions.amount,
      currency: wallets.currency,
      categoryId: subcategories.categoryId,
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .where(
      and(
        eq(transactions.direction, "expense"),
        gte(transactions.date, start),
        lt(transactions.date, end)
      )
    );

  // Category names/icons for labeling.
  const cats = await db.select().from(categories);
  const catById = new Map(cats.map((c) => [c.id, c]));

  return rows.map((b) => {
    const spent = spend
      .filter((s) => s.currency === b.currency)
      .filter((s) => (b.categoryId ? s.categoryId === b.categoryId : true))
      .reduce((sum, s) => sum + s.amount, 0);
    const cat = b.categoryId ? catById.get(b.categoryId) : null;
    return {
      id: b.id,
      name: b.name,
      amount: b.amount,
      categoryId: b.categoryId,
      categoryName: cat?.name ?? null,
      icon: cat?.icon ?? null,
      currency: b.currency,
      spent,
      remaining: b.amount - spent,
    };
  });
}

/* ------------------------- Category management --------------------------- */

export type CategoryInput = {
  name: string;
  kind: "expense" | "income";
  icon: string | null;
};

export async function addCategory(input: CategoryInput): Promise<string> {
  const id = newId("c");
  const existing = await db.select().from(categories);
  await db.insert(categories).values({
    id,
    name: input.name,
    kind: input.kind,
    icon: input.icon,
    isDefault: false,
    sortOrder: existing.length,
  });
  return id;
}

/** Rename a category. The icon is left untouched (there is no icon picker yet,
 *  so we must not wipe a default category's icon on rename). */
export async function updateCategory(id: string, input: { name: string }) {
  await db
    .update(categories)
    .set({ name: input.name })
    .where(eq(categories.id, id));
}

/**
 * Delete a category and its subcategories (cascade). Transactions that used a
 * deleted subcategory keep their history with a null category (SET NULL).
 */
export async function deleteCategory(id: string) {
  await db.delete(categories).where(eq(categories.id, id));
}

export async function addSubcategory(
  categoryId: string,
  name: string
): Promise<string> {
  const id = newId("s");
  const existing = await db
    .select()
    .from(subcategories)
    .where(eq(subcategories.categoryId, categoryId));
  await db.insert(subcategories).values({
    id,
    categoryId,
    name,
    isDefault: false,
    sortOrder: existing.length,
  });
  return id;
}

export async function updateSubcategory(id: string, name: string) {
  await db.update(subcategories).set({ name }).where(eq(subcategories.id, id));
}

export async function deleteSubcategory(id: string) {
  await db.delete(subcategories).where(eq(subcategories.id, id));
}

/* --------------------------------- Export -------------------------------- */

export type ExportRow = {
  date: Date;
  wallet: string;
  currency: string;
  direction: "expense" | "income";
  amount: number; // cents
  category: string;
  subcategory: string;
  title: string;
  note: string;
};

/** Every transaction with full context, newest first, for CSV export. */
export async function getAllTransactionsForExport(): Promise<ExportRow[]> {
  const rows = await db
    .select({
      date: transactions.date,
      wallet: wallets.name,
      currency: wallets.currency,
      direction: transactions.direction,
      amount: transactions.amount,
      catName: categories.name,
      subName: subcategories.name,
      title: transactions.title,
      note: transactions.note,
    })
    .from(transactions)
    .innerJoin(wallets, eq(transactions.walletId, wallets.id))
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .leftJoin(categories, eq(subcategories.categoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));

  return rows.map((r) => ({
    date: r.date,
    wallet: r.wallet,
    currency: r.currency,
    direction: r.direction,
    amount: r.amount,
    category: r.catName ?? "",
    subcategory: r.subName ?? "",
    title: r.title ?? "",
    note: r.note ?? "",
  }));
}

/* --------------------------------- Search -------------------------------- */

/**
 * Search transactions by title or note text (case-insensitive), newest first,
 * paginated. An empty query returns the normal recent list.
 */
export async function searchTransactions(
  query: string,
  page: number,
  pageSize: number
): Promise<TransactionListItem[]> {
  const q = query.trim();
  const term = `%${q.replace(/[%_]/g, "")}%`;

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
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .leftJoin(categories, eq(subcategories.categoryId, categories.id))
    .where(
      q
        ? or(
            like(transactions.title, term),
            like(transactions.note, term),
            like(subcategories.name, term),
            like(categories.name, term)
          )
        : undefined
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  return rows.map((r) => ({
    id: r.id,
    amount: r.direction === "expense" ? -r.amount : r.amount,
    // Display fallback, computed at read time so it can never go stale:
    // custom title > subcategory name > direction label.
    title:
      r.title ??
      r.subName ??
      (r.direction === "expense" ? "Expense" : "Income"),
    categoryName: r.catName ?? "Uncategorized",
    date: r.date,
  }));
}
