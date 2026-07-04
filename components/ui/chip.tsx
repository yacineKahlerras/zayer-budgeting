import { Pressable, StyleSheet, Text } from "react-native";

import { Colors } from "@/constants/theme";

/** Pill-shaped selectable chip, shared by category, subcategory, and currency
 *  pickers. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.cardElevated,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  textSelected: {
    color: Colors.text,
  },
});
