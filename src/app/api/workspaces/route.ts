import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WORKSPACE_SLUG_REGEX, WORKSPACE_NAME_MAX_LENGTH } from "@/lib/constants";
import { slugify } from "@/lib/workspace/helpers";

// GET /api/workspaces — list user's workspaces
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      joined_at,
      workspaces (
        id, name, slug, avatar_url, owner_id, theme, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const workspaces = (data || []).map((m) => ({
    ...m.workspaces,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({ workspaces });
}

// POST /api/workspaces — create workspace
// Uses service client because the user has no membership yet,
// so RLS SELECT policies (which require membership) would block reads.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, slug: requestedSlug } = body;

  if (!name || name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return NextResponse.json({ error: "Name is required (max 50 chars)" }, { status: 400 });
  }

  const slug = requestedSlug || slugify(name);
  if (!WORKSPACE_SLUG_REGEX.test(slug)) {
    return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
  }

  // Use service client for workspace creation — bypasses RLS
  // because the user has no membership yet (chicken-and-egg problem)
  const serviceClient = await createServiceClient();

  // Check slug uniqueness (needs service client to see all workspaces)
  const { data: existing } = await serviceClient
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  // Create workspace
  const { data: workspace, error: wsError } = await serviceClient
    .from("workspaces")
    .insert({ name, slug, owner_id: user.id })
    .select()
    .single();

  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });

  // Add creator as owner
  const { error: memberError } = await serviceClient
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  // Install default apps
  const { data: defaultApps } = await serviceClient
    .from("app_registry")
    .select("id")
    .eq("default_installed", true);

  if (defaultApps && defaultApps.length > 0) {
    const appInserts = defaultApps.map((app) => ({
      workspace_id: workspace.id,
      app_id: app.id,
      installed_by: user.id,
    }));

    await serviceClient.from("workspace_apps").insert(appInserts);
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
