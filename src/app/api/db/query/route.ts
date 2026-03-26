import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionId, query } = await request.json();
  if (!connectionId || !query) {
    return NextResponse.json({ error: "Connection ID and query required" }, { status: 400 });
  }

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection." }, { status: 500 });
  }

  try {
    const adapter = await createDbAdapter(connection.db_type, connectionString);
    const result = await adapter.query(query);
    await adapter.close();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Query failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
