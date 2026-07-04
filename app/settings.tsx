import { router } from "expo-router";
import {
  ChevronRight,
  Download,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import { exportAllToCsv } from "@/utils/export";

export default function SettingsScreen() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportAllToCsv();
    } catch (e) {
      Alert.alert("Export failed", (e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} hitSlop={10} onPress={() => router.back()}>
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.group}>
          <Row
            icon={Tags}
            label="Categories"
            hint="Add and edit your categories"
            onPress={() => router.push("/categories")}
          />
          <Row
            icon={Download}
            label={exporting ? "Exporting…" : "Export data (CSV)"}
            hint="Share all your transactions"
            onPress={handleExport}
            last
          />
        </View>

        <Text style={styles.version}>Zayer Budgeting</Text>
      </View>
    </SafeAreaView>
  );
}

function Row({
  icon: Icon,
  label,
  hint,
  onPress,
  last,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, last && styles.rowLast]} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Icon size={18} color={Colors.textMuted} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <ChevronRight size={16} color={Colors.textMuted} />
    </Pressable>
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
  headerTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  group: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  rowHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  version: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
  },
});
