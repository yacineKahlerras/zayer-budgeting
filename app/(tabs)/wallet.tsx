import { useFocusEffect, router } from "expo-router";
import { Plus, Wallet as WalletIcon } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Screen, ScreenTitle } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import { listWalletsWithBalances, type WalletWithBalance } from "@/db/queries";
import { formatCents } from "@/utils/format";

export default function WalletScreen() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listWalletsWithBalances().then((w) => {
        if (!cancelled) setWallets(w);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <Screen>
      <View style={styles.header}>
        <ScreenTitle>Wallets</ScreenTitle>
        <Pressable
          style={styles.addBtn}
          hitSlop={10}
          onPress={() => router.push("/edit-wallet")}
        >
          <Plus size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {wallets.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No wallets</Text>
            <Text style={styles.emptyText}>
              Tap + to add your first wallet.
            </Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {wallets.map((w, i) => (
              <Pressable
                key={w.id}
                style={[
                  styles.row,
                  i === wallets.length - 1 && styles.rowLast,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/edit-wallet",
                    params: { id: w.id },
                  })
                }
              >
                <View style={styles.icon}>
                  <WalletIcon size={18} color={Colors.textMuted} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={styles.currency}>{w.currency}</Text>
                </View>
                <Text style={styles.balance}>
                  {formatCents(w.balance, w.currency)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
  rows: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  info: {
    flex: 1,
  },
  name: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  currency: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  balance: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "700",
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
  },
});
