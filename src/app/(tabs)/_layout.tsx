import { Tabs } from "expo-router";
import { BottomTabIcon } from "@/components/BottomTabIcon";

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: () => <BottomTabIcon name="home" /> }} />
      <Tabs.Screen
        name="coaches"
        options={{ title: "Coaches", tabBarIcon: () => <BottomTabIcon name="people" /> }}
      />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarIcon: () => <BottomTabIcon name="plus" /> }} />
      <Tabs.Screen
        name="sessions"
        options={{ title: "My sessions", tabBarIcon: () => <BottomTabIcon name="calendar" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: () => <BottomTabIcon name="user" /> }}
      />
    </Tabs>
  );
}
