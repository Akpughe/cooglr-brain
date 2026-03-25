import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId, query } = await request.json();

  if (!connectionId || !query) {
    return NextResponse.json({ error: "Connection ID and query required" }, { status: 400 });
  }

  // Block destructive queries
  const normalized = query.trim().toUpperCase();
  const forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE", "GRANT", "REVOKE"];
  for (const keyword of forbidden) {
    if (normalized.startsWith(keyword)) {
      return NextResponse.json({ error: "Only SELECT queries are allowed" }, { status: 403 });
    }
  }

  // Fetch the connection
  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const connectionString = decrypt(connection.encrypted_connection_string);

  try {
    const { Client } = await import("pg");
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      statement_timeout: 30000,
    });
    await client.connect();

    // Wrap in read-only transaction for safety
    await client.query("BEGIN READ ONLY");
    const result = await client.query(query);
    await client.query("COMMIT");
    await client.end();

    return NextResponse.json({
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
