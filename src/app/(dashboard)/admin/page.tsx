import { UserTable } from "@/components/admin/user-table";

export default function AdminPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-foreground">User Management</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">Control who can access the platform</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Admin Only
          </div>
        </div>
        <UserTable />
      </div>
    </div>
  );
}
