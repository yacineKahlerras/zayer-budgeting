import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
  account,
  dateFor,
  getTransactions,
  iconFor,
  type Transaction,
} from "@/constants/mock-data";

const PAGE_SIZE = 20;

type DaySection = {
  /** ISO-ish key like "2026-5-28" */
  key: string;
  dayLabel: string;
  /** Month banner to show above this day, or null if same month as the day before */
  monthBanner: string | null;
  data: Transaction[];
};

const DAY_FMT: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};
const MONTH_FMT: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" };

function formatCurrency(amount: number) {
  return `$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Group a flat, date-descending list into day sections with month banners. */
function groupByDay(txns: Transaction[]): DaySection[] {
  const sections: DaySection[] = [];
  let lastMonthKey: string | null = null;

  for (const t of txns) {
    const d = dateFor(t.daysAgo);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;

    let section = sections[sections.length - 1];
    if (!section || section.key !== dayKey) {
      const monthBanner =
        monthKey !== lastMonthKey ? d.toLocaleDateString("en-US", MONTH_FMT) : null;
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

function AccountCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.holder}>{account.holder}</Text>
      <Text style={styles.balance}>{formatCurrency(account.balance)}</Text>
      <Text style={styles.balanceLabel}>Available balance</Text>
    </View>
  );
}

function TransactionRow({ item }: { item: Transaction }) {
  const isIncome = item.amount >= 0;
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{iconFor(item.type)}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <Text style={styles.rowMeta}>{item.type}</Text>
      </View>
      <Text
        style={[
          styles.rowAmount,
          { color: isIncome ? Colors.positive : Colors.text },
        ]}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(item.amount)}
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const [items, setItems] = useState<Transaction[]>(() =>
    getTransactions(0, PAGE_SIZE)
  );
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const sections = useMemo(() => groupByDay(items), [items]);

  const loadMore = useCallback(() => {
    if (loading || done) return;
    setLoading(true);
    const next = page + 1;
    const batch = getTransactions(next, PAGE_SIZE);
    if (batch.length === 0) {
      setDone(true);
    } else {
      setItems((prev) => [...prev, ...batch]);
      setPage(next);
    }
    setLoading(false);
  }, [loading, done, page]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow item={item} />}
        renderSectionHeader={({ section }) => (
          <View>
            {section.monthBanner && (
              <Text style={styles.monthBanner}>{section.monthBanner}</Text>
            )}
            <Text style={styles.dayHeader}>{section.dayLabel}</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <AccountCard />
            <Text style={styles.sectionTitle}>Transactions</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color={Colors.textMuted} style={styles.footer} />
          ) : done ? (
            <Text style={styles.endText}>No more transactions</Text>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    marginTop: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  holder: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
  },
  balance: {
    color: Colors.text,
    fontSize: 40,
    fontWeight: "800",
    marginTop: 8,
    letterSpacing: -1,
  },
  balanceLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  monthBanner: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 4,
  },
  dayHeader: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardElevated,
  },
  icon: {
    fontSize: 20,
  },
  rowInfo: {
    flex: 1,
    marginLeft: 14,
  },
  rowName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  rowMeta: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    marginVertical: 20,
  },
  endText: {
    color: Colors.textMuted,
    textAlign: "center",
    marginVertical: 20,
    fontSize: 13,
  },
});
