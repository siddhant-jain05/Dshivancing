import { describe, it, expect } from "vitest";

// Client-side payout masking (used for display only; encryption is server-side)
function maskPayout(details: string, type: string | null): string {
  if (!details) return "";
  if (type === "upi") {
    const parts = details.split("@");
    return parts.length > 1 ? `***@${parts[1]}` : "****";
  }
  return details.length > 4 ? `****${details.slice(-4)}` : "****";
}

describe("Payout masking", () => {
  it("masks UPI ID showing only domain", () => {
    expect(maskPayout("dancer@upi", "upi")).toBe("***@upi");
    expect(maskPayout("9876543210@paytm", "upi")).toBe("***@paytm");
  });

  it("masks bank account showing last 4 digits", () => {
    expect(maskPayout("1234567890123456", "bank")).toBe("****3456");
    expect(maskPayout("1234", "bank")).toBe("****");
  });

  it("returns empty for missing details", () => {
    expect(maskPayout("", "bank")).toBe("");
    expect(maskPayout("", null)).toBe("");
  });
});
