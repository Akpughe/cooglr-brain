import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/projects/tasks/[taskId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.taskType !== undefined) updates.task_type = body.taskType;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assigneeId !== undefined) updates.assignee_id = body.assigneeId;
  if (body.labels !== undefined) updates.labels = body.labels;
  if (body.dueDate !== undefined) updates.due_date = body.dueDate;
  if (body.githubRepo !== undefined) updates.github_repo = body.githubRepo;
  if (body.columnId !== undefined) updates.column_id = body.columnId;
  if (body.position !== undefined) updates.position = body.position;

  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", taskId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// DELETE /api/projects/tasks/[taskId]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
