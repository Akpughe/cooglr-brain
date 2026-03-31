import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WORKSPACE_SLUG_REGEX } from "@/lib/constants";
import { formatMember } from "@/lib/workspace/helpers";

// GET /api/workspaces/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: members } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", id);

  const { data: apps } = await supabase
    .from("workspace_apps")
    .select(`
      app_id, installed_at,
      app_registry:app_id (id, name, icon, route, has_sidebar, category, sort_order)
    `)
    .eq("workspace_id", id)
    .order("installed_at", { ascending: true });

  const installedApps = (apps || [])
    .map((a) => a.app_registry)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  const formattedMembers = (members || []).map(formatMember);

  return NextResponse.json({
    workspace,
    membership: { role: membership.role },
    installedApps,
    members: formattedMembers,
  });
}

// PATCH /api/workspaces/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can update workspace" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name) updates.name = body.name;
  if (body.slug) {
    if (!WORKSPACE_SLUG_REGEX.test(body.slug)) {
      return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", body.slug)
      .neq("id", id)
      .single();
    if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    updates.slug = body.slug;
  }
  if (body.theme) updates.theme = body.theme;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ workspace: data });
}

// DELETE /api/workspaces/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the owner can delete a workspace" }, { status: 403 });
  }

  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
