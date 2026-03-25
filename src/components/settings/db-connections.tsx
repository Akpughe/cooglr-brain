"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DbConnection {
  id: string;
  name: string;
  db_type: string;
  is_active: boolean;
  created_at: string;
}

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function DbConnections() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [connectionString, setConnectionString] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDb, setSelectedDb] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);

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
      body: JSON.stringify({ name, connectionString, dbType: "postgres" }),
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

  async function removeConnection(id: string) {
    await fetch("/api/db/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selectedDb === id) {
      setSelectedDb(null);
      setQueryResult(null);
    }
    loadConnections();
  }

  async function runQuery() {
    if (!selectedDb || !query.trim()) return;
    setQuerying(true);
    setQueryError(null);
    setQueryResult(null);

    const res = await fetch("/api/db/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: selectedDb, query: query.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setQueryError(data.error);
    } else {
      setQueryResult(data);
    }
    setQuerying(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Database Connections</CardTitle>
          <CardDescription>
            Connect read-only databases to generate reports and query data through the AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addConnection} className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <Input
                placeholder="Connection name (e.g. Production DB)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex-[2] min-w-[250px]">
              <Input
                placeholder="postgresql://user:pass@host:5432/dbname"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                type="password"
                required
              />
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? "Testing..." : "Add Connection"}
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {connections.length > 0 && (
            <div className="space-y-2">
              {connections.map((conn) => (
                <div
                  key={conn.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                      DB
                    </div>
                    <div>
                      <p className="font-medium text-sm">{conn.name}</p>
                      <p className="text-xs text-muted-foreground">{conn.db_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={conn.is_active ? "default" : "secondary"}>
                      {conn.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Button
                      variant={selectedDb === conn.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedDb(selectedDb === conn.id ? null : conn.id)}
                    >
                      {selectedDb === conn.id ? "Selected" : "Query"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeConnection(conn.id)}
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

      {selectedDb && (
        <Card>
          <CardHeader>
            <CardTitle>Query Runner</CardTitle>
            <CardDescription>
              Run read-only SQL queries against the selected database. Only SELECT queries are allowed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SELECT * FROM users LIMIT 10"
                className="font-mono text-sm"
                rows={3}
              />
            </div>
            <Button onClick={runQuery} disabled={querying || !query.trim()}>
              {querying ? "Running..." : "Run Query"}
            </Button>

            {queryError && <p className="text-sm text-destructive">{queryError}</p>}

            {queryResult && (
              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {queryResult.columns.map((col) => (
                        <TableHead key={col} className="font-mono text-xs">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queryResult.rows.map((row, i) => (
                      <TableRow key={i}>
                        {queryResult.columns.map((col) => (
                          <TableCell key={col} className="font-mono text-xs">
                            {String(row[col] ?? "NULL")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="p-2 text-xs text-muted-foreground border-t">
                  {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""} returned
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
