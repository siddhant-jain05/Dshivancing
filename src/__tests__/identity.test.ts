import { describe, it, expect, beforeEach } from "vitest";
import { StubIdentityVerifier } from "@/types/coach";

describe("StubIdentityVerifier", () => {
  beforeEach(() => {
    // Reset env for each test
    delete process.env.EXPO_PUBLIC_APP_ENV;
  });

  it("fails closed outside development", () => {
    process.env.EXPO_PUBLIC_APP_ENV = "production";
    const verifier = new StubIdentityVerifier();
    return expect(verifier.verify("ID-123456", "government_id")).rejects.toThrow(
      "disabled outside development"
    );
  });

  it("fails closed when APP_ENV is not set", () => {
    // EXPO_PUBLIC_APP_ENV is undefined
    const verifier = new StubIdentityVerifier();
    return expect(verifier.verify("ID-123456", "government_id")).rejects.toThrow(
      "disabled outside development"
    );
  });

  it("returns verified in development", async () => {
    process.env.EXPO_PUBLIC_APP_ENV = "development";
    const verifier = new StubIdentityVerifier();
    const result = await verifier.verify("ID-123456", "government_id");
    expect(result.verified).toBe(true);
  });

  it("does not set gender to enable women-only eligibility", async () => {
    process.env.EXPO_PUBLIC_APP_ENV = "development";
    const verifier = new StubIdentityVerifier();
    const result = await verifier.verify("ID-123456", "government_id");
    // Gender is returned as prefer_not_to_say, never used for women-only eligibility
    expect(result.genderOnId).toBe("prefer_not_to_say");
    expect(result.genderOnId).not.toBe("female");
    expect(result.genderOnId).not.toBe("male");
  });
});
