/**
 * CSV import for transactions exported from other budgeting apps — tuned for
 * "Wallet: Budget expense tracker" by BudgetBakers, whose export is
 * semicolon-delimited with these columns:
 *
 *   account;category;currency;amount;ref_currency_amount;type;payment_type;
 *   payment_type_local;note;date;gps_*;warranty_in_month;transfer;payee;
 *   labels;envelope_id;custom_category
 *
 * The importer is header-driven, so column order doesn't matter and it also
 * reads a plain comma-delimited CSV with `date,wallet,currency,type,amount,
 * category,...` headers (our own export shape).
 */

import { File } from "expo-file-system";

import {
  addTransaction,
  getOrCreateWallet,
  resolveImportCategory,
} from "@/db/queries";

export type ImportPreview = {
  rows: ParsedRow[];
  wallets: string[]; // distinct "Name · CUR" labels
  skipped: number; // rows that couldn't be parsed
};

type ParsedRow = {
  account: string;
  currency: string;
  category: string;
  direction: "expense" | "income";
  amountCents: number;
  note: string | null;
  date: Date;
};

/* ------------------------------ CSV parsing ------------------------------ */

/** Detect the delimiter from the header line (`;` if present, else `,`). */
function detectDelimiter(headerLine: string): string {
  return headerLine.includes(";") ? ";" : ",";
}

/** Split one CSV line, honoring double-quoted fields and escaped quotes. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parse "2026-07-04 21:53:25" or an ISO date into a Date (local time). */
function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DD"
  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", se = "0"] = m;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Amount string ("-1500.00", "1,234.50") → positive integer cents. */
function toCentsAbs(raw: string): number {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100);
}

/** Find a header's column index by any of the accepted aliases. */
function col(header: string[], ...aliases: string[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const i = lower.indexOf(a.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

/** Parse CSV text into rows + a preview, without touching the database. */
export function parseCsv(text: string): ImportPreview {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], wallets: [], skipped: 0 };
  }

  const delim = detectDelimiter(lines[0]);
  const header = splitLine(lines[0], delim);

  const iAccount = col(header, "account", "wallet");
  const iCategory = col(header, "category");
  const iCurrency = col(header, "currency");
  const iAmount = col(header, "amount");
  const iType = col(header, "type");
  const iNote = col(header, "note");
  const iDate = col(header, "date");

  const rows: ParsedRow[] = [];
  const walletLabels = new Set<string>();
  let skipped = 0;

  for (let li = 1; li < lines.length; li++) {
    const f = splitLine(lines[li], delim);
    const account = (iAccount >= 0 ? f[iAccount] : "Imported")?.trim() || "Imported";
    const currency = (iCurrency >= 0 ? f[iCurrency] : "USD")?.trim().toUpperCase() || "USD";
    const category = (iCategory >= 0 ? f[iCategory] : "")?.trim();
    const amountRaw = iAmount >= 0 ? f[iAmount] : "";
    const typeRaw = (iType >= 0 ? f[iType] : "")?.trim().toLowerCase();
    const note = iNote >= 0 ? f[iNote]?.trim() || null : null;
    const date = parseDate(iDate >= 0 ? f[iDate] : "");

    const amountCents = toCentsAbs(amountRaw);
    if (!date || amountCents <= 0) {
      skipped++;
      continue;
    }

    // Direction: prefer the explicit type; fall back to the amount's sign.
    const direction: "expense" | "income" =
      typeRaw.startsWith("inc")
        ? "income"
        : typeRaw.startsWith("exp")
          ? "expense"
          : amountRaw.trim().startsWith("-")
            ? "expense"
            : "income";

    rows.push({
      account,
      currency,
      category,
      direction,
      amountCents,
      note,
      date,
    });
    walletLabels.add(`${account} · ${currency}`);
  }

  return { rows, wallets: [...walletLabels].sort(), skipped };
}

/** Read + parse a CSV file (no DB writes). */
export async function previewCsvFile(uri: string): Promise<ImportPreview> {
  const file = new File(uri);
  const text = file.textSync();
  return parseCsv(text);
}

/* ------------------------------- Insertion ------------------------------- */

/**
 * Insert previously-parsed rows. Wallets and categories are resolved (created
 * if missing) and cached so re-imports don't duplicate them. Returns the number
 * of transactions inserted.
 */
export async function importRows(rows: ParsedRow[]): Promise<number> {
  const walletCache = new Map<string, string>();
  const categoryCache = new Map<
    string,
    { categoryId: string; subcategoryId: string | null }
  >();
  let inserted = 0;

  for (const r of rows) {
    const wKey = `${r.account.toLowerCase()}|${r.currency}`;
    let walletId = walletCache.get(wKey);
    if (!walletId) {
      walletId = await getOrCreateWallet(r.account, r.currency);
      walletCache.set(wKey, walletId);
    }

    // Source apps export their subcategory names in the category column, so
    // resolve against subcategories first (see resolveImportCategory).
    let scope: { categoryId: string; subcategoryId: string | null } | null =
      null;
    if (r.category) {
      const cKey = `${r.category.toLowerCase()}|${r.direction}`;
      scope = categoryCache.get(cKey) ?? null;
      if (!scope) {
        scope = await resolveImportCategory(r.category, r.direction);
        categoryCache.set(cKey, scope);
      }
    }

    await addTransaction({
      walletId,
      categoryId: scope?.categoryId ?? null,
      subcategoryId: scope?.subcategoryId ?? null,
      amount: r.amountCents,
      direction: r.direction,
      title: null,
      note: r.note,
      date: r.date,
    });
    inserted++;
  }

  return inserted;
}
