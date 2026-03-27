import { UserTable } from "@/components/admin/user-table";

export default function AdminPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Control who can access the platform. Only allowlisted emails can sign up.</p>
        </div>
        <UserTable />
      </div>
    </div>
  );
}
