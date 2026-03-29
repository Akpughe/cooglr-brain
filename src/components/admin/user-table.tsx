"use client";

import { useEffect, useState, useCallback } from "react";
import { DEPARTMENTS } from "@/lib/constants";

interface AllowedEmail {
  id: string;
  email: string;
  role: string;
  department: string | null;
  created_at: string;
}

const INPUT =
  "h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/40";
const SELECT =
  "h-9 px-3 rounded-lg border border-border bg-background text-[13px] text-foreground focus:outline-none focus:border-primary/30 transition-all appearance-none cursor-pointer";

export function UserTable() {
  const [users, setUsers] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [department, setDepartment] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(false);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, department: department || null }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
    } else {
      setEmail("");
      setDepartment("");
      setRole("member");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      load();
    }
    setInviting(false);
  }

  async function remove(id: string) {
    if (!confirm("Remove this user from the allowlist?")) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      {/* Invite Form */}
      <div className="rounded-2xl border border-border bg-card shadow-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-[14px] font-medium text-foreground">Invite User</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Add an email to the allowlist so they can sign up</p>
        </div>
        <form onSubmit={handleInvite} className="p-5">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-medium text-foreground/70 block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className={`${INPUT} w-full`}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-foreground/70 block mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${SELECT} w-[120px]`}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-foreground/70 block mb-1">Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className={`${SELECT} w-[150px]`}>
                <option value="">Select...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {inviting ? "Adding..." : "Add User"}
            </button>
          </div>
          {error && <p className="text-[12px] text-destructive mt-2 animate-in fade-in duration-200">{error}</p>}
          {success && <p className="text-[12px] text-green-600 dark:text-green-400 mt-2 animate-in fade-in duration-200">User added to allowlist</p>}
        </form>
      </div>

      {/* Users List */}
      <div className="rounded-2xl border border-border bg-card shadow-surface overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="text-[14px] font-medium text-foreground">Allowlisted Users</h3>
          <span className="text-[11px] text-muted-foreground">{users.length} user{users.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Loading...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-[13px] text-muted-foreground">No users yet</p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">Add an email above to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground uppercase">
                    {u.email.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary border border-primary/15"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {u.role}
                      </span>
                      {u.department && (
                        <span className="text-[10px] text-muted-foreground/70">{u.department}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground/50">
                    {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => remove(u.id)}
                    className="text-[11px] text-muted-foreground/40 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
