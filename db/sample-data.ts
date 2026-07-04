/**
 * Dev helper: inserts a few months of diverse, realistic sample transactions
 * so charts, budgets, and lists have something to show. Reached from Settings
 * (dev builds only). Amounts are cents. Safe to run more than once — it just
 * adds another batch.
 */

import { addTransaction, listCategoryTree, listWallets } from "./queries";

type Kind = "expense" | "income";

/** One template = one transaction per month (unless `everyNthMonth` skips). */
type Template = {
  day: number;
  amount: number; // cents
  direction: Kind;
  category: string;
  subcategory?: string;
  title?: string;
  note?: string;
  /** Wallet name to book against (falls back to the first wallet). */
  wallet?: string;
  /** 1 = every month, 2 = every other month, 3 = every third… */
  everyNthMonth?: number;
  /** Vary the amount a little per month so charts aren't flat. */
  jitter?: number[]; // cents added per month index
};

const TEMPLATES: Template[] = [
  // Income
  { day: 1, amount: 320000, direction: "income", category: "Income", subcategory: "Salary", note: "Monthly paycheck" },
  { day: 18, amount: 62000, direction: "income", category: "Income", subcategory: "Freelance", note: "Side project", everyNthMonth: 2, jitter: [0, 15000, -8000, 22000, 5000] },
  // Housing
  { day: 2, amount: 95000, direction: "expense", category: "Housing", subcategory: "Rent" },
  { day: 6, amount: 6500, direction: "expense", category: "Housing", subcategory: "Utilities", jitter: [0, 1200, -600, 2400, 800] },
  { day: 7, amount: 4500, direction: "expense", category: "Housing", subcategory: "Internet" },
  // Food
  { day: 5, amount: 8200, direction: "expense", category: "Food", subcategory: "Groceries", title: "Weekly shop", jitter: [0, 900, -400, 1300, 600] },
  { day: 12, amount: 7600, direction: "expense", category: "Food", subcategory: "Groceries", jitter: [500, -300, 800, 0, 1100] },
  { day: 19, amount: 9100, direction: "expense", category: "Food", subcategory: "Groceries", jitter: [-600, 400, 200, 900, -200] },
  { day: 8, amount: 3400, direction: "expense", category: "Food", subcategory: "Restaurant", note: "Date night" },
  { day: 16, amount: 1250, direction: "expense", category: "Food", subcategory: "Fast Food" },
  { day: 23, amount: 850, direction: "expense", category: "Food", subcategory: "Drinks", note: "Coffee run" },
  // Transport
  { day: 10, amount: 5200, direction: "expense", category: "Transport", subcategory: "Gas", jitter: [0, 700, -300, 1000, 400] },
  { day: 15, amount: 2500, direction: "expense", category: "Transport", subcategory: "Public Transit", title: "Metro pass" },
  { day: 27, amount: 1650, direction: "expense", category: "Transport", subcategory: "Rideshare", everyNthMonth: 2 },
  // Bills
  { day: 3, amount: 1549, direction: "expense", category: "Bills", subcategory: "Subscriptions", note: "Streaming" },
  { day: 4, amount: 3000, direction: "expense", category: "Bills", subcategory: "Phone" },
  // Shopping (category-only — no subcategory, exercises that path)
  { day: 20, amount: 8900, direction: "expense", category: "Shopping", title: "New sneakers", everyNthMonth: 2 },
  { day: 24, amount: 15900, direction: "expense", category: "Shopping", subcategory: "Electronics", note: "Keyboard", everyNthMonth: 3 },
  // Health
  { day: 22, amount: 2300, direction: "expense", category: "Health", subcategory: "Pharmacy", everyNthMonth: 2 },
  { day: 13, amount: 3500, direction: "expense", category: "Health", subcategory: "Fitness", title: "Gym" },
  // Second-wallet activity (booked on the second wallet when one exists)
  { day: 9, amount: 3800, direction: "expense", category: "Food", subcategory: "Restaurant", note: "Trip dinner", wallet: "#2" },
  { day: 11, amount: 1400, direction: "expense", category: "Transport", subcategory: "Public Transit", wallet: "#2" },
  { day: 14, amount: 5600, direction: "expense", category: "Food", subcategory: "Groceries", wallet: "#2" },
  { day: 25, amount: 45000, direction: "income", category: "Income", subcategory: "Freelance", note: "Invoice", wallet: "#2", everyNthMonth: 2 },
];

const MONTHS_BACK = 5;

/** Insert the sample batch. Returns how many transactions were created. */
export async function insertSampleData(): Promise<number> {
  const [walletList, tree] = await Promise.all([
    listWallets(),
    listCategoryTree(),
  ]);
  if (walletList.length === 0) {
    throw new Error("Add a wallet first.");
  }

  const byName = new Map(
    tree.map((c) => [
      c.name,
      { id: c.id, subs: new Map(c.subs.map((s) => [s.name, s.id])) },
    ])
  );

  const now = new Date();
  let created = 0;

  for (let back = 0; back < MONTHS_BACK; back++) {
    for (const t of TEMPLATES) {
      if (t.everyNthMonth && back % t.everyNthMonth !== 0) continue;

      const date = new Date(now.getFullYear(), now.getMonth() - back, t.day);
      if (date > now) continue; // don't create future transactions

      const cat = byName.get(t.category);
      const subId = t.subcategory ? cat?.subs.get(t.subcategory) ?? null : null;
      const wallet =
        t.wallet === "#2" && walletList.length > 1
          ? walletList[1]
          : walletList[0];
      const jitter = t.jitter?.[back] ?? 0;

      await addTransaction({
        walletId: wallet.id,
        categoryId: cat?.id ?? null,
        subcategoryId: subId,
        amount: t.amount + jitter,
        direction: t.direction,
        title: t.title ?? null,
        note: t.note ?? null,
        date,
      });
      created++;
    }
  }
  return created;
}
