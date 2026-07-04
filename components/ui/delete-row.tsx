import { Trash2 } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { Colors } from "@/constants/theme";

/** Shared destructive-action row (bordered, red trash + label). */
export function DeleteRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Trash2 size={18} color={Colors.negative} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
  text: {
    color: Colors.negative,
    fontSize: 15,
    fontWeight: "600",
  },
});
