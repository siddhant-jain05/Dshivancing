import { useState, useEffect } from "react";
import { Button, Text, TextInput, View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

export default function VerifyOTPScreen() {
  const { verifyOtp, resendOtp, user } = useAuth();
  const router = useRouter();
  const { phone } = useLocalSearchParams();
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (user) {
      router.replace("/(tabs)");
    }
  }, [user, router]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setInterval(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearInterval(t);
    }
  }, [resendCooldown]);

  const handleVerify = async () => {
    if (!token.trim()) return;
    setVerifying(true);
    const ok = await verifyOtp(phone as string, token);
    setVerifying(false);
    if (ok) router.replace("/(tabs)");
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    await resendOtp(phone as string);
    setResendCooldown(30);
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 20 }}>
        <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>Verify OTP</Text>
        <Text style={{ color: "#666", marginBottom: 16 }}>Enter the code sent to {phone}</Text>

        <TextInput
          placeholder="6-digit code"
          value={token}
          onChangeText={setToken}
          keyboardType="number-pad"
          maxLength={6}
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 8,
            padding: 12,
            fontSize: 18,
            marginBottom: 16,
            textAlign: "center",
          }}
        />

        <Button title="Verify" onPress={handleVerify} disabled={verifying} />
        {verifying && <ActivityIndicator size="small" style={{ marginTop: 8 }} />}

        <View style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: "#666", fontSize: 14 }}>No code received?</Text>
          <TouchableOpacity
            onPress={handleResend}
            disabled={resendCooldown > 0}
            style={{ paddingVertical: 2 }}
          >
            <Text
              style={{
                color: resendCooldown > 0 ? "#999" : "#007AFF",
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
