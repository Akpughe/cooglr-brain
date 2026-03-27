"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InviteForm } from "./invite-form";

interface AllowedEmail {
  id: string;
  email: string;
  role: string;
  department: string | null;
  created_at: string;
}

export function UserTable() {
  const [users, setUsers] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <InviteForm onInvited={load} />

      <Card className="rounded-xl shadow-warm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Allowlisted Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/60">
                <TableHead className="pl-6">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Added</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.id} className="border-b border-border/40 last:border-0">
                  <TableCell className="font-mono text-sm pl-6">{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                      className={
                        u.role === "admin"
                          ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                          : "bg-muted text-muted-foreground border border-border/60"
                      }
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{u.department || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(u.id)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
