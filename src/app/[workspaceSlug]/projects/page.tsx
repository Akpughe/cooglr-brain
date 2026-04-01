import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LayoutGrid } from "lucide-react";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) redirect(`/${workspaceSlug}`);

  const { data: firstProject } = await supabase
    .from("projects")
    .select("id")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (firstProject) {
    redirect(`/${workspaceSlug}/projects/${firstProject.id}`);
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <LayoutGrid className="w-7 h-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">No projects yet</h1>
        <p className="text-muted-foreground text-sm">Create a project from the sidebar to get started.</p>
      </div>
    </div>
  );
}
