import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { CoachApplication } from "@/types/coach";
import { Alert } from "react-native";

export function useCoach(userId: string | null) {
  const [application, setApplication] = useState<CoachApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!userId) {
      setApplication(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coach_applications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      setApplication(data as CoachApplication | null);
    } catch {
      Alert.alert("Error", "Failed to load application");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      await loadApplication();
    })();
  }, [loadApplication]);

  const upsertDraft = useCallback(
    async (updates: Partial<CoachApplication>) => {
      if (!userId) return false;
      setSaving(true);
      try {
        const existing = application;
        const payload = {
          user_id: userId,
          status: existing?.status ?? "draft",
          ...updates,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("coach_applications").upsert(payload);
        if (error) throw error;
        const { data } = await supabase
          .from("coach_applications")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        setApplication(data as CoachApplication | null);
        return true;
      } catch {
        Alert.alert("Error", "Failed to save draft");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId, application]
  );

  const submitApplication = useCallback(async () => {
    if (!userId) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("coach_applications")
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
      const { data } = await supabase
        .from("coach_applications")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      setApplication(data as CoachApplication | null);
      return true;
    } catch {
      Alert.alert("Error", "Failed to submit application");
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  return {
    application,
    loading,
    saving,
    loadApplication,
    upsertDraft,
    submitApplication,
  };
}
