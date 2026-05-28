import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/knowledge/pages?workspaceId=&connectionId= — list map pages.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  const connectionId = request.nextUrl.searchParams.get("connectionId");
  if (!workspaceId || !connectionId) {
    return NextResponse.json({ error: "workspaceId and connectionId required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("knowledge_pages")
    .select("id, path, type, title, content_md, confidence, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("connection_id", connectionId)
    .order("type", { ascending: true })
    .order("title", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pages: data ?? [] });
}
