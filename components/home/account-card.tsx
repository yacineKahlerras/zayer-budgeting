import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import type { WalletWithBalance } from "@/db/queries";
import { formatCents } from "@/utils/format";

/**
 * Balance card for the selected wallet, with a sleek dropdown on the card to
 * switch wallets. Wallets are independent ledgers in their own currencies, so
 * there is deliberately no combined "All" view.
 */
export function AccountCard({
  wallets,
  selectedWalletId,
  onSelect,
}: {
  wallets: WalletWithBalance[];
  selectedWalletId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected =
    wallets.find((w) => w.id === selectedWalletId) ?? wallets[0] ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Balance</Text>

      <View style={styles.balanceRow}>
        <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
          {formatCents(selected?.balance ?? 0, selected?.currency)}
        </Text>

        {/* Wallet dropdown trigger */}
        <Pressable
          style={styles.trigger}
          onPress={() => wallets.length > 1 && setOpen(true)}
          disabled={wallets.length <= 1}
        >
          <Text style={styles.triggerText}>{selected?.name ?? "—"}</Text>
          {wallets.length > 1 && (
            <ChevronDown size={14} color={Colors.textMuted} />
          )}
        </Pressable>
      </View>

      <Text style={styles.sub}>{selected?.currency ?? ""}</Text>

      {/* Dropdown menu */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {wallets.map((w, i) => {
              const active = w.id === selected?.id;
              return (
                <Pressable
                  key={w.id}
                  style={[
                    styles.menuRow,
                    i === wallets.length - 1 && styles.menuRowLast,
                  ]}
                  onPress={() => {
                    setOpen(false);
                    onSelect(w.id);
                  }}
                >
                  <View style={styles.menuInfo}>
                    <Text
                      style={[styles.menuName, active && styles.menuNameActive]}
                    >
                      {w.name}
                    </Text>
                    <Text style={styles.menuBalance}>
                      {formatCents(w.balance, w.currency)}
                    </Text>
                  </View>
                  {active && <Check size={16} color={Colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
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
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },
  balance: {
    flex: 1,
    color: Colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  sub: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  menu: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuInfo: {
    flex: 1,
  },
  menuName: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  menuNameActive: {
    color: Colors.text,
  },
  menuBalance: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
});
