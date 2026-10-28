import { useState, useCallback } from "react";
import { Alert } from "react-native";
import type { IdentityVerifier } from "@/types/coach";

export function useIdentity(verifier: IdentityVerifier) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ verified: boolean; genderOnId: string } | null>(null);

  const verify = useCallback(
    async (idNumber: string, idType: string) => {
      setVerifying(true);
      try {
        const res = await verifier.verify(idNumber, idType);
        setResult(res);
        return res;
      } catch {
        Alert.alert("Verification failed", "Could not verify identity");
        return null;
      } finally {
        setVerifying(false);
      }
    },
    [verifier]
  );

  return { verifying, result, verify };
}
