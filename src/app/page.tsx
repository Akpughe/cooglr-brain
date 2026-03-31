import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Fallback root page — middleware should handle "/" redirects,
// but if it doesn't (e.g., middleware skips), this page resolves the right destination.
export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has any workspaces
  const svc = await createServiceClient();
  const { data: membership } = await svc
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  if (membership) {
    const { data: ws } = await svc
      .from("workspaces")
      .select("slug")
      .eq("id", membership.workspace_id)
      .single();

    if (ws) {
      redirect(`/${ws.slug}`);
    }
  }

  // No workspaces — go to onboarding
  redirect("/onboarding");
}
