import { Check, ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";
import type { WalletWithBalance } from "@/db/queries";
import { formatCents } from "@/utils/format";

/**
 * The centered "Switch wallet" dialog on its own, for screens that provide
 * their own trigger (e.g. the add-transaction wallet row).
 */
export function WalletMenuModal({
  visible,
  wallets,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  wallets: WalletWithBalance[];
  selected: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.menu}>
          <Text style={styles.menuTitle}>Switch wallet</Text>
          {wallets.map((w, i) => {
            const active = w.id === selected;
            return (
              <Pressable
                key={w.id}
                style={[
                  styles.menuRow,
                  i === wallets.length - 1 && styles.menuRowLast,
                ]}
                onPress={() => {
                  onClose();
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
                    {formatCents(w.balance, w.currency)} · {w.currency}
                  </Text>
                </View>
                {active && <Check size={16} color={Colors.accent} />}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * A centered wallet switcher: a quiet pill trigger that opens a centered dialog
 * of wallets to pick from — the same interaction as the home balance header.
 * Shared by any screen that scopes to a single wallet (e.g. Stats).
 */
export function WalletPickerDialog({
  wallets,
  selected,
  onSelect,
}: {
  wallets: WalletWithBalance[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current =
    wallets.find((w) => w.id === selected) ?? wallets[0] ?? null;
  const canSwitch = wallets.length > 1;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.trigger}
        onPress={() => canSwitch && setOpen(true)}
        disabled={!canSwitch}
      >
        <Text style={styles.triggerText}>{current?.name ?? "—"}</Text>
        {current?.currency ? (
          <Text style={styles.triggerCurrency}>{current.currency}</Text>
        ) : null}
        {canSwitch && <ChevronDown size={14} color={Colors.textMuted} />}
      </Pressable>

      <WalletMenuModal
        visible={open}
        wallets={wallets}
        selected={current?.id ?? null}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  triggerText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  triggerCurrency: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
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
    paddingTop: 14,
    overflow: "hidden",
  },
  menuTitle: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
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
    // All wallet names read at full contrast — the ones you'd switch TO are
    // the unselected rows, so they must be legible; the accent check marks the
    // current one.
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  menuNameActive: {
    color: Colors.accent,
  },
  menuBalance: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
});
