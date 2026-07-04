import { router } from "expo-router";
import { Search as SearchIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TransactionRow } from "@/components/home/transaction-row";
import { Colors } from "@/constants/theme";
import { searchTransactions, type TransactionListItem } from "@/db/queries";

const PAGE_SIZE = 30;

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TransactionListItem[]>([]);
  const [searched, setSearched] = useState(false);

  // Debounce the query so we don't hit the DB on every keystroke.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await searchTransactions(q, 0, PAGE_SIZE);
      if (cancelled) return;
      setResults(rows);
      setSearched(true);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <SearchIcon size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search transactions…"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            returnKeyType="search"
          />
        </View>
        <Pressable hitSlop={10} onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow item={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {searched
                ? "No matching transactions."
                : "Search by title, note, or category."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    padding: 0,
  },
  cancel: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
