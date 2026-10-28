import { createMockSupabase } from "./src/__mocks__/supabase.ts";

const supabase = createMockSupabase({ id: "user-owner-1", role: "dancer" });

supabase.from("coach_applications").insert({
  id: "app-draft",
  user_id: "user-owner-1",
  status: "draft",
  bio: "original",
});

await supabase.from("coach_applications").update({ bio: "updated" }).eq("id", "app-draft");

const { data } = await supabase.from("coach_applications").eq("id", "app-draft").maybeSingle();
console.log("Result:", JSON.stringify(data, null, 2));
