import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Warm ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-40%] right-[-20%] w-[700px] h-[700px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="w-full max-w-[400px] space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo + Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary rounded-2xl text-primary-foreground text-lg font-extrabold shadow-surface-md transition-transform hover:scale-105">
            5C
          </div>
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">500Claw Platform</h1>
            <p className="text-[13px] text-muted-foreground mt-1">Sign in or create an account</p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="text-[11px] text-muted-foreground/50 text-center">
          Create a workspace or join your team
        </p>
      </div>
    </div>
  );
}
