/** Formatting helpers shared across screens. */

/**
 * Format integer minor units (cents) as a currency string.
 * e.g. 123450 -> "$1,234.50". Uses the magnitude; callers add the sign.
 */
export function formatCents(cents: number, currency = "USD"): string {
  const symbol = currency === "EUR" ? "€" : "$";
  const value = Math.abs(cents) / 100;
  return `${symbol}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
