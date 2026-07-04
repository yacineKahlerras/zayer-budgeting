import { Tabs } from "expo-router";
import {
  ChartColumn,
  House,
  PiggyBank,
  Wallet,
} from "lucide-react-native";
import React from "react";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { Colors } from "@/constants/theme";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          // Symmetric breathing room around the icons/labels, on top of the
          // device's bottom safe-area inset (gesture bar).
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <House size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Budgets",
          tabBarIcon: ({ color }) => <PiggyBank size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color }) => <ChartColumn size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallets",
          tabBarIcon: ({ color }) => <Wallet size={28} color={color} />,
        }}
      />
    </Tabs>
  );
}
