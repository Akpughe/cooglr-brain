"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, ROLES } from "@/lib/constants";

interface Props {
  onInvited: () => void;
}

export function InviteForm({ onInvited }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      onInvited();
    }

    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <Input
          type="email"
          placeholder="email@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Select value={role} onValueChange={(v) => v && setRole(v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ROLES.MEMBER}>Member</SelectItem>
          <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
        </SelectContent>
      </Select>
      <Select value={department} onValueChange={(v) => v && setDepartment(v)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          {DEPARTMENTS.map((d) => (
            <SelectItem key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={loading}>
        Add User
      </Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}
    </form>
  );
}
