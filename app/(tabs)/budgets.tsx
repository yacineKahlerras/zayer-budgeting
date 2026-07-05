import { router, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen, ScreenTitle } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import {
  budgetPeriodLabel,
  listBudgetsWithProgress,
  type BudgetWithProgress,
} from "@/db/queries";
import { categoryIcon } from "@/utils/category-icon";
import { formatCents } from "@/utils/format";

export default function BudgetsScreen() {
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listBudgetsWithProgress(new Date()).then((b) => {
        if (!cancelled) setBudgets(b);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <ScreenTitle>Budgets</ScreenTitle>
          <Text style={styles.subtitle}>Spending limits</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          hitSlop={10}
          onPress={() => router.push("/edit-budget")}
        >
          <Plus size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {budgets.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptyText}>
              Set a monthly limit for a category to track your spending.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function BudgetCard({ budget: b }: { budget: BudgetWithProgress }) {
  const Icon = categoryIcon(b.icon);
  const pct = b.amount > 0 ? Math.min(1, b.spent / b.amount) : 0;
  const over = b.spent > b.amount;
  const barColor = over
    ? Colors.negative
    : pct > 0.85
      ? "#F59E0B"
      : Colors.accent;
  // Most specific scope wins: subcategory > category > custom name > "Overall".
  const label =
    b.subcategoryName ?? b.categoryName ?? b.name ?? "Overall";
  // Meta carries context the title dropped: when the title is a subcategory,
  // lead with its parent category so "Restaurant" reads as "Food · …".
  const parentContext =
    b.subcategoryName && b.categoryName ? `${b.categoryName} · ` : "";
  const periodLabel = budgetPeriodLabel(b.period);

  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({ pathname: "/edit-budget", params: { id: b.id } })
      }
    >
      <View style={styles.cardTop}>
        <View style={styles.cardLeft}>
          <View style={styles.icon}>
            <Icon size={16} color={Colors.textMuted} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardName}>{label}</Text>
            <Text style={styles.cardMeta}>
              {parentContext}
              {periodLabel} · {b.currency}
            </Text>
          </View>
        </View>
        <Text style={[styles.cardRemaining, over && { color: Colors.negative }]}>
          {over
            ? `${formatCents(b.spent - b.amount, b.currency)} over`
            : `${formatCents(b.remaining, b.currency)} left`}
        </Text>
      </View>

      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${Math.max(2, pct * 100)}%`, backgroundColor: barColor },
          ]}
        />
      </View>

      <Text style={styles.cardFooter}>
        {formatCents(b.spent, b.currency)} of {formatCents(b.amount, b.currency)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitleWrap: {
    flexShrink: 1,
  },
  cardName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  cardMeta: {
    color: Colors.textMuted,
    fontSize: 11.5,
    marginTop: 1,
  },
  cardRemaining: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.cardElevated,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  cardFooter: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
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
    paddingHorizontal: 20,
  },
});
