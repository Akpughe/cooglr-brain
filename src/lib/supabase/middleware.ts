import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/invite");

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/") {
    const activeWorkspaceId = request.cookies.get("active_workspace_id")?.value;

    let slug: string | null = null;

    if (activeWorkspaceId) {
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", user.id)
        .eq("workspace_id", activeWorkspaceId)
        .single();

      if (membership?.workspaces) {
        slug = (membership.workspaces as { slug: string }).slug;
      }
    }

    if (!slug) {
      const { data: firstMembership } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single();

      if (firstMembership?.workspaces) {
        slug = (firstMembership.workspaces as { slug: string }).slug;
      }
    }

    const url = request.nextUrl.clone();
    if (slug) {
      url.pathname = `/${slug}`;
    } else {
      url.pathname = "/onboarding";
    }
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/onboarding") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (count && count > 0) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
