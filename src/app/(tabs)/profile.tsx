import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getThumbnailAsync } from "expo-video-thumbnails";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";

const MAX_IMAGE_SIZE_MB = 5;
const MAX_VIDEO_DURATION_SECONDS = 60;

const STYLE_OPTIONS = ["Bollywood", "Hip Hop", "Contemporary", "Kathak", "Salsa", "Bharatanatyam", "Locking", "House"];
const LEVELS = ["beginner", "improver", "intermediate", "advanced"] as const;

type StyleLevel = { style: string; level: string };

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExp, setYearsExp] = useState("0");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [userStyles, setUserStyles] = useState<StyleLevel[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [coachApplication, setCoachApplication] = useState<any>(null);
  const [coachProfile, setCoachProfile] = useState<any>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data: prof } = await supabase
        .from("dancer_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const { data: styles } = await supabase
        .from("user_styles")
        .select("style, level")
        .eq("user_id", user.id);
      const { data: mediaRows } = await supabase
        .from("media")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (prof) {
        setName(prof.name);
        setBio(prof.bio ?? "");
        setProfilePic(prof.profile_picture_url);
        setYearsExp(String(prof.years_of_experience ?? 0));
      }
      setUserStyles((styles ?? []).map((s: any) => ({ style: s.style, level: s.level })));
      setMedia(mediaRows ?? []);

      const { data: app } = await supabase
        .from("coach_applications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setCoachApplication(app);

      const { data: cp } = await supabase
        .from("coach_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      setCoachProfile(cp);
    } catch {
      Alert.alert("Error", "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadProfile();
    })();
  }, [user, loadProfile]);

  const toggleEdit = () => setMode((m) => (m === "view" ? "edit" : "view"));

  const addStyle = () => {
    if (userStyles.length >= 5) return;
    setUserStyles([...userStyles, { style: STYLE_OPTIONS[0], level: "beginner" }]);
  };

  const removeStyle = (index: number) => {
    setUserStyles(userStyles.filter((_, i) => i !== index));
  };

  const setStyleLevel = (index: number, level: string) => {
    const next = [...userStyles];
    next[index].level = level;
    setUserStyles(next);
  };

  const setStyleName = (index: number, style: string) => {
    const next = [...userStyles];
    next[index].style = style;
    setUserStyles(next);
  };

  const saveProfile = async () => {
    if (!user || !name.trim()) {
      Alert.alert("Validation", "Name is required");
      return;
    }
    setSaving(true);
    try {
      await supabase.from("users").upsert({ id: user.id, phone: user.phone ?? "" });
      await supabase.from("dancer_profiles").upsert({
        id: user.id,
        name,
        bio,
        profile_picture_url: profilePic,
        years_of_experience: parseInt(yearsExp, 10) || 0,
      });

      await supabase.from("user_styles").delete().eq("user_id", user.id);
      if (userStyles.length) {
        await supabase
          .from("user_styles")
          .insert(userStyles.map((s) => ({ user_id: user.id, style: s.style, level: s.level })));
      }

      setMode("view");
      Alert.alert("Saved", "Profile updated");
    } catch {
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const pickMedia = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Not supported", "Media picker not supported on web");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 4],
        quality: 0.7,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      if (asset.type === "image") {
        await handleImageUpload(asset);
      } else {
        await handleVideoUpload(asset);
      }
      } catch {
        Alert.alert("Error", "Failed to pick media");
      }
    }

    const handleImageUpload = async (asset: any) => {
    if (!user) return;
    const sizeMB = (asset.fileSize ?? 0) / (1024 * 1024);
    if (sizeMB > MAX_IMAGE_SIZE_MB) {
      Alert.alert("File too large", `Images must be under ${MAX_IMAGE_SIZE_MB} MB`);
      return;
    }
    await uploadFile(asset.uri, "image");
  };

  const handleVideoUpload = async (asset: any) => {
    if (!user) return;
    const duration = asset.duration ?? 0;
    if (duration > MAX_VIDEO_DURATION_SECONDS) {
      Alert.alert("Video too long", `Videos must be under ${MAX_VIDEO_DURATION_SECONDS} seconds`);
      return;
    }
    const thumb = await getThumbnailAsync(asset.uri, { time: 1 });
    await uploadFile(asset.uri, "video", thumb.uri);
  };

  const uploadFile = async (uri: string, kind: "image" | "video", thumbnailUri?: string) => {
    if (!user) return;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = kind === "image" ? "jpg" : "mp4";
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = kind === "image" ? "profile-images" : "session-videos";

      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, blob, {
        contentType: kind === "image" ? "image/jpeg" : "video/mp4",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      await supabase.from("media").insert({
        user_id: user.id,
        storage_path: fileName,
        kind,
        duration_seconds: kind === "video" ? undefined : undefined,
      });

      setMedia((prev) => [
        { id: Date.now().toString(), storage_path: fileName, kind, public_url: publicUrl, thumbnail_url: thumbnailUri },
        ...prev,
      ]);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : String(e));
    }
  };

  const deleteMedia = async (id: string, storagePath: string) => {
    if (!user) return;
    const confirmed = await new Promise<boolean>((res) =>
      Alert.alert("Delete media", "Remove this item?", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => res(true) },
      ])
    );
    if (!confirmed) return;
    try {
      await supabase.storage.from("profile-images").remove([storagePath]);
      await supabase.storage.from("session-videos").remove([storagePath]);
      await supabase.from("media").delete().eq("id", id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
    } catch {
      Alert.alert("Error", "Failed to delete media");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={ss.header}>
          {profilePic ? (
            <Image source={{ uri: profilePic }} style={ss.avatar} />
          ) : (
            <View style={[ss.avatar, ss.avatarPlaceholder]} />
          )}
          <TouchableOpacity style={ss.editButton} onPress={toggleEdit}>
            <Text style={ss.editText}>{mode === "view" ? "Edit" : "Done"}</Text>
          </TouchableOpacity>
        </View>

        {mode === "view" ? (
          <>
            {coachProfile && !coachProfile.is_paused ? (
              <View style={ss.viewCard}>
                <Text style={ss.name}>{name}</Text>
                <Text style={ss.roleBadge}>
                  {coachProfile.probation ? "New coach" : "Coach"}
                </Text>
                {bio && <Text style={ss.bio}>{bio}</Text>}
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Experience</Text>
                  <Text style={ss.sectionValue}>{yearsExp} years</Text>
                </View>
                {userStyles.length > 0 && (
                  <View>
                    <Text style={ss.sectionTitle}>Styles & levels</Text>
                    <View style={ss.styleChips}>
                      {userStyles.map((s, i) => (
                        <View key={i} style={ss.styleChip}>
                          <Text style={ss.styleChipText}>{s.style}</Text>
                          <Text style={ss.styleChipLevel}>{s.level}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Sessions completed</Text>
                  <Text style={ss.sectionValue}>{coachProfile.sessions_completed}</Text>
                </View>
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Probation</Text>
                  <Text style={ss.sectionValue}>
                    {coachProfile.probation ? "Active (max 6/group)" : "Complete"}
                  </Text>
                </View>
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Media gallery</Text>
                  <TouchableOpacity style={ss.addMediaButton} onPress={pickMedia}>
                    <Text style={ss.addMediaText}>+ Add photo/video</Text>
                  </TouchableOpacity>
                </View>
                {media.length === 0 ? (
                  <Text style={ss.emptyMedia}>No media yet</Text>
                ) : (
                  <View style={ss.mediaGrid}>
                    {media.map((m: any) => (
                      <View key={m.id} style={ss.mediaItem}>
                        {m.kind === "image" ? (
                          <Image source={{ uri: m.public_url }} style={ss.mediaImage} />
                        ) : (
                          <View style={ss.mediaItem}>
                            <Image
                              source={{ uri: m.thumbnail_url || m.public_url }}
                              style={ss.mediaImage}
                            />
                            <View style={ss.videoBadge}>
                              <Text style={ss.videoBadgeText}>VIDEO</Text>
                            </View>
                          </View>
                        )}
                        <TouchableOpacity
                          style={ss.deleteMediaButton}
                          onPress={() => deleteMedia(m.id, m.storage_path)}
                        >
                          <Text style={ss.deleteMediaText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : coachApplication ? (
              <View style={ss.viewCard}>
                <Text style={ss.name}>{name}</Text>
                <Text style={ss.roleBadge}>Application status</Text>
                <View style={ss.statusChip}>
                  <Text style={ss.statusText}>{coachApplication.status.replace(/_/g, " ")}</Text>
                </View>
                {coachApplication.admin_note && (
                  <View style={ss.adminNoteCard}>
                    <Text style={ss.adminNoteTitle}>Admin note</Text>
                    <Text style={ss.adminNoteText}>{coachApplication.admin_note}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={ss.becomeCoachButton}
                  onPress={() => router.push("/(tabs)/coach-status")}
                >
                  <Text style={ss.becomeCoachText}>View application details</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={ss.viewCard}>
                <Text style={ss.name}>{name}</Text>
                <Text style={ss.roleBadge}>New dancer</Text>
                {bio && <Text style={ss.bio}>{bio}</Text>}
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Experience</Text>
                  <Text style={ss.sectionValue}>{yearsExp} years</Text>
                </View>
                {userStyles.length > 0 && (
                  <View>
                    <Text style={ss.sectionTitle}>Styles & levels</Text>
                    <View style={ss.styleChips}>
                      {userStyles.map((s, i) => (
                        <View key={i} style={ss.styleChip}>
                          <Text style={ss.styleChipText}>{s.style}</Text>
                          <Text style={ss.styleChipLevel}>{s.level}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                <View style={ss.sectionRow}>
                  <Text style={ss.sectionTitle}>Media gallery</Text>
                  <TouchableOpacity style={ss.addMediaButton} onPress={pickMedia}>
                    <Text style={ss.addMediaText}>+ Add photo/video</Text>
                  </TouchableOpacity>
                </View>
                {media.length === 0 ? (
                  <Text style={ss.emptyMedia}>No media yet</Text>
                ) : (
                  <View style={ss.mediaGrid}>
                    {media.map((m: any) => (
                      <View key={m.id} style={ss.mediaItem}>
                        {m.kind === "image" ? (
                          <Image source={{ uri: m.public_url }} style={ss.mediaImage} />
                        ) : (
                          <View style={ss.mediaItem}>
                            <Image
                              source={{ uri: m.thumbnail_url || m.public_url }}
                              style={ss.mediaImage}
                            />
                            <View style={ss.videoBadge}>
                              <Text style={ss.videoBadgeText}>VIDEO</Text>
                            </View>
                          </View>
                        )}
                        <TouchableOpacity
                          style={ss.deleteMediaButton}
                          onPress={() => deleteMedia(m.id, m.storage_path)}
                        >
                          <Text style={ss.deleteMediaText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={ss.becomeCoachButton}
                  onPress={() => router.push("/(tabs)/coach-intro")}
                >
                  <Text style={ss.becomeCoachText}>Become a coach</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={ss.editCard}>
            <TextInput value={name} onChangeText={setName} placeholder="Name" style={ss.input} />
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Bio"
              multiline
              numberOfLines={3}
              style={ss.bioInput}
            />
            <View style={ss.sectionRow}>
              <Text style={ss.sectionTitle}>Years of experience</Text>
              <TextInput
                value={yearsExp}
                onChangeText={setYearsExp}
                keyboardType="numeric"
                style={ss.yearsInput}
              />
            </View>
            <View style={ss.sectionRow}>
              <Text style={ss.sectionTitle}>Styles</Text>
              <TouchableOpacity style={ss.addStyleButton} onPress={addStyle}>
                <Text style={ss.addStyleText}>+ Add style</Text>
              </TouchableOpacity>
            </View>
            {userStyles.map((s, i) => (
              <View key={i} style={ss.styleEditRow}>
                <TextInput
                  value={s.style}
                  onChangeText={(t) => setStyleName(i, t)}
                  style={ss.styleInput}
                />
                <TouchableOpacity
                  style={ss.levelDropdown}
                  onPress={() => {
                    const idx = LEVELS.indexOf(s.level as any);
                    const next = LEVELS[(idx + 1) % LEVELS.length];
                    setStyleLevel(i, next);
                  }}
                >
                  <Text style={ss.levelText}>{s.level}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ss.removeStyleButton} onPress={() => removeStyle(i)}>
                  <Text style={ss.removeStyleText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={ss.saveButton} onPress={saveProfile} disabled={saving}>
              <Text style={ss.saveText}>{saving ? "Saving..." : "Save profile"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { backgroundColor: "#eee" },
  editButton: { marginRight: 4 },
  editText: { fontWeight: "600", color: "#007AFF" },
  viewCard: { padding: 16 },
  name: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
  roleBadge: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
    marginBottom: 10,
  },
  bio: { fontSize: 15, color: "#555", marginBottom: 14, lineHeight: 20 },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  addMediaButton: { flexDirection: "row", alignItems: "center", gap: 6 },
  addMediaText: { color: "#007AFF", fontWeight: "600" },
  emptyMedia: { color: "#999", marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "600" },
  sectionValue: { fontSize: 16, color: "#555" },
  styleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  styleChip: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: "center",
    gap: 4,
  },
  styleChipText: { fontSize: 13, fontWeight: "600" },
  styleChipLevel: { fontSize: 11, color: "#666" },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  mediaItem: { width: 100, height: 100, position: "relative", borderRadius: 8, overflow: "hidden" },
  mediaImage: { width: "100%", height: "100%" },
  videoBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  deleteMediaButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteMediaText: { color: "#fff", fontSize: 14, lineHeight: 24 },
  editCard: { padding: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
    textAlignVertical: "top",
    height: 80,
  },
  yearsInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    width: 60,
  },
  addStyleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  addStyleText: { color: "#007AFF", fontWeight: "600" },
  styleEditRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  styleInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    flex: 1,
  },
  levelDropdown: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  levelText: { fontSize: 13 },
  removeStyleButton: { padding: 4 },
  removeStyleText: { color: "#999", fontSize: 16 },
  saveButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  saveText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  statusChip: {
    backgroundColor: "#eef6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  statusText: { fontSize: 13, fontWeight: "600", color: "#007AFF" },
  adminNoteCard: {
    backgroundColor: "#fff3e0",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  adminNoteTitle: { fontSize: 13, fontWeight: "600", color: "#e65100", marginBottom: 4 },
  adminNoteText: { fontSize: 14, color: "#555" },
  becomeCoachButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  becomeCoachText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
