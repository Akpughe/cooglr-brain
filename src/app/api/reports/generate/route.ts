import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, connectionId } = await request.json();
  if (!prompt || !connectionId) {
    return NextResponse.json({ error: "Prompt and connectionId required" }, { status: 400 });
  }

  const { data: connection } = await supabase
    .from("database_connections")
    .select("encrypted_connection_string")
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .single();

  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection" }, { status: 500 });
  }

  const { Client } = await import("pg");
  let schema = "";
  let foreignKeys = "";

  for (const sslOpt of [{ rejectUnauthorized: false }, false as const]) {
    const client = new Client({ connectionString, ssl: sslOpt, statement_timeout: 15000 });
    try {
      await client.connect();

      // Get tables with ALL columns and their types
      const tablesResult = await client.query(`
        SELECT
          t.table_name,
          string_agg(
            c.column_name || ' ' || c.data_type ||
            CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT' ELSE '' END,
            ', ' ORDER BY c.ordinal_position
          ) as columns
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        GROUP BY t.table_name
        ORDER BY t.table_name
      `);

      schema = tablesResult.rows.map((r: { table_name: string; columns: string }) =>
        `"${r.table_name}" (${r.columns})`
      ).join("\n");

      // Get foreign key relationships
      const fkResult = await client.query(`
        SELECT
          tc.table_name AS from_table,
          kcu.column_name AS from_column,
          ccu.table_name AS to_table,
          ccu.column_name AS to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        ORDER BY tc.table_name
      `);

      foreignKeys = fkResult.rows.map((r: { from_table: string; from_column: string; to_table: string; to_column: string }) =>
        `"${r.from_table}"."${r.from_column}" -> "${r.to_table}"."${r.to_column}"`
      ).join("\n");

      // Get a sample of 3 rows from the most relevant table to understand data patterns
      await client.end();
      break;
    } catch {
      await client.end().catch(() => {});
    }
  }

  if (!schema) {
    return NextResponse.json({ error: "Could not fetch database schema" }, { status: 500 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
  }

  const aiPrompt = `You are an expert PostgreSQL analyst. Generate the best possible query for the user's request.

DATABASE SCHEMA:
${schema}

FOREIGN KEY RELATIONSHIPS:
${foreignKeys || "None found"}

USER REQUEST: "${prompt}"

INSTRUCTIONS:
- Generate a single PostgreSQL SELECT statement
- Output ONLY the raw SQL — no markdown, no explanation, no code fences, no semicolons
- Use double quotes for all table and column names (they are case-sensitive)
- JOIN related tables when it makes the result more useful and complete
- When the user asks about "orders", include relevant details like amounts, items, dates, customer info — not just IDs
- When the user asks about "customers" or "users", include names, emails, counts — not just IDs
- Select human-readable columns, not just foreign key IDs
- Use meaningful aliases: "total_amount", "order_count", "customer_name" etc.
- Format dates with to_char() when appropriate
- Include aggregations (COUNT, SUM, AVG) when they make the result more insightful
- ORDER BY the most relevant column (usually date DESC or count DESC)
- Always LIMIT to a reasonable number (default 50 unless the user specifies)
- Think about what a business analyst would actually want to see

SQL:`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: aiPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1000 },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    let sql = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Clean up
    sql = sql.replace(/^```sql?\n?/i, "").replace(/\n?```$/i, "").replace(/;\s*$/, "").trim();

    if (!sql) {
      return NextResponse.json({ error: "AI could not generate a query" }, { status: 500 });
    }

    return NextResponse.json({ sql });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed" }, { status: 500 });
  }
}
