import { router, useFocusEffect } from "expo-router";
import { Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AccountCard } from "@/components/home/account-card";
import { TransactionList } from "@/components/home/transaction-list";
import { Screen } from "@/components/ui/screen";
import {
  ALL_WALLETS,
  WalletSelector,
} from "@/components/ui/wallet-selector";
import { Colors } from "@/constants/theme";
import { listWalletsWithBalances, type WalletWithBalance } from "@/db/queries";

export default function HomeScreen() {
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [selected, setSelected] = useState<string>(ALL_WALLETS);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listWalletsWithBalances().then((w) => {
        if (cancelled) return;
        setWallets(w);
        // With a single wallet there's no "All" vs "one" distinction — scope to
        // that wallet so the card shows its name/currency, not "Total balance".
        if (w.length === 1) setSelected(w[0].id);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const walletFilter = selected === ALL_WALLETS ? undefined : selected;

  function handleAdd() {
    // Pre-select the current wallet in the new-transaction form.
    router.push(
      walletFilter
        ? { pathname: "/add-transaction", params: { walletId: walletFilter } }
        : "/add-transaction"
    );
  }

  return (
    <Screen>
      <Pressable onPress={handleAdd} style={styles.fab}>
        <Plus color={Colors.background} />
      </Pressable>

      <TransactionList
        walletId={walletFilter}
        header={
          <View>
            {wallets.length > 1 && (
              <View style={styles.selectorWrap}>
                <WalletSelector
                  wallets={wallets}
                  selected={selected}
                  onSelect={setSelected}
                />
              </View>
            )}
            <AccountCard wallets={wallets} selectedWalletId={selected} />
            <Text style={styles.sectionTitle}>Transactions</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectorWrap: {
    marginHorizontal: -20,
    marginTop: 4,
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
