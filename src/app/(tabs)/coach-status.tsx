import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  needs_changes: "Needs changes",
  rejected: "Rejected",
};

const statusChipStyle = (status: string) => {
  switch (status) {
    case "draft": return ss.statusDraft;
    case "submitted": return ss.statusSubmitted;
    case "under_review": return ss.statusUnder_review;
    case "approved": return ss.statusApproved;
    case "needs_changes": return ss.statusNeeds_changes;
    case "rejected": return ss.statusRejected;
    default: return {};
  }
};

export default function CoachStatusScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("coach_applications")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();
        setApplication(data);
      } catch {
        Alert.alert("Error", "Failed to load application");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={ss.container}>
        <ScrollView contentContainerStyle={ss.scrollContent}>
          <View style={ss.card}>
            <Text style={ss.title}>No application</Text>
            <Text style={ss.subtitle}>You have not started a coach application yet.</Text>
          </View>
          <TouchableOpacity style={ss.startButton} onPress={() => router.push("/(tabs)/coach-intro")}>
            <Text style={ss.startText}>Start application</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const status = application.status;
  const isTerminal = status === "approved" || status === "rejected";

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        <View style={ss.header}>
          <Text style={ss.title}>Application status</Text>
          <View style={[ss.statusChip, statusChipStyle(status)]}>
            <Text style={ss.statusText}>{STATUS_LABELS[status]}</Text>
          </View>
        </View>

        {status === "under_review" && (
          <View style={ss.infoCard}>
            <Text style={ss.infoTitle}>Under review</Text>
            <Text style={ss.infoText}>
              Your application is being reviewed by our admin team. This usually takes up to 2 days.
            </Text>
          </View>
        )}

        {status === "needs_changes" && (
          <View style={ss.infoCard}>
            <Text style={ss.infoTitle}>Needs changes</Text>
            {application.admin_note && (
              <>
                <Text style={ss.noteTitle}>Admin note</Text>
                <Text style={ss.noteText}>{application.admin_note}</Text>
              </>
            )}
            <TouchableOpacity style={ss.editButton} onPress={() => router.push("/(tabs)/coach-application")}>
              <Text style={ss.editText}>Update application</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "rejected" && (
          <View style={ss.infoCard}>
            <Text style={ss.infoTitle}>Application rejected</Text>
            {application.admin_note && (
              <>
                <Text style={ss.noteTitle}>Reason</Text>
                <Text style={ss.noteText}>{application.admin_note}</Text>
              </>
            )}
            <TouchableOpacity style={ss.reapplyButton} onPress={() => router.push("/(tabs)/coach-intro")}>
              <Text style={ss.reapplyText}>Apply again</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "approved" && (
          <>
            <View style={ss.infoCard}>
              <Text style={ss.infoTitle}>Application approved!</Text>
              <Text style={ss.infoText}>
                Complete your coach setup checklist to start hosting sessions.
              </Text>
            </View>
            <TouchableOpacity style={ss.setupButton} onPress={() => router.push("/(tabs)/coach-setup")}>
              <Text style={ss.setupText}>Go to setup checklist</Text>
            </TouchableOpacity>
          </>
        )}

        {!isTerminal && application.updated_at && (
          <View style={ss.updatedCard}>
            <Text style={ss.updatedLabel}>Last updated</Text>
            <Text style={ss.updatedValue}>{new Date(application.updated_at).toLocaleDateString()}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 20, minHeight: "100%", justifyContent: "space-between" },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#666", lineHeight: 22 },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  statusDraft: { backgroundColor: "#f5f5f5", borderColor: "#999", borderWidth: 1 },
  statusSubmitted: { backgroundColor: "#eef6ff", borderColor: "#007AFF", borderWidth: 1 },
  statusUnder_review: { backgroundColor: "#fff4e6", borderColor: "#ff9800", borderWidth: 1 },
  statusApproved: { backgroundColor: "#e8f5e9", borderColor: "#4caf50", borderWidth: 1 },
  statusNeeds_changes: { backgroundColor: "#fff3e0", borderColor: "#ff9800", borderWidth: 1 },
  statusRejected: { backgroundColor: "#ffebee", borderColor: "#f44336", borderWidth: 1 },
  statusText: { fontSize: 14, fontWeight: "600" },
  infoCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  infoText: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 12 },
  noteTitle: { fontSize: 14, fontWeight: "600", color: "#e65100", marginBottom: 6 },
  noteText: { fontSize: 14, color: "#444", lineHeight: 20, marginBottom: 12 },
  editButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  editText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  reapplyButton: {
    backgroundColor: "#f44336",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  reapplyText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  setupButton: {
    backgroundColor: "#4caf50",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  setupText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  startButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  startText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  updatedCard: {
    alignItems: "center",
    marginTop: 16,
  },
  updatedLabel: { fontSize: 12, color: "#999", marginBottom: 4 },
  updatedValue: { fontSize: 14, color: "#666" },
});
