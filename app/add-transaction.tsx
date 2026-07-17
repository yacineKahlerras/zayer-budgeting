import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Minus,
  Plus,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AmountInput } from "@/components/ui/amount-input";
import { DeleteRow } from "@/components/ui/delete-row";
import { ModalHeader } from "@/components/ui/modal-header";
import { WalletMenuModal } from "@/components/ui/wallet-picker-dialog";
import { Colors } from "@/constants/theme";
import {
  addTransaction,
  deleteTransaction,
  getTransaction,
  listCategoryTree,
  listWalletsWithBalances,
  updateTransaction,
  type CategoryWithSubs,
  type WalletWithBalance,
} from "@/db/queries";
import { categoryIcon } from "@/utils/category-icon";
import { monthShort, toCents } from "@/utils/format";

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Direction = "expense" | "income";

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(d: Date) {
  const label = `${monthShort(d.getMonth())} ${d.getDate()}`;
  return isSameDay(d, new Date()) ? `Today · ${label}` : label;
}

export default function AddTransaction() {
  const { id, walletId: presetWalletId } = useLocalSearchParams<{
    id?: string;
    walletId?: string;
  }>();
  const editing = !!id;

  const [direction, setDirection] = useState<Direction>("expense");
  const [amount, setAmount] = useState("");
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);
  const [walletIndex, setWalletIndex] = useState(0);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [tree, setTree] = useState<CategoryWithSubs[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  /** The whole category picker is collapsed by default; the summary row opens it. */
  const [categoryListOpen, setCategoryListOpen] = useState(false);
  /** Selected category — valid on its own, no subcategory required. */
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const amountInputRef = useRef<TextInput>(null);

  // Load wallets once — they don't depend on direction. In create mode,
  // preselect the wallet passed from the home screen (if any).
  useEffect(() => {
    let cancelled = false;
    listWalletsWithBalances().then((w) => {
      if (cancelled) return;
      setWallets(w);
      if (!id && presetWalletId) {
        const i = w.findIndex((x) => x.id === presetWalletId);
        if (i >= 0) setWalletIndex(i);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, presetWalletId]);

  // Load the category tree for the current direction.
  useEffect(() => {
    let cancelled = false;
    listCategoryTree(direction).then((t) => {
      if (cancelled) return;
      setTree(t);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [direction]);

  // The edited transaction's wallet id, captured during prefill so we can map
  // it to an index once wallets load — without a second DB read, and without
  // re-applying it later (which would clobber a manual wallet change).
  const pendingWalletId = useRef<string | null>(null);

  // In edit mode, load the transaction once and prefill the form. Setting
  // `direction` here re-runs the category effect but does NOT clear the
  // category, because the reset only happens in the toggle handler below.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getTransaction(id).then((tx) => {
      if (cancelled || !tx) return;
      setDirection(tx.direction);
      setAmount((tx.amount / 100).toFixed(2));
      setCategoryId(tx.categoryId);
      setSubcategoryId(tx.subcategoryId);
      setTitle(tx.title ?? "");
      setMemo(tx.note ?? "");
      setDate(tx.date);
      // Reveal the picker up front when editing something already categorized,
      // and open its subcategory group so the current choice is visible.
      if (tx.categoryId || tx.subcategoryId) {
        setCategoryListOpen(true);
        setOpenCategoryId(tx.categoryId);
      }
      if (tx.note || tx.title) setExpanded(true);
      pendingWalletId.current = tx.walletId;
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Apply the pending wallet selection exactly once, when wallets are ready.
  useEffect(() => {
    if (!pendingWalletId.current || wallets.length === 0) return;
    const wi = wallets.findIndex((x) => x.id === pendingWalletId.current);
    if (wi >= 0) setWalletIndex(wi);
    pendingWalletId.current = null; // consume it — never re-apply
  }, [wallets]);

  // Legacy rows (created before the categoryId column) only carry a
  // subcategoryId; derive the parent category once the tree is loaded.
  useEffect(() => {
    if (categoryId || !subcategoryId || tree.length === 0) return;
    const parent = tree.find((c) =>
      c.subs.some((s) => s.id === subcategoryId)
    );
    if (parent) setCategoryId(parent.id);
  }, [tree, categoryId, subcategoryId]);

  /** Switch direction AND clear the (now-invalid) category selection. Only the
   *  user's toggle triggers this — prefilling direction must not clear it. */
  function selectDirection(next: Direction) {
    if (next === direction) return;
    setDirection(next);
    setCategoryListOpen(false);
    setOpenCategoryId(null);
    setCategoryId(null);
    setSubcategoryId(null);
  }

  /** Fold/unfold the whole category picker. */
  function toggleCategoryList() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryListOpen((v) => !v);
  }

  const wallet = wallets[walletIndex] ?? null;

  /** Name shown as the title placeholder: subcategory > category. */
  const selectionName = useMemo(() => {
    const cat = tree.find((c) => c.id === categoryId);
    const sub = cat?.subs.find((s) => s.id === subcategoryId);
    return sub?.name ?? cat?.name ?? null;
  }, [tree, categoryId, subcategoryId]);

  function toggleExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
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

  /** Tapping a subcategory refines the selection and collapses the whole picker
   *  (the choice is final). Tapping the already-selected subcategory clears the
   *  refinement but keeps the category, and leaves the picker open to re-pick. */
  function selectSubcategory(catId: string, subId: string) {
    setCategoryId(catId);
    if (subcategoryId === subId) {
      // Toggling the current refinement off — stay open to choose another.
      setSubcategoryId(null);
      return;
    }
    setSubcategoryId(subId);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCategoryListOpen(false);
  }

  /** Open the wallet dialog — even with a single wallet, so the choice is
   *  always visible rather than a blind tap-to-cycle. */
  function openWalletMenu() {
    if (wallets.length === 0) return;
    setWalletMenuOpen(true);
  }

  function selectWallet(id: string) {
    const i = wallets.findIndex((w) => w.id === id);
    if (i >= 0) setWalletIndex(i);
  }

  async function handleSave() {
    const cents = toCents(amount);
    if (cents <= 0) {
      Alert.alert("Enter an amount", "The amount must be greater than zero.");
      return;
    }
    if (!wallet) {
      Alert.alert("No wallet", "Add a wallet first.");
      return;
    }
    // Store only a genuine user-entered title. Display fallbacks (subcategory
    // name, or "Income"/"Expense" when uncategorized) are computed at read time
    // so they can never go stale when the transaction is later edited.
    const payload = {
      walletId: wallet.id,
      categoryId: categoryId ?? null,
      subcategoryId: subcategoryId ?? null,
      amount: cents,
      direction,
      title: title.trim() || null,
      note: memo.trim() || null,
      date,
    };
    setSaving(true);
    try {
      if (editing && id) {
        await updateTransaction(id, payload);
      } else {
        await addTransaction(payload);
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
      "Delete transaction",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(id);
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
        title={editing ? "Edit transaction" : "New transaction"}
        onCancel={() => router.back()}
        onSave={handleSave}
        saving={saving}
      />

      <KeyboardAwareScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {/* Amount on the left; vertical + / − direction stack on the right */}
        <View style={styles.amountSection}>
          <Pressable
            style={styles.amountBlock}
            onPress={() => amountInputRef.current?.focus()}
          >
            <Text style={styles.amountLabel}>Amount</Text>
            <AmountInput
              ref={amountInputRef}
              value={amount}
              onChangeText={setAmount}
              currency={wallet?.currency ?? "USD"}
              autoFocus
            />
          </Pressable>

          {/* Single toggle: tap to flip Expense ↔ Income. Vertically centered
              beside the amount, well away from the header's confirm button. */}
          <Pressable
            style={styles.directionStack}
            hitSlop={8}
            onPress={() =>
              selectDirection(direction === "expense" ? "income" : "expense")
            }
          >
            <View
              style={[
                styles.dirBtn,
                direction === "expense"
                  ? styles.dirBtnExpense
                  : styles.dirBtnIncome,
              ]}
            >
              {direction === "expense" ? (
                <Minus size={20} color={Colors.negative} />
              ) : (
                <Plus size={20} color={Colors.positive} />
              )}
            </View>
            <Text
              style={[
                styles.dirTagText,
                {
                  color:
                    direction === "expense" ? Colors.negative : Colors.positive,
                },
              ]}
            >
              {direction === "expense" ? "Expense" : "Income"}
            </Text>
          </Pressable>
        </View>

        {/* Wallet — opens the wallet dialog, like the home balance header */}
        <Pressable style={styles.walletRow} onPress={openWalletMenu}>
          <Text style={styles.walletKey}>Wallet</Text>
          <View style={styles.walletValue}>
            <Text style={styles.walletValueText}>
              {wallet ? `${wallet.name} · ${wallet.currency}` : "—"}
            </Text>
            <ChevronDown size={14} color={Colors.textMuted} />
          </View>
        </Pressable>

        {/* Category — collapsed by default; the summary row opens the picker,
            and subcategories optionally refine the chosen category. */}
        <Text style={styles.sectionLabel}>Category · optional</Text>
        <Pressable style={styles.categorySummary} onPress={toggleCategoryList}>
          <Text
            style={[
              styles.categorySummaryText,
              selectionName && styles.categorySummaryTextSelected,
            ]}
            numberOfLines={1}
          >
            {selectionName ?? "Choose category"}
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
        <ScrollView
          style={styles.rows}
          contentContainerStyle={styles.rowsContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tree.map((c, i) => {
            const Icon = categoryIcon(c.icon);
            const isLast = i === tree.length - 1;
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
                  {isSelected && (
                    <Check size={16} color={Colors.accent} />
                  )}
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
        </ScrollView>
        )}

        {/* More options */}
        <Pressable style={styles.moreRow} onPress={toggleExpanded}>
          <Text style={styles.moreText}>More options</Text>
          <ChevronDown
            size={18}
            color={Colors.textMuted}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </Pressable>

        {expanded && (
          <View style={styles.advanced}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.fieldInput}
                value={title}
                onChangeText={setTitle}
                placeholder={selectionName ?? "Title"}
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Memo</Text>
              <TextInput
                style={styles.fieldInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="Add a note…"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date</Text>
              <Pressable
                style={styles.fieldInputRow}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(date)}</Text>
                <Calendar size={16} color={Colors.textMuted} />
              </Pressable>
            </View>
          </View>
        )}

        {editing && (
          <DeleteRow label="Delete transaction" onPress={handleDelete} />
        )}
      </KeyboardAwareScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          maximumDate={new Date()}
          onChange={(event, selected) => {
            // Android fires once then closes; iOS stays until dismissed.
            setShowDatePicker(Platform.OS === "ios");
            if (event.type === "set" && selected) setDate(selected);
          }}
        />
      )}

      <WalletMenuModal
        visible={walletMenuOpen}
        wallets={wallets}
        selected={wallet?.id ?? null}
        onSelect={selectWallet}
        onClose={() => setWalletMenuOpen(false)}
      />
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
    // No large tail padding here: extra scroll room lets the category list's
    // over-scroll drag the whole form up and hide the amount. The breathing
    // room lives on the bottom section (`moreRow`/`advanced`) instead.
    paddingBottom: 24,
  },

  amountSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    // Keep the direction toggle clearly below the header's confirm button.
    marginTop: 16,
    marginBottom: 6,
  },
  directionStack: {
    alignItems: "center",
    gap: 6,
  },
  dirBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  dirBtnExpense: {
    borderColor: Colors.negative,
    backgroundColor: "#2E1A1A",
  },
  dirBtnIncome: {
    borderColor: Colors.positive,
    backgroundColor: "#0F2E24",
  },
  dirTagText: {
    fontSize: 11,
    fontWeight: "700",
  },

  amountBlock: {
    flex: 1,
    gap: 4,
  },
  amountLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
  },

  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginTop: 14,
    marginBottom: 18,
  },
  walletKey: {
    fontSize: 13.5,
    color: Colors.textMuted,
  },
  walletValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  walletValueText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.text,
  },

  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 8,
  },
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
    color: Colors.textMuted,
  },
  categorySummaryTextSelected: {
    color: Colors.text,
    fontWeight: "600",
  },
  rows: {
    marginTop: 8,
    marginBottom: 4,
    // Bound the open picker so its own scroll takes over instead of pushing the
    // page down — the summary toggle above stays reachable no matter how many
    // subcategories are expanded.
    maxHeight: 320,
  },
  rowsContent: {
    paddingBottom: 4,
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

  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    // Breathing room below the toggle when the advanced section is collapsed,
    // so "More options" isn't jammed against the bottom edge.
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  moreText: {
    fontSize: 13.5,
    fontWeight: "600",
    color: Colors.textMuted,
  },

  advanced: {
    marginTop: 16,
    gap: 14,
    // Keep the last field (date/memo) clear of the keyboard and the bottom edge.
    paddingBottom: 96,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  fieldInput: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  fieldInputRow: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    color: Colors.text,
    fontSize: 15,
  },
});
