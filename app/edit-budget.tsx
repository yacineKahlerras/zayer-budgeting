import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmountInput } from "@/components/ui/amount-input";
import { Chip } from "@/components/ui/chip";
import { DeleteRow } from "@/components/ui/delete-row";
import { ModalHeader } from "@/components/ui/modal-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Colors } from "@/constants/theme";
import {
  addBudget,
  budgetPeriodLabel,
  deleteBudget,
  getBudget,
  listCategoryTree,
  listWallets,
  updateBudget,
  type BudgetPeriod,
  type CategoryWithSubs,
} from "@/db/queries";
import { toCents } from "@/utils/format";

// Sentinel for the "overall" (no category) budget scope.
const OVERALL = "__overall__";

const PERIOD_OPTIONS = [
  { value: "day" as const, label: "Day" },
  { value: "month" as const, label: "Month" },
  { value: "year" as const, label: "Year" },
];

export default function EditBudget() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("month");
  const [categoryId, setCategoryId] = useState<string>(OVERALL);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [categories, setCategories] = useState<CategoryWithSubs[]>([]);
  const [currencies, setCurrencies] = useState<string[]>(["USD"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load everything in one effect so there's no race over the currency: the
  // edited budget's own currency always wins and is always offered in the list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tree, wallets, budget] = await Promise.all([
        listCategoryTree("expense"),
        listWallets(),
        id ? getBudget(id) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      setCategories(tree);

      if (budget) {
        setAmount((budget.amount / 100).toFixed(2));
        setCategoryId(budget.categoryId ?? OVERALL);
        setSubcategoryId(budget.subcategoryId ?? null);
        // Custom-period budgets fall back to monthly in this editor.
        setPeriod(
          budget.period === "day" || budget.period === "year"
            ? budget.period
            : "month"
        );
      }

      // Currency options = the user's wallet currencies, plus the budget's own
      // currency (so an old budget in a no-longer-used currency stays editable).
      const walletCurrencies = wallets.map((w) => w.currency);
      const options = [
        ...new Set([...(budget ? [budget.currency] : []), ...walletCurrencies]),
      ];
      if (options.length > 0) setCurrencies(options);

      // Chosen currency: the budget's (edit) or the first available (create).
      setCurrency(budget?.currency ?? options[0] ?? "USD");

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Pick a top-level category (or Overall), clearing any subcategory refinement. */
  function selectCategory(next: string) {
    setCategoryId(next);
    setSubcategoryId(null);
  }

  /** Toggle a subcategory refinement; picking the same one again clears it. */
  function selectSubcategory(subId: string) {
    setSubcategoryId((cur) => (cur === subId ? null : subId));
  }

  const activeCategory =
    categoryId === OVERALL
      ? null
      : categories.find((c) => c.id === categoryId) ?? null;

  async function handleSave() {
    const cents = toCents(amount);
    if (cents <= 0) {
      Alert.alert("Enter an amount", "The budget must be greater than zero.");
      return;
    }
    const scoped = categoryId !== OVERALL;
    const payload = {
      name: null,
      amount: cents,
      categoryId: scoped ? categoryId : null,
      subcategoryId: scoped ? subcategoryId : null,
      period,
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
        {/* Limit */}
        <Text style={styles.label}>{budgetPeriodLabel(period)} limit</Text>
        <AmountInput
          value={amount}
          onChangeText={setAmount}
          currency={currency}
          autoFocus={!editing}
        />

        {/* Period */}
        <Text style={[styles.label, styles.section]}>Resets every</Text>
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
        />

        {/* Currency — above the categories so the money scope is set first.
            Only shown when the user has more than one currency. */}
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

        {/* Scope: category, then optional subcategory. No category = Overall. */}
        <Text style={[styles.label, styles.section]}>Applies to</Text>
        <View style={styles.chips}>
          <Chip
            label="Overall"
            selected={categoryId === OVERALL}
            onPress={() => selectCategory(OVERALL)}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={categoryId === c.id}
              onPress={() => selectCategory(c.id)}
            />
          ))}
        </View>

        {/* Subcategory refinement, only when a category with subs is chosen.
            Same chip pattern as the categories above, one nesting level in. */}
        {activeCategory && activeCategory.subs.length > 0 && (
          <>
            <Text style={[styles.label, styles.subSection]}>
              Subcategory · optional
            </Text>
            <View style={styles.chips}>
              {activeCategory.subs.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={s.id === subcategoryId}
                  onPress={() => selectSubcategory(s.id)}
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  // A refinement of "Applies to" — a gap, not a full section break.
  subSection: {
    marginTop: 16,
  },
});
