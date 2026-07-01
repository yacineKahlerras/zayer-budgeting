import { StyleSheet, Text, View } from "react-native";

import { iconFor, type Transaction } from "@/constants/mock-data";
import { Colors } from "@/constants/theme";
import { formatCurrency } from "@/utils/format";

/** A single transaction line: icon, name/type, and signed amount. */
export function TransactionRow({ item }: { item: Transaction }) {
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
});
