import { Check, X } from "lucide-react-native";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

/** Shared modal header: ✕ (cancel) · title · ✓ (save). Used by the
 *  add-transaction and edit-wallet modals. */
export function ModalHeader({
  title,
  onCancel,
  onSave,
  saving = false,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <View style={styles.header}>
      <Pressable style={styles.iconBtn} hitSlop={10} onPress={onCancel}>
        <X size={22} color={Colors.text} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        style={styles.iconBtn}
        hitSlop={10}
        onPress={onSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : (
          <Check size={22} color={Colors.accent} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  title: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
  },
});
