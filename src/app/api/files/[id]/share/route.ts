import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/files/[id]/share — list shares for a file
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("file_shares")
    .select("*")
    .eq("file_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shares = (data || []).map((s: Record<string, unknown>) => ({
    id: s.id,
    fileId: s.file_id,
    sharedWith: s.shared_with,
    permission: s.permission,
    createdAt: s.created_at,
  }));

  return NextResponse.json({ shares });
}

// POST /api/files/[id]/share — share file with a user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, permission } = await request.json();
  if (!userId || !permission) {
    return NextResponse.json({ error: "userId and permission required" }, { status: 400 });
  }
  if (!["view", "edit"].includes(permission)) {
    return NextResponse.json({ error: "permission must be view or edit" }, { status: 400 });
  }

  // Verify caller is the file creator
  const { data: file } = await supabase
    .from("files")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!file || file.created_by !== user.id) {
    return NextResponse.json({ error: "Only the file creator can share" }, { status: 403 });
  }

  const { data: share, error } = await supabase
    .from("file_shares")
    .upsert(
      { file_id: id, shared_with: userId, permission },
      { onConflict: "file_id,shared_with" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    share: {
      id: share.id,
      fileId: share.file_id,
      sharedWith: share.shared_with,
      permission: share.permission,
      createdAt: share.created_at,
    },
  }, { status: 201 });
}
