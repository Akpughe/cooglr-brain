import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";
import { buildPages, enrichSchema, persistPages } from "@/lib/knowledge/ingest";
import type { RawTable } from "@/lib/knowledge/introspect";

// POST /api/knowledge/ingest — build (or refresh) the structural map for a connection.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, connectionId } = await request.json();
  if (!workspaceId || !connectionId) {
    return NextResponse.json({ error: "workspaceId and connectionId required" }, { status: 400 });
  }

  // Track the run as a job.
  const { data: job } = await supabase
    .from("knowledge_jobs")
    .insert({ workspace_id: workspaceId, connection_id: connectionId, kind: "ingest", status: "running", created_by: user.id })
    .select("id")
    .single();

  const fail = async (message: string, code = 500) => {
    if (job?.id) {
      await supabase.from("knowledge_jobs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", job.id);
    }
    return NextResponse.json({ error: message }, { status: code });
  };

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type, selected_database")
    .eq("id", connectionId)
    .single();
  if (!connection) return fail("Connection not found", 404);

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return fail("Failed to decrypt connection");
  }

  try {
    const adapter = await createDbAdapter(connection.db_type, connectionString, connection.selected_database || undefined);
    const introspection = await adapter.introspect();
    await adapter.close();

    const raw = introspection.tables as RawTable[];
    if (raw.length === 0) return fail("No tables found to map (or this database type is not yet supported)");

    const enrichment = await enrichSchema(raw);
    const pages = buildPages(workspaceId, connectionId, raw, enrichment);
    await persistPages(supabase, pages, "ingest", user.id);

    if (job?.id) {
      await supabase.from("knowledge_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
    }
    return NextResponse.json({
      pages: pages.length,
      tables: raw.length,
      metrics: enrichment.metrics.length,
    });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Ingest failed");
  }
}
