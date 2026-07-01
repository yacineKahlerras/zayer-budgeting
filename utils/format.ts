/** Formatting helpers shared across screens. */

/** Format a number as a currency string, e.g. 1234.5 -> "$1,234.50". */
export function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
