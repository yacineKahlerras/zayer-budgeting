import { dateFor, type Transaction } from "@/constants/mock-data";

export type DaySection = {
  /** ISO-ish key like "2026-5-28" */
  key: string;
  dayLabel: string;
  /** Month banner to show above this day, or null if same month as the day before. */
  monthBanner: string | null;
  data: Transaction[];
};

const DAY_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

const MONTH_FMT: Intl.DateTimeFormatOptions = {
  month: "long",
  year: "numeric",
};

/** Group a flat, date-descending list into day sections with month banners. */
export function groupByDay(txns: Transaction[]): DaySection[] {
  const sections: DaySection[] = [];
  let lastMonthKey: string | null = null;

  for (const t of txns) {
    const d = dateFor(t.daysAgo);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

    let section = sections[sections.length - 1];
    if (!section || section.key !== dayKey) {
      const monthBanner =
        monthKey !== lastMonthKey
          ? d.toLocaleDateString("en-US", MONTH_FMT)
          : null;
      lastMonthKey = monthKey;
      section = {
        key: dayKey,
        dayLabel: d.toLocaleDateString("en-US", DAY_FMT),
        monthBanner,
        data: [],
      };
      sections.push(section);
    }
    section.data.push(t);
  }
  return sections;
}
