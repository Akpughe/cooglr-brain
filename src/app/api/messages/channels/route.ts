import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/messages/channels?workspaceId=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channels: data });
}

// POST /api/messages/channels
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, name, description } = await request.json();
  if (!workspaceId || !name) return NextResponse.json({ error: "workspaceId and name required" }, { status: 400 });

  const channelName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-|-$/g, "");

  const { data: existing } = await supabase
    .from("channels").select("id").eq("workspace_id", workspaceId).eq("name", channelName).single();

  if (existing) return NextResponse.json({ error: "Channel name already exists" }, { status: 409 });

  const { data, error } = await supabase
    .from("channels")
    .insert({ workspace_id: workspaceId, name: channelName, description: description || null, created_by: user.id })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ channel: data }, { status: 201 });
}
