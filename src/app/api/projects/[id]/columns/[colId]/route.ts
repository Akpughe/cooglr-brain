import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/projects/[id]/columns/[colId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; colId: string }> }
) {
  const { colId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.color !== undefined) updates.color = body.color;
  if (body.position !== undefined) updates.position = body.position;

  const { data, error } = await supabase
    .from("project_columns")
    .update(updates)
    .eq("id", colId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ column: data });
}

// DELETE /api/projects/[id]/columns/[colId] — moves tasks to first column
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; colId: string }> }
) {
  const { id, colId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find the first column (by position) that isn't the one being deleted
  const svc = await createServiceClient();
  const { data: firstCol } = await svc
    .from("project_columns")
    .select("id")
    .eq("project_id", id)
    .neq("id", colId)
    .order("position", { ascending: true })
    .limit(1)
    .single();

  if (firstCol) {
    // Move tasks from deleted column to first column
    await svc
      .from("tasks")
      .update({ column_id: firstCol.id })
      .eq("column_id", colId);
  }

  const { error } = await supabase
    .from("project_columns")
    .delete()
    .eq("id", colId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
