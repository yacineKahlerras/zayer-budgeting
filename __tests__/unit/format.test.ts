import {
  balancesByCurrency,
  currencySymbol,
  formatCents,
  monthShort,
  toCents,
} from "@/utils/format";

describe("monthShort", () => {
  it("maps 0-based months", () => {
    expect(monthShort(0)).toBe("Jan");
    expect(monthShort(6)).toBe("Jul");
    expect(monthShort(11)).toBe("Dec");
  });

  it("returns empty string out of range", () => {
    expect(monthShort(12)).toBe("");
    expect(monthShort(-1)).toBe("");
  });
});

describe("currencySymbol", () => {
  it("knows the mapped currencies", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("DZD")).toBe("DA");
    expect(currencySymbol("MAD")).toBe("DH");
    expect(currencySymbol("EGP")).toBe("E£");
  });

  it("falls back to $ for unknown codes", () => {
    expect(currencySymbol("XXX")).toBe("$");
    expect(currencySymbol("")).toBe("$");
  });
});

describe("formatCents", () => {
  it("formats minor units with grouping and two decimals", () => {
    expect(formatCents(123450)).toBe("$1,234.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(5)).toBe("$0.05");
  });

  it("uses the magnitude — callers add the sign", () => {
    expect(formatCents(-123450)).toBe("$1,234.50");
  });

  it("honors the currency code", () => {
    expect(formatCents(4830700, "DZD")).toBe("DA48,307.00");
    expect(formatCents(10000, "EUR")).toBe("€100.00");
  });
});

describe("toCents", () => {
  it("parses decimal strings to integer cents", () => {
    expect(toCents("24.50")).toBe(2450);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1000")).toBe(100000);
  });

  it("rounds fractional cents", () => {
    expect(toCents("0.005")).toBe(1);
    expect(toCents("1.004")).toBe(100);
  });

  it("returns 0 for blank, garbage, zero and negatives", () => {
    expect(toCents("")).toBe(0);
    expect(toCents("abc")).toBe(0);
    expect(toCents("0")).toBe(0);
    expect(toCents("-5")).toBe(0);
  });
});

describe("balancesByCurrency", () => {
  it("groups per currency and sums", () => {
    const out = balancesByCurrency([
      { currency: "USD", balance: 100 },
      { currency: "USD", balance: 50 },
      { currency: "EUR", balance: 30 },
    ]);
    expect(out).toEqual([
      { currency: "USD", balance: 150 },
      { currency: "EUR", balance: 30 },
    ]);
  });

  it("sorts by absolute balance so an empty wallet can't bury the headline", () => {
    const out = balancesByCurrency([
      { currency: "USD", balance: 0 },
      { currency: "DZD", balance: -4830700 },
    ]);
    expect(out[0].currency).toBe("DZD");
  });

  it("ties break alphabetically by code", () => {
    const out = balancesByCurrency([
      { currency: "GBP", balance: 10 },
      { currency: "EUR", balance: 10 },
    ]);
    expect(out.map((o) => o.currency)).toEqual(["EUR", "GBP"]);
  });
});
