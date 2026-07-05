import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addBudget,
  addTransaction,
  addWallet,
  budgetPeriodLabel,
  deleteBudget,
  getBudget,
  listBudgetsWithProgress,
  listCategoryTree,
  updateBudget,
} from "@/db/queries";
import { budgets } from "@/db/schema";

const ANCHOR = new Date(2026, 6, 5, 12); // Sun Jul 5 2026, noon

async function seed() {
  await ensureDefaults(db);
  const usd = await addWallet({ name: "USD", currency: "USD", initialBalance: 0 });
  const dzd = await addWallet({ name: "DZD", currency: "DZD", initialBalance: 0 });
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const groceries = food.subs.find((s) => s.name === "Groceries")!;
  const restaurant = food.subs.find((s) => s.name === "Restaurant")!;

  const spend = (
    over: Partial<Parameters<typeof addTransaction>[0]> & { amount: number }
  ) =>
    addTransaction({
      walletId: usd,
      categoryId: null,
      subcategoryId: null,
      direction: "expense",
      title: null,
      note: null,
      date: ANCHOR,
      ...over,
    });

  return { usd, dzd, food, groceries, restaurant, spend };
}

const budgetInput = {
  name: null as string | null,
  amount: 100_00,
  categoryId: null as string | null,
  subcategoryId: null as string | null,
  period: "month" as const,
  currency: "USD",
};

describe("budgetPeriodLabel", () => {
  it("labels the three periods and defaults unknown to Monthly", () => {
    expect(budgetPeriodLabel("day")).toBe("Daily");
    expect(budgetPeriodLabel("month")).toBe("Monthly");
    expect(budgetPeriodLabel("year")).toBe("Yearly");
    expect(budgetPeriodLabel("custom")).toBe("Monthly");
  });
});

describe("budget CRUD", () => {
  it("add + get round-trips scope and period", async () => {
    const { food, groceries } = await seed();
    const id = await addBudget({
      ...budgetInput,
      categoryId: food.id,
      subcategoryId: groceries.id,
      period: "day",
    });
    const b = await getBudget(id);
    expect(b).toMatchObject({
      categoryId: food.id,
      subcategoryId: groceries.id,
      period: "day",
      currency: "USD",
      amount: 100_00,
    });
  });

  it("update changes scope, period and currency", async () => {
    const { food } = await seed();
    const id = await addBudget(budgetInput);
    await updateBudget(id, {
      ...budgetInput,
      categoryId: food.id,
      period: "year",
      currency: "DZD",
      amount: 5_00,
    });
    expect(await getBudget(id)).toMatchObject({
      categoryId: food.id,
      period: "year",
      currency: "DZD",
      amount: 5_00,
    });
  });

  it("delete removes the budget", async () => {
    await seed();
    const id = await addBudget(budgetInput);
    await deleteBudget(id);
    expect(await getBudget(id)).toBeNull();
  });
});

describe("listBudgetsWithProgress", () => {
  it("returns [] without touching anything when no budgets exist", async () => {
    await seed();
    expect(await listBudgetsWithProgress(ANCHOR)).toEqual([]);
  });

  it("overall budget counts all expenses in its currency this month", async () => {
    const { spend, dzd } = await seed();
    await addBudget(budgetInput); // overall, USD, month
    await spend({ amount: 10_00 });
    await spend({ amount: 15_00, date: new Date(2026, 6, 1) });
    await spend({ amount: 99_00, walletId: dzd }); // other currency
    await spend({ amount: 88_00, date: new Date(2026, 5, 20) }); // June

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(25_00);
    expect(b.remaining).toBe(75_00);
  });

  it("category budget counts only that category (incl. via subcategory)", async () => {
    const { spend, food, groceries } = await seed();
    await addBudget({ ...budgetInput, categoryId: food.id });
    await spend({ amount: 5_00, categoryId: food.id });
    await spend({ amount: 6_00, categoryId: food.id, subcategoryId: groceries.id });
    await spend({ amount: 7_00 }); // uncategorized

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(11_00);
    expect(b.categoryName).toBe("Food");
  });

  it("subcategory budget counts only that subcategory", async () => {
    const { spend, food, groceries, restaurant } = await seed();
    await addBudget({
      ...budgetInput,
      categoryId: food.id,
      subcategoryId: restaurant.id,
    });
    await spend({ amount: 4_00, categoryId: food.id, subcategoryId: restaurant.id });
    await spend({ amount: 9_00, categoryId: food.id, subcategoryId: groceries.id });
    await spend({ amount: 3_00, categoryId: food.id });

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(4_00);
    expect(b.subcategoryName).toBe("Restaurant");
  });

  it("a day budget only sees today's spending", async () => {
    const { spend } = await seed();
    await addBudget({ ...budgetInput, period: "day" });
    await spend({ amount: 2_00, date: new Date(2026, 6, 5, 9) });
    await spend({ amount: 50_00, date: new Date(2026, 6, 4, 23) });

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(2_00);
    expect(b.period).toBe("day");
  });

  it("a year budget sees the whole year", async () => {
    const { spend } = await seed();
    await addBudget({ ...budgetInput, period: "year" });
    await spend({ amount: 1_00, date: new Date(2026, 0, 2) });
    await spend({ amount: 2_00, date: new Date(2026, 11, 30) });
    await spend({ amount: 77_00, date: new Date(2025, 11, 31) });

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(3_00);
  });

  it("mixed-period budgets each get their own window in one call", async () => {
    const { spend } = await seed();
    await addBudget({ ...budgetInput, period: "day" });
    await addBudget({ ...budgetInput, period: "month" });
    await addBudget({ ...budgetInput, period: "year" });
    await spend({ amount: 1_00, date: new Date(2026, 6, 5, 8) }); // today
    await spend({ amount: 10_00, date: new Date(2026, 6, 1) }); // this month
    await spend({ amount: 100_00, date: new Date(2026, 1, 1) }); // this year

    const list = await listBudgetsWithProgress(ANCHOR);
    const byPeriod = Object.fromEntries(list.map((b) => [b.period, b.spent]));
    expect(byPeriod).toEqual({
      day: 1_00,
      month: 11_00,
      year: 111_00,
    });
  });

  it("legacy custom-period budgets use their explicit inclusive date range", async () => {
    const { spend, usd } = await seed();
    await db.insert(budgets).values({
      id: "b_custom",
      name: null,
      amount: 100_00,
      categoryId: null,
      subcategoryId: null,
      walletId: null,
      period: "custom",
      startDate: new Date(2026, 6, 1),
      endDate: new Date(2026, 6, 3),
      currency: "USD",
    });
    await spend({ amount: 5_00, date: new Date(2026, 6, 3, 18), walletId: usd });
    await spend({ amount: 9_00, date: new Date(2026, 6, 4, 1), walletId: usd });

    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(5_00);
    expect(b.period).toBe("month"); // normalized for display
  });

  it("remaining goes negative when over budget", async () => {
    const { spend } = await seed();
    await addBudget({ ...budgetInput, amount: 10_00 });
    await spend({ amount: 25_00 });
    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.remaining).toBe(-15_00);
  });

  it("income never counts against a budget", async () => {
    const { spend } = await seed();
    await addBudget(budgetInput);
    await spend({ amount: 500_00, direction: "income" });
    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.spent).toBe(0);
  });

  it("carries the category icon and name for the card", async () => {
    const { food } = await seed();
    await addBudget({ ...budgetInput, categoryId: food.id });
    const [b] = await listBudgetsWithProgress(ANCHOR);
    expect(b.icon).toBe("ShoppingCart");
    expect(b.categoryName).toBe("Food");
    expect(b.subcategoryName).toBeNull();
  });
});
