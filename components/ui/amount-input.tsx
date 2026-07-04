import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { Colors } from "@/constants/theme";
import { currencySymbol } from "@/utils/format";

/** Only digits and a single decimal point. */
function sanitize(input: string): string {
  return input.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

/** The app's signature large money input: a currency symbol beside a big
 *  tabular number. Shared by add-transaction and edit-budget. */
export const AmountInput = forwardRef<
  TextInput,
  {
    value: string;
    onChangeText: (value: string) => void;
    currency: string;
    autoFocus?: boolean;
  }
>(function AmountInput({ value, onChangeText, currency, autoFocus }, ref) {
  return (
    <View style={styles.row}>
      <Text style={styles.currency}>{currencySymbol(currency)}</Text>
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={(t) => onChangeText(sanitize(t))}
        keyboardType="decimal-pad"
        placeholder="0.00"
        placeholderTextColor={Colors.textMuted}
        autoFocus={autoFocus}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  currency: {
    fontSize: 32,
    color: Colors.textMuted,
    fontWeight: "500",
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 46,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: Colors.text,
    padding: 0,
    fontVariant: ["tabular-nums"],
  },
});
