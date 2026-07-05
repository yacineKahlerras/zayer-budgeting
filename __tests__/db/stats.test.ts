import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  addTransaction,
  addWallet,
  getCategoryBreakdown,
  getPeriodSummary,
  listCategoryTree,
  periodRange,
} from "@/db/queries";

describe("periodRange", () => {
  it("day: [midnight, next midnight)", () => {
    const { start, end } = periodRange("day", new Date(2026, 6, 5, 13, 45));
    expect(start.getTime()).toBe(new Date(2026, 6, 5).getTime());
    expect(end.getTime()).toBe(new Date(2026, 6, 6).getTime());
  });

  it("day: rolls over month boundaries", () => {
    const { end } = periodRange("day", new Date(2026, 6, 31));
    expect(end.getTime()).toBe(new Date(2026, 7, 1).getTime());
  });

  it("week: starts Monday and spans 7 days", () => {
    // 2026-07-05 is a Sunday → week starts Monday 2026-06-29.
    const { start, end } = periodRange("week", new Date(2026, 6, 5));
    expect(start.getTime()).toBe(new Date(2026, 5, 29).getTime());
    expect(end.getTime()).toBe(new Date(2026, 6, 6).getTime());
  });

  it("week: a Monday anchor starts on itself", () => {
    const { start } = periodRange("week", new Date(2026, 5, 29));
    expect(start.getTime()).toBe(new Date(2026, 5, 29).getTime());
  });

  it("month: first of month to first of next, incl. December→January", () => {
    const jul = periodRange("month", new Date(2026, 6, 15));
    expect(jul.start.getTime()).toBe(new Date(2026, 6, 1).getTime());
    expect(jul.end.getTime()).toBe(new Date(2026, 7, 1).getTime());

    const dec = periodRange("month", new Date(2026, 11, 31));
    expect(dec.end.getTime()).toBe(new Date(2027, 0, 1).getTime());
  });

  it("year: Jan 1 to next Jan 1", () => {
    const { start, end } = periodRange("year", new Date(2026, 6, 5));
    expect(start.getTime()).toBe(new Date(2026, 0, 1).getTime());
    expect(end.getTime()).toBe(new Date(2027, 0, 1).getTime());
  });
});

async function seedStats() {
  await ensureDefaults(db);
  const walletId = await addWallet({
    name: "Main",
    currency: "DZD",
    initialBalance: 0,
  });
  const other = await addWallet({
    name: "Other",
    currency: "USD",
    initialBalance: 0,
  });
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const groceries = food.subs.find((s) => s.name === "Groceries")!;
  const housing = tree.find((c) => c.name === "Housing")!;

  const tx = (
    over: Partial<Parameters<typeof addTransaction>[0]> & { amount: number }
  ) =>
    addTransaction({
      walletId,
      categoryId: null,
      subcategoryId: null,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 6, 10),
      ...over,
    });

  return { walletId, other, food, groceries, housing, tx };
}

describe("getPeriodSummary", () => {
  it("sums income/expense/net inside the window only", async () => {
    const { walletId, tx } = await seedStats();
    await tx({ amount: 100_00, direction: "income", date: new Date(2026, 6, 2) });
    await tx({ amount: 30_00, date: new Date(2026, 6, 15) });
    await tx({ amount: 999_00, date: new Date(2026, 5, 30) }); // June — outside
    const { start, end } = periodRange("month", new Date(2026, 6, 20));
    const s = await getPeriodSummary(walletId, start, end);
    expect(s).toEqual({ income: 100_00, expense: 30_00, net: 70_00 });
  });

  it("window end is exclusive", async () => {
    const { walletId, tx } = await seedStats();
    await tx({ amount: 10_00, date: new Date(2026, 7, 1, 0, 0) }); // Aug 1
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    const s = await getPeriodSummary(walletId, start, end);
    expect(s.expense).toBe(0);
  });

  it("only counts the given wallet", async () => {
    const { walletId, other, tx } = await seedStats();
    await tx({ amount: 5_00 });
    await tx({ amount: 7_00, walletId: other });
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    expect((await getPeriodSummary(walletId, start, end)).expense).toBe(5_00);
    expect((await getPeriodSummary(other, start, end)).expense).toBe(7_00);
  });

  it("returns zeros for an empty window", async () => {
    const { walletId } = await seedStats();
    const { start, end } = periodRange("day", new Date(2026, 0, 1));
    expect(await getPeriodSummary(walletId, start, end)).toEqual({
      income: 0,
      expense: 0,
      net: 0,
    });
  });

  it("net can be negative", async () => {
    const { walletId, tx } = await seedStats();
    await tx({ amount: 50_00 });
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    expect((await getPeriodSummary(walletId, start, end)).net).toBe(-50_00);
  });
});

describe("getCategoryBreakdown", () => {
  it("groups expenses by effective top-level category, largest first", async () => {
    const { walletId, food, groceries, housing, tx } = await seedStats();
    await tx({ amount: 10_00, categoryId: food.id }); // direct category
    await tx({ amount: 15_00, categoryId: food.id, subcategoryId: groceries.id }); // via sub
    await tx({ amount: 40_00, categoryId: housing.id });

    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    const slices = await getCategoryBreakdown(walletId, start, end);
    expect(slices.map((s) => [s.categoryName, s.amount])).toEqual([
      ["Housing", 40_00],
      ["Food", 25_00],
    ]);
  });

  it("folds uncategorized spending into an Uncategorized slice", async () => {
    const { walletId, tx } = await seedStats();
    await tx({ amount: 9_99 });
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    const slices = await getCategoryBreakdown(walletId, start, end);
    expect(slices).toEqual([
      expect.objectContaining({
        categoryId: "uncategorized",
        categoryName: "Uncategorized",
        amount: 9_99,
      }),
    ]);
  });

  it("ignores income entirely", async () => {
    const { walletId, food, tx } = await seedStats();
    await tx({ amount: 500_00, direction: "income", categoryId: food.id });
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    expect(await getCategoryBreakdown(walletId, start, end)).toEqual([]);
  });

  it("scopes to wallet and window", async () => {
    const { walletId, other, food, tx } = await seedStats();
    await tx({ amount: 11_00, categoryId: food.id, walletId: other });
    await tx({ amount: 12_00, categoryId: food.id, date: new Date(2026, 5, 1) });
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    expect(await getCategoryBreakdown(walletId, start, end)).toEqual([]);
  });

  it("a legacy subcategory-only row lands in its parent category", async () => {
    const { walletId, groceries, tx } = await seedStats();
    await tx({ amount: 20_00, subcategoryId: groceries.id }); // categoryId null
    const { start, end } = periodRange("month", new Date(2026, 6, 10));
    const slices = await getCategoryBreakdown(walletId, start, end);
    expect(slices[0].categoryName).toBe("Food");
  });
});
