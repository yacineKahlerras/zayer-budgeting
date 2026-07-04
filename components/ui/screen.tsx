import { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";

/** Full-screen container with the app background and safe-area handling. */
export function Screen({
  children,
  edges = ["top"],
}: {
  children: ReactNode;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** Standard large screen heading. */
export function ScreenTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
});
