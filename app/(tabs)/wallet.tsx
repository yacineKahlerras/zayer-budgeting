import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "@/db/client";
import { resetAndReseed } from "@/db/seed";
import { Colors } from "@/constants/theme";

export default function WalletScreen() {
  const [busy, setBusy] = useState(false);

  async function handleReseed() {
    setBusy(true);
    try {
      await resetAndReseed(db);
      Alert.alert("Done", "Database wiped and reseeded.");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Wallet</Text>

        {/* Dev-only control. `__DEV__` is false in production builds, so this
            never ships to users. */}
        {__DEV__ && (
          <Pressable
            style={[styles.devButton, busy && styles.devButtonBusy]}
            onPress={handleReseed}
            disabled={busy}
          >
            <Text style={styles.devButtonText}>
              {busy ? "Reseeding…" : "Reset & reseed DB (dev)"}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "700",
  },
  devButton: {
    marginTop: 24,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  devButtonBusy: {
    opacity: 0.6,
  },
  devButtonText: {
    color: Colors.textMuted,
    fontWeight: "600",
  },
});
