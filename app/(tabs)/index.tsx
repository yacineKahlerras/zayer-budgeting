import { Pressable, StyleSheet, Text, View } from "react-native";

import { AccountCard } from "@/components/home/account-card";
import { TransactionList } from "@/components/home/transaction-list";
import { Screen } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";
import { router } from "expo-router";
import { Plus } from "lucide-react-native";

export default function HomeScreen() {
  return (
    <Screen>
      <Pressable style={styles.fab}>
        <Plus onPress={() => router.push("/add-transaction")} color="black" />
      </Pressable>
      <TransactionList
        header={
          <View>
            <AccountCard />
            <Text style={styles.sectionTitle}>Transactions</Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 50,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
