import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/workspaces/[id]/apps
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify membership
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (!callerMembership) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("workspace_apps")
    .select(`
      app_id, installed_at, installed_by,
      app_registry:app_id (id, name, description, icon, route, has_sidebar, category, sort_order, setup_required)
    `)
    .eq("workspace_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const apps = (data || [])
    .map((a) => ({ ...a.app_registry, installedAt: a.installed_at }))
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  return NextResponse.json({ apps });
}

// POST /api/workspaces/[id]/apps — install app
export async function POST(
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
    return NextResponse.json({ error: "Only owners can install apps" }, { status: 403 });
  }

  const { appId } = await request.json();

  const { data: app } = await supabase
    .from("app_registry")
    .select("id")
    .eq("id", appId)
    .single();

  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const { error } = await supabase
    .from("workspace_apps")
    .insert({ workspace_id: id, app_id: appId, installed_by: user.id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "App already installed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/workspaces/[id]/apps — uninstall app
export async function DELETE(
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
    return NextResponse.json({ error: "Only owners can uninstall apps" }, { status: 403 });
  }

  const { appId } = await request.json();

  const { error } = await supabase
    .from("workspace_apps")
    .delete()
    .eq("workspace_id", id)
    .eq("app_id", appId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
