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

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection. Key may have been rotated." }, { status: 500 });
  }

  const { Client } = await import("pg");
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 30000,
  });

  try {
    await client.connect();

    // Read-only transaction + wrap user query with LIMIT for safety
    await client.query("BEGIN READ ONLY");
    const result = await client.query(
      `SELECT * FROM (${query}) AS _user_query LIMIT 1000`
    );
    await client.query("COMMIT");

    return NextResponse.json({
      columns: result.fields.map((f: { name: string }) => f.name),
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await client.end().catch(() => {});
  }
}
