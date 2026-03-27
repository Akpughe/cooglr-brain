"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  is_active: boolean;
  created_at: string;
}

const DB_TYPES = [
  { value: "postgres", label: "PostgreSQL", placeholder: "postgresql://user:pass@host:5432/dbname" },
  { value: "clickhouse", label: "ClickHouse", placeholder: "clickhouse://user:pass@host:8123/dbname" },
];

export function DbConnections() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [dbType, setDbType] = useState("postgres");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    const res = await fetch("/api/db/connections");
    if (res.ok) setConnections(await res.json());
    setLoading(false);
  }

  async function addConnection(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);

    const res = await fetch("/api/db/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, connectionString, dbType }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
    } else {
      setName("");
      setConnectionString("");
      loadConnections();
    }
    setAdding(false);
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    await fetch("/api/db/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentlyActive }),
    });
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: !currentlyActive } : c))
    );
  }

  async function removeConnection(id: string) {
    await fetch("/api/db/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadConnections();
  }

  const selectedType = DB_TYPES.find((t) => t.value === dbType) || DB_TYPES[0];

  return (
    <Card className="rounded-xl shadow-warm">
      <CardHeader>
        <CardTitle>Database Connections</CardTitle>
        <CardDescription>
          Connect databases to generate reports. Toggle sources on/off to control which ones are used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={addConnection} className="space-y-3">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input
                placeholder="e.g. Production DB"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              <Select value={dbType} onValueChange={(v) => v && setDbType(v)}>
                <SelectTrigger className="w-[140px] rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DB_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={selectedType.placeholder}
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              type="password"
              required
              className="flex-1 rounded-lg"
            />
            <Button
              type="submit"
              disabled={adding}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {adding ? "Testing..." : "Add Connection"}
            </Button>
          </div>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {connections.length > 0 && (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className={`flex items-center justify-between p-3 rounded-xl border border-border/60 transition-colors ${
                  conn.is_active ? "hover:bg-muted/50" : "opacity-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                    conn.is_active
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-muted text-muted-foreground border border-border/60"
                  }`}>
                    {conn.db_type === "clickhouse" ? "CH" : "PG"}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{conn.name}</p>
                    <p className="text-xs text-muted-foreground">{conn.db_type === "clickhouse" ? "ClickHouse" : "PostgreSQL"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={conn.is_active ? "default" : "secondary"}
                    className={
                      conn.is_active
                        ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                        : "bg-muted text-muted-foreground border border-border/60"
                    }
                  >
                    {conn.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleActive(conn.id, conn.is_active)}
                    className="rounded-lg border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    {conn.is_active ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConnection(conn.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      </CardContent>
    </Card>
  );
}
