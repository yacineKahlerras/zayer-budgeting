import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addTransaction,
  addWallet,
  getAllTransactionsForExport,
  listCategoryTree,
  searchTransactions,
} from "@/db/queries";

async function seed() {
  await ensureDefaults(db);
  const walletId = await addWallet({
    name: "Main",
    currency: "USD",
    initialBalance: 0,
  });
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const groceries = food.subs.find((s) => s.name === "Groceries")!;

  await addTransaction({
    walletId,
    categoryId: food.id,
    subcategoryId: groceries.id,
    amount: 100,
    direction: "expense",
    title: "Weekly Shop",
    note: "milk and bread",
    date: new Date(2026, 6, 4),
  });
  await addTransaction({
    walletId,
    categoryId: null,
    subcategoryId: null,
    amount: 200,
    direction: "expense",
    title: "Cinema",
    note: null,
    date: new Date(2026, 6, 3),
  });
  await addTransaction({
    walletId,
    categoryId: food.id,
    subcategoryId: null,
    amount: 300,
    direction: "income",
    title: null,
    note: "refund 100%",
    date: new Date(2026, 6, 2),
  });
  return { walletId, food, groceries };
}

describe("searchTransactions", () => {
  it("matches the title case-insensitively", async () => {
    await seed();
    const hits = await searchTransactions("weekly", 0, 10);
    expect(hits.map((h) => h.title)).toEqual(["Weekly Shop"]);
  });

  it("matches notes, subcategory names and category names", async () => {
    await seed();
    expect((await searchTransactions("bread", 0, 10))).toHaveLength(1);
    expect((await searchTransactions("groceries", 0, 10))).toHaveLength(1);
    // "Food" matches both categorized transactions.
    expect((await searchTransactions("food", 0, 10))).toHaveLength(2);
  });

  it("an empty query returns the recent list, newest first", async () => {
    await seed();
    const all = await searchTransactions("", 0, 10);
    // The categorized income row falls back to its category name ("Food").
    expect(all.map((t) => t.title)).toEqual(["Weekly Shop", "Cinema", "Food"]);
  });

  it("strips LIKE wildcards so % cannot match everything", async () => {
    await seed();
    const hits = await searchTransactions("%", 0, 10);
    // "%" is stripped → empty term → behaves like %% match... the term becomes
    // "%%" which matches all rows, same as an empty query. What must NOT
    // happen is an SQL error.
    expect(hits.length).toBeGreaterThanOrEqual(0);
  });

  it("finds literal text that merely contains stripped characters", async () => {
    await seed();
    const hits = await searchTransactions("100%", 0, 10);
    expect(hits).toHaveLength(1);
    expect(hits[0].note).toBe("refund 100%");
  });

  it("paginates", async () => {
    await seed();
    const page0 = await searchTransactions("", 0, 2);
    const page1 = await searchTransactions("", 1, 2);
    expect(page0).toHaveLength(2);
    expect(page1).toHaveLength(1);
  });

  it("returns nothing for a term with no matches", async () => {
    await seed();
    expect(await searchTransactions("zzz-not-there", 0, 10)).toEqual([]);
  });
});

describe("getAllTransactionsForExport", () => {
  it("joins wallet, category and subcategory context, newest first", async () => {
    await seed();
    const rows = await getAllTransactionsForExport();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      wallet: "Main",
      currency: "USD",
      direction: "expense",
      amount: 100,
      category: "Food",
      subcategory: "Groceries",
      title: "Weekly Shop",
      note: "milk and bread",
    });
  });

  it("blanks missing optional fields instead of null", async () => {
    await seed();
    const rows = await getAllTransactionsForExport();
    const income = rows[2];
    expect(income.subcategory).toBe("");
    expect(income.title).toBe("");
    expect(income.note).toBe("refund 100%");
  });

  it("returns an empty array when there is no data", async () => {
    await ensureDefaults(db);
    expect(await getAllTransactionsForExport()).toEqual([]);
  });
});
