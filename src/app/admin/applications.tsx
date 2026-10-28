import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function ApplicationsScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("coach_applications")
        .select("*, users(phone, role)")
        .order("created_at", { ascending: false });
      setApplications(data ?? []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        <View style={ss.header}>
          <Text style={ss.title}>Coach Applications</Text>
          <Text style={ss.subtitle}>{applications.length} application(s)</Text>
        </View>

        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={ss.card} onPress={() => {}}>
              <Link href={`/admin/application/${item.id}`}>
                <View style={ss.cardContent}>
                  <View style={ss.cardLeft}>
                    <Text style={ss.appName}>{item.styles_taught?.[0]?.style ?? "Coach"} application</Text>
                    <Text style={ss.appPhone}>{item.users?.phone ?? "—"}</Text>
                  </View>
                  <View style={ss.cardRight}>
                    <View style={[ss.statusChip, statusStyle(item.status)]}>
                      <Text style={ss.statusText}>{item.status.replace(/_/g, " ")}</Text>
                    </View>
                  </View>
                </View>
              </Link>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={ss.separator} />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const statusStyle = (status: string) => {
  switch (status) {
    case "draft": return { backgroundColor: "#f5f5f5", borderColor: "#999", borderWidth: 1 };
    case "submitted": return { backgroundColor: "#eef6ff", borderColor: "#007AFF", borderWidth: 1 };
    case "under_review": return { backgroundColor: "#fff4e6", borderColor: "#ff9800", borderWidth: 1 };
    case "approved": return { backgroundColor: "#e8f5e9", borderColor: "#4caf50", borderWidth: 1 };
    case "needs_changes": return { backgroundColor: "#fff3e0", borderColor: "#ff9800", borderWidth: 1 };
    case "rejected": return { backgroundColor: "#ffebee", borderColor: "#f44336", borderWidth: 1 };
    default: return {};
  }
};

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollContent: { padding: 16 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardLeft: { flex: 1 },
  appName: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  appPhone: { fontSize: 13, color: "#666" },
  cardRight: { alignItems: "flex-end" },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  separator: { height: 8, backgroundColor: "#f5f5f5" },
});
