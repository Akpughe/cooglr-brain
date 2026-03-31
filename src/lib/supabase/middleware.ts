import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Service client for workspace resolution — bypasses RLS
// Used only for routing decisions in middleware, not for user data access
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  // Not authenticated + not public → login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated + on login/signup → go to root
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Authenticated + root "/" → resolve workspace
  if (user && pathname === "/") {
    const svc = getServiceClient();
    const activeWorkspaceId = request.cookies.get("active_workspace_id")?.value;

    let slug: string | null = null;

    if (activeWorkspaceId) {
      // Verify the cookie's workspace still exists and user is still a member
      const { data: membership } = await svc
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .eq("workspace_id", activeWorkspaceId)
        .single();

      if (membership) {
        const { data: ws } = await svc
          .from("workspaces")
          .select("slug")
          .eq("id", activeWorkspaceId)
          .single();

        if (ws) slug = ws.slug;
      }
    }

    if (!slug) {
      // Fall back to first workspace the user belongs to
      const { data: firstMembership } = await svc
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single();

      if (firstMembership) {
        const { data: ws } = await svc
          .from("workspaces")
          .select("slug")
          .eq("id", firstMembership.workspace_id)
          .single();

        if (ws) slug = ws.slug;
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

  // Authenticated + on /onboarding but has workspaces → redirect to workspace
  if (user && pathname === "/onboarding") {
    const svc = getServiceClient();

    const { data: firstMembership } = await svc
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (firstMembership) {
      const { data: ws } = await svc
        .from("workspaces")
        .select("slug")
        .eq("id", firstMembership.workspace_id)
        .single();

      if (ws) {
        const url = request.nextUrl.clone();
        url.pathname = `/${ws.slug}`;
        return NextResponse.redirect(url);
      }
    }
  }

  // Set active_workspace_id cookie when navigating to a workspace path
  if (user && !isPublicPath && pathname !== "/" && pathname !== "/onboarding") {
    const segments = pathname.split("/").filter(Boolean);
    const potentialSlug = segments[0];
    if (potentialSlug && !potentialSlug.startsWith("api")) {
      const svc = getServiceClient();
      const { data: ws } = await svc
        .from("workspaces")
        .select("id")
        .eq("slug", potentialSlug)
        .single();

      if (ws) {
        supabaseResponse.cookies.set("active_workspace_id", ws.id, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }
  }

  return supabaseResponse;
}
