import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("report_sessions")
    .select("id, name, connection_id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, connectionId } = await request.json();

  const { data, error } = await supabase
    .from("report_sessions")
    .insert({
      user_id: user.id,
      name: name || "New Report",
      connection_id: connectionId || null,
    })
    .select("id, name, connection_id, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  await supabase.from("report_sessions").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
