import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { getAllTransactionsForExport, type ExportRow } from "@/db/queries";
import { monthShort } from "./format";

/** Quote a CSV field, escaping embedded quotes and wrapping when needed. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function toCsv(rows: ExportRow[]): string {
  const header = [
    "Date",
    "Wallet",
    "Currency",
    "Type",
    "Amount",
    "Category",
    "Subcategory",
    "Title",
    "Note",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        isoDate(r.date),
        csvField(r.wallet),
        r.currency,
        r.direction,
        // amount as a signed decimal string
        ((r.direction === "expense" ? -r.amount : r.amount) / 100).toFixed(2),
        csvField(r.category),
        csvField(r.subcategory),
        csvField(r.title),
        csvField(r.note),
      ].join(",")
    );
  }
  return lines.join("\n");
}

/**
 * Export every transaction to a CSV file and open the system share sheet.
 * Throws if there is nothing to export or sharing is unavailable.
 */
export async function exportAllToCsv(): Promise<void> {
  const rows = await getAllTransactionsForExport();
  if (rows.length === 0) {
    throw new Error("There are no transactions to export yet.");
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}-${monthShort(now.getMonth())}-${now.getDate()}`;
  const file = new File(Paths.cache, `zayer-export-${stamp}.csv`);
  // Overwrite any previous export from today.
  if (file.exists) file.delete();
  file.create();
  file.write(toCsv(rows));

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: "Export transactions",
    UTI: "public.comma-separated-values-text",
  });
}
