import { StyleSheet, Text, View } from "react-native";

import { ALL_WALLETS } from "@/components/ui/wallet-selector";
import { Colors } from "@/constants/theme";
import type { WalletWithBalance } from "@/db/queries";
import { balancesByCurrency, formatCents } from "@/utils/format";

/**
 * Balance card. When a single wallet is selected it shows that wallet's balance;
 * when "All" is selected it shows one total PER CURRENCY (summing across
 * currencies would be meaningless without exchange rates).
 */
export function AccountCard({
  wallets,
  selectedWalletId,
}: {
  wallets: WalletWithBalance[];
  selectedWalletId: string;
}) {
  const isAll = selectedWalletId === ALL_WALLETS;
  const selected = wallets.find((w) => w.id === selectedWalletId);

  // Group by currency for the "All" view (can't sum mixed currencies).
  const currencyTotals = balancesByCurrency(wallets);
  const primary = isAll ? currencyTotals[0] : null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        {isAll ? "Total balance" : selected?.name ?? "Balance"}
      </Text>

      {isAll ? (
        <>
          <Text style={styles.balance}>
            {primary
              ? formatCents(primary.balance, primary.currency)
              : formatCents(0)}
          </Text>
          {currencyTotals.length > 1 ? (
            <View style={styles.otherCurrencies}>
              {currencyTotals.slice(1).map((c) => (
                <Text key={c.currency} style={styles.otherLine}>
                  {formatCents(c.balance, c.currency)}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.sub}>Across all wallets</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.balance}>
            {formatCents(selected?.balance ?? 0, selected?.currency)}
          </Text>
          <Text style={styles.sub}>{selected?.currency}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    marginTop: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
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
    fontVariant: ["tabular-nums"],
  },
  sub: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  otherCurrencies: {
    marginTop: 8,
    gap: 2,
  },
  otherLine: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
