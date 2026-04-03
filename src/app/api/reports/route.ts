import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");

  const query = supabase
    .from("saved_reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  const { data } = await query;
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, connectionId, queryText, workspaceId } = await request.json();
  if (!name || !queryText) return NextResponse.json({ error: "Name and query required" }, { status: 400 });

  const { data, error } = await supabase
    .from("saved_reports")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId || null,
      name,
      description,
      connection_id: connectionId,
      query_text: queryText,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workspaceId } = await request.json();

  const query = supabase.from("saved_reports").delete().eq("id", id);
  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  await query;
  return NextResponse.json({ ok: true });
}
