import { useState, useEffect, useCallback } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useCoach } from "@/hooks/useCoach";
import { useIdentity } from "@/hooks/useIdentity";
import { useAuth } from "@/hooks/useAuth";
import { StubIdentityVerifier } from "@/types/coach";
import { supabase } from "@/lib/supabase";

const STEP_TITLES: Record<string, string> = {
  styles: "Styles you teach",
  experience: "Experience",
  introVideo: "Intro video",
  samples: "Teaching samples",
  certifications: "Certifications",
  bio: "About you",
  languages: "Languages",
  social: "Social links",
  identity: "Identity verification",
  review: "Review & submit",
};

const STYLE_OPTIONS = ["Bollywood", "Hip Hop", "Contemporary", "Kathak", "Salsa", "Bharatanatyam", "Locking", "House"];
const LEVELS = ["beginner", "improver", "intermediate", "advanced"] as const;
const LANGUAGES = ["Hindi", "English", "Marathi", "Gujarati", "Tamil", "Telugu", "Kannada", "Malayalam", "Punjabi", "Bengali"];

type AppData = {
  styles_taught: { style: string; level: string }[];
  years_experience: number | null;
  intro_video_url: string | null;
  teaching_samples: string[];
  certifications: string[];
  bio: string | null;
  languages: string[];
  social_links: Record<string, string>;
};

const MAX_VIDEO_SECONDS = 60;
const MIN_VIDEO_SECONDS = 30;
const MIN_SAMPLES = 2;
const MAX_SAMPLES = 3;

export default function CoachApplicationScreen() {
  const { user } = useAuth();
  const { application, loading, saving, upsertDraft, submitApplication } = useCoach(user?.id ?? null);
  const [step, setStep] = useState("styles");
  const [stepLoading, setStepLoading] = useState(false);

  // Form state (mirrors DB columns)
  const [styles, setStyles] = useState<{ style: string; level: string }[]>([]);
  const [yearsExp, setYearsExp] = useState<string>("");
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [samples, setSamples] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const { verify, verifying: identityVerifying, result: identityResult } = useIdentity(
    new StubIdentityVerifier()
  );

  useEffect(() => {
    if (application && !loading) {
      (async () => {
        setStyles(application.styles_taught ?? []);
        setYearsExp(String(application.years_experience ?? ""));
        setIntroVideoUrl(application.intro_video_url);
        setSamples(application.teaching_samples ?? []);
        setCertifications(application.certifications ?? []);
        setBio(application.bio ?? "");
        setLanguages(application.languages ?? []);
        setSocialLinks(application.social_links ?? {});
        if (application.status === "submitted" || application.status === "under_review") {
          setStep("review");
        }
      })();
    }
  }, [application, loading]);

  const saveCurrentStep = useCallback(async () => {
    const payload: Partial<AppData> = {
      styles_taught: styles,
      years_experience: yearsExp ? parseInt(yearsExp, 10) || null : null,
      intro_video_url: introVideoUrl,
      teaching_samples: samples,
      certifications: certifications,
      bio,
      languages: languages,
      social_links: socialLinks,
    };
    await upsertDraft(payload);
  }, [styles, yearsExp, introVideoUrl, samples, certifications, bio, languages, socialLinks, upsertDraft]);

  const nextStep = async () => {
    await saveCurrentStep();
    const keys = Object.keys(STEP_TITLES);
    const idx = keys.indexOf(step);
    if (idx < keys.length - 1) setStep(keys[idx + 1]);
  };

  const prevStep = async () => {
    await saveCurrentStep();
    const keys = Object.keys(STEP_TITLES);
    const idx = keys.indexOf(step);
    if (idx > 0) setStep(keys[idx - 1]);
  };

  const handleSubmit = async () => {
    await saveCurrentStep();
    const ok = await submitApplication();
    if (ok) setStep("review");
  };

  const pickVideo = async (bucket: string, setUrl: (url: string | null) => void, minSec: number, maxSec: number) => {
    if (Platform.OS === "web") {
      Alert.alert("Not supported", "Video picker not supported on web");
      return;
    }
    setStepLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.6,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const duration = asset.duration ?? 0;
      if (duration < minSec || duration > maxSec) {
        Alert.alert(
          "Invalid duration",
          `Video must be between ${minSec} and ${maxSec} seconds`
        );
        return;
      }
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const fileName = `${Date.now()}.mp4`;
      const { error } = await supabase.storage.from(bucket).upload(fileName, blob, {
        contentType: "video/mp4",
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      setUrl(urlData.publicUrl);
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : String(e));
    } finally {
      setStepLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "styles":
        return <StylesStep styles={styles} setStyles={setStyles} />;
      case "experience":
        return <ExperienceStep yearsExp={yearsExp} setYearsExp={setYearsExp} />;
      case "introVideo":
        return <IntroVideoStep introVideoUrl={introVideoUrl} setIntroVideoUrl={setIntroVideoUrl} pickVideo={pickVideo} />;
      case "samples":
        return <SamplesStep samples={samples} setSamples={setSamples} pickVideo={pickVideo} />;
      case "certifications":
        return <CertificationsStep certifications={certifications} setCertifications={setCertifications} pickVideo={pickVideo} />;
      case "bio":
        return <BioStep bio={bio} setBio={setBio} />;
      case "languages":
        return <LanguagesStep languages={languages} setLanguages={setLanguages} />;
      case "social":
        return <SocialStep socialLinks={socialLinks} setSocialLinks={setSocialLinks} />;
      case "identity":
        return <IdentityStep
          applicationId={application?.id ?? null}
          verify={verify}
          verifying={identityVerifying}
          result={identityResult}
        />;
      case "review":
        return <ReviewStep onSubmit={handleSubmit} saving={saving} />;
      default:
        return <StylesStep styles={styles} setStyles={setStyles} />;
    }
  };

  const isLastStep = step === "review";
  const isFirstStep = step === "styles";

  return (
    <SafeAreaView style={ss.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ss.scrollContent}>
        <View style={ss.header}>
          <Text style={ss.stepTitle}>{STEP_TITLES[step]}</Text>
          <Text style={ss.stepProgress}>{stepLoading ? "Saving…" : `Step ${Object.keys(STEP_TITLES).indexOf(step) + 1} of ${Object.keys(STEP_TITLES).length}`}</Text>
        </View>

        {renderStep()}

        <View style={ss.nav}>
          {isFirstStep ? null : (
            <TouchableOpacity style={ss.prevButton} onPress={prevStep} disabled={stepLoading}>
              <Text style={ss.prevText}>Back</Text>
            </TouchableOpacity>
          )}
          {isLastStep ? (
            <TouchableOpacity style={ss.submitButton} onPress={handleSubmit} disabled={stepLoading || saving}>
              <Text style={ss.submitText}>{saving ? "Submitting…" : "Submit application"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={ss.nextButton} onPress={nextStep} disabled={stepLoading}>
              <Text style={ss.nextText}>Continue</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------- Step components ----------

function StylesStep({ styles, setStyles }: { styles: { style: string; level: string }[]; setStyles: any }) {
  const addStyle = () => {
    if (styles.length >= 5) return;
    setStyles([...styles, { style: STYLE_OPTIONS[0], level: "beginner" }]);
  };
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Select 1–5 dance styles you can teach with your self-declared level.</Text>
      {styles.map((s, i) => (
        <View key={i} style={ss.styleRow}>
          <TextInput
            value={s.style}
            onChangeText={(t) => {
              const next = [...styles];
              next[i].style = t;
              setStyles(next);
            }}
            style={ss.input}
            placeholder="Style"
          />
          <TouchableOpacity
            style={ss.levelButton}
            onPress={() => {
              const next = [...styles];
              const idx = LEVELS.indexOf(s.level as any);
              next[i].level = LEVELS[(idx + 1) % LEVELS.length];
              setStyles(next);
            }}
          >
            <Text style={ss.levelText}>{s.level}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ss.removeButton} onPress={() => setStyles(styles.filter((_, j) => j !== i))}>
            <Text style={ss.removeText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={ss.addButton} onPress={addStyle}>
        <Text style={ss.addText}>+ Add style</Text>
      </TouchableOpacity>
    </View>
  );
}

function ExperienceStep({ yearsExp, setYearsExp }: { yearsExp: string; setYearsExp: any }) {
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>How many years of dance experience do you have?</Text>
      <TextInput
        value={yearsExp}
        onChangeText={setYearsExp}
        keyboardType="numeric"
        style={ss.yearsInput}
        placeholder="Years"
      />
    </View>
  );
}

function IntroVideoStep({
  introVideoUrl,
  setIntroVideoUrl,
  pickVideo,
}: {
  introVideoUrl: string | null;
  setIntroVideoUrl: any;
  pickVideo: any;
}) {
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>
        Record a 30–60 second intro video showing your teaching ability.
      </Text>
      {introVideoUrl ? (
        <View style={ss.videoPreview}>
          <Text style={ss.previewText}>Intro video uploaded</Text>
          <TouchableOpacity style={ss.removeButton} onPress={() => setIntroVideoUrl(null)}>
            <Text style={ss.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <TouchableOpacity
        style={ss.uploadButton}
        onPress={() => pickVideo("coach-intro-videos", setIntroVideoUrl, MIN_VIDEO_SECONDS, MAX_VIDEO_SECONDS)}
      >
        <Text style={ss.uploadText}>Choose intro video</Text>
      </TouchableOpacity>
    </View>
  );
}

function SamplesStep({
  samples,
  setSamples,
  pickVideo,
}: {
  samples: string[];
  setSamples: any;
  pickVideo: any;
}) {
  const addSample = () => {
    if (samples.length >= MAX_SAMPLES) return;
    pickVideo("coach-samples", (url: string | null) => {
      if (url) setSamples([...samples, url]);
    }, MIN_VIDEO_SECONDS, MAX_VIDEO_SECONDS);
  };
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>
        Upload {MIN_SAMPLES}–{MAX_SAMPLES} teaching samples matching your styles.
      </Text>
      {samples.map((url, i) => (
        <View key={i} style={ss.videoPreview}>
          <Text style={ss.previewText}>Sample {i + 1} uploaded</Text>
          <TouchableOpacity style={ss.removeButton} onPress={() => setSamples(samples.filter((_, j) => j !== i))}>
            <Text style={ss.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      {samples.length < MAX_SAMPLES && (
        <TouchableOpacity style={ss.uploadButton} onPress={addSample}>
          <Text style={ss.uploadText}>+ Add teaching sample</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function CertificationsStep({
  certifications,
  setCertifications,
  pickVideo,
}: {
  certifications: string[];
  setCertifications: any;
  pickVideo: any;
}) {
  const addCert = () => {
    pickVideo("coach-certifications", (url: string | null) => {
      if (url) setCertifications([...certifications, url]);
    }, 1, 300);
  };
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Optional: upload certification documents or videos.</Text>
      {certifications.map((url, i) => (
        <View key={i} style={ss.videoPreview}>
          <Text style={ss.previewText}>Certification {i + 1} uploaded</Text>
          <TouchableOpacity style={ss.removeButton} onPress={() => setCertifications(certifications.filter((_, j) => j !== i))}>
            <Text style={ss.removeText}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={ss.uploadButton} onPress={addCert}>
        <Text style={ss.uploadText}>+ Add certification</Text>
      </TouchableOpacity>
    </View>
  );
}

function BioStep({ bio, setBio }: { bio: string; setBio: any }) {
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Write a short bio about yourself as a dance coach.</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={5}
        style={ss.bioInput}
        placeholder="Tell us about your dance journey and teaching approach"
      />
    </View>
  );
}

function LanguagesStep({ languages, setLanguages }: { languages: string[]; setLanguages: any }) {
  const toggle = (lang: string) => {
    setLanguages(languages.includes(lang) ? languages.filter((l) => l !== lang) : [...languages, lang]);
  };
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Select languages you can teach in.</Text>
      <View style={ss.chipGrid}>
        {LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang}
            style={[ss.chip, languages.includes(lang) && ss.chipSelected]}
            onPress={() => toggle(lang)}
          >
            <Text style={ss.chipText}>{lang}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SocialStep({ socialLinks, setSocialLinks }: { socialLinks: Record<string, string>; setSocialLinks: any }) {
  const platforms = ["instagram", "youtube", "facebook"];
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Add your social media links (optional).</Text>
      {platforms.map((p) => (
        <View key={p} style={ss.socialRow}>
          <Text style={ss.socialLabel}>{p}</Text>
          <TextInput
            value={socialLinks[p] ?? ""}
            onChangeText={(t) => {
              setSocialLinks({ ...socialLinks, [p]: t });
            }}
            style={ss.input}
            placeholder={`https://${p}.com/yourhandle`}
          />
        </View>
      ))}
    </View>
  );
}

function IdentityStep({
  applicationId,
  verify,
  verifying,
  result,
}: {
  applicationId: string | null;
  verify: any;
  verifying: boolean;
  result: any;
}) {
  const [serverResult, setServerResult] = useState<{ verified: boolean; genderOnId: string } | null>(null);

  const handleVerify = async () => {
    if (!applicationId) return;
    const res = await verify("ID-123456", "government_id");
    if (res) {
      // Persist via server-side SECURITY DEFINER function; client never writes these columns directly
      const { error } = await supabase.rpc("set_coach_identity_verification", {
        p_application_id: applicationId,
        p_verified: res.verified,
        p_gender_on_id: res.genderOnId,
      });
      if (error) {
        Alert.alert("Verification failed", error.message);
        return;
      }
      setServerResult(res);
    }
  };

  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>
        Verify your identity. We never store ID images — only the result and the gender shown on your ID.
        The ID number itself is never stored anywhere.
      </Text>
      {(result || serverResult) && (
        <View style={ss.identityResult}>
          <Text style={ss.resultText}>
            Identity {(result || serverResult)!.verified ? "verified" : "not verified"}. Gender on ID:
            {(result || serverResult)!.genderOnId}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={ss.verifyButton}
        onPress={handleVerify}
        disabled={verifying || !applicationId}
      >
        <Text style={ss.verifyText}>
          {verifying ? "Verifying…" : "Verify identity (dev stub)"}
        </Text>
      </TouchableOpacity>
      {serverResult && (
        <Text style={ss.resultText}>
          Verification result saved to server: {serverResult.verified ? "verified" : "not verified"}
        </Text>
      )}
    </View>
  );
}

function ReviewStep({ onSubmit, saving }: { onSubmit: () => Promise<void>; saving: boolean }) {
  return (
    <View style={ss.stepContent}>
      <Text style={ss.instruction}>Review your application before submitting.</Text>
      <Text style={ss.reviewNote}>Once submitted, an admin will review your application within 2 days.</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { padding: 16, minHeight: "100%" },
  header: { marginBottom: 20 },
  stepTitle: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  stepProgress: { fontSize: 13, color: "#666", marginBottom: 16 },
  stepContent: { flex: 1 },
  instruction: { fontSize: 14, color: "#555", marginBottom: 14, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  yearsInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    width: 100,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
    height: 120,
  },
  styleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  levelButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelText: { fontSize: 12 },
  removeButton: { padding: 4 },
  removeText: { color: "#999", fontSize: 16 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  addText: { color: "#007AFF", fontWeight: "600" },
  videoPreview: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewText: { fontSize: 13, color: "#444", flex: 1 },
  uploadButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  uploadText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  chipSelected: { backgroundColor: "#eef6ff", borderColor: "#007AFF", borderWidth: 1 },
  chipText: { fontSize: 13, color: "#444" },
  socialRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  socialLabel: { width: 100, fontSize: 14, color: "#444" },
  identityResult: {
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  resultText: { fontSize: 13, color: "#2e7d32" },
  verifyButton: {
    backgroundColor: "#007AFF",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 14,
  },
  verifyText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  reviewNote: { fontSize: 14, color: "#555", marginBottom: 16 },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingBottom: 20,
  },
  prevButton: { paddingVertical: 8 },
  prevText: { color: "#007AFF", fontWeight: "600", fontSize: 15 },
  nextButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  submitButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
