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
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <LayoutGrid className="size-7 text-muted-foreground" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <h1 className="text-xl font-semibold">No projects yet</h1>
        <p className="max-w-xs text-sm text-muted-foreground">Create a project from the sidebar to get started.</p>
      </div>
    </div>
  );
}
