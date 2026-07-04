import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Plus, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { listCategoryTree, type CategoryWithSubs } from "@/db/queries";
import { categoryIcon } from "@/utils/category-icon";

export default function CategoriesScreen() {
  const [tree, setTree] = useState<CategoryWithSubs[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listCategoryTree().then((t) => {
        if (!cancelled) setTree(t);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const expense = tree.filter((c) => c.kind === "expense");
  const income = tree.filter((c) => c.kind === "income");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} hitSlop={10} onPress={() => router.back()}>
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Categories</Text>
        <Pressable
          style={styles.iconBtn}
          hitSlop={10}
          onPress={() => router.push("/edit-category")}
        >
          <Plus size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Group title="Expense" categories={expense} />
        <Group title="Income" categories={income} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Group({
  title,
  categories,
}: {
  title: string;
  categories: CategoryWithSubs[];
}) {
  if (categories.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{title}</Text>
      <View style={styles.rows}>
        {categories.map((c, i) => {
          const Icon = categoryIcon(c.icon);
          return (
            <Pressable
              key={c.id}
              style={[styles.row, i === categories.length - 1 && styles.rowLast]}
              onPress={() =>
                router.push({ pathname: "/edit-category", params: { id: c.id } })
              }
            >
              <View style={styles.icon}>
                <Icon size={16} color={Colors.textMuted} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{c.name}</Text>
                {c.subs.length > 0 && (
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {c.subs.map((s) => s.name).join(" · ")}
                  </Text>
                )}
              </View>
              <ChevronRight size={16} color={Colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
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
  group: {
    marginBottom: 24,
  },
  groupLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 10,
  },
  rows: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
