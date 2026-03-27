import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.user_metadata?.name?.split(" ")[0] ||
    user?.email?.split("@")[0] || "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Check which integrations are connected
  const { data: accounts } = await supabase
    .from("external_accounts")
    .select("provider")
    .eq("user_id", user!.id);

  const { data: dbConnections } = await supabase
    .from("database_connections")
    .select("id")
    .eq("user_id", user!.id);

  const connectedProviders = (accounts || []).map((a) => a.provider);
  const hasGithub = connectedProviders.includes("github");
  const hasGoogle = connectedProviders.includes("google");
  const hasDatabase = (dbConnections || []).length > 0;

  return (
    <DashboardContent
      greeting={greeting}
      firstName={firstName}
      hasGithub={hasGithub}
      hasGoogle={hasGoogle}
      hasDatabase={hasDatabase}
    />
  );
}
