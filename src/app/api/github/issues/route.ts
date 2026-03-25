import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listIssues, createIssue } from "@/lib/github";

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
    const issues = await listIssues(token, owner, repo);
    return NextResponse.json(issues);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, title, body } = await request.json();
  if (!owner || !repo || !title) return NextResponse.json({ error: "owner, repo, and title required" }, { status: 400 });

  const token = await getUserToken(supabase, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const issue = await createIssue(token, owner, repo, title, body || "");
    return NextResponse.json(issue);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
