import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import { createDbAdapter } from "@/lib/db-adapter";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, connectionId, conversationHistory, workspaceId } = await request.json();
  if (!prompt || !connectionId) {
    return NextResponse.json({ error: "Prompt and connectionId required" }, { status: 400 });
  }

  const historyContext = (conversationHistory || [])
    .map((h: { prompt: string; sql: string; rowCount: number }) =>
      `Previous query: "${h.prompt}" → SQL: ${h.sql} → Returned ${h.rowCount} rows`
    )
    .join("\n");

  const connectionQuery = supabase
    .from("database_connections")
    .select("encrypted_connection_string, db_type, selected_database")
    .eq("id", connectionId);

  if (workspaceId) {
    connectionQuery.eq("workspace_id", workspaceId);
  } else {
    connectionQuery.eq("user_id", user.id);
  }

  const { data: connection } = await connectionQuery.single();

  if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  let connectionString: string;
  try {
    connectionString = decrypt(connection.encrypted_connection_string);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt connection" }, { status: 500 });
  }

  const dbType = connection.db_type || "postgres";
  const isClickHouse = dbType === "clickhouse";

  // --- Fetch schema + sample data using the adapter ---
  let schema = "";
  let foreignKeys = "";
  let sampleData = "";

  try {
    const adapter = await createDbAdapter(dbType, connectionString, connection.selected_database || undefined);

    // Get schema
    const tables = await adapter.getSchema();
    schema = tables.map((t) => `"${t.table_name}" (${t.columns})`).join("\n");

    // Get foreign keys (Postgres only — ClickHouse doesn't have FK constraints)
    if (!isClickHouse) {
      try {
        const fkResult = await adapter.query(`
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
        foreignKeys = fkResult.rows.map((r) =>
          `"${r.from_table}"."${r.from_column}" -> "${r.to_table}"."${r.to_column}"`
        ).join("\n");
      } catch { /* some pg users may not have access */ }
    }

    // Sample data from relevant tables
    const keywords = prompt.toLowerCase().split(/\s+/);
    const relevantTables = tables
      .filter((t) => {
        const name = t.table_name.toLowerCase();
        return keywords.some((k: string) =>
          name.includes(k) || k.includes(name) ||
          k.length > 3 && (name.includes(k.slice(0, -1)) || k.includes(name.split(".").pop() || ""))
        );
      })
      .map((t) => t.table_name)
      .slice(0, 5);

    // Also try common table names
    const commonNames = ["order", "customer", "user", "product", "item", "business", "transaction", "payment"];
    const allTables = tables.map((t) => t.table_name);
    const extraTables = allTables
      .filter((t) => commonNames.some((c) => t.toLowerCase().includes(c)))
      .slice(0, 5);

    const tablesToSample = [...new Set([...relevantTables, ...extraTables])].slice(0, 8);

    const samples: string[] = [];
    for (const tableName of tablesToSample) {
      try {
        // For ClickHouse, table names include database prefix (db.table)
        const sampleResult = await adapter.query(`SELECT * FROM ${isClickHouse ? tableName : `"${tableName}"`} LIMIT 2`);
        if (sampleResult.rows.length > 0) {
          samples.push(
            `-- "${tableName}" sample (${sampleResult.columns.length} columns: ${sampleResult.columns.join(", ")}):\n` +
            sampleResult.rows.map((row) =>
              sampleResult.columns.map((c) => {
                const v = row[c];
                if (v === null || v === undefined) return "NULL";
                if (typeof v === "object") return "{}";
                const s = String(v);
                return s.length > 50 ? s.substring(0, 50) + "..." : s;
              }).join(" | ")
            ).join("\n")
          );
        }
      } catch { /* skip tables we can't sample */ }
    }
    sampleData = samples.join("\n\n");

    await adapter.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Could not fetch database schema: ${msg}` }, { status: 500 });
  }

  if (!schema) {
    return NextResponse.json({ error: "No tables found in the database" }, { status: 500 });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({ error: "AI API key not configured" }, { status: 500 });
  }

  // --- DB-specific SQL generation instructions ---
  const dbLabel = isClickHouse ? "ClickHouse" : "PostgreSQL";
  const syntaxRules = isClickHouse
    ? `- This is ClickHouse SQL — do NOT use PostgreSQL syntax
- Use backticks or no quotes for identifiers (NOT double quotes)
- Tables may be prefixed with database name (e.g. db.table)
- Use ClickHouse functions: toDate(), formatDateTime(), arrayJoin(), etc.
- For aggregation across strings use groupArray() or arrayStringConcat()
- Use FORMAT defaults — do NOT add FORMAT clause
- ClickHouse has no JOINs like Postgres — use JOIN with explicit ON clauses, prefer LEFT JOIN
- For date filtering use toDate(now()) and date arithmetic
- LIMIT 50 unless user specifies`
    : `- This is PostgreSQL — use PostgreSQL syntax
- Use double quotes for ALL table/column names (they are PascalCase/case-sensitive)
- ALWAYS JOIN related tables for complete data — never return bare foreign key IDs
- For "items" data: use string_agg() to list item names/quantities in a readable column
- For monetary values: include individual amounts AND totals/sums
- LIMIT 50 unless user specifies`;

  const selectedDb = connection.selected_database;
  const dbContext = selectedDb ? `\nSELECTED DATABASE: ${selectedDb} — all queries should target this database.\n` : "";

  // Two-step AI approach
  const planPrompt = `You are a senior business intelligence analyst. The user asked: "${prompt}"

Given this ${dbLabel} database schema:
${schema}
${dbContext}
And these relationships:
${foreignKeys || "None found / not applicable"}

And sample data:
${sampleData || "No samples available"}

THINK about what the user REALLY wants to know. Go beyond the literal request:
- If they ask for "most ordered items" → they also want revenue, order count, average order value
- If they ask for "recent orders" → they want customer names, items ordered, amounts, statuses
- If they ask for "customers" → they want order history, total spend, last order date
- If they ask for "revenue" → they want breakdowns by product, category, time period
- If they ask about "tables" or "schema" → list all tables with their row counts and column counts

List EXACTLY which tables to query and which columns to include. Think about what a CEO would want.
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

    // Step 2: Generate SQL
    const sqlPrompt = `You are a ${dbLabel} expert. Generate a comprehensive query.

DATABASE TYPE: ${dbLabel}
DATABASE SCHEMA:
${schema}
${dbContext}
FOREIGN KEY RELATIONSHIPS:
${foreignKeys || "None found / not applicable"}

SAMPLE DATA:
${sampleData || "No samples available"}

CONVERSATION HISTORY (previous queries in this session):
${historyContext || "None — this is the first query"}

USER REQUEST: "${prompt}"
Note: If the user references "these", "those", "the same", etc., they are referring to results from previous queries above.

ANALYSIS PLAN:
${planContext || "Include all relevant related data"}

OUTPUT RULES:
- Output ONLY raw SQL — no markdown, no code fences, no explanation, no semicolons
${syntaxRules}
- Use meaningful aliases that a non-technical person would understand
- ORDER BY the most useful column (date DESC, amount DESC, count DESC)
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
