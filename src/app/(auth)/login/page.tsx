import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-40%] right-[-20%] w-[700px] h-[700px] rounded-full bg-foreground/[0.02] blur-3xl" />
        <div className="absolute bottom-[-30%] left-[-15%] w-[600px] h-[600px] rounded-full bg-foreground/[0.015] blur-3xl" />
      </div>

      <div className="w-full max-w-[380px] space-y-8 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Logo + Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-foreground rounded-2xl text-background text-xl font-extrabold">
            5C
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome to 500Claw</h1>
            <p className="text-sm text-muted-foreground mt-1">Your all-in-one workspace for teams</p>
          </div>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="text-[11px] text-muted-foreground/50 text-center">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
