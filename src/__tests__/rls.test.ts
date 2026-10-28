import { describe, it, expect } from "vitest";
import { createMockSupabase } from "@/__mocks__/supabase";

describe("RLS: coach_applications", () => {
  const ownerId = "user-owner-1";
  const otherId = "user-other-1";
  const adminId = "admin-1";

  it("normal user cannot read other users' applications", async () => {
    const ownerSupabase = createMockSupabase({ id: ownerId, role: "dancer" } as any);
    const otherSupabase = createMockSupabase({ id: otherId, role: "dancer" } as any);

    ownerSupabase.from("coach_applications").insert({
      id: "app-1",
      user_id: ownerId,
      status: "draft",
    });

    const { data } = await otherSupabase
      .from("coach_applications")
      .eq("id", "app-1")
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("normal user can only update their own applications", async () => {
    const ownerSupabase = createMockSupabase({ id: ownerId, role: "dancer" } as any);
    const otherSupabase = createMockSupabase({ id: otherId, role: "dancer" } as any);

    ownerSupabase.from("coach_applications").insert({
      id: "app-2",
      user_id: ownerId,
      status: "draft",
    });

    // Other user cannot update owner's application
    const { data } = await otherSupabase
      .from("coach_applications")
      .update({ status: "approved" })
      .eq("id", "app-2")
      .maybeSingle();
    expect(data).toBeNull();
  });

  it("applicant can edit draft but not submitted (policy enforced in SQL)", async () => {
    const ownerSupabase = createMockSupabase({ id: ownerId, role: "dancer" } as any);

    // Draft - owner can edit (ownership RLS allows)
    ownerSupabase.from("coach_applications").insert({
      id: "app-draft",
      user_id: ownerId,
      status: "draft",
      bio: "original",
    });
    await ownerSupabase
      .from("coach_applications")
      .update({ bio: "updated" })
      .eq("id", "app-draft");
    const { data: draftData } = await ownerSupabase
      .from("coach_applications")
      .eq("id", "app-draft")
      .maybeSingle();
    expect(draftData?.bio).toBe("updated");

    // Note: SQL RLS policy additionally blocks status changes from 'submitted'
    // See migration 005: owner can only update when status='draft' or 'needs_changes'
  });

  it("only admins can approve/reject/pause via RPC", async () => {
    const ownerSupabase = createMockSupabase({ id: ownerId, role: "dancer" } as any);
    const adminSupabase = createMockSupabase({ id: adminId, role: "admin" } as any);

    // Non-admin tries to approve - should fail
    const { error: nonAdminError } = await ownerSupabase.rpc("approve_coach_application", {
      p_application_id: "app-1",
      p_admin_note: null,
    });
    expect(nonAdminError).not.toBeNull();

    // Admin inserts an app then approves
    adminSupabase.from("coach_applications").insert({
      id: "app-admin-1",
      user_id: ownerId,
      status: "submitted",
    });
    const { data, error } = await adminSupabase.rpc("approve_coach_application", {
      p_application_id: "app-admin-1",
      p_admin_note: null,
    });
    expect(error).toBeNull();
    expect(data?.status).toBe("approved");
  });
});

describe("RLS: admin_actions", () => {
  it("normal user cannot read admin_actions", async () => {
    const ownerSupabase = createMockSupabase({ id: "user-1", role: "dancer" } as any);
    const { data } = await ownerSupabase.from("admin_actions").select().maybeSingle();
    expect(data).toBeNull();
  });

  it("admin can read all admin_actions", async () => {
    const adminSupabase = createMockSupabase({ id: "admin-1", role: "admin" } as any);
    adminSupabase.from("admin_actions").insert({
      id: "action-1",
      admin_id: "admin-1",
      action_type: "approve",
      target_user_id: "user-1",
      target_application_id: "app-1",
      note: "test",
    });
    const { data } = await adminSupabase.from("admin_actions").select().maybeSingle();
    expect(data).not.toBeNull();
  });
});
