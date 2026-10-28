import { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const CHECKLIST_ITEMS = [
  { key: "video", label: "Intro video shows teaching ability" },
  { key: "samples", label: "Teaching samples match declared styles" },
  { key: "identity", label: "ID verification passed" },
  { key: "social", label: "Social accounts look genuine" },
];

export default function ApplicationDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const id = (router as any).params?.id;
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [outcomeNote, setOutcomeNote] = useState("");
  const [coachPaused, setCoachPaused] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("coach_applications")
        .select("*, users(phone, name, role)")
        .eq("id", id)
        .maybeSingle();
      setApplication(data);
      if (data) {
        const defaults: Record<string, boolean> = {};
        CHECKLIST_ITEMS.forEach((c) => (defaults[c.key] = false));
        setChecklist(defaults);
      }
      const { data: cp } = await supabase
        .from("coach_profiles")
        .select("is_paused")
        .eq("id", application?.user_id)
        .maybeSingle();
      setCoachPaused(cp?.is_paused ?? false);
      setLoading(false);
    })();
  }, [user, id, application]);

  const handleApprove = async () => {
    if (!application) return;
    const { error } = await supabase.rpc("approve_coach_application", {
      p_application_id: id,
      p_admin_note: null,
    });
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setApplication((prev: any) => ({ ...prev, status: "approved" }));
    Alert.alert("Approved", "Coach application approved");
  };

  const handleNeedsChanges = async () => {
    if (!outcomeNote.trim()) {
      Alert.alert("Validation", "Please add a note explaining what needs to change");
      return;
    }
    if (!application) return;
    const { error } = await supabase.rpc("needs_changes_coach_application", {
      p_application_id: id,
      p_admin_note: outcomeNote,
    });
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setApplication((prev: any) => ({ ...prev, status: "needs_changes", admin_note: outcomeNote }));
    Alert.alert("Needs changes", "Applicant has been notified");
  };

  const handleReject = async () => {
    if (!outcomeNote.trim()) {
      Alert.alert("Validation", "Please add a reason for rejection");
      return;
    }
    if (!application) return;
    const { error } = await supabase.rpc("reject_coach_application", {
      p_application_id: id,
      p_reason: outcomeNote,
    });
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setApplication((prev: any) => ({ ...prev, status: "rejected", admin_note: outcomeNote }));
    Alert.alert("Rejected", "Application rejected");
  };

  const togglePause = async () => {
    if (!application || !user) return;
    const newPaused = !coachPaused;
    const { error } = await supabase.rpc(
      newPaused ? "pause_coach" : "resume_coach",
      { p_coach_id: application.user_id, p_admin_note: null }
    );
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setCoachPaused(newPaused);
    Alert.alert(newPaused ? "Coach paused" : "Coach resumed", newPaused ? "Coach is paused from hosting." : "Coach is active again.");
  };

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
        <Text style={ss.title}>Application not found</Text>
      </SafeAreaView>
    );
  }

  const status = application.status;
  const isReviewable = status === "submitted" || status === "under_review" || status === "needs_changes";

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        <View style={ss.header}>
          <Text style={ss.title}>Application review</Text>
          <View style={[ss.statusChip, statusStyle(status)]}>
            <Text style={ss.statusText}>{status.replace(/_/g, " ")}</Text>
          </View>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Applicant</Text>
          <Text style={ss.appField}>{application.users?.name ?? "—"}</Text>
          <Text style={ss.appField}>{application.users?.phone ?? "—"}</Text>
          <Text style={ss.appField}>{application.users?.role}</Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Styles taught</Text>
          <View style={ss.chipRow}>
            {(application.styles_taught ?? []).map((s: any, i: number) => (
              <View key={i} style={ss.chip}>
                <Text style={ss.chipText}>{s.style} ({s.level})</Text>
              </View>
            ))}
          </View>
          <View style={ss.fieldRow}>
            <Text style={ss.fieldLabel}>Experience</Text>
            <Text style={ss.fieldValue}>{application.years_experience ?? 0} years</Text>
          </View>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Bio</Text>
          <Text style={ss.bioText}>{application.bio ?? "—"}</Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Languages</Text>
          <Text style={ss.fieldValue}>{(application.languages ?? []).join(", ") || "—"}</Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Intro video</Text>
          <Text style={ss.fieldValue}>{application.intro_video_url ? "Uploaded" : "Not provided"}</Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Teaching samples</Text>
          <Text style={ss.fieldValue}>
            {(application.teaching_samples ?? []).length} uploaded
          </Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>Identity verification</Text>
          <Text style={ss.fieldValue}>
            {application.identity_verified ? "Verified" : "Not verified"}
          </Text>
          {application.gender_on_id && (
            <Text style={ss.fieldValue}>Gender on ID: {application.gender_on_id}</Text>
          )}
        </View>

        {isReviewable && (
          <View style={ss.card}>
            <Text style={ss.sectionTitle}>Review checklist</Text>
            {CHECKLIST_ITEMS.map((item) => (
              <View key={item.key} style={ss.checklistRow}>
                <TouchableOpacity
                  style={[ss.checkBox, checklist[item.key] && ss.checkBoxChecked]}
                  onPress={() =>
                    setChecklist((c) => ({ ...c, [item.key]: !c[item.key] }))
                  }
                >
                  <Text style={ss.checkText}>{checklist[item.key] ? "☑" : "☐"}</Text>
                </TouchableOpacity>
                <Text style={ss.checkLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {isReviewable && (
          <View style={ss.card}>
            <Text style={ss.sectionTitle}>Admin note</Text>
            <TextInput
              value={outcomeNote}
              onChangeText={setOutcomeNote}
              multiline
              numberOfLines={3}
              style={ss.noteInput}
              placeholder="Add a note for the applicant"
            />
            <View style={ss.buttonRow}>
              <TouchableOpacity style={ss.rejectButton} onPress={handleReject}>
                <Text style={ss.buttonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.needsChangesButton} onPress={handleNeedsChanges}>
                <Text style={ss.buttonText}>Needs changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.approveButton} onPress={handleApprove}>
                <Text style={ss.buttonText}>Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {application.admin_note && (
          <View style={ss.card}>
            <Text style={ss.sectionTitle}>Previous admin note</Text>
            <Text style={ss.noteText}>{application.admin_note}</Text>
          </View>
        )}

        {status === "approved" && (
          <View style={ss.card}>
            <Text style={ss.sectionTitle}>Coach status</Text>
            <TouchableOpacity
              style={[ss.pauseButton, coachPaused && ss.pauseButtonActive]}
              onPress={togglePause}
            >
              <Text style={ss.pauseButtonText}>
                {coachPaused ? "Resume coach" : "Pause coach"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  appField: { fontSize: 14, color: "#444", marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: { fontSize: 13, color: "#444" },
  fieldRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  fieldLabel: { fontSize: 14, color: "#666" },
  fieldValue: { fontSize: 14, color: "#444" },
  bioText: { fontSize: 14, color: "#444", lineHeight: 20 },
  noteInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
    textAlignVertical: "top",
    height: 90,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkBoxChecked: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  checkText: { color: "#fff", fontSize: 14 },
  checkLabel: { fontSize: 14, color: "#444", flex: 1 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  rejectButton: {
    backgroundColor: "#f44336",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  needsChangesButton: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  approveButton: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  noteText: { fontSize: 14, color: "#444", lineHeight: 20 },
  pauseButton: {
    backgroundColor: "#ff9800",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  pauseButtonActive: { backgroundColor: "#4caf50" },
  pauseButtonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
