"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface InviteAcceptClientProps {
  token: string;
  workspaceName: string;
  workspaceInitial: string;
  inviteEmail: string;
  authenticated: boolean;
}

export function InviteAcceptClient({
  token,
  workspaceName,
  workspaceInitial,
  inviteEmail,
}: InviteAcceptClientProps) {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    const supabase = createClient();
    const callbackUrl = new URL(`${window.location.origin}/callback`);
    callbackUrl.searchParams.set("next", `/invite/${token}`);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: { login_hint: inviteEmail },
      },
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Workspace avatar */}
        <div className="w-16 h-16 bg-foreground rounded-2xl flex items-center justify-center mx-auto text-background text-2xl font-bold">
          {workspaceInitial}
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Join {workspaceName}
          </h1>
          <p className="text-sm text-muted-foreground">
            You&apos;ve been invited to join <strong>{workspaceName}</strong> on Nuton.
            Sign in with Google to accept.
          </p>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full h-12 rounded-xl border border-border bg-card text-sm font-medium text-foreground flex items-center justify-center gap-3 hover:bg-muted/50 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              Redirecting...
            </span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground/60">
          Invite sent to <strong className="text-muted-foreground">{inviteEmail}</strong>
        </p>
      </div>
    </div>
  );
}
