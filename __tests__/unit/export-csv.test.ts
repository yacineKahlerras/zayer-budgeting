/**
 * CSV export — exercised through `exportAllToCsv` with expo-file-system and
 * expo-sharing mocked, against real data in the test database.
 */

import { db } from "@/db/client";
import { ensureDefaults } from "@/db/defaults";
import { addTransaction, listCategoryTree, listWallets } from "@/db/queries";

const mockState = { written: "" };
const mockShareAsync = jest.fn((..._a: unknown[]) => undefined);
const mockIsAvailableAsync = jest.fn(async (..._a: unknown[]) => true);

jest.mock("expo-file-system", () => ({
  Paths: { cache: "/cache" },
  File: class {
    uri = "file:///cache/export.csv";
    exists = false;
    create() {}
    delete() {}
    write(text: string) {
      mockState.written = text;
    }
    textSync() {
      return mockState.written;
    }
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...a: unknown[]) => mockIsAvailableAsync(...a),
  shareAsync: (...a: unknown[]) => mockShareAsync(...a),
}));

// Import AFTER the mocks so export.ts binds to them.
import { exportAllToCsv } from "@/utils/export";

async function seed() {
  await ensureDefaults(db);
  const [w] = await listWallets();
  const tree = await listCategoryTree("expense");
  const food = tree.find((c) => c.name === "Food")!;
  const groceries = food.subs.find((s) => s.name === "Groceries")!;
  await addTransaction({
    walletId: w.id,
    categoryId: food.id,
    subcategoryId: groceries.id,
    amount: 1234,
    direction: "expense",
    title: 'He said "hi", twice',
    note: null,
    date: new Date(2026, 6, 4),
  });
  await addTransaction({
    walletId: w.id,
    categoryId: null,
    subcategoryId: null,
    amount: 5000,
    direction: "income",
    title: null,
    note: "salary, july",
    date: new Date(2026, 6, 1),
  });
}

beforeEach(() => {
  mockState.written = "";
  mockShareAsync.mockClear();
});

describe("exportAllToCsv", () => {
  it("throws when there is nothing to export", async () => {
    await ensureDefaults(db);
    await expect(exportAllToCsv()).rejects.toThrow(/no transactions/i);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("writes a header plus one line per transaction, newest first", async () => {
    await seed();
    await exportAllToCsv();
    const lines = mockState.written.split("\n");
    expect(lines[0]).toBe(
      "Date,Wallet,Currency,Type,Amount,Category,Subcategory,Title,Note"
    );
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("2026-07-04")).toBe(true);
    expect(lines[2].startsWith("2026-07-01")).toBe(true);
  });

  it("signs amounts: expense negative, income positive, 2 decimals", async () => {
    await seed();
    await exportAllToCsv();
    const [, expense, income] = mockState.written.split("\n");
    expect(expense).toContain(",-12.34,");
    expect(income).toContain(",50.00,");
  });

  it("quotes fields containing commas and escapes embedded quotes", async () => {
    await seed();
    await exportAllToCsv();
    const [, expense, income] = mockState.written.split("\n");
    expect(expense).toContain('"He said ""hi"", twice"');
    expect(income).toContain('"salary, july"');
  });

  it("includes category and subcategory names", async () => {
    await seed();
    await exportAllToCsv();
    const [, expense] = mockState.written.split("\n");
    expect(expense).toContain("Food");
    expect(expense).toContain("Groceries");
  });

  it("shares the file as text/csv", async () => {
    await seed();
    await exportAllToCsv();
    expect(mockShareAsync).toHaveBeenCalledWith(
      "file:///cache/export.csv",
      expect.objectContaining({ mimeType: "text/csv" })
    );
  });

  it("throws when sharing is unavailable", async () => {
    await seed();
    mockIsAvailableAsync.mockResolvedValueOnce(false);
    await expect(exportAllToCsv()).rejects.toThrow(/not available/i);
  });

  it("round-trips through the importer's parser", async () => {
    await seed();
    await exportAllToCsv();
    const { parseCsv } = require("@/utils/import");
    const { rows, skipped } = parseCsv(mockState.written);
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      direction: "expense",
      amountCents: 1234,
      currency: "USD",
    });
  });
});
