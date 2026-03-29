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
  selected_database: string | null;
}

const DB_TYPES = [
  { value: "postgres", label: "PostgreSQL", placeholder: "postgresql://user:pass@host:5432/dbname" },
  { value: "clickhouse", label: "ClickHouse", placeholder: "clickhouse://user:pass@host:8123/dbname" },
];

type Step = "form" | "testing" | "select-db" | "saving";

export function DbConnections() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [dbType, setDbType] = useState("postgres");
  const [error, setError] = useState<string | null>(null);

  // Two-step flow state
  const [step, setStep] = useState<Step>("form");
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    const res = await fetch("/api/db/connections");
    if (res.ok) setConnections(await res.json());
    setLoading(false);
  }

  function resetForm() {
    setName("");
    setConnectionString("");
    setStep("form");
    setAvailableDatabases([]);
    setSelectedDatabase("");
    setError(null);
  }

  async function testConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !connectionString.trim()) return;

    setStep("testing");
    setError(null);

    try {
      const res = await fetch("/api/db/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString, dbType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        setStep("form");
        return;
      }

      if (data.needsSelection && data.databases.length > 1) {
        // Multiple databases — show selector
        setAvailableDatabases(data.databases);
        setSelectedDatabase(data.databases[0]);
        setStep("select-db");
      } else {
        // Single database or Postgres — save directly
        await saveConnection(data.databases[0] || null);
      }
    } catch {
      setError("Failed to test connection");
      setStep("form");
    }
  }

  async function saveConnection(database: string | null) {
    setStep("saving");
    setError(null);

    try {
      const res = await fetch("/api/db/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          connectionString,
          dbType,
          selectedDatabase: database,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        setStep("form");
      } else {
        resetForm();
        loadConnections();
      }
    } catch {
      setError("Failed to save connection");
      setStep("form");
    }
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
  const isBusy = step === "testing" || step === "saving";

  return (
    <Card className="rounded-xl shadow-warm">
      <CardHeader>
        <CardTitle>Database Connections</CardTitle>
        <CardDescription>
          Connect databases to generate reports. Toggle sources on/off to control which ones are used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step 1: Connection form */}
        {(step === "form" || step === "testing") && (
          <form onSubmit={testConnection} className="space-y-3">
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                <Input
                  placeholder="e.g. Production DB"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isBusy}
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select value={dbType} onValueChange={(v) => v && setDbType(v)} disabled={isBusy}>
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
                disabled={isBusy}
                className="flex-1 rounded-lg"
              />
              <Button
                type="submit"
                disabled={isBusy}
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {step === "testing" ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Testing...
                  </span>
                ) : "Connect"}
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Database selector */}
        {step === "select-db" && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
                  <path d="M3 12A9 3 0 0 0 21 12"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Multiple databases found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This server has {availableDatabases.length} databases. Select which one to use for reports.
                </p>
              </div>
            </div>

            <div className="grid gap-1.5 max-h-[200px] overflow-y-auto">
              {availableDatabases.map((db) => (
                <button
                  key={db}
                  type="button"
                  onClick={() => setSelectedDatabase(db)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                    selectedDatabase === db
                      ? "bg-primary text-white"
                      : "bg-background border border-border hover:border-primary/40 hover:bg-primary/5"
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    selectedDatabase === db ? "border-white" : "border-muted-foreground/40"
                  }`}>
                    {selectedDatabase === db && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{db}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={resetForm}
                className="rounded-lg border-border/60"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => saveConnection(selectedDatabase)}
                disabled={!selectedDatabase}
                className="rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Use this database
              </Button>
            </div>
          </div>
        )}

        {/* Saving indicator */}
        {step === "saving" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            Saving connection...
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Connection list */}
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{conn.name}</p>
                      {conn.selected_database && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                          {conn.selected_database}
                        </span>
                      )}
                    </div>
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
