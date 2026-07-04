import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip } from "@/components/ui/chip";
import { DeleteRow } from "@/components/ui/delete-row";
import { ModalHeader } from "@/components/ui/modal-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Colors } from "@/constants/theme";
import {
  addTransaction,
  deleteTransaction,
  getTransaction,
  listCategoryTree,
  listWallets,
  updateTransaction,
  type CategoryWithSubs,
} from "@/db/queries";
import type { Wallet } from "@/db/schema";
import { categoryIcon } from "@/utils/category-icon";
import { currencySymbol, monthShort, toCents } from "@/utils/format";

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Direction = "expense" | "income";

const DIRECTION_OPTIONS = [
  { value: "expense" as const, label: "Expense" },
  { value: "income" as const, label: "Income" },
];

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
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletIndex, setWalletIndex] = useState(0);
  const [tree, setTree] = useState<CategoryWithSubs[]>([]);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
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
    listWallets().then((w) => {
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
      setSubcategoryId(tx.subcategoryId);
      setTitle(tx.title ?? "");
      setMemo(tx.note ?? "");
      setDate(tx.date);
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

  /** Switch direction AND clear the (now-invalid) category selection. Only the
   *  user's toggle triggers this — prefilling direction must not clear it. */
  function selectDirection(next: Direction) {
    if (next === direction) return;
    setDirection(next);
    setOpenCategoryId(null);
    setSubcategoryId(null);
  }

  const wallet = wallets[walletIndex] ?? null;

  const selectedSub = useMemo(() => {
    for (const c of tree) {
      const s = c.subs.find((x) => x.id === subcategoryId);
      if (s) return { sub: s, category: c };
    }
    return null;
  }, [tree, subcategoryId]);

  function toggleExpanded() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  function toggleCategory(catId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCategoryId((cur) => (cur === catId ? null : catId));
  }

  function cycleWallet() {
    if (wallets.length === 0) return;
    setWalletIndex((i) => (i + 1) % wallets.length);
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
    // Category is optional. When absent, fall back to a title so the row still
    // reads sensibly instead of "Uncategorized".
    const fallbackTitle = direction === "income" ? "Income" : "Expense";
    const payload = {
      walletId: wallet.id,
      subcategoryId: subcategoryId ?? null,
      amount: cents,
      direction,
      title: title.trim() || (subcategoryId ? null : fallbackTitle),
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
        {/* Direction toggle */}
        <View style={styles.toggle}>
          <SegmentedControl
            options={DIRECTION_OPTIONS}
            value={direction}
            onChange={selectDirection}
          />
        </View>

        {/* Amount — real visible input so the keyboard reliably appears */}
        <Pressable
          style={styles.amountBlock}
          onPress={() => amountInputRef.current?.focus()}
        >
          <Text style={styles.amountLabel}>Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amountCurrency}>
              {currencySymbol(wallet?.currency ?? "USD")}
            </Text>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              value={amount}
              onChangeText={(t) =>
                setAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
              }
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>
        </Pressable>

        {/* Wallet */}
        <Pressable style={styles.walletRow} onPress={cycleWallet}>
          <Text style={styles.walletKey}>Wallet</Text>
          <View style={styles.walletValue}>
            <Text style={styles.walletValueText}>
              {wallet ? `${wallet.name} · ${wallet.currency}` : "—"}
            </Text>
            <ChevronDown size={14} color={Colors.textMuted} />
          </View>
        </Pressable>

        {/* Category → subcategory */}
        <Text style={styles.sectionLabel}>Category · optional</Text>
        <View style={styles.rows}>
          {tree.map((c, i) => {
            const Icon = categoryIcon(c.icon);
            const isLast = i === tree.length - 1;
            const isOpen = c.id === openCategoryId;
            const hasSelected = c.subs.some((s) => s.id === subcategoryId);
            return (
              <View key={c.id}>
                <Pressable
                  style={[
                    styles.catRow,
                    isLast && !isOpen && styles.catRowLast,
                  ]}
                  onPress={() => toggleCategory(c.id)}
                >
                  <View
                    style={[
                      styles.catIcon,
                      hasSelected && styles.catIconSelected,
                    ]}
                  >
                    <Icon
                      size={17}
                      color={hasSelected ? Colors.accent : Colors.textMuted}
                    />
                  </View>
                  <Text
                    style={[
                      styles.catName,
                      hasSelected && styles.catNameSelected,
                    ]}
                  >
                    {c.name}
                  </Text>
                  {hasSelected && selectedSub ? (
                    <Text style={styles.catSelectedSub}>
                      {selectedSub.sub.name}
                    </Text>
                  ) : null}
                  <ChevronRight
                    size={16}
                    color={Colors.textMuted}
                    style={{
                      transform: [{ rotate: isOpen ? "90deg" : "0deg" }],
                    }}
                  />
                </Pressable>

                {/* Subcategory chips */}
                {isOpen && (
                  <View style={styles.subWrap}>
                    {c.subs.map((s) => (
                      <Chip
                        key={s.id}
                        label={s.name}
                        selected={s.id === subcategoryId}
                        onPress={() => setSubcategoryId(s.id)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

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
                placeholder={selectedSub?.sub.name ?? "Title"}
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
    paddingBottom: 120,
  },

  toggle: {
    marginBottom: 24,
  },

  amountBlock: {
    marginBottom: 6,
  },
  amountLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
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
  rows: {
    marginBottom: 4,
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
  catSelectedSub: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: "600",
    marginRight: 4,
  },

  subWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 14,
    paddingLeft: 47,
  },

  moreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
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
