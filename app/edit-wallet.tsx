import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { DeleteRow } from "@/components/ui/delete-row";
import { ModalHeader } from "@/components/ui/modal-header";
import { Colors } from "@/constants/theme";
import {
  addWallet,
  adjustWalletBalance,
  deleteWallet,
  getWallet,
  getWalletBalance,
  updateWallet,
} from "@/db/queries";
import { formatCents, toCents } from "@/utils/format";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "DZD", "MAD", "TND", "SAR", "AED", "EGP"];

export default function EditWallet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  // For a NEW wallet this is the starting balance; when EDITING it is the
  // current (derived) balance — changing it logs an adjustment transaction.
  const [balance, setBalance] = useState("");
  // The balance the field was loaded with, so we only log an adjustment when
  // it actually changes.
  const [loadedBalanceCents, setLoadedBalanceCents] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [w, bal] = await Promise.all([getWallet(id), getWalletBalance(id)]);
      if (cancelled) return;
      if (w) {
        setName(w.name);
        setCurrency(w.currency);
        setBalance((bal / 100).toFixed(2));
        setLoadedBalanceCents(bal);
      }
      // Clear loading even when the wallet is missing, so we don't spin forever.
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Give the wallet a name.");
      return;
    }
    const balanceCents = toCents(balance);
    setSaving(true);
    try {
      if (editing && id) {
        // initialBalance is never edited here — the balance is changed by
        // logging the difference as a transaction, so the ledger stays honest.
        await updateWallet(id, {
          name: name.trim(),
          currency,
          initialBalance: (await getWallet(id))?.initialBalance ?? 0,
        });
        await adjustWalletBalance(id, balanceCents);
      } else {
        await addWallet({
          name: name.trim(),
          currency,
          initialBalance: balanceCents,
        });
      }
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert("Could not save", (e as Error).message);
    }
  }

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      "Delete wallet",
      "This also deletes all of its transactions. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWallet(id);
              router.back();
            } catch (e) {
              Alert.alert("Could not delete", (e as Error).message);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  // The transaction that saving would log: target − loaded balance.
  const adjustmentCents = toCents(balance) - loadedBalanceCents;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ModalHeader
        title={editing ? "Edit wallet" : "New wallet"}
        onCancel={() => router.back()}
        onSave={handleSave}
        saving={saving}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Cash, Savings"
            placeholderTextColor={Colors.textMuted}
            autoFocus={!editing}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Currency</Text>
          <View style={styles.chips}>
            {CURRENCIES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={c === currency}
                onPress={() => setCurrency(c)}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            {editing ? "Current balance" : "Starting balance"}
          </Text>
          <TextInput
            style={styles.input}
            value={balance}
            onChangeText={(t) =>
              setBalance(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
            }
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad"
          />
          {editing ? (
            adjustmentCents !== 0 ? (
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
                  {formatCents(adjustmentCents, currency)}
                </Text>{" "}
                {adjustmentCents < 0 ? "expense" : "income"} to match.
              </Text>
            ) : (
              <Text style={styles.hint}>
                Change it to record an adjustment transaction for the
                difference.
              </Text>
            )
          ) : (
            <Text style={styles.hint}>
              The balance before any transactions are recorded.
            </Text>
          )}
        </View>

        {editing && <DeleteRow label="Delete wallet" onPress={handleDelete} />}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 22,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
