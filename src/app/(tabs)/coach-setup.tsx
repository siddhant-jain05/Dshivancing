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
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const CHECKLIST_ITEMS = [
  { key: "availability", label: "Weekly availability" },
  { key: "venue", label: "Default venue with 3+ photos" },
  { key: "pricing", label: "Price and group-size limits" },
  { key: "payout", label: "Payout details (bank/UPI)" },
  { key: "terms", label: "Accept coach terms" },
];

export default function CoachSetupScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Setup form state
  const [availability, setAvailability] = useState<Record<number, { start: string; end: string; available: boolean }>>({});
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venuePhotos, setVenuePhotos] = useState<string[]>([]);
  const [pricePerHour, setPricePerHour] = useState("");
  const [minGroup, setMinGroup] = useState("");
  const [maxGroup, setMaxGroup] = useState("");
  const [payoutType, setPayoutType] = useState<"bank" | "upi" | null>(null);
  const [payoutDetails, setPayoutDetails] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Read non-payout profile fields from the public view
      const { data: cp } = await supabase
        .from("coach_profiles_public")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      // Read payout fields from the owner-only view
      const { data: payout } = await supabase
        .from("coach_profile_payout_public")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const { data: venues } = await supabase
        .from("venues")
        .select("*, venue_media(*)")
        .eq("coach_id", user.id)
        .eq("is_default", true)
        .maybeSingle();

      const { data: avail } = await supabase
        .from("coach_availability")
        .select("*")
        .eq("coach_id", user.id);

      if (cp) {
        setPricePerHour(String(cp.default_price_per_hour ?? ""));
        setMinGroup(String(cp.default_min_group_size ?? ""));
        setMaxGroup(String(cp.default_max_group_size ?? ""));
      }
      if (payout) {
        setPayoutType(payout.payout_type);
        setPayoutDetails(payout.payout_details_masked ?? "");
        setTermsAccepted(payout.terms_accepted);
      }
      if (venues) {
        setVenueName(venues.name);
        setVenueAddress(venues.address);
        setVenueCity(venues.city);
        setVenuePhotos((venues.venue_media ?? []).map((m: any) => m.public_url));
      }
      if (avail) {
        const map: Record<number, { start: string; end: string; available: boolean }> = {};
        avail.forEach((a: any) => {
          map[a.day_of_week] = { start: a.start_time, end: a.end_time, available: a.is_available };
        });
        setAvailability(map);
      }
      setLoading(false);
    })();
  }, [user]);

  const completion = () => {
    let count = 0;
    const hasAvailability = Object.values(availability).some((a) => a.available);
    if (hasAvailability) count++;
    if (venueName && venueAddress && venueCity && venuePhotos.length >= 3) count++;
    if (pricePerHour && minGroup && maxGroup) count++;
    if (payoutType && payoutDetails) count++;
    if (termsAccepted) count++;
    return Math.round((count / CHECKLIST_ITEMS.length) * 100);
  };

  const saveAvailability = async () => {
    if (!user) return;
    const rows = Object.entries(availability).map(([day, a]) => ({
      coach_id: user.id,
      day_of_week: parseInt(day, 10),
      start_time: a.start,
      end_time: a.end,
      is_available: a.available,
    }));
    for (const row of rows) {
      await supabase.from("coach_availability").upsert(row);
    }
  };

  const saveVenue = async () => {
    if (!user) return;
    const { data: existing } = await supabase
      .from("venues")
      .select("id")
      .eq("coach_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("venues")
        .update({ name: venueName, address: venueAddress, city: venueCity })
        .eq("id", existing.id);
    } else {
      const { data: v } = await supabase
        .from("venues")
        .insert({ coach_id: user.id, name: venueName, address: venueAddress, city: venueCity, is_default: true })
        .select()
        .single();
      if (v) {
        for (const photo of venuePhotos) {
          await supabase.from("venue_media").insert({ venue_id: v.id, storage_path: photo, kind: "image", public_url: photo });
        }
      }
    }
  };

  const saveCoachProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save non-payout fields directly (owner can write their own profile)
      await supabase.from("coach_profiles").upsert({
        id: user.id,
        default_price_per_hour: pricePerHour ? parseInt(pricePerHour, 10) : null,
        default_min_group_size: minGroup ? parseInt(minGroup, 10) : null,
        default_max_group_size: maxGroup ? parseInt(maxGroup, 10) : null,
        terms_accepted: termsAccepted,
        terms_accepted_at: termsAccepted ? new Date().toISOString() : null,
      });

      // Save payout details via encrypted RPC (write-only, returns masked)
      if (payoutType && payoutDetails) {
        const { error: payoutError } = await supabase.rpc("set_coach_payout_details", {
          p_coach_id: user.id,
          p_payout_type: payoutType,
          p_payout_details: payoutDetails,
        });
        if (payoutError) throw payoutError;
      }

      Alert.alert("Saved", "Coach setup updated");
    } catch {
      Alert.alert("Error", "Failed to save setup");
    } finally {
      setSaving(false);
    }
  };

  // maskPayout kept for display only; encryption happens server-side via pgsodium
  const maskPayout = (details: string, type: string | null): string => {
    if (!details) return "";
    if (type === "upi") {
      const parts = details.split("@");
      return parts.length > 1 ? `***@${parts[1]}` : "****";
    }
    return details.length > 4 ? `****${details.slice(-4)}` : "****";
  };

  const pickVenuePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not supported", "Image picker not supported on web");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = `${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("venue-photos").upload(fileName, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("venue-photos").getPublicUrl(fileName);
      setVenuePhotos([...venuePhotos, urlData.publicUrl]);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : String(e));
    }
  };

  const isComplete = completion() === 100;

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
          <Text style={ss.title}>Coach Setup Checklist</Text>
          <Text style={ss.subtitle}>Complete all steps before hosting sessions</Text>
        </View>

        <View style={ss.progressCard}>
          <Text style={ss.progressTitle}>Progress</Text>
          <View style={ss.progressBar}>
            <View style={[ss.progressFill, { width: `${completion()}%` }]} />
          </View>
          <Text style={ss.progressText}>{completion()}% complete</Text>
        </View>

        {CHECKLIST_ITEMS.map((item) => {
          const done = isItemDone(item.key);
          return (
            <View key={item.key} style={ss.itemCard}>
              <View style={ss.itemRow}>
                <Text style={[ss.itemLabel, done && ss.itemLabelDone]}>{item.label}</Text>
                {done ? <Text style={ss.itemDone}>Done</Text> : null}
              </View>
              {item.key === "availability" && (
                <AvailabilitySection availability={availability} setAvailability={setAvailability} />
              )}
              {item.key === "venue" && (
                <VenueSection
                  venueName={venueName}
                  setVenueName={setVenueName}
                  venueAddress={venueAddress}
                  setVenueAddress={setVenueAddress}
                  venueCity={venueCity}
                  setVenueCity={setVenueCity}
                  venuePhotos={venuePhotos}
                  setVenuePhotos={setVenuePhotos}
                  pickVenuePhoto={pickVenuePhoto}
                />
              )}
              {item.key === "pricing" && (
                <PricingSection
                  pricePerHour={pricePerHour}
                  setPricePerHour={setPricePerHour}
                  minGroup={minGroup}
                  setMinGroup={setMinGroup}
                  maxGroup={maxGroup}
                  setMaxGroup={setMaxGroup}
                />
              )}
              {item.key === "payout" && (
                <PayoutSection
                  payoutType={payoutType}
                  setPayoutType={setPayoutType}
                  payoutDetails={payoutDetails}
                  setPayoutDetails={setPayoutDetails}
                  masked={maskPayout(payoutDetails, payoutType)}
                />
              )}
              {item.key === "terms" && (
                <TermsSection termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} />
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={ss.saveButton}
          onPress={async () => {
            await saveAvailability();
            await saveVenue();
            await saveCoachProfile();
          }}
          disabled={saving}
        >
          <Text style={ss.saveText}>{saving ? "Saving…" : "Save all setup"}</Text>
        </TouchableOpacity>

        {isComplete && (
          <TouchableOpacity style={ss.finishButton} onPress={() => router.push("/(tabs)/profile")}>
            <Text style={ss.finishText}>Setup complete — view coach profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );

  function isItemDone(key: string): boolean {
    switch (key) {
      case "availability":
        return Object.values(availability).some((a) => a.available);
      case "venue":
        return Boolean(venueName && venueAddress && venueCity && venuePhotos.length >= 3);
      case "pricing":
        return Boolean(pricePerHour && minGroup && maxGroup);
      case "payout":
        return Boolean(payoutType && payoutDetails);
      case "terms":
        return termsAccepted;
      default:
        return false;
    }
  }
}

// ---------- Section components ----------

function AvailabilitySection({ availability, setAvailability }: any) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <View style={ss.section}>
      {days.map((day, i) => {
        const a = availability[i] || { start: "09:00", end: "17:00", available: false };
        return (
          <View key={day} style={ss.dayRow}>
            <Text style={ss.dayLabel}>{day}</Text>
            <TouchableOpacity
              style={[ss.toggle, a.available && ss.toggleOn]}
              onPress={() => {
                setAvailability((c: any) => ({ ...c, [i]: { ...c[i], available: !a.available } }));
              }}
            >
              <Text style={ss.toggleText}>{a.available ? "ON" : "OFF"}</Text>
            </TouchableOpacity>
            <TextInput
              value={a.start}
              onChangeText={(t) =>
                setAvailability((c: any) => ({ ...c, [i]: { ...c[i], start: t } }))
              }
              style={ss.timeInput}
              placeholder="Start"
            />
            <TextInput
              value={a.end}
              onChangeText={(t) =>
                setAvailability((c: any) => ({ ...c, [i]: { ...c[i], end: t } }))
              }
              style={ss.timeInput}
              placeholder="End"
            />
          </View>
        );
      })}
    </View>
  );
}

function VenueSection({
  venueName,
  setVenueName,
  venueAddress,
  setVenueAddress,
  venueCity,
  setVenueCity,
  venuePhotos,
  setVenuePhotos,
  pickVenuePhoto,
}: any) {
  return (
    <View style={ss.section}>
      <TextInput value={venueName} onChangeText={setVenueName} placeholder="Venue name" style={ss.input} />
      <TextInput value={venueAddress} onChangeText={setVenueAddress} placeholder="Exact address" style={ss.input} />
      <TextInput value={venueCity} onChangeText={setVenueCity} placeholder="City" style={ss.input} />
      <View style={ss.photoGrid}>
        {venuePhotos.map((url: string, i: number) => (
          <View key={i} style={ss.photoItem}>
            <Image source={{ uri: url }} style={ss.photoImage} />
          </View>
        ))}
        {venuePhotos.length < 3 && (
          <TouchableOpacity style={ss.addPhoto} onPress={pickVenuePhoto}>
            <Text style={ss.addPhotoText}>+ Add photo</Text>
          </TouchableOpacity>
        )}
        <Text style={ss.photoHint}>{venuePhotos.length}/3 photos</Text>
      </View>
    </View>
  );
}

function PricingSection({
  pricePerHour,
  setPricePerHour,
  minGroup,
  setMinGroup,
  maxGroup,
  setMaxGroup,
}: any) {
  return (
    <View style={ss.section}>
      <View style={ss.fieldRow}>
        <TextInput value={pricePerHour} onChangeText={setPricePerHour} keyboardType="numeric" placeholder="Price per hour (₹)" style={ss.priceInput} />
        <TextInput value={minGroup} onChangeText={setMinGroup} keyboardType="numeric" placeholder="Min group" style={ss.groupInput} />
        <TextInput value={maxGroup} onChangeText={setMaxGroup} keyboardType="numeric" placeholder="Max group" style={ss.groupInput} />
      </View>
    </View>
  );
}

function PayoutSection({
  payoutType,
  setPayoutType,
  payoutDetails,
  setPayoutDetails,
  masked,
}: any) {
  return (
    <View style={ss.section}>
      <View style={ss.payoutRow}>
        <TouchableOpacity style={[ss.payoutChip, payoutType === "upi" && ss.payoutChipSelected]} onPress={() => setPayoutType("upi")}>
          <Text style={ss.payoutChipText}>UPI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ss.payoutChip, payoutType === "bank" && ss.payoutChipSelected]} onPress={() => setPayoutType("bank")}>
          <Text style={ss.payoutChipText}>Bank</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        value={payoutDetails}
        onChangeText={setPayoutDetails}
        placeholder="UPI ID or account number"
        style={ss.input}
      />
      <Text style={ss.maskedText}>Stored masked: {masked}</Text>
    </View>
  );
}

function TermsSection({ termsAccepted, setTermsAccepted }: any) {
  return (
    <View style={ss.section}>
      <TouchableOpacity
        style={[ss.termsRow, termsAccepted && ss.termsRowChecked]}
        onPress={() => setTermsAccepted((t: boolean) => !t)}
      >
        <Text style={[ss.termsCheckbox, termsAccepted && ss.termsCheckboxChecked]}>
          {termsAccepted ? "☑" : "☐"}
        </Text>
        <Text style={ss.termsText}>
          I accept the coach terms and agree to maintain session quality and reliability.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 16, minHeight: "100%" },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#666" },
  progressCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  progressTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e5e5",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: 8,
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  progressText: { fontSize: 13, fontWeight: "600", color: "#007AFF" },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  itemLabel: { fontSize: 15, fontWeight: "600", color: "#444" },
  itemLabelDone: { color: "#4caf50" },
  itemDone: { fontSize: 13, fontWeight: "600", color: "#4caf50" },
  section: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    width: 110,
  },
  groupInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    width: 70,
  },
  fieldRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  photoItem: { width: 70, height: 70, borderRadius: 8, overflow: "hidden", backgroundColor: "#f5f5f5" },
  photoImage: { width: "100%", height: "100%" },
  addPhoto: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dashed",
  },
  addPhotoText: { fontSize: 12, color: "#007AFF" },
  photoHint: { fontSize: 12, color: "#999", marginTop: 6 },
  payoutRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  payoutChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  payoutChipSelected: { backgroundColor: "#eef6ff", borderColor: "#007AFF" },
  payoutChipText: { fontSize: 13, fontWeight: "600" },
  maskedText: { fontSize: 12, color: "#666", marginTop: 6 },
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
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  dayLabel: { width: 40, fontSize: 13, color: "#444" },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOn: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  toggleText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  timeInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 6,
    fontSize: 13,
    width: 70,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  finishButton: {
    backgroundColor: "#4caf50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  finishText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
