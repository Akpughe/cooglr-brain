import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, connectionId, dbType } = await request.json();
  if (!prompt || !connectionId) {
    return NextResponse.json({ error: "Prompt and connectionId required" }, { status: 400 });
  }

  // Get the database schema
  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string")
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
    return NextResponse.json({ error: "Failed to decrypt connection" }, { status: 500 });
  }

  // Fetch schema
  const { Client } = await import("pg");
  let schema = "";

  for (const sslOpt of [{ rejectUnauthorized: false }, false as const]) {
    const client = new Client({ connectionString, ssl: sslOpt, statement_timeout: 10000 });
    try {
      await client.connect();
      const result = await client.query(`
        SELECT
          t.table_name,
          string_agg(c.column_name || ' (' || c.data_type || ')', ', ' ORDER BY c.ordinal_position) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name
        LIMIT 100
      `);
      await client.end();
      schema = result.rows.map((r: { table_name: string; columns: string }) =>
        `Table "${r.table_name}": ${r.columns}`
      ).join("\n");
      break;
    } catch {
      await client.end().catch(() => {});
    }
  }

  if (!schema) {
    return NextResponse.json({ error: "Could not fetch database schema" }, { status: 500 });
  }

  // Use the Gemini API directly to generate SQL (faster than going through OpenClaw)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
  }

  const aiPrompt = `You are a SQL expert. Generate a PostgreSQL SELECT query based on the user's request.

Database schema:
${schema}

User request: "${prompt}"

Rules:
- Only output a single SELECT statement, nothing else
- No markdown, no explanation, no code fences — just the raw SQL
- Use double quotes for table/column names that are capitalized or contain special characters
- Always include a LIMIT clause (max 1000)
- If the user's request is ambiguous, make reasonable assumptions

SQL:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 500 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    let sql = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Clean up: remove markdown code fences if the AI adds them
    sql = sql.replace(/^```sql?\n?/i, "").replace(/\n?```$/i, "").trim();

    if (!sql) {
      return NextResponse.json({ error: "AI could not generate a query" }, { status: 500 });
    }

    return NextResponse.json({ sql });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed" }, { status: 500 });
  }
}
