/**
 * Schema/migrations, first-run defaults, and the duplicate-category repair.
 */

import { count, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
// The test double behind "@/db/client" (same module instance under Jest's
// moduleNameMapper); imported directly so TypeScript sees its real exports.
import { testDb } from "../../test/db-client.mock";
import { ensureDefaults } from "@/db/defaults";
import {
  absorbDuplicateCategories,
  addBudget,
  addCategory,
  addTransaction,
  getBudget,
  listCategoryTree,
  listWallets,
} from "@/db/queries";
import {
  budgets,
  categories,
  subcategories,
  transactions,
  wallets,
} from "@/db/schema";

describe("migrations", () => {
  it("create all five tables", async () => {
    const rows = testDb().all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );
    const names = rows.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "wallets",
        "categories",
        "subcategories",
        "transactions",
        "budgets",
      ])
    );
  });

  it("budgets table accepts subcategory_id (migration 0002)", async () => {
    await ensureDefaults(db);
    const tree = await listCategoryTree("expense");
    const food = tree.find((c) => c.name === "Food")!;
    const groceries = food.subs.find((s) => s.name === "Groceries")!;
    const id = await addBudget({
      name: null,
      amount: 10_00,
      categoryId: food.id,
      subcategoryId: groceries.id,
      period: "month",
      currency: "USD",
    });
    const row = await getBudget(id);
    expect(row?.subcategoryId).toBe(groceries.id);
  });

  it("enforces FK cascade: deleting a wallet removes its transactions", async () => {
    await ensureDefaults(db);
    const [w] = await listWallets();
    // Need a second wallet so the last-wallet guard allows deletion later.
    await db.insert(wallets).values({
      id: "w2",
      name: "Second",
      currency: "USD",
      initialBalance: 0,
      sortOrder: 1,
    });
    await addTransaction({
      walletId: w.id,
      categoryId: null,
      subcategoryId: null,
      amount: 500,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 15),
    });
    await db.delete(wallets).where(eq(wallets.id, w.id));
    const [{ value }] = await db.select({ value: count() }).from(transactions);
    expect(value).toBe(0);
  });

  it("deleting a subcategory sets transaction references to NULL", async () => {
    await ensureDefaults(db);
    const [w] = await listWallets();
    const tree = await listCategoryTree("expense");
    const food = tree.find((c) => c.name === "Food")!;
    const sub = food.subs[0];
    const txId = await addTransaction({
      walletId: w.id,
      categoryId: food.id,
      subcategoryId: sub.id,
      amount: 100,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    await db.delete(subcategories).where(eq(subcategories.id, sub.id));
    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txId));
    expect(tx.subcategoryId).toBeNull();
    expect(tx.categoryId).toBe(food.id); // direct category link survives
  });
});

describe("ensureDefaults", () => {
  it("seeds one wallet and the default category tree on first run", async () => {
    await ensureDefaults(db);
    const ws = await listWallets();
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({ name: "Cash", currency: "USD" });

    const tree = await listCategoryTree();
    const names = tree.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Food",
        "Housing",
        "Transport",
        "Shopping",
        "Bills",
        "Health",
        "Income",
      ])
    );
    const food = tree.find((c) => c.name === "Food")!;
    expect(food.kind).toBe("expense");
    expect(food.subs.map((s) => s.name)).toEqual([
      "Groceries",
      "Restaurant",
      "Fast Food",
      "Drinks",
    ]);
    const income = tree.find((c) => c.name === "Income")!;
    expect(income.kind).toBe("income");
  });

  it("is idempotent — a second run inserts nothing", async () => {
    await ensureDefaults(db);
    await ensureDefaults(db);
    const [{ value: cats }] = await db.select({ value: count() }).from(categories);
    const [{ value: ws }] = await db.select({ value: count() }).from(wallets);
    expect(cats).toBe(7);
    expect(ws).toBe(1);
  });
});

describe("absorbDuplicateCategories", () => {
  async function seedDupe() {
    await ensureDefaults(db);
    const [w] = await listWallets();
    // Import-style duplicate: top-level "groceries" (lowercase, expense)
    const dupeId = await addCategory({
      name: "groceries",
      kind: "expense",
      icon: null,
    });
    const txId = await addTransaction({
      walletId: w.id,
      categoryId: dupeId,
      subcategoryId: null,
      amount: 1500_00,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 6, 4),
    });
    const budgetId = await addBudget({
      name: null,
      amount: 100_00,
      categoryId: dupeId,
      subcategoryId: null,
      period: "month",
      currency: "USD",
    });
    return { dupeId, txId, budgetId };
  }

  it("retargets transactions and budgets to the matching subcategory and deletes the dupe", async () => {
    const { dupeId, txId, budgetId } = await seedDupe();
    await absorbDuplicateCategories();

    const tree = await listCategoryTree();
    expect(tree.find((c) => c.id === dupeId)).toBeUndefined();

    const food = tree.find((c) => c.name === "Food")!;
    const groceries = food.subs.find((s) => s.name === "Groceries")!;

    const [tx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, txId));
    expect(tx.categoryId).toBe(food.id);
    expect(tx.subcategoryId).toBe(groceries.id);

    const budget = await getBudget(budgetId);
    expect(budget?.categoryId).toBe(food.id);
    expect(budget?.subcategoryId).toBe(groceries.id);
  });

  it("is idempotent and a no-op when there is nothing to absorb", async () => {
    await seedDupe();
    await absorbDuplicateCategories();
    const before = (await listCategoryTree()).length;
    await absorbDuplicateCategories();
    expect((await listCategoryTree()).length).toBe(before);
  });

  it("does not absorb across kinds", async () => {
    await ensureDefaults(db);
    // "Salary" exists as an INCOME subcategory; an EXPENSE category named
    // Salary must survive.
    const id = await addCategory({ name: "Salary", kind: "expense", icon: null });
    await absorbDuplicateCategories();
    expect((await listCategoryTree()).find((c) => c.id === id)).toBeDefined();
  });

  it("does not absorb categories that have their own subcategories", async () => {
    await ensureDefaults(db);
    const id = await addCategory({ name: "Groceries", kind: "expense", icon: null });
    await db.insert(subcategories).values({
      id: "s_custom",
      categoryId: id,
      name: "Bulk",
      isDefault: false,
      sortOrder: 0,
    });
    await absorbDuplicateCategories();
    expect((await listCategoryTree()).find((c) => c.id === id)).toBeDefined();
  });
});
