import { router, useLocalSearchParams } from "expo-router";
import { Check, ChevronDown, ChevronRight, Wallet } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
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
import { categoryIcon } from "@/utils/category-icon";
import { toCents } from "@/utils/format";

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  /** The scope picker is collapsed by default; the summary row opens it. */
  const [categoryListOpen, setCategoryListOpen] = useState(false);
  /** Which category's subcategory dropdown is unfolded. */
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
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
        // Reveal the picker up front when editing a scoped budget, with the
        // chosen category's subcategory dropdown unfolded — same as editing a
        // categorized transaction.
        if (budget.categoryId) {
          setCategoryListOpen(true);
          setOpenCategoryId(budget.categoryId);
        }
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

  /** Fold/unfold the whole scope picker. */
  function toggleCategoryList() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryListOpen((v) => !v);
  }

  /** Cap all spending: no category, no subcategory, fold any open dropdown. */
  function selectOverall() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryId(OVERALL);
    setSubcategoryId(null);
    setOpenCategoryId(null);
  }

  /** Tapping a category selects it outright (no subcategory needed) and
   *  reveals its subcategories to optionally refine. Tapping the selected
   *  category again just folds/unfolds its subcategory list. */
  function selectCategory(catId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (categoryId === catId) {
      setOpenCategoryId((cur) => (cur === catId ? null : catId));
      return;
    }
    setCategoryId(catId);
    setSubcategoryId(null);
    setOpenCategoryId(catId);
  }

  /** Tapping a subcategory refines the selection; tapping it again clears the
   *  refinement but keeps the category. */
  function selectSubcategory(catId: string, subId: string) {
    setCategoryId(catId);
    setSubcategoryId((cur) => (cur === subId ? null : subId));
  }

  /** Name shown in the collapsed summary: subcategory > category > Overall. */
  const selectionName = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    const sub = cat?.subs.find((s) => s.id === subcategoryId);
    return sub?.name ?? cat?.name ?? "Overall";
  }, [categories, categoryId, subcategoryId]);

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

        {/* Scope — collapsed by default; the summary row opens the picker.
            Same rows-and-dropdown pattern as the add-transaction screen, plus
            an "Overall" row. No category = overall cap. */}
        <Text style={[styles.label, styles.section]}>Applies to</Text>
        <Pressable style={styles.categorySummary} onPress={toggleCategoryList}>
          <Text style={styles.categorySummaryText} numberOfLines={1}>
            {selectionName}
          </Text>
          <ChevronDown
            size={18}
            color={Colors.textMuted}
            style={{
              transform: [{ rotate: categoryListOpen ? "180deg" : "0deg" }],
            }}
          />
        </Pressable>

        {categoryListOpen && (
          <View style={styles.rows}>
            {/* Overall — cap across all categories */}
            <Pressable style={styles.catRow} onPress={selectOverall}>
              <View
                style={[
                  styles.catIcon,
                  categoryId === OVERALL && styles.catIconSelected,
                ]}
              >
                <Wallet
                  size={17}
                  color={
                    categoryId === OVERALL ? Colors.accent : Colors.textMuted
                  }
                />
              </View>
              <Text
                style={[
                  styles.catName,
                  categoryId === OVERALL && styles.catNameSelected,
                ]}
              >
                Overall
              </Text>
              {categoryId === OVERALL && (
                <Check size={16} color={Colors.accent} />
              )}
            </Pressable>

            {categories.map((c, i) => {
              const Icon = categoryIcon(c.icon);
              const isLast = i === categories.length - 1;
              const isOpen = c.id === openCategoryId;
              const isSelected = c.id === categoryId;
              return (
                <View key={c.id}>
                  <Pressable
                    style={[
                      styles.catRow,
                      isLast && !isOpen && styles.catRowLast,
                    ]}
                    onPress={() => selectCategory(c.id)}
                  >
                    <View
                      style={[
                        styles.catIcon,
                        isSelected && styles.catIconSelected,
                      ]}
                    >
                      <Icon
                        size={17}
                        color={isSelected ? Colors.accent : Colors.textMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.catName,
                        isSelected && styles.catNameSelected,
                      ]}
                    >
                      {c.name}
                    </Text>
                    {isSelected && <Check size={16} color={Colors.accent} />}
                    {c.subs.length > 0 && (
                      <ChevronRight
                        size={16}
                        color={Colors.textMuted}
                        style={{
                          transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
                        }}
                      />
                    )}
                  </Pressable>

                  {/* Subcategories as slim indented rows */}
                  {isOpen && (
                    <View style={styles.subList}>
                      {c.subs.map((s, si) => {
                        const subSelected = s.id === subcategoryId;
                        return (
                          <Pressable
                            key={s.id}
                            style={[
                              styles.subRow,
                              si === c.subs.length - 1 && styles.subRowLast,
                            ]}
                            onPress={() => selectSubcategory(c.id, s.id)}
                          >
                            <Text
                              style={[
                                styles.subName,
                                subSelected && styles.subNameSelected,
                              ]}
                            >
                              {s.name}
                            </Text>
                            {subSelected && (
                              <Check size={15} color={Colors.accent} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
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

  /* Scope picker — mirrors the add-transaction category picker */
  categorySummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  categorySummaryText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "600",
    color: Colors.text,
  },
  rows: {
    marginTop: 8,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  catRowLast: {
    borderBottomWidth: 0,
  },
  catIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catIconSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardElevated,
  },
  catName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "500",
    color: Colors.textMuted,
  },
  catNameSelected: {
    color: Colors.text,
  },
  subList: {
    marginLeft: 47,
    marginBottom: 8,
    borderLeftWidth: 1,
    borderColor: Colors.border,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  subRowLast: {
    borderBottomWidth: 0,
  },
  subName: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  subNameSelected: {
    color: Colors.text,
    fontWeight: "600",
  },
});
