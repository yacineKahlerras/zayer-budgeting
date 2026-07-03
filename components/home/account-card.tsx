import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import { getTotalBalance } from "@/db/queries";
import { formatCents } from "@/utils/format";

/** The balance card shown at the top of the home screen. */
export function AccountCard() {
  const [balance, setBalance] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTotalBalance().then((b) => {
        if (!cancelled) setBalance(b);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <View style={styles.card}>
      <Text style={styles.holder}>Total balance</Text>
      <Text style={styles.balance}>{formatCents(balance)}</Text>
      <Text style={styles.balanceLabel}>Across all wallets</Text>
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
