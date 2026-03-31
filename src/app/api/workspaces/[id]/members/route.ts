import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/workspaces/[id]/members
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (members || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    fullName: (m.profiles as any)?.full_name || "",
    email: (m.profiles as any)?.email || "",
    avatarUrl: (m.profiles as any)?.avatar_url || null,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({ members: formatted });
}

// DELETE /api/workspaces/[id]/members — remove member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (callerMembership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  const { userId } = await request.json();

  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot remove yourself as owner" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
