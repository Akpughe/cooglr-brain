import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// PATCH /api/projects/tasks/reorder — batch reorder
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tasks } = await request.json();

  if (!tasks || !Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks array required" }, { status: 400 });
  }

  // Batch update each task's column_id and position
  const errors = [];
  for (const t of tasks) {
    const { error } = await supabase
      .from("tasks")
      .update({ column_id: t.columnId, position: t.position, updated_at: new Date().toISOString() })
      .eq("id", t.id);

    if (error) errors.push({ id: t.id, error: error.message });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some updates failed", errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
