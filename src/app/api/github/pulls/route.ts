import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listPulls, mergePull, addPRReview } from "@/lib/github";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });

  const token = await getUserToken(supabase, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const pulls = await listPulls(token, owner, repo);
    return NextResponse.json(pulls);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, owner, repo, number, body, event } = await request.json();
  const token = await getUserToken(supabase, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    if (action === "merge") {
      await mergePull(token, owner, repo, number);
      return NextResponse.json({ ok: true, message: "PR merged" });
    }
    if (action === "review") {
      await addPRReview(token, owner, repo, number, body, event);
      return NextResponse.json({ ok: true, message: "Review submitted" });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
