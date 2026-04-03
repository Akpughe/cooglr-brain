import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");

  const query = supabase
    .from("email_audiences")
    .select("id, name, description, source_type, contact_count, tags, status, last_synced_at, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (workspaceId) {
    query.eq("workspace_id", workspaceId);
  } else {
    query.eq("user_id", user.id);
  }

  const { data } = await query;

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { workspaceId } = body;

  // CSV import mode
  if (body.action === "import_csv") {
    return importCsv(supabase, user.id, body, workspaceId);
  }

  // Database query mode
  if (body.action === "from_database") {
    return fromDatabase(supabase, user.id, body);
  }

  // Manual creation
  const { name, description } = body;
  if (!name) return NextResponse.json({ error: "Audience name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("email_audiences")
    .insert({
      user_id: user.id,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      name,
      description: description || null,
      source_type: "manual",
      contact_count: 0,
    })
    .select("id, name, source_type, contact_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, workspaceId } = await request.json();
  if (!id) return NextResponse.json({ error: "Audience ID required" }, { status: 400 });

  // Delete audience (cascade deletes junction records)
  const deleteQuery = supabase.from("email_audiences").delete().eq("id", id);
  if (workspaceId) {
    deleteQuery.eq("workspace_id", workspaceId);
  } else {
    deleteQuery.eq("user_id", user.id);
  }
  await deleteQuery;
  return NextResponse.json({ ok: true });
}

async function importCsv(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: { name: string; contacts: { email: string; first_name?: string; last_name?: string; [key: string]: unknown }[] },
  workspaceId?: string
) {
  const { name, contacts } = body;
  if (!name || !contacts?.length) {
    return NextResponse.json({ error: "Name and contacts array required" }, { status: 400 });
  }

  // Create audience
  const { data: audience, error: audError } = await supabase
    .from("email_audiences")
    .insert({
      user_id: userId,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
      name,
      source_type: "csv_import",
      contact_count: contacts.length,
      last_synced_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (audError) return NextResponse.json({ error: audError.message }, { status: 500 });

  // Batch upsert contacts
  const validContacts = contacts
    .filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
    .map((c) => ({
      user_id: userId,
      email: c.email.toLowerCase().trim(),
      first_name: c.first_name || null,
      last_name: c.last_name || null,
      metadata: Object.fromEntries(
        Object.entries(c).filter(([k]) => !["email", "first_name", "last_name"].includes(k))
      ),
      consent_given_at: new Date().toISOString(),
      consent_source: "csv_import",
    }));

  if (validContacts.length === 0) {
    return NextResponse.json({ error: "No valid email addresses found" }, { status: 400 });
  }

  // Batch in chunks of 500
  const chunkSize = 500;
  for (let i = 0; i < validContacts.length; i += chunkSize) {
    await supabase
      .from("email_contacts")
      .upsert(validContacts.slice(i, i + chunkSize), { onConflict: "user_id,email" });
  }

  // Fetch IDs of all upserted contacts to link them
  const emails = validContacts.map((c) => c.email);
  const { data: insertedContacts } = await supabase
    .from("email_contacts")
    .select("id")
    .eq("user_id", userId)
    .in("email", emails);

  // Batch link to audience
  if (insertedContacts?.length) {
    const links = insertedContacts.map((c) => ({
      audience_id: audience!.id,
      contact_id: c.id,
    }));
    for (let i = 0; i < links.length; i += chunkSize) {
      await supabase
        .from("email_audience_contacts")
        .upsert(links.slice(i, i + chunkSize), { onConflict: "audience_id,contact_id" });
    }
  }

  const linked = insertedContacts?.length || 0;
  await supabase
    .from("email_audiences")
    .update({ contact_count: linked })
    .eq("id", audience!.id);

  return NextResponse.json({ id: audience!.id, name, contactCount: linked }, { status: 201 });
}

async function fromDatabase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  body: { name: string; connectionId: string; query: string }
) {
  const { name, connectionId, query } = body;
  if (!name || !connectionId || !query) {
    return NextResponse.json({ error: "Name, connectionId, and query required" }, { status: 400 });
  }

  // Only allow SELECT queries
  const trimmed = query.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT")) {
    return NextResponse.json({ error: "Only SELECT queries are allowed" }, { status: 400 });
  }

  // Use existing db-adapter to run the query
  const { decrypt } = await import("@/lib/crypto");
  const { createDbAdapter } = await import("@/lib/db-adapter");

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type, selected_database")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (!connection) return NextResponse.json({ error: "Database connection not found" }, { status: 404 });

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection" }, { status: 500 });
  }

  try {
    const adapter = await createDbAdapter(connection.db_type, connectionString, connection.selected_database || undefined);
    const result = await adapter.query(query);
    await adapter.close();

    // Expect at least an 'email' column
    if (!result.columns.some((c) => c.toLowerCase() === "email")) {
      return NextResponse.json({ error: "Query must return an 'email' column" }, { status: 400 });
    }

    const emailCol = result.columns.find((c) => c.toLowerCase() === "email")!;
    const nameCol = result.columns.find((c) => ["first_name", "name", "firstname"].includes(c.toLowerCase()));

    // Create audience
    const { data: audience, error: audError } = await supabase
      .from("email_audiences")
      .insert({
        user_id: userId,
        name,
        source_type: "database_query",
        source_config: { connectionId, query },
        contact_count: result.rows.length,
        last_synced_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (audError) return NextResponse.json({ error: audError.message }, { status: 500 });

    // Upsert contacts
    let linked = 0;
    for (const row of result.rows) {
      const email = String(row[emailCol] || "").toLowerCase().trim();
      if (!email) continue;

      const { data: contact } = await supabase
        .from("email_contacts")
        .upsert(
          {
            user_id: userId,
            email,
            first_name: nameCol ? String(row[nameCol] || "") : null,
            consent_given_at: new Date().toISOString(),
            consent_source: "database_query",
          },
          { onConflict: "user_id,email" }
        )
        .select("id")
        .single();

      if (contact) {
        await supabase.from("email_audience_contacts").upsert(
          { audience_id: audience!.id, contact_id: contact.id },
          { onConflict: "audience_id,contact_id" }
        );
        linked++;
      }
    }

    await supabase.from("email_audiences").update({ contact_count: linked }).eq("id", audience!.id);

    return NextResponse.json({ id: audience!.id, name, contactCount: linked }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Query failed" }, { status: 500 });
  }
}
