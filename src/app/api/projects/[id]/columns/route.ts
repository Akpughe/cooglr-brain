import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/projects/[id]/columns
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("project_columns")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ columns: data });
}

// POST /api/projects/[id]/columns
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, color } = await request.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Get next position
  const { data: existing } = await supabase
    .from("project_columns")
    .select("position")
    .eq("project_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (existing?.position ?? -1) + 1;

  const { data, error } = await supabase
    .from("project_columns")
    .insert({ project_id: id, name, color: color || "gray", position: nextPosition })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ column: data }, { status: 201 });
}
