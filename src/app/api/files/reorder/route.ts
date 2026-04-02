import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { updates } = await request.json();
  if (!updates || !Array.isArray(updates)) {
    return NextResponse.json({ error: "updates array required" }, { status: 400 });
  }

  const svc = await createServiceClient();
  const errors: { id: string; error: string }[] = [];

  for (const u of updates) {
    const { error } = await svc
      .from("files")
      .update({ parent_id: u.parentId ?? null, position: u.position })
      .eq("id", u.id);

    if (error) errors.push({ id: u.id, error: error.message });
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some updates failed", errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
