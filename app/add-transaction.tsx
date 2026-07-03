import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { Calendar, Check, ChevronDown, ChevronRight, X } from "lucide-react-native";
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
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
  addTransaction,
  listCategoryTree,
  listWallets,
  type CategoryWithSubs,
} from "@/db/queries";
import type { Wallet } from "@/db/schema";
import { categoryIcon } from "@/utils/category-icon";

// Enable LayoutAnimation on Android.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Direction = "expense" | "income";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(d: Date) {
  const label = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return isSameDay(d, new Date()) ? `Today · ${label}` : label;
}

/** Convert a "24.50" style string to integer cents. */
function toCents(input: string): number {
  const n = parseFloat(input);
  if (!n || n <= 0) return 0;
  return Math.round(n * 100);
}

export default function AddTransaction() {
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

  // Load wallets + categories for the selected direction.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [w, t] = await Promise.all([
        listWallets(),
        listCategoryTree(direction),
      ]);
      if (cancelled) return;
      setWallets(w);
      setTree(t);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [direction]);

  // Reset category selection when direction changes (income/expense have
  // different category sets).
  useEffect(() => {
    setOpenCategoryId(null);
    setSubcategoryId(null);
  }, [direction]);

  const wallet = wallets[walletIndex] ?? null;
  const amountDisplay = amount === "" ? "0.00" : amount;

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

  function toggleCategory(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCategoryId((cur) => (cur === id ? null : id));
  }

  function cycleWallet() {
    if (wallets.length === 0) return;
    setWalletIndex((i) => (i + 1) % wallets.length);
  }

  async function handleSave() {
    const cents = toCents(amountDisplay);
    if (cents <= 0) {
      Alert.alert("Enter an amount", "The amount must be greater than zero.");
      return;
    }
    if (!subcategoryId) {
      Alert.alert("Pick a category", "Choose a category for this transaction.");
      return;
    }
    if (!wallet) {
      Alert.alert("No wallet", "Add a wallet first.");
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        walletId: wallet.id,
        subcategoryId,
        amount: cents,
        direction,
        title: title.trim() || null,
        note: memo.trim() || null,
        date,
      });
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert("Could not save", (e as Error).message);
    }
  }

  const isIncome = direction === "income";

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <ActivityIndicator color={Colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconBtn}
          hitSlop={10}
          onPress={() => router.back()}
        >
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New transaction</Text>
        <Pressable
          style={styles.iconBtn}
          hitSlop={10}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <Check size={22} color={Colors.accent} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Direction toggle */}
        <View style={styles.toggle}>
          <Pressable
            style={[styles.toggleBtn, !isIncome && styles.toggleBtnActive]}
            onPress={() => setDirection("expense")}
          >
            <Text
              style={[styles.toggleText, !isIncome && styles.toggleTextActive]}
            >
              Expense
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, isIncome && styles.toggleBtnActive]}
            onPress={() => setDirection("income")}
          >
            <Text
              style={[styles.toggleText, isIncome && styles.toggleTextActive]}
            >
              Income
            </Text>
          </Pressable>
        </View>

        {/* Amount */}
        <Pressable
          style={styles.amountBlock}
          onPress={() => amountInputRef.current?.focus()}
        >
          <Text style={styles.amountLabel}>Amount</Text>
          <Text style={styles.amountValue}>
            <Text style={styles.amountCurrency}>
              {wallet?.currency === "EUR" ? "€" : "$"}
            </Text>
            {amountDisplay}
          </Text>
          <TextInput
            ref={amountInputRef}
            style={styles.hiddenInput}
            value={amount}
            onChangeText={(t) =>
              setAmount(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))
            }
            keyboardType="decimal-pad"
          />
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
        <Text style={styles.sectionLabel}>Category</Text>
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
                    {c.subs.map((s) => {
                      const selected = s.id === subcategoryId;
                      return (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, selected && styles.chipSelected]}
                          onPress={() => setSubcategoryId(s.id)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              selected && styles.chipTextSelected,
                            ]}
                          >
                            {s.name}
                          </Text>
                        </Pressable>
                      );
                    })}
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
      </ScrollView>

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
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  toggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: Colors.card,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.text,
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
  amountValue: {
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: Colors.text,
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  amountCurrency: {
    color: Colors.textMuted,
    fontWeight: "500",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardElevated,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: Colors.text,
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
