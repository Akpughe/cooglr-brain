import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listRepos } from "@/lib/github";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getUserToken(supabase, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected. Go to Settings to connect." }, { status: 400 });

  try {
    const repos = await listRepos(token);
    return NextResponse.json(repos);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
