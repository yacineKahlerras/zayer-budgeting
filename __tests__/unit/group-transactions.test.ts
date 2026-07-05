import type { TransactionListItem } from "@/db/queries";
import { groupByDay } from "@/utils/group-transactions";

function tx(id: string, date: Date): TransactionListItem {
  return {
    id,
    amount: -100,
    title: "t",
    categoryName: "c",
    note: null,
    date,
  };
}

describe("groupByDay", () => {
  it("returns no sections for an empty list", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("groups same-day transactions into one section, order preserved", () => {
    const a = tx("a", new Date(2026, 6, 4, 10));
    const b = tx("b", new Date(2026, 6, 4, 9));
    const sections = groupByDay([a, b]);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("puts a month banner only on the first section of each month", () => {
    const sections = groupByDay([
      tx("a", new Date(2026, 6, 4)),
      tx("b", new Date(2026, 6, 1)),
      tx("c", new Date(2026, 5, 30)),
    ]);
    expect(sections).toHaveLength(3);
    expect(sections[0].monthBanner).toBe("July 2026");
    expect(sections[1].monthBanner).toBeNull();
    expect(sections[2].monthBanner).toBe("June 2026");
  });

  it("labels days with weekday, month and day", () => {
    const [s] = groupByDay([tx("a", new Date(2026, 6, 4))]);
    expect(s.dayLabel).toBe("Sat, Jul 4");
  });

  it("does not merge the same calendar day across months/years", () => {
    const sections = groupByDay([
      tx("a", new Date(2026, 6, 4)),
      tx("b", new Date(2025, 6, 4)),
    ]);
    expect(sections).toHaveLength(2);
    expect(sections[1].monthBanner).toBe("July 2025");
  });

  it("produces unique keys per day", () => {
    const sections = groupByDay([
      tx("a", new Date(2026, 6, 4)),
      tx("b", new Date(2026, 6, 3)),
    ]);
    expect(new Set(sections.map((s) => s.key)).size).toBe(2);
  });
});
