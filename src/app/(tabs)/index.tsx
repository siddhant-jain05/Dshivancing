import { Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export default function HomeScreen() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase
      .from("config")
      .select("*")
      .then(({ data }: { data: any }) => setMessage(`Config loaded: ${data?.length ?? 0} rows`));
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Home</Text>
      <Text style={{ marginTop: 12, color: "#666" }}>{message}</Text>
      <TouchableOpacity
        style={{ marginTop: 24, padding: 12, backgroundColor: "#eee", borderRadius: 8 }}
        onPress={() => {}}
      >
        <Text>Open sessions (placeholder)</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
