import { UserTable } from "@/components/admin/user-table";

export default function AdminPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage who can access the platform. Only allowlisted emails can sign up.
        </p>
      </div>
      <UserTable />
    </div>
  );
}
