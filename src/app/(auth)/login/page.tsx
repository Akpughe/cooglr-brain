import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl text-primary-foreground text-lg font-extrabold mb-4">
            5C
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">500Claw Platform</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your workspace</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
