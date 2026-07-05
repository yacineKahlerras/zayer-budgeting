import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Pencil,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { BalanceEditor } from "@/components/home/balance-editor";
import { Colors } from "@/constants/theme";
import {
  getPeriodSummary,
  periodRange,
  type PeriodSummary,
  type WalletWithBalance,
} from "@/db/queries";
import { currencySymbol, formatCents } from "@/utils/format";

/**
 * The balance header. Modern fintech treatment: the number floats directly on
 * the background (no card box), with the wallet switcher as a quiet pill and a
 * glanceable month in/out summary underneath. Wallets are independent ledgers
 * in their own currencies, so there is deliberately no combined "All" view.
 */
export function AccountCard({
  wallets,
  selectedWalletId,
  onSelect,
  onBalanceEdited,
}: {
  wallets: WalletWithBalance[];
  selectedWalletId: string | null;
  onSelect: (id: string) => void;
  /** Called after an inline balance edit is saved, so the screen can reload. */
  onBalanceEdited?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState<PeriodSummary | null>(null);
  const selected =
    wallets.find((w) => w.id === selectedWalletId) ?? wallets[0] ?? null;

  // This month's in/out for the selected wallet (Copilot-style glance line).
  useEffect(() => {
    // Clear immediately so a wallet switch never flashes the previous
    // wallet's numbers under the new wallet's currency symbol.
    setMonth(null);
    if (!selected?.id) return;
    let cancelled = false;
    const { start, end } = periodRange("month", new Date());
    getPeriodSummary(selected.id, start, end).then((s) => {
      if (!cancelled) setMonth(s);
    });
    return () => {
      cancelled = true;
    };
    // `wallets` is included so the glance refreshes on focus reloads.
  }, [selected?.id, wallets]);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.eyebrow}>Balance</Text>

        <Pressable
          style={styles.trigger}
          onPress={() => wallets.length > 1 && setOpen(true)}
          disabled={wallets.length <= 1}
        >
          <Text style={styles.triggerText}>{selected?.name ?? "—"}</Text>
          {wallets.length > 1 && (
            <ChevronDown size={13} color={Colors.textMuted} />
          )}
        </Pressable>
      </View>

      <View style={styles.balanceRow}>
        <Text
          style={styles.balance}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          <Text style={styles.balanceSymbol}>
            {currencySymbol(selected?.currency ?? "USD")}
          </Text>
          {formatCents(selected?.balance ?? 0, selected?.currency).slice(
            currencySymbol(selected?.currency ?? "USD").length
          )}
        </Text>
        {selected && (
          <Pressable
            hitSlop={12}
            onPress={() => setEditing(true)}
            style={styles.editBtn}
            accessibilityRole="button"
            accessibilityLabel="Edit balance"
          >
            <Pencil size={16} color={Colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Month at a glance */}
      <View style={styles.glanceRow}>
        <View style={styles.glanceItem}>
          <ArrowDownLeft size={14} color={Colors.positive} />
          <Text style={styles.glanceIn}>
            {formatCents(month?.income ?? 0, selected?.currency)}
          </Text>
        </View>
        <View style={styles.glanceItem}>
          <ArrowUpRight size={14} color={Colors.negative} />
          <Text style={styles.glanceOut}>
            {formatCents(month?.expense ?? 0, selected?.currency)}
          </Text>
        </View>
        <Text style={styles.glanceCaption}>this month</Text>
      </View>

      <View style={styles.divider} />

      {/* Inline balance editor */}
      <BalanceEditor
        wallet={selected}
        visible={editing}
        onClose={() => setEditing(false)}
        onSaved={() => onBalanceEdited?.()}
      />

      {/* Wallet picker */}
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
  wrap: {
    marginTop: 20,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerText: {
    color: Colors.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  balance: {
    flexShrink: 1,
    color: Colors.text,
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  balanceSymbol: {
    color: Colors.accent,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  glanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
  },
  glanceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  glanceIn: {
    color: Colors.positive,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  glanceOut: {
    color: Colors.negative,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  glanceCaption: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 20,
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
