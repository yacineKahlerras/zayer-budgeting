import { StyleSheet, Text, View } from "react-native";

import { account } from "@/constants/mock-data";
import { Colors } from "@/constants/theme";
import { formatCurrency } from "@/utils/format";

/** The balance card shown at the top of the home screen. */
export function AccountCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.holder}>{account.holder}</Text>
      <Text style={styles.balance}>{formatCurrency(account.balance)}</Text>
      <Text style={styles.balanceLabel}>Available balance</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
