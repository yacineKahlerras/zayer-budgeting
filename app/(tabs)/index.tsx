import { router, useFocusEffect } from "expo-router";
import { Plus, Search, Settings } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AccountCard } from "@/components/home/account-card";
import { TransactionList } from "@/components/home/transaction-list";
import { Screen } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import { listWalletsWithBalances, type WalletWithBalance } from "@/db/queries";

export default function HomeScreen() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  // Bumped after an inline balance edit to refetch the balance header and the
  // transaction list (which don't blur/refocus, so focus effects won't re-run).
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    listWalletsWithBalances().then((w) => {
      setWallets(w);
      // Keep the current selection if it still exists; else the first wallet.
      setSelected((cur) =>
        cur && w.some((x) => x.id === cur) ? cur : w[0]?.id ?? null
      );
    });
  }, []);

  const handleBalanceEdited = useCallback(() => {
    reload();
    setRefreshKey((k) => k + 1);
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function handleAdd() {
    router.push(
      selected
        ? { pathname: "/add-transaction", params: { walletId: selected } }
        : "/add-transaction"
    );
  }

  return (
    <Screen>
      <Pressable onPress={handleAdd} style={styles.fab}>
        <Plus color={Colors.background} />
      </Pressable>

      <TransactionList
        walletId={selected ?? undefined}
        refreshKey={refreshKey}
        header={
          <View>
            <View style={styles.topBar}>
              <Text style={styles.appTitle}>Zayer</Text>
              <View style={styles.topActions}>
                <Pressable hitSlop={10} onPress={() => router.push("/search")}>
                  <Search size={22} color={Colors.textMuted} />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => router.push("/settings")}>
                  <Settings size={22} color={Colors.textMuted} />
                </Pressable>
              </View>
            </View>
            <AccountCard
              wallets={wallets}
              selectedWalletId={selected}
              onSelect={setSelected}
              onBalanceEdited={handleBalanceEdited}
            />
            <Text style={styles.sectionTitle}>Transactions</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 4,
  },
  appTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 50,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
