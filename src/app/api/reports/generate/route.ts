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

  const aiPrompt = `You are a senior business intelligence analyst writing PostgreSQL queries. Your queries should be comprehensive and insightful — you NEVER return bare IDs when human-readable data is available.

DATABASE SCHEMA:
${schema}

FOREIGN KEY RELATIONSHIPS:
${foreignKeys || "None found"}

SAMPLE DATA FROM KEY TABLES:
${sampleData || "No samples available"}

USER REQUEST: "${prompt}"

CRITICAL RULES:
1. Output ONLY raw SQL — no markdown, no code fences, no explanation, no semicolons
2. Use double quotes for ALL table and column names (they are PascalCase/case-sensitive)
3. BE COMPREHENSIVE — JOIN every related table that adds useful context:
   - Orders → JOIN OrderItem for item details (names, quantities, prices)
   - Orders → JOIN Customer/User for customer names and contact info
   - Orders → JOIN Product/Menu for product names and categories
   - Orders → JOIN Business/Store for business names and locations
   - Always resolve foreign key IDs into human-readable names
4. NEVER return just IDs — always JOIN to get names, descriptions, amounts
5. Include ALL relevant columns: amounts, quantities, names, statuses, dates, categories
6. Use string_agg() or array_agg() to combine child rows (e.g., order items) into a single column when useful
7. Use meaningful aliases: "customer_name", "total_amount", "item_count", "items_ordered", "business_name"
8. Format currency values, format dates with to_char() for readability
9. Include aggregations (COUNT, SUM, AVG) when they make the report more insightful
10. ORDER BY the most relevant column (usually date DESC, amount DESC, or count DESC)
11. LIMIT to 50 by default unless the user specifies otherwise
12. Think: "What would a CEO or operations manager want to see in this report?"

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
