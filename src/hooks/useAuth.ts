import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Alert } from "react-native";

export type AuthUser = User & {
  role?: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: any } }) => {
      setUser(data.user as AuthUser);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser((session?.user as AuthUser) || null);
      setLoading(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithOtp = useCallback(async (phone: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: "sms",
      },
    });
    setLoading(false);
    if (error) {
      Alert.alert("OTP error", error.message);
      return false;
    }
    return true;
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, token: string) => {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      setLoading(false);
      if (error) {
        Alert.alert("Verification error", error.message);
        return false;
      }
      return !!data.session;
    },
    [],
  );

  const resendOtp = useCallback(
    async (phone: string) => {
      return signInWithOtp(phone);
    },
    [signInWithOtp],
  );

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  }, []);

  return { user, loading, signInWithOtp, verifyOtp, resendOtp, signOut };
}
