import { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

const EXPECTATIONS = [
  "Verify your identity (government ID). ID images are never stored.",
  "Teach at least 2 dance styles with self-declared levels.",
  "Submit an intro video (30–60s) showing your teaching ability.",
  "Upload 2–3 teaching samples matching your styles.",
  "Maintain reliability: show up for confirmed sessions.",
  "Accept coach terms and set up payout details before going live.",
];

export default function CoachIntroScreen() {
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        <View style={ss.header}>
          <Text style={ss.title}>Become a Coach</Text>
          <Text style={ss.subtitle}>Help others step out of their comfort zone through dance.</Text>
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>What we expect</Text>
          {EXPECTATIONS.map((exp, i) => (
            <View key={i} style={ss.expectationRow}>
              <Text style={ss.expectationNumber}>{i + 1}</Text>
              <Text style={ss.expectationText}>{exp}</Text>
            </View>
          ))}
        </View>

        <View style={ss.card}>
          <Text style={ss.sectionTitle}>How it works</Text>
          <Text style={ss.stepText}>1. Fill out the application (one topic per screen, drafts auto-save).</Text>
          <Text style={ss.stepText}>2. Complete identity verification (stub in dev — always passes).</Text>
          <Text style={ss.stepText}>3. Wait for admin review (usually within 2 days).</Text>
          <Text style={ss.stepText}>4. If approved, complete your setup checklist (availability, venue, pricing, payout).</Text>
          <Text style={ss.stepText}>5. Start hosting sessions during probation (max 6 dancers per group).</Text>
        </View>

        <View style={ss.termsCard}>
          <TouchableOpacity
            style={[ss.termsRow, agreed && ss.termsRowChecked]}
            onPress={() => setAgreed((a) => !a)}
          >
            <Text style={[ss.termsCheckbox, agreed && ss.termsCheckboxChecked]}>
              {agreed ? "☑" : "☐"}
            </Text>
            <Text style={ss.termsText}>
              I understand that coaches are reviewed for reliability, and I will maintain the
              quality of sessions I host.
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[ss.startButton, !agreed && ss.startButtonDisabled]}
          onPress={agreed ? () => router.push("/(tabs)/coach-application") : undefined}
          disabled={!agreed}
        >
          <Text style={ss.startButtonText}>Start application</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 20, minHeight: "100%", justifyContent: "space-between" },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#666", lineHeight: 22 },
  card: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginBottom: 12 },
  expectationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  expectationNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
    width: 20,
    marginRight: 8,
    marginTop: 2,
  },
  expectationText: { fontSize: 14, color: "#444", lineHeight: 20, flex: 1 },
  stepText: { fontSize: 14, color: "#444", lineHeight: 20, marginBottom: 8 },
  termsCard: { backgroundColor: "#f9f9f9", borderRadius: 12, padding: 16, marginBottom: 20 },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  termsRowChecked: { borderColor: "#007AFF", backgroundColor: "#eef6ff" },
  termsCheckbox: { fontSize: 20, marginRight: 10 },
  termsCheckboxChecked: { color: "#007AFF" },
  termsText: { fontSize: 13, color: "#444", lineHeight: 18, flex: 1 },
  startButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  startButtonDisabled: {
    backgroundColor: "#ccc",
  },
  startButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
