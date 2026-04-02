import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE /api/files/[id]/share/[userId] — revoke share
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("file_shares")
    .delete()
    .eq("file_id", id)
    .eq("shared_with", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
