import { ScrollView, StyleSheet, Pressable, Text } from "react-native";

import { Colors } from "@/constants/theme";
import type { WalletWithBalance } from "@/db/queries";

/** Sentinel value meaning "all wallets" (no filter). */
export const ALL_WALLETS = "__all__";

/**
 * Horizontal chip row for choosing a wallet scope: "All" plus one chip per
 * wallet. Shared by the home and stats screens.
 */
export function WalletSelector({
  wallets,
  selected,
  onSelect,
  includeAll = true,
}: {
  wallets: WalletWithBalance[];
  selected: string;
  onSelect: (id: string) => void;
  includeAll?: boolean;
}) {
  const chips = includeAll
    ? [{ id: ALL_WALLETS, name: "All" }, ...wallets]
    : wallets;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((w) => {
        const active = w.id === selected;
        return (
          <Pressable
            key={w.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(w.id)}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {w.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardElevated,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  textActive: {
    color: Colors.text,
  },
});
