import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addTransaction,
  addWallet,
  deleteTransaction,
  getTransaction,
  getTransactionsPage,
  listCategoryTree,
  updateTransaction,
} from "@/db/queries";

async function seed() {
  await ensureDefaults(db);
  const walletId = await addWallet({
    name: "W",
    currency: "USD",
    initialBalance: 0,
  });
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const groceries = food.subs.find((s) => s.name === "Groceries")!;
  return { walletId, food, groceries };
}

const base = (walletId: string) => ({
  walletId,
  categoryId: null as string | null,
  subcategoryId: null as string | null,
  amount: 100,
  direction: "expense" as const,
  title: null as string | null,
  note: null as string | null,
  date: new Date(2026, 5, 15, 12),
});

describe("add / get / update / delete", () => {
  it("round-trips every field including the date", async () => {
    const { walletId, food, groceries } = await seed();
    const id = await addTransaction({
      walletId,
      categoryId: food.id,
      subcategoryId: groceries.id,
      amount: 1250,
      direction: "expense",
      title: "Weekly shop",
      note: "with coupons",
      date: new Date(2026, 6, 4, 21, 53, 25),
    });
    const tx = await getTransaction(id);
    expect(tx).toMatchObject({
      walletId,
      categoryId: food.id,
      subcategoryId: groceries.id,
      amount: 1250,
      direction: "expense",
      title: "Weekly shop",
      note: "with coupons",
    });
    expect(tx!.date.getTime()).toBe(new Date(2026, 6, 4, 21, 53, 25).getTime());
  });

  it("updateTransaction replaces the full payload", async () => {
    const { walletId, food } = await seed();
    const id = await addTransaction(base(walletId));
    await updateTransaction(id, {
      ...base(walletId),
      categoryId: food.id,
      amount: 999,
      direction: "income",
      title: "changed",
    });
    const tx = await getTransaction(id);
    expect(tx).toMatchObject({
      amount: 999,
      direction: "income",
      title: "changed",
      categoryId: food.id,
    });
  });

  it("deleteTransaction removes the row", async () => {
    const { walletId } = await seed();
    const id = await addTransaction(base(walletId));
    await deleteTransaction(id);
    expect(await getTransaction(id)).toBeNull();
  });

  it("getTransaction returns null for unknown ids", async () => {
    await seed();
    expect(await getTransaction("missing")).toBeNull();
  });
});

describe("getTransactionsPage", () => {
  it("orders newest first and pages with LIMIT/OFFSET", async () => {
    const { walletId } = await seed();
    for (let i = 1; i <= 5; i++) {
      await addTransaction({
        ...base(walletId),
        title: `t${i}`,
        date: new Date(2026, 0, i),
      });
    }
    const page0 = await getTransactionsPage(0, 2);
    const page1 = await getTransactionsPage(1, 2);
    expect(page0.map((t) => t.title)).toEqual(["t5", "t4"]);
    expect(page1.map((t) => t.title)).toEqual(["t3", "t2"]);
  });

  it("filters by wallet when given one", async () => {
    const { walletId } = await seed();
    const other = await addWallet({ name: "O", currency: "USD", initialBalance: 0 });
    await addTransaction({ ...base(walletId), title: "mine" });
    await addTransaction({ ...base(other), title: "theirs" });
    const mine = await getTransactionsPage(0, 10, walletId);
    expect(mine.map((t) => t.title)).toEqual(["mine"]);
  });

  it("signs amounts: expense negative, income positive", async () => {
    const { walletId } = await seed();
    await addTransaction({
      ...base(walletId),
      amount: 700,
      direction: "income",
      date: new Date(2026, 5, 14),
    });
    await addTransaction({
      ...base(walletId),
      amount: 300,
      direction: "expense",
      date: new Date(2026, 5, 15),
    });
    const [expense, income] = await getTransactionsPage(0, 10);
    expect(expense.amount).toBe(-300);
    expect(income.amount).toBe(700);
  });

  it("title falls back: custom > subcategory > category > direction label", async () => {
    const { walletId, food, groceries } = await seed();
    await addTransaction({ ...base(walletId), title: "Custom", categoryId: food.id, subcategoryId: groceries.id, date: new Date(2026, 0, 4) });
    await addTransaction({ ...base(walletId), categoryId: food.id, subcategoryId: groceries.id, date: new Date(2026, 0, 3) });
    await addTransaction({ ...base(walletId), categoryId: food.id, date: new Date(2026, 0, 2) });
    await addTransaction({ ...base(walletId), date: new Date(2026, 0, 1) });
    await addTransaction({ ...base(walletId), direction: "income", date: new Date(2026, 0, 0) });

    const titles = (await getTransactionsPage(0, 10)).map((t) => t.title);
    expect(titles).toEqual(["Custom", "Groceries", "Food", "Expense", "Income"]);
  });

  it("categoryName falls back to Uncategorized", async () => {
    const { walletId } = await seed();
    await addTransaction(base(walletId));
    const [t] = await getTransactionsPage(0, 10);
    expect(t.categoryName).toBe("Uncategorized");
  });

  it("legacy rows with only a subcategory resolve their parent via the join", async () => {
    const { walletId, food, groceries } = await seed();
    // Simulate a pre-categoryId row: subcategory set, categoryId null.
    await addTransaction({
      ...base(walletId),
      categoryId: null,
      subcategoryId: groceries.id,
    });
    const [t] = await getTransactionsPage(0, 10);
    expect(t.categoryName).toBe(food.name);
    expect(t.title).toBe("Groceries");
  });

  it("subcategory's parent wins over a stale stored categoryId", async () => {
    const { walletId, groceries } = await seed();
    const tree = await listCategoryTree("expense");
    const housing = tree.find((c) => c.name === "Housing")!;
    // Contradictory row: categoryId Housing but subcategory Groceries(Food).
    await addTransaction({
      ...base(walletId),
      categoryId: housing.id,
      subcategoryId: groceries.id,
    });
    const [t] = await getTransactionsPage(0, 10);
    expect(t.categoryName).toBe("Food");
  });
});
