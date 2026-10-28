import { useState } from "react";
import { Button, Text, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function SignupScreen() {
  const { signInWithOtp } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phone.trim()) return;
    setSending(true);
    await signInWithOtp(phone);
    setSending(false);
    router.push("/(auth)/verify-otp?phone=" + encodeURIComponent(phone) + "&isSignup=true");
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>Create account</Text>
        <Text style={{ color: "#666", marginBottom: 24 }}>Enter your phone number to get started</Text>

        <TextInput
          placeholder="+91 XXXXX XXXXX"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 16,
            marginBottom: 16,
          }}
        />

        <Button title="Send OTP" onPress={handleSend} disabled={sending} />
        {sending && <Text style={{ marginTop: 8, color: "#666" }}>Sending...</Text>}

        <TouchableOpacity
          style={{ marginTop: 24, alignItems: "center" }}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text>Already have an account? Log in</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
