import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Colors } from "@/constants/theme";
import { adjustWalletBalance, type WalletWithBalance } from "@/db/queries";
import { currencySymbol, formatCents, toCents } from "@/utils/format";

/**
 * A centered dialog for correcting a wallet's balance in place. Mirrors the
 * edit-wallet screen's honest-ledger model: instead of overwriting anything,
 * saving logs the DIFFERENCE as a "Balance adjustment" transaction (lower →
 * expense, higher → income). Reuses the app's centered-dialog treatment so it
 * feels native to the home screen it floats over.
 */
export function BalanceEditor({
  wallet,
  visible,
  onClose,
  onSaved,
}: {
  wallet: WalletWithBalance | null;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Seed the field with the current balance each time the dialog opens.
  useEffect(() => {
    if (visible && wallet) {
      setValue((wallet.balance / 100).toFixed(2));
      setSaving(false);
    }
  }, [visible, wallet]);

  if (!wallet) return null;

  const targetCents = toCents(value);
  const adjustmentCents = targetCents - wallet.balance;

  async function handleSave() {
    if (!wallet) return;
    setSaving(true);
    try {
      await adjustWalletBalance(wallet.id, targetCents);
      onSaved();
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop taps inside the card from dismissing the dialog. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.eyebrow}>Adjust balance</Text>
          <Text style={styles.walletName}>{wallet.name}</Text>

          <View style={styles.inputRow}>
            <Text style={styles.symbol}>{currencySymbol(wallet.currency)}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(t) =>
                setValue(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
              }
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
              selectTextOnFocus
            />
          </View>

          {adjustmentCents !== 0 ? (
            <Text style={styles.hint}>
              Logs a{" "}
              <Text
                style={{
                  color:
                    adjustmentCents < 0 ? Colors.negative : Colors.positive,
                  fontWeight: "700",
                }}
              >
                {adjustmentCents < 0 ? "-" : "+"}
                {formatCents(adjustmentCents, wallet.currency)}
              </Text>{" "}
              {adjustmentCents < 0 ? "expense" : "income"} to match.
            </Text>
          ) : (
            <Text style={styles.hint}>
              Set a new balance to record the difference.
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                adjustmentCents === 0 && styles.btnDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || adjustmentCents === 0}
            >
              {saving ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Text style={styles.btnPrimaryText}>Save</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
  },
  walletName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 18,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderColor: Colors.border,
  },
  symbol: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: {
    backgroundColor: Colors.cardElevated,
  },
  btnGhostText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  btnPrimary: {
    backgroundColor: Colors.accent,
  },
  btnPrimaryText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
