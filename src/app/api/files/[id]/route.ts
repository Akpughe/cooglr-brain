import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/files/[id] — full file with content
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  return NextResponse.json({
    file: {
      id: data.id,
      workspaceId: data.workspace_id,
      parentId: data.parent_id,
      type: data.type,
      title: data.title,
      content: data.content,
      icon: data.icon,
      coverUrl: data.cover_url,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      isPrivate: data.is_private,
      position: data.position,
      createdBy: data.created_by,
      updatedAt: data.updated_at,
      createdAt: data.created_at,
    },
  });
}

// PATCH /api/files/[id] — update any fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.coverUrl !== undefined) updates.cover_url = body.coverUrl;
  if (body.isPrivate !== undefined) updates.is_private = body.isPrivate;
  if (body.parentId !== undefined) updates.parent_id = body.parentId;
  if (body.position !== undefined) updates.position = body.position;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("files")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    file: {
      id: data.id,
      workspaceId: data.workspace_id,
      parentId: data.parent_id,
      type: data.type,
      title: data.title,
      content: data.content,
      icon: data.icon,
      coverUrl: data.cover_url,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      isPrivate: data.is_private,
      position: data.position,
      createdBy: data.created_by,
      updatedAt: data.updated_at,
      createdAt: data.created_at,
    },
  });
}

// DELETE /api/files/[id] — creator only, cascades children
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if it's a file with storage — delete from storage first
  const { data: file } = await supabase
    .from("files")
    .select("type, storage_path")
    .eq("id", id)
    .single();

  if (file?.type === "file" && file.storage_path) {
    await supabase.storage.from("file-uploads").remove([file.storage_path]);
  }

  // Also delete storage for any child files
  const svc = await createServiceClient();
  const { data: childFiles } = await svc
    .from("files")
    .select("storage_path")
    .eq("parent_id", id)
    .eq("type", "file")
    .not("storage_path", "is", null);

  if (childFiles && childFiles.length > 0) {
    const paths = childFiles.map((f: { storage_path: string }) => f.storage_path);
    await supabase.storage.from("file-uploads").remove(paths);
  }

  const { error } = await supabase.from("files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
