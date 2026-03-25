import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col">
        <div className="font-bold text-lg mb-6">500Claw</div>
        <nav className="flex-1 space-y-1">
          <a href="/" className="block px-3 py-2 rounded-md bg-accent text-sm font-medium">
            Chat
          </a>
          <a href="/settings" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
            Settings
          </a>
          {isAdmin && (
            <a href="/admin" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Admin
            </a>
          )}
        </nav>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
