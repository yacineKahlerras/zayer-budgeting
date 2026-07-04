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
  addBudget,
  deleteBudget,
  getBudget,
  listCategoryTree,
  listWallets,
  updateBudget,
  type CategoryWithSubs,
} from "@/db/queries";
import { currencySymbol, toCents } from "@/utils/format";

// Sentinel for the "overall" (no category) budget scope.
const OVERALL = "__overall__";

export default function EditBudget() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>(OVERALL);
  const [currency, setCurrency] = useState("USD");
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(["USD"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load expense categories + the set of currencies the user actually has.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tree, wallets] = await Promise.all([
        listCategoryTree("expense"),
        listWallets(),
      ]);
      if (cancelled) return;
      setCategories(tree);
      const uniqueCurrencies = [...new Set(wallets.map((w) => w.currency))];
      if (uniqueCurrencies.length > 0) {
        setCurrencies(uniqueCurrencies);
        setCurrency((c) => (uniqueCurrencies.includes(c) ? c : uniqueCurrencies[0]));
      }
      if (!id) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Edit mode: load the budget.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getBudget(id).then((b) => {
      if (cancelled) return;
      if (b) {
        setAmount((b.amount / 100).toFixed(2));
        setCategoryId(b.categoryId ?? OVERALL);
        setCurrency(b.currency);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    const cents = toCents(amount);
    if (cents <= 0) {
      Alert.alert("Enter an amount", "The budget must be greater than zero.");
      return;
    }
    const payload = {
      name: null,
      amount: cents,
      categoryId: categoryId === OVERALL ? null : categoryId,
      currency,
    };
    setSaving(true);
    try {
      if (editing && id) await updateBudget(id, payload);
      else await addBudget(payload);
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert("Could not save", (e as Error).message);
    }
  }

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      "Delete budget",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBudget(id);
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
        title={editing ? "Edit budget" : "New budget"}
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
        {/* Monthly limit */}
        <Text style={styles.label}>Monthly limit</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountCurrency}>{currencySymbol(currency)}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={(t) =>
              setAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
            }
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={Colors.textMuted}
            autoFocus={!editing}
          />
        </View>

        {/* Scope */}
        <Text style={[styles.label, styles.section]}>Applies to</Text>
        <View style={styles.chips}>
          <Chip
            label="Overall"
            selected={categoryId === OVERALL}
            onPress={() => setCategoryId(OVERALL)}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => setCategoryId(c.id)}
            />
          ))}
        </View>

        {/* Currency (only when the user has more than one) */}
        {currencies.length > 1 && (
          <>
            <Text style={[styles.label, styles.section]}>Currency</Text>
            <View style={styles.chips}>
              {currencies.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={currency === c}
                  onPress={() => setCurrency(c)}
                />
              ))}
            </View>
          </>
        )}

        {editing && <DeleteRow label="Delete budget" onPress={handleDelete} />}
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
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 8,
  },
  section: {
    marginTop: 28,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  amountCurrency: {
    fontSize: 32,
    color: Colors.textMuted,
    fontWeight: "500",
    marginRight: 2,
  },
  amountInput: {
    flex: 1,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: Colors.text,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
