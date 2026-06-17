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

  // Public URL for the stored object so the client can preview it (the
  // file-uploads bucket is public). Null for pages / nodes with no object.
  let url: string | null = null;
  if (data.storage_path) {
    url = supabase.storage.from("file-uploads").getPublicUrl(data.storage_path).data.publicUrl;
  }

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
      url,
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

  // Collect all storage paths in the subtree before cascade delete removes them
  const svc = await createServiceClient();
  const { data: subtreeFiles, error: rpcError } = await svc.rpc("get_file_subtree_storage", { root_id: id });

  const storagePaths: string[] = [];
  if (!rpcError && subtreeFiles) {
    for (const f of subtreeFiles as { storage_path: string }[]) {
      storagePaths.push(f.storage_path);
    }
  }

  // Clean up storage objects
  if (storagePaths.length > 0) {
    await supabase.storage.from("file-uploads").remove(storagePaths);
  }

  // CASCADE delete handles children in DB
  const { error } = await supabase.from("files").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
