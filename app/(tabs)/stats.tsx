import { useFocusEffect } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Screen, ScreenTitle } from "@/components/ui/screen";
import {
  ALL_WALLETS,
  WalletSelector,
} from "@/components/ui/wallet-selector";
import { Colors } from "@/constants/theme";
import {
  getCategoryBreakdown,
  getMonthlyTotals,
  getPeriodSummary,
  listWalletsWithBalances,
  periodRange,
  type CategorySlice,
  type MonthlyTotal,
  type PeriodSummary,
  type WalletWithBalance,
} from "@/db/queries";
import { categoryIcon } from "@/utils/category-icon";
import { formatCents } from "@/utils/format";

type Period = "week" | "month" | "year";
const PERIODS: Period[] = ["week", "month", "year"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function rangeLabel(period: Period, anchor: Date): string {
  if (period === "year") return `${anchor.getFullYear()}`;
  if (period === "month") {
    return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }
  const { start, end } = periodRange("week", anchor);
  const endInclusive = new Date(end);
  endInclusive.setDate(end.getDate() - 1);
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[endInclusive.getMonth()]} ${endInclusive.getDate()}`;
}

function shiftAnchor(period: Period, anchor: Date, dir: -1 | 1): Date {
  const d = new Date(anchor);
  if (period === "week") d.setDate(d.getDate() + dir * 7);
  else if (period === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

export default function StatsScreen() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  // Stats must be single-currency; default to the first wallet, not "All".
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [period, setPeriod] = useState<Period>("month");
  const [anchor, setAnchor] = useState(new Date());

  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [breakdown, setBreakdown] = useState<CategorySlice[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [loading, setLoading] = useState(true);

  const currency =
    wallets.find((w) => w.id === selectedWallet)?.currency ?? "USD";

  // Load wallets; default the scope to the first wallet.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listWalletsWithBalances().then((w) => {
        if (cancelled) return;
        setWallets(w);
        setSelectedWallet((cur) =>
          cur && (cur === ALL_WALLETS || w.some((x) => x.id === cur))
            ? cur
            : w[0]?.id ?? ""
        );
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Recompute stats whenever scope/period/anchor changes.
  useFocusEffect(
    useCallback(() => {
      if (!selectedWallet) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      const { start, end } = periodRange(period, anchor);
      (async () => {
        const [s, b, m] = await Promise.all([
          getPeriodSummary(selectedWallet, start, end),
          getCategoryBreakdown(selectedWallet, start, end),
          getMonthlyTotals(selectedWallet, 6, anchor),
        ]);
        if (cancelled) return;
        setSummary(s);
        setBreakdown(b);
        setMonthly(m);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [selectedWallet, period, anchor])
  );

  const totalExpense = useMemo(
    () => breakdown.reduce((sum, s) => sum + s.amount, 0),
    [breakdown]
  );
  const maxMonthly = useMemo(
    () => Math.max(1, ...monthly.map((m) => Math.max(m.income, m.expense))),
    [monthly]
  );

  if (wallets.length === 0) {
    return (
      <Screen>
        <ScreenTitle>Stats</ScreenTitle>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No wallets yet</Text>
          <Text style={styles.emptyText}>
            Add a wallet and some transactions to see stats.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.titleRow}>
        <ScreenTitle>Stats</ScreenTitle>
      </View>

      <View style={styles.selectorWrap}>
        <WalletSelector
          wallets={wallets}
          selected={selectedWallet}
          onSelect={setSelectedWallet}
          includeAll={false}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Period toggle */}
        <View style={styles.periodToggle}>
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <Pressable
                key={p}
                style={[styles.periodBtn, active && styles.periodBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[
                    styles.periodText,
                    active && styles.periodTextActive,
                  ]}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Range stepper */}
        <View style={styles.stepper}>
          <Pressable
            hitSlop={10}
            onPress={() => setAnchor((a) => shiftAnchor(period, a, -1))}
          >
            <ChevronLeft size={22} color={Colors.textMuted} />
          </Pressable>
          <Text style={styles.rangeLabel}>{rangeLabel(period, anchor)}</Text>
          <Pressable
            hitSlop={10}
            onPress={() => setAnchor((a) => shiftAnchor(period, a, 1))}
          >
            <ChevronRight size={22} color={Colors.textMuted} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={styles.loader} />
        ) : (
          <>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, { color: Colors.positive }]}>
                  {formatCents(summary?.income ?? 0, currency)}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Expense</Text>
                <Text style={[styles.summaryValue, { color: Colors.negative }]}>
                  {formatCents(summary?.expense ?? 0, currency)}
                </Text>
              </View>
              <View style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>Net</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        (summary?.net ?? 0) >= 0
                          ? Colors.positive
                          : Colors.negative,
                    },
                  ]}
                >
                  {(summary?.net ?? 0) < 0 ? "-" : ""}
                  {formatCents(summary?.net ?? 0, currency)}
                </Text>
              </View>
            </View>

            {/* Category breakdown */}
            <Text style={styles.sectionLabel}>Spending by category</Text>
            {breakdown.length === 0 ? (
              <Text style={styles.emptyInline}>No spending this period.</Text>
            ) : (
              <View style={styles.breakdown}>
                {breakdown.map((s) => {
                  const Icon = categoryIcon(s.icon);
                  const pct = totalExpense > 0 ? s.amount / totalExpense : 0;
                  return (
                    <View key={s.categoryId} style={styles.catRow}>
                      <View style={styles.catIcon}>
                        <Icon size={16} color={Colors.textMuted} />
                      </View>
                      <View style={styles.catBody}>
                        <View style={styles.catTop}>
                          <Text style={styles.catName}>{s.categoryName}</Text>
                          <Text style={styles.catAmount}>
                            {formatCents(s.amount, currency)}
                          </Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${Math.max(3, pct * 100)}%` },
                            ]}
                          />
                        </View>
                        <Text style={styles.catPct}>
                          {Math.round(pct * 100)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Monthly trend */}
            <Text style={styles.sectionLabel}>Last 6 months</Text>
            <View style={styles.trend}>
              {monthly.map((m) => (
                <View key={`${m.year}-${m.month}`} style={styles.trendCol}>
                  <View style={styles.trendBars}>
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: `${(m.income / maxMonthly) * 100}%`,
                          backgroundColor: Colors.positive,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: `${(m.expense / maxMonthly) * 100}%`,
                          backgroundColor: Colors.negative,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.trendLabel}>{MONTHS[m.month]}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: Colors.positive }]}
                />
                <Text style={styles.legendText}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: Colors.negative }]}
                />
                <Text style={styles.legendText}>Expense</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  selectorWrap: {
    marginTop: 8,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  periodToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 12,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
  },
  periodBtnActive: {
    backgroundColor: Colors.card,
  },
  periodText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  periodTextActive: {
    color: Colors.text,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  rangeLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  loader: {
    marginTop: 40,
  },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  summaryCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  emptyInline: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  breakdown: {
    gap: 16,
    marginBottom: 28,
  },
  catRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 2,
  },
  catBody: {
    flex: 1,
  },
  catTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  catAmount: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cardElevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  catPct: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  trend: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    marginBottom: 12,
  },
  trendCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  trendBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  trendBar: {
    width: 10,
    borderRadius: 3,
    minHeight: 2,
  },
  trendLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 6,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 6,
    textAlign: "center",
  },
});
