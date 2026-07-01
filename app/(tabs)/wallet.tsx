import { StyleSheet, View } from "react-native";

import { Screen, ScreenTitle } from "@/components/ui/screen";

export default function WalletScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <ScreenTitle>Wallet</ScreenTitle>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
});
