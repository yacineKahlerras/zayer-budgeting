import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import {
  CheckCircle2,
  FileText,
  UploadCloud,
  Wallet as WalletIcon,
  X,
} from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/theme";
import {
  importRows,
  previewCsvFile,
  type ImportPreview,
} from "@/utils/import";

export default function ImportScreen() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "*/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets[0];
      const p = await previewCsvFile(asset.uri);
      setFileName(asset.name);
      setPreview(p);
    } catch (e) {
      Alert.alert("Could not read file", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (busy || !preview || preview.rows.length === 0) return;
    setBusy(true);
    try {
      const n = await importRows(preview.rows);
      Alert.alert("Import complete", `${n} transactions imported.`, [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Import failed", (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} hitSlop={10} onPress={() => router.back()}>
          <X size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Import data</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!preview ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <UploadCloud size={30} color={Colors.accent} />
              </View>
              <Text style={styles.heroTitle}>Import a CSV export</Text>
              <Text style={styles.heroText}>
                Bring your history from another budgeting app. Works with
                Wallet by BudgetBakers and standard CSV exports. Wallets and
                categories are created automatically.
              </Text>
            </View>

            <Pressable
              style={styles.pickBtn}
              onPress={handlePick}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <>
                  <FileText size={18} color={Colors.background} />
                  <Text style={styles.pickBtnText}>Choose CSV file</Text>
                </>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.fileRow}>
              <FileText size={18} color={Colors.textMuted} />
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>

            {/* Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <CheckCircle2 size={18} color={Colors.positive} />
                <Text style={styles.summaryText}>
                  <Text style={styles.summaryStrong}>
                    {preview.rows.length}
                  </Text>{" "}
                  transactions ready to import
                </Text>
              </View>
              {preview.skipped > 0 && (
                <View style={styles.summaryRow}>
                  <X size={18} color={Colors.negative} />
                  <Text style={styles.summaryText}>
                    {preview.skipped} rows skipped (missing date or amount)
                  </Text>
                </View>
              )}
            </View>

            {/* Wallets that will be created/matched */}
            <Text style={styles.sectionLabel}>Wallets</Text>
            <View style={styles.walletList}>
              {preview.wallets.map((w, i) => (
                <View
                  key={w}
                  style={[
                    styles.walletRow,
                    i === preview.wallets.length - 1 && styles.walletRowLast,
                  ]}
                >
                  <WalletIcon size={16} color={Colors.textMuted} />
                  <Text style={styles.walletName}>{w}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.note}>
              Wallets and categories with matching names are reused, so no
              duplicates there. Transactions are always added, so importing the
              same file twice will add them again.
            </Text>

            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => {
                  setPreview(null);
                  setFileName(null);
                }}
                disabled={busy}
              >
                <Text style={styles.secondaryBtnText}>Choose another</Text>
              </Pressable>
              <Pressable
                style={styles.primaryBtn}
                onPress={handleImport}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Import {preview.rows.length}
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  hero: {
    alignItems: "center",
    marginTop: 24,
    marginBottom: 28,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.text,
    borderRadius: 14,
    paddingVertical: 15,
  },
  pickBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
  },

  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 16,
  },
  fileName: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  summary: {
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryText: {
    color: Colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  summaryStrong: {
    color: Colors.text,
    fontWeight: "700",
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 10,
  },
  walletList: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  walletRowLast: {
    borderBottomWidth: 0,
  },
  walletName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  note: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  secondaryBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: Colors.accent,
  },
  primaryBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700",
  },
});
