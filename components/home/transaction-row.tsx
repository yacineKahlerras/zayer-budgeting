import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import type { TransactionListItem } from "@/db/queries";
import { formatCents } from "@/utils/format";

/** A single transaction line: direction icon, title/category, signed amount. */
export function TransactionRow({ item }: { item: TransactionListItem }) {
  const isIncome = item.amount >= 0;
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        {isIncome ? (
          <ArrowDownLeft size={20} color={Colors.positive} />
        ) : (
          <ArrowUpRight size={20} color={Colors.textMuted} />
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.title}</Text>
        <Text style={styles.rowMeta}>{item.categoryName}</Text>
      </View>
      <Text
        style={[
          styles.rowAmount,
          { color: isIncome ? Colors.positive : Colors.text },
        ]}
      >
        {isIncome ? "+" : "-"}
        {formatCents(item.amount)}
      </Text>
    </View>
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
});
