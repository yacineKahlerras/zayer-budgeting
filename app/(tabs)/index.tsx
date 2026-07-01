import { StyleSheet, Text, View } from "react-native";

import { AccountCard } from "@/components/home/account-card";
import { TransactionList } from "@/components/home/transaction-list";
import { Screen } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";

export default function HomeScreen() {
  return (
    <Screen>
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
});
