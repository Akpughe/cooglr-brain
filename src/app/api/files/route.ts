import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// GET /api/files?workspaceId=X — list all accessible files (no content)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const { data, error } = await supabase
    .from("files")
    .select("id, workspace_id, parent_id, type, title, icon, is_private, position, created_by, updated_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const files = (data || []).map((f: Record<string, unknown>) => ({
    id: f.id,
    parentId: f.parent_id,
    type: f.type,
    title: f.title,
    icon: f.icon,
    isPrivate: f.is_private,
    position: f.position,
    createdBy: f.created_by,
    updatedAt: f.updated_at,
  }));

  return NextResponse.json({ files });
}

// POST /api/files — create page, folder, or file node
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, title, type, parentId, icon } = await request.json();
  if (!workspaceId || !type) {
    return NextResponse.json({ error: "workspaceId and type required" }, { status: 400 });
  }
  if (!["page", "folder", "file"].includes(type)) {
    return NextResponse.json({ error: "type must be page, folder, or file" }, { status: 400 });
  }

  // Verify workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });

  // Get next position within parent
  const svc = await createServiceClient();
  const { data: siblings } = await svc
    .from("files")
    .select("position")
    .eq("workspace_id", workspaceId)
    .is("parent_id", parentId || null)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = siblings && siblings.length > 0 ? siblings[0].position + 1 : 0;

  const { data: file, error } = await svc
    .from("files")
    .insert({
      workspace_id: workspaceId,
      parent_id: parentId || null,
      type,
      title: title || "Untitled",
      icon: icon || null,
      position: nextPosition,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    file: {
      id: file.id,
      workspaceId: file.workspace_id,
      parentId: file.parent_id,
      type: file.type,
      title: file.title,
      content: file.content,
      icon: file.icon,
      coverUrl: file.cover_url,
      storagePath: file.storage_path,
      mimeType: file.mime_type,
      fileSize: file.file_size,
      isPrivate: file.is_private,
      position: file.position,
      createdBy: file.created_by,
      updatedAt: file.updated_at,
      createdAt: file.created_at,
    },
  }, { status: 201 });
}
