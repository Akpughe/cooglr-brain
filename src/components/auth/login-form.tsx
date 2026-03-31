"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INPUT =
  "w-full h-10 px-3.5 rounded-xl border border-border bg-card text-[13px] text-foreground focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/40";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirect");

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const callbackUrl = new URL(`${window.location.origin}/callback`);
    if (redirectTo) callbackUrl.searchParams.set("next", redirectTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else if (redirectTo) {
        router.push(redirectTo);
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setError("Check your email for a confirmation link.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-surface-md overflow-hidden">
      <div className="p-6 space-y-5">
        {/* Google OAuth */}
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="w-full h-10 rounded-xl border border-border bg-card text-[13px] font-medium text-foreground flex items-center justify-center gap-2.5 hover:bg-muted/40 hover:border-border active:scale-[0.98] transition-all disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-foreground/70 block mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className={INPUT}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-foreground/70 block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Min 6 characters" : "Enter your password"}
              required
              className={INPUT}
            />
          </div>

          {error && (
            <div className={`text-[12px] text-center py-2 px-3 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200 ${error.includes("Check your email") ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                {mode === "signin" ? "Signing in..." : "Creating account..."}
              </span>
            ) : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>

      {/* Mode toggle footer */}
      <div className="px-6 py-3.5 bg-muted/30 border-t border-border text-center">
        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === "signin" ? (
            <>Don&apos;t have an account? <span className="text-primary font-medium">Sign up</span></>
          ) : (
            <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
          )}
        </button>
      </div>
    </div>
  );
}
