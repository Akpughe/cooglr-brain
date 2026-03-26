import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";

// GET — list user's database connections
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("database_connections")
    .select("id, name, db_type, is_active, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

// POST — add a new database connection
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, connectionString, dbType } = await request.json();
  if (!name || !connectionString) {
    return NextResponse.json({ error: "Name and connection string required" }, { status: 400 });
  }

  const type = dbType || "postgres";

  // Test connection
  try {
    const adapter = await createDbAdapter(type, connectionString);
    await adapter.testConnection();
    await adapter.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ error: `Connection test failed: ${msg}` }, { status: 400 });
  }

  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient
    .from("database_connections")
    .insert({
      user_id: user.id,
      name,
      encrypted_connection_string: encrypt(connectionString),
      db_type: type,
    })
    .select("id, name, db_type, is_active, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH — toggle active/inactive
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, is_active } = await request.json();
  if (!id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "id and is_active required" }, { status: 400 });
  }

  await supabase
    .from("database_connections")
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}

// DELETE — remove a database connection
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  await supabase.from("database_connections").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
