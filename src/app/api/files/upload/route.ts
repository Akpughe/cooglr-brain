import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ingestFile } from "@/lib/knowledge/content-ingest";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const workspaceId = formData.get("workspaceId") as string;
  const parentId = formData.get("parentId") as string | null;

  if (!file || !workspaceId) {
    return NextResponse.json({ error: "file and workspaceId required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  // Verify workspace membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a workspace member" }, { status: 403 });

  const ext = file.name.split(".").pop() || "bin";
  const fileId = crypto.randomUUID();
  const storagePath = `${workspaceId}/${fileId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("file-uploads")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("file-uploads")
    .getPublicUrl(storagePath);

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

  const { data: fileNode, error: insertError } = await svc
    .from("files")
    .insert({
      workspace_id: workspaceId,
      parent_id: parentId || null,
      type: "file",
      title: file.name,
      storage_path: storagePath,
      mime_type: file.type,
      file_size: file.size,
      position: nextPosition,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Auto-ingest into the knowledge corpus + UltraMem (memory). Best-effort and
  // detached so the upload returns immediately; uses the service client so it
  // doesn't depend on the request's cookie lifetime. (Prod would use a queue.)
  void ingestFile(
    svc,
    workspaceId,
    {
      id: fileNode.id,
      type: "file",
      title: fileNode.title,
      content: null,
      storage_path: fileNode.storage_path,
      mime_type: fileNode.mime_type,
    },
    user.id,
  ).catch(async (err) => {
    console.error("[files/upload] ingest failed", err);
    // Mark the file as errored so the UI shows a failure instead of a stuck spinner.
    await svc
      .from("knowledge_documents")
      .upsert(
        {
          workspace_id: workspaceId,
          file_id: fileNode.id,
          source: "file",
          source_ref: fileNode.id,
          title: fileNode.title,
          status: "error",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,source,source_ref" },
      )
      .then(() => {}, () => {});
  });

  return NextResponse.json({
    file: {
      id: fileNode.id,
      workspaceId: fileNode.workspace_id,
      parentId: fileNode.parent_id,
      type: fileNode.type,
      title: fileNode.title,
      storagePath: fileNode.storage_path,
      mimeType: fileNode.mime_type,
      fileSize: fileNode.file_size,
      isPrivate: fileNode.is_private,
      position: fileNode.position,
      createdBy: fileNode.created_by,
      updatedAt: fileNode.updated_at,
      createdAt: fileNode.created_at,
      url: publicUrl,
    },
  }, { status: 201 });
}
