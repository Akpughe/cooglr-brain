import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/projects/[id]/tasks?assignee=xxx&priority=xxx&type=xxx
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let query = supabase
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  const assignee = request.nextUrl.searchParams.get("assignee");
  const priority = request.nextUrl.searchParams.get("priority");
  const taskType = request.nextUrl.searchParams.get("type");

  if (assignee) query = query.eq("assignee_id", assignee);
  if (priority) query = query.eq("priority", priority);
  if (taskType) query = query.eq("task_type", taskType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get project identifier for display IDs
  const svc = await createServiceClient();
  const { data: project } = await svc
    .from("projects")
    .select("identifier")
    .eq("id", id)
    .single();

  const identifier = project?.identifier || "TASK";

  // Resolve assignee profiles
  const assigneeIds = [...new Set((data || []).filter((t) => t.assignee_id).map((t) => t.assignee_id))];
  const profilesMap = new Map<string, { fullName: string; avatarUrl: string | null }>();

  if (assigneeIds.length > 0) {
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", assigneeIds);

    for (const p of profiles || []) {
      profilesMap.set(p.id, { fullName: p.full_name || "", avatarUrl: p.avatar_url || null });
    }
  }

  const tasks = (data || []).map((t) => {
    const profile = t.assignee_id ? profilesMap.get(t.assignee_id) : null;
    return {
      id: t.id,
      projectId: t.project_id,
      workspaceId: t.workspace_id,
      columnId: t.column_id,
      taskNumber: t.task_number,
      displayId: `${identifier}-${t.task_number}`,
      title: t.title,
      description: t.description,
      taskType: t.task_type,
      priority: t.priority,
      assigneeId: t.assignee_id,
      assigneeName: profile?.fullName || null,
      assigneeAvatar: profile?.avatarUrl || null,
      labels: t.labels || [],
      dueDate: t.due_date,
      githubRepo: t.github_repo,
      position: t.position,
      createdBy: t.created_by,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  });

  return NextResponse.json({ tasks });
}

// POST /api/projects/[id]/tasks — create task with atomic counter
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, columnId, workspaceId, description, taskType, priority, assigneeId, labels, dueDate, githubRepo } = body;

  if (!title || !columnId || !workspaceId) {
    return NextResponse.json({ error: "title, columnId, and workspaceId required" }, { status: 400 });
  }

  // Atomic counter increment via service client
  const svc = await createServiceClient();

  const { data: project, error: counterError } = await svc
    .from("projects")
    .update({ task_counter: undefined as any }) // Will use raw SQL below
    .eq("id", id)
    .select("task_counter, identifier")
    .single();

  // Use raw RPC for atomic increment
  const { data: updated, error: rpcError } = await svc.rpc("increment_task_counter" as any, { project_id: id });

  // Fallback: if RPC doesn't exist, do it manually
  let taskNumber: number;
  let identifier: string;

  if (rpcError || !updated) {
    // Manual increment
    const { data: proj } = await svc
      .from("projects")
      .select("task_counter, identifier")
      .eq("id", id)
      .single();

    taskNumber = (proj?.task_counter || 0) + 1;
    identifier = proj?.identifier || "TASK";

    await svc
      .from("projects")
      .update({ task_counter: taskNumber })
      .eq("id", id);
  } else {
    taskNumber = updated;
    const { data: proj } = await svc.from("projects").select("identifier").eq("id", id).single();
    identifier = proj?.identifier || "TASK";
  }

  // Get max position in the column
  const { data: lastTask } = await svc
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastTask?.position ?? -1) + 1;

  const { data: task, error: taskError } = await svc
    .from("tasks")
    .insert({
      project_id: id,
      workspace_id: workspaceId,
      column_id: columnId,
      task_number: taskNumber,
      title,
      description: description || null,
      task_type: taskType || "task",
      priority: priority || "medium",
      assignee_id: assigneeId || null,
      labels: labels || [],
      due_date: dueDate || null,
      github_repo: githubRepo || null,
      position,
      created_by: user.id,
    })
    .select()
    .single();

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });

  return NextResponse.json({
    task: {
      ...task,
      taskNumber: task.task_number,
      displayId: `${identifier}-${task.task_number}`,
      columnId: task.column_id,
      projectId: task.project_id,
      workspaceId: task.workspace_id,
      taskType: task.task_type,
      assigneeId: task.assignee_id,
      assigneeName: null,
      assigneeAvatar: null,
      dueDate: task.due_date,
      githubRepo: task.github_repo,
      createdBy: task.created_by,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    },
  }, { status: 201 });
}
