/** Formatting helpers shared across screens. */

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
