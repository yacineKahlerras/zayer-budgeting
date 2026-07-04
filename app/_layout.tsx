import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { useDatabase } from "@/db/use-database";

export const unstable_settings = {
  anchor: "(tabs)",
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.background,
    card: Colors.card,
    text: Colors.text,
    border: Colors.border,
    primary: Colors.accent,
  },
};

export default function RootLayout() {
  const { ready, error } = useDatabase();

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
      <ThemeProvider value={navTheme}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorTitle}>Database error</Text>
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        ) : !ready ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Preparing database…</Text>
          </View>
        ) : (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
            <Stack.Screen
              name="add-transaction"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="edit-wallet"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="edit-budget"
              options={{ presentation: "modal", headerShown: false }}
            />
          </Stack>
        )}
        <StatusBar style="light" />
      </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  loadingText: {
    color: Colors.textMuted,
    marginTop: 12,
  },
  errorTitle: {
    color: Colors.negative,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    color: Colors.textMuted,
    textAlign: "center",
  },
});
