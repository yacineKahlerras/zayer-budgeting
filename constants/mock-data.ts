export type TransactionType =
  | "Housing"
  | "Groceries"
  | "Transport"
  | "Dining"
  | "Subscriptions"
  | "Shopping"
  | "Utilities"
  | "Health"
  | "Income";

export type Transaction = {
  id: string;
  name: string;
  type: TransactionType;
  /** Days before the anchor date (0 = most recent). Used to derive the date. */
  daysAgo: number;
  amount: number; // positive = money in, negative = money out
};

export const account = {
  holder: "Yacine Kahlerras",
  balance: 4820.5,
  currency: "USD",
};

/**
 * Anchor date the feed counts backwards from. Fixed (not `new Date()`) so the
 * generated feed is fully deterministic.
 */
export const ANCHOR_DATE = new Date(2026, 5, 30); // Jun 30, 2026

const ICON: Record<TransactionType, string> = {
  Housing: "🏠",
  Groceries: "🛒",
  Transport: "🚗",
  Dining: "🍽️",
  Subscriptions: "🔁",
  Shopping: "🛍️",
  Utilities: "💡",
  Health: "💊",
  Income: "💰",
};

export function iconFor(type: TransactionType) {
  return ICON[type];
}

type Template = {
  names: string[];
  type: TransactionType;
  min: number;
  max: number;
  income?: boolean;
};

const TEMPLATES: Template[] = [
  { names: ["Rent", "Mortgage"], type: "Housing", min: 900, max: 1600 },
  {
    names: ["Whole Foods", "Trader Joe's", "Local Market", "Costco"],
    type: "Groceries",
    min: 18,
    max: 160,
  },
  { names: ["Uber", "Shell", "Metro Card", "Lyft"], type: "Transport", min: 8, max: 70 },
  {
    names: ["Chipotle", "Starbucks", "Sushi Place", "Pizza Night"],
    type: "Dining",
    min: 9,
    max: 85,
  },
  {
    names: ["Spotify", "Netflix", "iCloud", "Gym"],
    type: "Subscriptions",
    min: 5,
    max: 40,
  },
  { names: ["Amazon", "Zara", "Apple Store"], type: "Shopping", min: 20, max: 320 },
  {
    names: ["Electric Bill", "Water Bill", "Internet"],
    type: "Utilities",
    min: 30,
    max: 140,
  },
  { names: ["Pharmacy", "Dentist", "Clinic"], type: "Health", min: 12, max: 220 },
  {
    names: ["Salary", "Freelance Project", "Refund", "Sarah M."],
    type: "Income",
    min: 50,
    max: 3200,
    income: true,
  },
];

/**
 * Deterministic pseudo-random in [0, 1) from an integer seed.
 * (Math.random() is unavailable in this environment and would break determinism.)
 */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.floor(rand(seed) * arr.length)];
}

/**
 * Generate one deterministic transaction for a global index `i`.
 * Roughly 0–3 transactions land on each day as `i` grows, so the feed is
 * grouped naturally by day. Index 0 is the most recent.
 */
function generate(i: number): Transaction {
  const tpl = pick(TEMPLATES, i * 3 + 7);
  const name = pick(tpl.names, i * 5 + 11);
  // ~2 transactions per day on average
  const daysAgo = Math.floor(i / 2);
  const span = tpl.max - tpl.min;
  const amount = Math.round((tpl.min + rand(i * 7 + 3) * span) * 100) / 100;
  return {
    id: `tx-${i}`,
    name,
    type: tpl.type,
    daysAgo,
    amount: tpl.income ? amount : -amount,
  };
}

/**
 * Simulates a paginated API. Returns a deterministic batch of transactions.
 * The feed is effectively endless (capped high to avoid runaway scroll).
 */
export function getTransactions(page: number, pageSize = 20): Transaction[] {
  const MAX = 2000;
  const start = page * pageSize;
  if (start >= MAX) return [];
  const end = Math.min(start + pageSize, MAX);
  const out: Transaction[] = [];
  for (let i = start; i < end; i++) out.push(generate(i));
  return out;
}

export function dateFor(daysAgo: number): Date {
  const d = new Date(ANCHOR_DATE);
  d.setDate(d.getDate() - daysAgo);
  return d;
}
