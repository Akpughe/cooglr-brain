import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { count } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWizard
        user={{
          id: user.id,
          email: user.email || "",
          fullName: profile?.full_name || "",
          avatarUrl: profile?.avatar_url || "",
        }}
      />
    </div>
  );
}
