import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDbAdapter } from "@/lib/db-adapter";

/**
 * POST /api/db/test — test a connection and return available databases
 * Used during the add-connection flow to let users pick a database
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { connectionString, dbType } = await request.json();
  if (!connectionString) {
    return NextResponse.json({ error: "Connection string required" }, { status: 400 });
  }

  const type = dbType || "postgres";

  try {
    const adapter = await createDbAdapter(type, connectionString);
    await adapter.testConnection();
    const databases = await adapter.listDatabases();
    await adapter.close();

    return NextResponse.json({
      ok: true,
      databases,
      needsSelection: databases.length > 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: `Connection test failed: ${msg}` }, { status: 400 });
  }
}
