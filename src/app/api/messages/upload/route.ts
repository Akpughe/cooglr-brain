import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const workspaceId = formData.get("workspaceId") as string;
  const targetId = formData.get("targetId") as string;

  if (!file || !workspaceId || !targetId) return NextResponse.json({ error: "file, workspaceId, and targetId required" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

  const ext = file.name.split(".").pop() || "bin";
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `${workspaceId}/${targetId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("message-attachments")
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("message-attachments")
    .getPublicUrl(filePath);

  return NextResponse.json({
    attachment: { name: file.name, url: publicUrl, type: file.type, size: file.size },
  });
}
