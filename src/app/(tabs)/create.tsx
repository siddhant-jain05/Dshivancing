import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CreateScreen() {
  return (
    <SafeAreaView style={{ flex: 1, padding: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Create</Text>
      <Text style={{ marginTop: 12, color: "#666" }}>Placeholder — session creation coming in V1 phase 2.</Text>
    </SafeAreaView>
  );
}
