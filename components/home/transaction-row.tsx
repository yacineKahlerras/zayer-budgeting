import { router } from "expo-router";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import type { TransactionListItem } from "@/db/queries";
import { formatCents, monthShort } from "@/utils/format";

/** A single transaction line. Tapping it opens the transaction for editing. */
export function TransactionRow({ item }: { item: TransactionListItem }) {
  const isIncome = item.amount >= 0;
  // Don't repeat the category when the title already IS the category (a
  // category-only transaction with no custom title).
  const metaParts = [
    ...(item.categoryName !== item.title ? [item.categoryName] : []),
    ...(item.note ? [item.note] : []),
  ];
  const meta = metaParts.join(" · ");
  const dateLabel = `${monthShort(item.date.getMonth())} ${item.date.getDate()}`;

  return (
    <Pressable
      style={styles.row}
      onPress={() =>
        router.push({ pathname: "/add-transaction", params: { id: item.id } })
      }
    >
      <View style={styles.iconCircle}>
        {isIncome ? (
          <ArrowDownLeft size={20} color={Colors.positive} />
        ) : (
          <ArrowUpRight size={20} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.title}
        </Text>
        {meta.length > 0 && (
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.rowAmount,
            { color: isIncome ? Colors.positive : Colors.text },
          ]}
        >
          {isIncome ? "+" : "-"}
          {formatCents(item.amount, item.currency)}
        </Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  rowInfo: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
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
  rowRight: {
    alignItems: "flex-end",
  },
  rowAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  rowDate: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});
