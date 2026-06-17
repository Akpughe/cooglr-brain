import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShowcase } from "@/components/auth/auth-showcase";

export default function LoginPage() {
  return (
    <div
      className="agent-shell-root"
      style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}
    >
      {/* Left — form */}
      <main
        role="main"
        style={{
          flex: "1 1 0",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 32px",
        }}
      >
        <div className="rise" style={{ width: "100%", maxWidth: 360 }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--ink)",
              color: "#fff",
              fontSize: 17,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            5C
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)", marginTop: 26 }}>
            Welcome to 500Claw
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--ink-3)", marginTop: 6, lineHeight: 1.5 }}>
            Sign in to your team&apos;s all-in-one agentic workspace.
          </p>

          <div style={{ marginTop: 28 }}>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>

          <p style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 22, lineHeight: 1.5 }}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </main>

      {/* Right — showcase (hidden on small screens) */}
      <div className="auth-showcase-wrap" aria-hidden="true" style={{ flex: "1 1 0", minWidth: 0 }}>
        <AuthShowcase />
      </div>
    </div>
  );
}
