import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors } from "@/constants/theme";

export type SegmentOption<T extends string> = { value: T; label: string };

/** Bordered segmented control (e.g. Expense/Income, Week/Month/Year). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnActive: {
    backgroundColor: Colors.card,
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
