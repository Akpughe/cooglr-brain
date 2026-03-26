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
  let sampleData = "";

  for (const sslOpt of [{ rejectUnauthorized: false }, false as const]) {
    const client = new Client({ connectionString, ssl: sslOpt, statement_timeout: 20000 });
    try {
      await client.connect();

      // Get tables with ALL columns
      const tablesResult = await client.query(`
        SELECT
          t.table_name,
          string_agg(
            c.column_name || ' ' || c.data_type ||
            CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
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

      // Get ALL foreign key relationships
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

      // Get sample data from tables that seem relevant to the user's prompt
      const keywords = prompt.toLowerCase().split(/\s+/);
      const relevantTables = tablesResult.rows
        .filter((r: { table_name: string }) => {
          const name = r.table_name.toLowerCase();
          return keywords.some((k: string) =>
            name.includes(k) || k.includes(name) ||
            (k === "orders" && name === "order") ||
            (k === "order" && name.includes("order")) ||
            (k === "customers" && name.includes("customer")) ||
            (k === "users" && name.includes("user")) ||
            (k === "products" && name.includes("product")) ||
            (k === "items" && name.includes("item"))
          );
        })
        .map((r: { table_name: string }) => r.table_name)
        .slice(0, 5);

      // Also add common related tables
      const alwaysSample = ["Order", "OrderItem", "Customer", "Product", "User", "Business"];
      const tablesToSample = [...new Set([...relevantTables, ...alwaysSample])];

      const samples: string[] = [];
      for (const tableName of tablesToSample) {
        try {
          const sampleResult = await client.query(
            `SELECT * FROM "${tableName}" ORDER BY "createdAt" DESC LIMIT 2`
          );
          if (sampleResult.rows.length > 0) {
            const cols = sampleResult.fields.map((f: { name: string }) => f.name);
            samples.push(
              `-- "${tableName}" sample (${cols.length} columns: ${cols.join(", ")}):\n` +
              sampleResult.rows.map((row: Record<string, unknown>) =>
                cols.map((c: string) => {
                  const v = row[c];
                  if (v === null) return "NULL";
                  if (typeof v === "object") return "{}";
                  const s = String(v);
                  return s.length > 50 ? s.substring(0, 50) + "..." : s;
                }).join(" | ")
              ).join("\n")
            );
          }
        } catch {
          // Table might not have createdAt, try without ORDER
          try {
            const sampleResult = await client.query(
              `SELECT * FROM "${tableName}" LIMIT 2`
            );
            if (sampleResult.rows.length > 0) {
              const cols = sampleResult.fields.map((f: { name: string }) => f.name);
              samples.push(
                `-- "${tableName}" sample (${cols.length} columns: ${cols.join(", ")}):\n` +
                sampleResult.rows.map((row: Record<string, unknown>) =>
                  cols.map((c: string) => {
                    const v = row[c];
                    if (v === null) return "NULL";
                    if (typeof v === "object") return "{}";
                    const s = String(v);
                    return s.length > 50 ? s.substring(0, 50) + "..." : s;
                  }).join(" | ")
                ).join("\n")
              );
            }
          } catch { /* skip */ }
        }
      }
      sampleData = samples.join("\n\n");

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

  // Two-step AI approach: Plan first, then generate SQL

  const planPrompt = `You are a senior business intelligence analyst. The user asked: "${prompt}"

Given this database schema:
${schema}

And these relationships:
${foreignKeys || "None found"}

And sample data:
${sampleData || "No samples available"}

THINK about what the user REALLY wants to know. Go beyond the literal request:
- If they ask for "most ordered items" → they also want revenue, order count, average order value
- If they ask for "recent orders" → they want customer names, items ordered, amounts, statuses
- If they ask for "customers" → they want order history, total spend, last order date
- If they ask for "revenue" → they want breakdowns by product, category, time period

List EXACTLY which tables to JOIN and which columns to include. Think about what a CEO would want.
Output a JSON object with:
{"tables": ["Table1", "Table2"], "key_columns": ["col1", "col2"], "aggregations": ["SUM(amount)", "COUNT(*)"], "reasoning": "brief explanation"}

ONLY output the JSON, nothing else.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

    // Step 1: Plan
    const planRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: planPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
      }),
    });

    let planContext = "";
    if (planRes.ok) {
      const planData = await planRes.json();
      planContext = planData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    }

    // Step 2: Generate SQL using the plan
    const sqlPrompt = `You are a PostgreSQL expert. Generate a comprehensive query.

DATABASE SCHEMA:
${schema}

FOREIGN KEY RELATIONSHIPS:
${foreignKeys || "None found"}

SAMPLE DATA:
${sampleData || "No samples available"}

USER REQUEST: "${prompt}"

ANALYSIS PLAN:
${planContext || "Include all relevant related data"}

OUTPUT RULES:
- Output ONLY raw SQL — no markdown, no code fences, no explanation, no semicolons
- Use double quotes for ALL table/column names (they are PascalCase/case-sensitive)
- ALWAYS JOIN related tables for complete data — never return bare foreign key IDs
- Include items, quantities, prices, names, emails, statuses, dates — everything relevant
- For "items" data: use string_agg() to list item names/quantities in a readable column
- For monetary values: include individual amounts AND totals/sums
- Use meaningful aliases that a non-technical person would understand
- ORDER BY the most useful column (date DESC, amount DESC, count DESC)
- LIMIT 50 unless user specifies
- The query should tell a COMPLETE STORY — not just answer the literal question but provide full context

SQL:`;

    const sqlRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: sqlPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
      }),
    });

    if (!sqlRes.ok) {
      const err = await sqlRes.json();
      return NextResponse.json({ error: err.error?.message || "AI generation failed" }, { status: 500 });
    }

    const data = await sqlRes.json();
    let sql = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    sql = sql.replace(/^```sql?\n?/i, "").replace(/\n?```$/i, "").replace(/;\s*$/, "").trim();

    if (!sql) {
      return NextResponse.json({ error: "AI could not generate a query" }, { status: 500 });
    }

    return NextResponse.json({ sql });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI request failed" }, { status: 500 });
  }
}
