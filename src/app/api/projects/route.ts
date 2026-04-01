import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/projects?workspaceId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get task counts per project
  const svc = await createServiceClient();
  const projectIds = (data || []).map((p) => p.id);

  const taskCounts = new Map<string, number>();
  if (projectIds.length > 0) {
    const { data: tasks } = await svc
      .from("tasks")
      .select("project_id")
      .in("project_id", projectIds);

    for (const t of tasks || []) {
      taskCounts.set(t.project_id, (taskCounts.get(t.project_id) || 0) + 1);
    }
  }

  const projects = (data || []).map((p) => ({
    id: p.id,
    workspaceId: p.workspace_id,
    name: p.name,
    description: p.description,
    identifier: p.identifier,
    taskCounter: p.task_counter,
    createdBy: p.created_by,
    createdAt: p.created_at,
    taskCount: taskCounts.get(p.id) || 0,
  }));

  return NextResponse.json({ projects });
}

// POST /api/projects — create project + default columns
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, name, description, identifier } = await request.json();
  if (!workspaceId || !name || !identifier) {
    return NextResponse.json({ error: "workspaceId, name, and identifier required" }, { status: 400 });
  }

  const cleanIdentifier = identifier.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

  // Use service client for creation (avoids RLS issues with immediate read-back)
  const svc = await createServiceClient();

  const { data: project, error: projError } = await svc
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      name,
      description: description || null,
      identifier: cleanIdentifier,
      created_by: user.id,
    })
    .select()
    .single();

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 });

  // Create default columns
  const { error: colError } = await svc
    .from("project_columns")
    .insert([
      { project_id: project.id, name: "To Do", color: "red", position: 0 },
      { project_id: project.id, name: "In Progress", color: "blue", position: 1 },
      { project_id: project.id, name: "Done", color: "green", position: 2 },
    ]);

  if (colError) return NextResponse.json({ error: colError.message }, { status: 500 });

  return NextResponse.json({ project: { ...project, taskCount: 0 } }, { status: 201 });
}
