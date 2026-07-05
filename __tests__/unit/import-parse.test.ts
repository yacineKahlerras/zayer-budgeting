/**
 * CSV parsing (`parseCsv`) — the pure half of the importer. DB insertion is
 * covered in __tests__/db/import.test.ts.
 */

import { parseCsv } from "@/utils/import";

const WALLET_HEADER =
  "account;category;currency;amount;ref_currency_amount;type;payment_type;payment_type_local;note;date;gps_latitude;gps_longitude;gps_accuracy_in_meters;warranty_in_month;transfer;payee;labels;envelope_id;custom_category";

function walletCsv(rows: string[]): string {
  return [WALLET_HEADER, ...rows].join("\n");
}

describe("parseCsv — Wallet by BudgetBakers shape (semicolon)", () => {
  it("parses a plain expense row", () => {
    const { rows, skipped } = parseCsv(
      walletCsv([
        "Cash;Groceries;DZD;-1500.00;-1500.00;Expenses;CASH;Cash;;2026-07-04 21:53:25;;;;0;false;;;1000;false",
      ])
    );
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      account: "Cash",
      category: "Groceries",
      currency: "DZD",
      direction: "expense",
      amountCents: 150000,
      note: null,
    });
    const d = rows[0].date;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 4]);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([21, 53, 25]);
  });

  it("parses an income row from the type column even with a positive amount", () => {
    const { rows } = parseCsv(
      walletCsv([
        "usd;TRANSFER;USD;20.00;20.00;Income;CASH;Cash;;2026-07-03 10:18:56;;;;0;true;;;20001;false",
      ])
    );
    expect(rows[0].direction).toBe("income");
    expect(rows[0].amountCents).toBe(2000);
    expect(rows[0].currency).toBe("USD");
  });

  it("collects distinct wallet labels, sorted", () => {
    const { wallets } = parseCsv(
      walletCsv([
        "usd;A;USD;-1;-1;Expenses;CASH;Cash;;2026-01-01;;;;0;false;;;1;false",
        "Cash;B;DZD;-2;-2;Expenses;CASH;Cash;;2026-01-02;;;;0;false;;;2;false",
        "Cash;C;DZD;-3;-3;Expenses;CASH;Cash;;2026-01-03;;;;0;false;;;3;false",
      ])
    );
    expect(wallets).toEqual(["Cash · DZD", "usd · USD"]);
  });

  it("keeps the note column", () => {
    const { rows } = parseCsv(
      walletCsv([
        "Cash;Groceries;DZD;-10;-10;Expenses;CASH;Cash;weekly shop;2026-01-01;;;;0;false;;;1;false",
      ])
    );
    expect(rows[0].note).toBe("weekly shop");
  });

  it("skips rows without a parsable date or with a zero amount", () => {
    const { rows, skipped } = parseCsv(
      walletCsv([
        "Cash;A;DZD;-10;-10;Expenses;CASH;Cash;;not-a-date;;;;0;false;;;1;false",
        "Cash;B;DZD;0;0;Expenses;CASH;Cash;;2026-01-01;;;;0;false;;;2;false",
        "Cash;C;DZD;-10;-10;Expenses;CASH;Cash;;2026-01-01;;;;0;false;;;3;false",
      ])
    );
    expect(skipped).toBe(2);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("C");
  });
});

describe("parseCsv — generic comma CSV (our own export shape)", () => {
  it("detects the comma delimiter and maps the wallet alias", () => {
    const text = [
      "date,wallet,currency,type,amount,category,note",
      "2026-02-10,Cash,USD,expense,12.34,Food,lunch",
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0]).toMatchObject({
      account: "Cash",
      currency: "USD",
      direction: "expense",
      amountCents: 1234,
      category: "Food",
      note: "lunch",
    });
  });

  it("infers direction from the amount sign when there is no usable type", () => {
    const text = [
      "date,wallet,currency,type,amount,category",
      "2026-02-10,Cash,USD,,-5.00,Food",
      "2026-02-11,Cash,USD,,5.00,Salary",
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0].direction).toBe("expense");
    expect(rows[1].direction).toBe("income");
  });

  it("honors quoted fields with embedded delimiters and escaped quotes", () => {
    const text = [
      "date,wallet,currency,type,amount,category,note",
      '2026-02-10,Cash,USD,expense,1.00,"Restaurant, fast-food","said ""thanks"", left"',
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0].category).toBe("Restaurant, fast-food");
    expect(rows[0].note).toBe('said "thanks", left');
  });

  it("parses date-only and ISO datetime values", () => {
    const text = [
      "date,wallet,currency,type,amount,category",
      "2026-03-05,Cash,USD,expense,1.00,A",
      "2026-03-06T08:30:00,Cash,USD,expense,1.00,B",
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0].date.getDate()).toBe(5);
    expect(rows[1].date.getHours()).toBe(8);
  });

  it("normalizes currency to uppercase and defaults missing fields", () => {
    const text = [
      "date,wallet,currency,type,amount,category",
      "2026-02-10,,usd,expense,2.00,",
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0].account).toBe("Imported");
    expect(rows[0].currency).toBe("USD");
    expect(rows[0].category).toBe("");
  });

  it("handles amounts with thousands separators", () => {
    const text = [
      "date,wallet,currency,type,amount,category",
      '2026-02-10,Cash,USD,expense,"1,234.56",Food',
    ].join("\n");
    const { rows } = parseCsv(text);
    expect(rows[0].amountCents).toBe(123456);
  });

  it("returns an empty preview for a header-only or empty file", () => {
    expect(parseCsv("")).toEqual({ rows: [], wallets: [], skipped: 0 });
    expect(parseCsv("date,wallet,currency,type,amount,category").rows).toEqual(
      []
    );
  });

  it("ignores blank and whitespace-only lines entirely", () => {
    const text = [
      "date,wallet,currency,type,amount,category",
      "",
      "2026-02-10,Cash,USD,expense,1.00,Food",
      "   ",
    ].join("\n");
    const { rows, skipped } = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(skipped).toBe(0); // blank lines are filtered before parsing
  });

  it("handles CRLF line endings", () => {
    const text =
      "date,wallet,currency,type,amount,category\r\n2026-02-10,Cash,USD,expense,1.00,Food\r\n";
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(1);
  });
});

describe("parseCsv — the real exported fixture", () => {
  it("parses the shipped BudgetBakers export end to end", () => {
    const fs = require("fs");
    const path = require("path");
    const fixture = path.join(
      __dirname,
      "..",
      "..",
      "report_2026-07-04_231628.csv"
    );
    if (!fs.existsSync(fixture)) return; // fixture is gitignored; skip if absent
    const { rows, wallets, skipped } = parseCsv(
      fs.readFileSync(fixture, "utf8")
    );
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(117);
    expect(wallets).toEqual(["Cash · DZD", "euro · EUR", "usd · USD"]);
    expect(rows.filter((r) => r.direction === "income")).toHaveLength(9);
  });
});
