import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ScreenTitle } from "@/components/ui/screen";
import { Colors } from "@/constants/theme";

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <ScreenTitle>This is a modal</ScreenTitle>
      <Link href="/" dismissTo style={styles.link}>
        <Text style={styles.linkText}>Go to home screen</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    color: Colors.accent,
  },
});
