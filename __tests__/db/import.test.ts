/**
 * Import resolution + row insertion (the DB half of the importer).
 */

import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import {
  getTransactionsPage,
  listCategoryTree,
  listWallets,
  listWalletsWithBalances,
  resolveImportCategory,
} from "@/db/queries";
import { importRows, parseCsv } from "@/utils/import";

describe("resolveImportCategory", () => {
  it("maps a subcategory name to its parent + sub (case-insensitive)", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    const groceries = food.subs.find((s) => s.name === "Groceries")!;
    const hit = await resolveImportCategory("gRoCeRiEs", "expense");
    expect(hit).toEqual({ categoryId: food.id, subcategoryId: groceries.id });
  });

  it("requires kind to match for subcategory resolution", async () => {
    await ensureDefaults(db);
    // "Salary" is an INCOME sub; importing it as expense must not match it.
    const hit = await resolveImportCategory("Salary", "expense");
    expect(hit.subcategoryId).toBeNull();
  });

  it("falls back to a top-level category match", async () => {
    await ensureDefaults(db);
    const food = (await listCategoryTree()).find((c) => c.name === "Food")!;
    const hit = await resolveImportCategory("food", "expense");
    expect(hit).toEqual({ categoryId: food.id, subcategoryId: null });
  });

  it("creates a new category when nothing matches", async () => {
    await ensureDefaults(db);
    const before = (await listCategoryTree()).length;
    const hit = await resolveImportCategory("Bar, cafe", "expense");
    expect(hit.subcategoryId).toBeNull();
    const tree = await listCategoryTree();
    expect(tree.length).toBe(before + 1);
    expect(tree.find((c) => c.id === hit.categoryId)?.name).toBe("Bar, cafe");
  });

  it("does not duplicate a category it already created", async () => {
    await ensureDefaults(db);
    const a = await resolveImportCategory("Bar, cafe", "expense");
    const b = await resolveImportCategory("BAR, CAFE", "expense");
    expect(b.categoryId).toBe(a.categoryId);
  });
});

describe("importRows", () => {
  const csv = [
    "account;category;currency;amount;ref_currency_amount;type;payment_type;payment_type_local;note;date;gps_latitude;gps_longitude;gps_accuracy_in_meters;warranty_in_month;transfer;payee;labels;envelope_id;custom_category",
    "Cash;Groceries;DZD;-1500.00;-1500.00;Expenses;CASH;Cash;;2026-07-04 21:53:25;;;;0;false;;;1;false",
    "Cash;Groceries;DZD;-760.00;-760.00;Expenses;CASH;Cash;;2026-06-01 09:00:00;;;;0;false;;;2;false",
    "Cash;Bar, cafe;DZD;-400.00;-400.00;Expenses;CASH;Cash;;2026-07-01 20:00:00;;;;0;false;;;3;false",
    "usd;TRANSFER;USD;20.00;20.00;Income;CASH;Cash;;2026-07-03 10:18:56;;;;0;true;;;4;false",
  ].join("\n");

  it("inserts every parsed row and reports the count", async () => {
    await ensureDefaults(db);
    const { rows } = parseCsv(csv);
    expect(await importRows(rows)).toBe(4);
    expect(await getTransactionsPage(0, 50)).toHaveLength(4);
  });

  it("creates wallets once per (name, currency) and reuses them", async () => {
    await ensureDefaults(db);
    await importRows(parseCsv(csv).rows);
    const wallets = await listWallets();
    // Default "Cash" is USD; import needs Cash·DZD and usd·USD.
    expect(wallets.map((w) => `${w.name}·${w.currency}`).sort()).toEqual([
      "Cash·DZD",
      "Cash·USD",
      "usd·USD",
    ]);
  });

  it("tags known subcategory names with parent + subcategory", async () => {
    await ensureDefaults(db);
    await importRows(parseCsv(csv).rows);
    const groceriesRows = (await getTransactionsPage(0, 50)).filter(
      (t) => t.title === "Groceries"
    );
    expect(groceriesRows).toHaveLength(2);
    for (const r of groceriesRows) expect(r.categoryName).toBe("Food");
  });

  it("creates unknown names as top-level categories, once", async () => {
    await ensureDefaults(db);
    await importRows(parseCsv(csv).rows);
    const tree = await listCategoryTree();
    const bar = tree.filter((c) => c.name === "Bar, cafe");
    expect(bar).toHaveLength(1);
    expect(bar[0].kind).toBe("expense");
    const transfer = tree.find((c) => c.name === "TRANSFER");
    expect(transfer?.kind).toBe("income");
  });

  it("derived balances reflect the imported amounts exactly", async () => {
    await ensureDefaults(db);
    await importRows(parseCsv(csv).rows);
    const balances = await listWalletsWithBalances();
    const cashDzd = balances.find(
      (w) => w.name === "Cash" && w.currency === "DZD"
    )!;
    const usd = balances.find((w) => w.name === "usd")!;
    expect(cashDzd.balance).toBe(-(1500_00 + 760_00 + 400_00));
    expect(usd.balance).toBe(20_00);
  });

  it("re-importing the same file adds rows again but never duplicates wallets/categories", async () => {
    await ensureDefaults(db);
    await importRows(parseCsv(csv).rows);
    await importRows(parseCsv(csv).rows);
    expect(await getTransactionsPage(0, 50)).toHaveLength(8);
    expect(await listWallets()).toHaveLength(3);
    const tree = await listCategoryTree();
    expect(tree.filter((c) => c.name === "Bar, cafe")).toHaveLength(1);
  });

  it("keeps notes and dates on inserted rows", async () => {
    await ensureDefaults(db);
    const noteCsv = [
      "date,wallet,currency,type,amount,category,note",
      "2026-02-10,Cash,USD,expense,12.34,,lunch with team",
    ].join("\n");
    await importRows(parseCsv(noteCsv).rows);
    const [t] = await getTransactionsPage(0, 10);
    expect(t.note).toBe("lunch with team");
    expect(t.date.getFullYear()).toBe(2026);
    expect(t.amount).toBe(-1234);
  });
});
