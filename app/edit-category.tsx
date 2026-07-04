import { router, useLocalSearchParams } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
  addCategory,
  addSubcategory,
  deleteCategory,
  deleteSubcategory,
  listCategoryTree,
  updateCategory,
  type CategoryWithSubs,
} from "@/db/queries";

type Kind = "expense" | "income";
type Sub = { id: string; name: string };

export default function EditCategory() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;

  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [newSub, setNewSub] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  // Monotonic counter for staged (not-yet-persisted) subcategory ids, so
  // removing one never lets a later add reuse an existing id.
  const stagedCounter = useRef(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    listCategoryTree().then((tree) => {
      if (cancelled) return;
      const cat = tree.find((c: CategoryWithSubs) => c.id === id);
      if (cat) {
        setName(cat.name);
        setKind(cat.kind);
        setSubs(cat.subs.map((s) => ({ id: s.id, name: s.name })));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // In edit mode, subcategory changes persist immediately (they have their own
  // rows); in create mode we stage them and insert after the category exists.
  async function addSub() {
    const trimmed = newSub.trim();
    if (!trimmed) return;
    setNewSub("");
    if (editing && id) {
      const subId = await addSubcategory(id, trimmed);
      setSubs((s) => [...s, { id: subId, name: trimmed }]);
    } else {
      const stagedId = `staged_${stagedCounter.current++}`;
      setSubs((s) => [...s, { id: stagedId, name: trimmed }]);
    }
  }

  async function removeSub(sub: Sub) {
    setSubs((s) => s.filter((x) => x.id !== sub.id));
    if (editing && !sub.id.startsWith("staged_")) {
      await deleteSubcategory(sub.id);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Name required", "Give the category a name.");
      return;
    }
    setSaving(true);
    try {
      if (editing && id) {
        await updateCategory(id, { name: name.trim() });
      } else {
        const catId = await addCategory({
          name: name.trim(),
          kind,
          icon: null,
        });
        // Insert staged subcategories.
        for (const s of subs) await addSubcategory(catId, s.name);
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
      "Delete category",
      "Its subcategories are removed too. Past transactions keep their history but become uncategorized. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategory(id);
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
        title={editing ? "Edit category" : "New category"}
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
            placeholder="e.g. Groceries, Salary"
            placeholderTextColor={Colors.textMuted}
            autoFocus={!editing}
          />
        </View>

        {/* Kind is fixed after creation (changing it would orphan budgets). */}
        {!editing && (
          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.chips}>
              <Chip
                label="Expense"
                selected={kind === "expense"}
                onPress={() => setKind("expense")}
              />
              <Chip
                label="Income"
                selected={kind === "income"}
                onPress={() => setKind("income")}
              />
            </View>
          </View>
        )}

        {/* Subcategories */}
        <View style={styles.field}>
          <Text style={styles.label}>Subcategories</Text>
          <View style={styles.subList}>
            {subs.map((s) => (
              <View key={s.id} style={styles.subRow}>
                <Text style={styles.subName}>{s.name}</Text>
                <Pressable hitSlop={10} onPress={() => removeSub(s)}>
                  <Trash2 size={16} color={Colors.negative} />
                </Pressable>
              </View>
            ))}
            <View style={styles.addSubRow}>
              <TextInput
                style={styles.addSubInput}
                value={newSub}
                onChangeText={setNewSub}
                placeholder="Add a subcategory…"
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={addSub}
                returnKeyType="done"
              />
              <Pressable style={styles.addSubBtn} hitSlop={8} onPress={addSub}>
                <Plus size={18} color={Colors.accent} />
              </Pressable>
            </View>
          </View>
        </View>

        {editing && <DeleteRow label="Delete category" onPress={handleDelete} />}
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
    gap: 24,
  },
  field: {
    gap: 10,
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
  chips: {
    flexDirection: "row",
    gap: 8,
  },
  subList: {
    gap: 8,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  subName: {
    color: Colors.text,
    fontSize: 15,
  },
  addSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addSubInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  addSubBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
