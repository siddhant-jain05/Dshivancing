import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SessionsScreen() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>My sessions</Text>
      <Text style={{ marginTop: 12, color: "#666" }}>Placeholder — your booked sessions coming in V1 phase 2.</Text>
    </SafeAreaView>
  );
}
