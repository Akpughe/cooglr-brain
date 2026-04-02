import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { updates, workspaceId } = await request.json();
  if (!updates || !Array.isArray(updates) || !workspaceId) {
    return NextResponse.json({ error: "updates array and workspaceId required" }, { status: 400 });
  }

  // Verify workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });

  const svc = await createServiceClient();
  const errors: { id: string; error: string }[] = [];

  for (const u of updates) {
    // Scope updates to the verified workspace
    const { error } = await svc
      .from("files")
      .update({ parent_id: u.parentId ?? null, position: u.position })
      .eq("id", u.id)
      .eq("workspace_id", workspaceId);

    if (error) errors.push({ id: u.id, error: error.message });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some updates failed", errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
