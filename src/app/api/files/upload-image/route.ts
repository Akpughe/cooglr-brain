import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File;
  const workspaceId = formData.get("workspaceId") as string;

  if (!file || !workspaceId) {
    return NextResponse.json({ error: "file and workspaceId required" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json({ error: "Image too large (max 10MB)" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() || "png";
  const storagePath = `${workspaceId}/images/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("file-uploads")
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage
    .from("file-uploads")
    .getPublicUrl(storagePath);

  return NextResponse.json({ url: publicUrl });
}
