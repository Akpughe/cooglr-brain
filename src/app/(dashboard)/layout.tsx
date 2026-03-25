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
        <a href="/" className="font-bold text-lg mb-6 block">500Claw</a>

        <nav className="flex-1 space-y-4">
          <div>
            <a href="/" className="block px-3 py-2 rounded-md hover:bg-accent text-sm font-medium">
              Dashboard
            </a>
            <a href="/chat" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Chat
            </a>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Development</p>
            <a href="/repos" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Repos
            </a>
            <a href="/tickets" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Tickets
            </a>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Business</p>
            <a href="/reports" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Reports
            </a>
            <a href="/emails" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Emails
            </a>
          </div>

          <div>
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">System</p>
            <a href="/settings" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
              Settings
            </a>
            {isAdmin && (
              <a href="/admin" className="block px-3 py-2 rounded-md hover:bg-accent text-sm">
                Admin
              </a>
            )}
          </div>
        </nav>

        <div className="text-xs text-muted-foreground">{user.email}</div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
