import { useEffect, useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
      if (!data || data.role !== "admin") {
        Alert.alert("Access denied", "Admin only");
        router.replace("/(tabs)");
      }
    })();
  }, [user, loading, router]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!isAdmin) return null;

  return <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>{children}</SafeAreaView>;
}
