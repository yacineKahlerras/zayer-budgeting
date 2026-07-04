/** Formatting helpers shared across screens. */

/** Abbreviated month names, shared by the trend chart, range labels, and lists. */
export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Abbreviated month name for a 0-based month index. */
export function monthShort(month: number): string {
  return MONTHS_SHORT[month] ?? "";
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CAD: "$",
  AUD: "$",
};

/** The display symbol for a currency code, defaulting to "$". */
export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? "$";
}

/**
 * Format integer minor units (cents) as a currency string.
 * e.g. 123450 -> "$1,234.50". Uses the magnitude; callers add the sign.
 */
export function formatCents(cents: number, currency = "USD"): string {
  const value = Math.abs(cents) / 100;
  return `${currencySymbol(currency)}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Parse a "24.50"-style string into integer minor units (cents).
 * Returns 0 for blank, non-numeric, or non-positive input.
 */
export function toCents(input: string): number {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/**
 * Group balances by currency. Summing across currencies is meaningless without
 * exchange rates, so combined totals are shown one-per-currency instead.
 */
export function balancesByCurrency(
  wallets: { currency: string; balance: number }[]
): { currency: string; balance: number }[] {
  const byCurrency = new Map<string, number>();
  for (const w of wallets) {
    byCurrency.set(w.currency, (byCurrency.get(w.currency) ?? 0) + w.balance);
  }
  return [...byCurrency.entries()]
    .map(([currency, balance]) => ({ currency, balance }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
