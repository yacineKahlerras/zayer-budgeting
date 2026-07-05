import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  addTransaction,
  addWallet,
  adjustWalletBalance,
  deleteWallet,
  getOrCreateWallet,
  getTransactionsPage,
  getWallet,
  getWalletBalance,
  listWallets,
  listWalletsWithBalances,
  updateWallet,
} from "@/db/queries";
import { wallets } from "@/db/schema";

async function seedWallet(name = "Main", currency = "USD", initial = 0) {
  return addWallet({ name, currency, initialBalance: initial });
}

describe("addWallet / listWallets", () => {
  it("appends wallets with increasing sortOrder and lists them in order", async () => {
    await seedWallet("A");
    await seedWallet("B");
    await seedWallet("C");
    const ws = await listWallets();
    expect(ws.map((w) => w.name)).toEqual(["A", "B", "C"]);
    expect(ws.map((w) => w.sortOrder)).toEqual([0, 1, 2]);
  });

  it("excludes archived wallets", async () => {
    const id = await seedWallet("Hidden");
    await db.update(wallets).set({ archived: true }).where(eq(wallets.id, id));
    expect(await listWallets()).toHaveLength(0);
  });
});

describe("listWalletsWithBalances", () => {
  it("derives balance = initial + income − expense", async () => {
    const id = await seedWallet("Main", "USD", 10_00);
    const base = {
      walletId: id,
      categoryId: null,
      subcategoryId: null,
      title: null,
      note: null,
      date: new Date(2026, 0, 10),
    };
    await addTransaction({ ...base, amount: 50_00, direction: "income" });
    await addTransaction({ ...base, amount: 20_00, direction: "expense" });
    await addTransaction({ ...base, amount: 5_00, direction: "expense" });

    const [w] = await listWalletsWithBalances();
    expect(w.balance).toBe(10_00 + 50_00 - 25_00);
  });

  it("reports the raw initial balance for a wallet without transactions", async () => {
    await seedWallet("Empty", "EUR", 123_45);
    const [w] = await listWalletsWithBalances();
    expect(w.balance).toBe(123_45);
    expect(w.currency).toBe("EUR");
  });

  it("keeps balances independent per wallet", async () => {
    const a = await seedWallet("A");
    const b = await seedWallet("B");
    await addTransaction({
      walletId: a,
      categoryId: null,
      subcategoryId: null,
      amount: 100,
      direction: "income",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    const list = await listWalletsWithBalances();
    expect(list.find((w) => w.id === a)?.balance).toBe(100);
    expect(list.find((w) => w.id === b)?.balance).toBe(0);
  });

  it("supports negative balances", async () => {
    const id = await seedWallet("Neg", "USD", 0);
    await addTransaction({
      walletId: id,
      categoryId: null,
      subcategoryId: null,
      amount: 42_00,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    const [w] = await listWalletsWithBalances();
    expect(w.balance).toBe(-42_00);
  });
});

describe("updateWallet / getWallet", () => {
  it("updates name, currency and initial balance", async () => {
    const id = await seedWallet("Old", "USD", 0);
    await updateWallet(id, { name: "New", currency: "DZD", initialBalance: 7_00 });
    const w = await getWallet(id);
    expect(w).toMatchObject({ name: "New", currency: "DZD", initialBalance: 7_00 });
  });

  it("getWallet returns null for unknown ids", async () => {
    expect(await getWallet("nope")).toBeNull();
  });
});

describe("deleteWallet", () => {
  it("refuses to delete the last wallet", async () => {
    const id = await seedWallet("Only");
    await expect(deleteWallet(id)).rejects.toThrow(/at least one wallet/i);
    expect(await listWallets()).toHaveLength(1);
  });

  it("deletes a wallet when another remains", async () => {
    const a = await seedWallet("A");
    await seedWallet("B");
    await deleteWallet(a);
    const ws = await listWallets();
    expect(ws.map((w) => w.name)).toEqual(["B"]);
  });
});

describe("getWalletBalance", () => {
  it("returns the derived balance for one wallet", async () => {
    const id = await seedWallet("W", "USD", 100_00);
    await addTransaction({
      walletId: id,
      categoryId: null,
      subcategoryId: null,
      amount: 30_00,
      direction: "expense",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    expect(await getWalletBalance(id)).toBe(70_00);
  });

  it("returns 0 for an unknown wallet", async () => {
    expect(await getWalletBalance("nope")).toBe(0);
  });
});

describe("adjustWalletBalance", () => {
  async function walletAt(cents: number) {
    // A wallet whose derived balance equals `cents` via its initial balance.
    return seedWallet("Main", "USD", cents);
  }

  it("logs an expense for the shortfall when lowering the balance", async () => {
    const id = await walletAt(100_00);
    const txId = await adjustWalletBalance(id, 50_00);
    expect(txId).not.toBeNull();
    // Balance now matches the target.
    expect(await getWalletBalance(id)).toBe(50_00);
    // And the adjustment shows up as a −$50 expense titled accordingly.
    const [tx] = await getTransactionsPage(0, 10, id);
    expect(tx.amount).toBe(-50_00);
    expect(tx.title).toBe("Balance adjustment");
  });

  it("logs an income when raising the balance", async () => {
    const id = await walletAt(50_00);
    await adjustWalletBalance(id, 120_00);
    expect(await getWalletBalance(id)).toBe(120_00);
    const [tx] = await getTransactionsPage(0, 10, id);
    expect(tx.amount).toBe(70_00);
    expect(tx.title).toBe("Balance adjustment");
  });

  it("is a no-op when the balance is unchanged", async () => {
    const id = await walletAt(80_00);
    expect(await adjustWalletBalance(id, 80_00)).toBeNull();
    expect(await getTransactionsPage(0, 10, id)).toHaveLength(0);
  });

  it("accounts for existing transactions, not just the initial balance", async () => {
    const id = await walletAt(0);
    await addTransaction({
      walletId: id,
      categoryId: null,
      subcategoryId: null,
      amount: 200_00,
      direction: "income",
      title: null,
      note: null,
      date: new Date(2026, 0, 1),
    });
    // Derived balance is 200; adjust down to 150 → logs a −50 expense.
    await adjustWalletBalance(id, 150_00);
    expect(await getWalletBalance(id)).toBe(150_00);
    const [tx] = await getTransactionsPage(0, 1, id);
    expect(tx.amount).toBe(-50_00);
  });

  it("can target a negative balance", async () => {
    const id = await walletAt(10_00);
    await adjustWalletBalance(id, -5_00); // e.g. an overdrawn account
    expect(await getWalletBalance(id)).toBe(-5_00);
    const [tx] = await getTransactionsPage(0, 1, id);
    expect(tx.amount).toBe(-15_00); // 10 → −5 is a −15 expense
  });
});

describe("getOrCreateWallet (import)", () => {
  it("matches by case-insensitive name AND exact currency", async () => {
    const id = await seedWallet("Cash", "DZD");
    expect(await getOrCreateWallet("cash", "DZD")).toBe(id);
    expect(await getOrCreateWallet("CASH", "DZD")).toBe(id);
  });

  it("creates a new wallet when only the currency differs", async () => {
    const usd = await seedWallet("Cash", "USD");
    const dzd = await getOrCreateWallet("Cash", "DZD");
    expect(dzd).not.toBe(usd);
    expect(await listWallets()).toHaveLength(2);
  });

  it("creates with zero initial balance", async () => {
    const id = await getOrCreateWallet("Imported", "EUR");
    expect((await getWallet(id))?.initialBalance).toBe(0);
  });
});
