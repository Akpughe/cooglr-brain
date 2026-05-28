// One-off live FULL ingest: wires a real connection into Supabase and builds the
// complete knowledge map (introspect -> batched enrichment -> pages -> persist).
// Guarded behind RUN_FULL_INGEST=1 plus all required env, so it never runs in
// the normal suite. Uses the service client (no logged-in session in a test).
//
//   set -a; . ./.env.local; set +a
//   RUN_FULL_INGEST=1 WS_ID=... USER_ID=... \
//   KNOWLEDGE_TEST_DB_URL=postgres://... \
//   npx vitest run full-ingest.live
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { encrypt } from "../../crypto";
import { createPostgresAdapter } from "../../db-adapter";
import { enrichSchema, buildPages, persistPages } from "../ingest";
import { planQuery, synthesizeAnswer } from "../query";
import { sqlDigTool } from "../dig/sql-dig";
import type { RawTable } from "../introspect";

const ready =
  process.env.RUN_FULL_INGEST === "1" &&
  process.env.KNOWLEDGE_TEST_DB_URL &&
  process.env.WS_ID &&
  process.env.USER_ID &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!ready)("knowledge layer — FULL live ingest into Supabase", () => {
  it("introspects, enriches, builds and persists the whole map", { timeout: 600000 }, async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const workspaceId = process.env.WS_ID!;
    const userId = process.env.USER_ID!;
    const dbUrl = process.env.KNOWLEDGE_TEST_DB_URL!;

    // 1. Upsert the connection (idempotent by workspace + name).
    let connectionId: string;
    const { data: existing } = await supabase
      .from("database_connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", "chowcentral_staging")
      .maybeSingle();

    if (existing?.id) {
      connectionId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("database_connections")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          name: "chowcentral_staging",
          encrypted_connection_string: encrypt(dbUrl),
          db_type: "postgres",
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(`connection insert failed: ${error.message}`);
      connectionId = created!.id;
    }
    console.log("CONNECTION:", connectionId);

    // 2. Introspect the real DB.
    const adapter = await createPostgresAdapter(dbUrl);
    const intro = await adapter.introspect();
    await adapter.close();
    const raw = intro.tables as RawTable[];
    console.log(`INTROSPECT: ${raw.length} tables`);

    // 3. Batched enrichment (fast bulk model).
    const t0 = Date.now();
    const enrichment = await enrichSchema(raw);
    console.log(`ENRICH: ${enrichment.tables.length} tables, ${enrichment.metrics.length} metrics in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    // 4. Build pages and report the breakdown.
    const pages = buildPages(workspaceId, connectionId, raw, enrichment);
    const byType: Record<string, number> = {};
    for (const p of pages) byType[p.type] = (byType[p.type] ?? 0) + 1;
    console.log("PAGES:", pages.length, JSON.stringify(byType));

    // 5. Persist (concurrent).
    const t1 = Date.now();
    await persistPages(supabase as unknown as Parameters<typeof persistPages>[0], pages, "ingest", userId);
    console.log(`PERSIST: ${pages.length} pages in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

    // 6. Confirm rows landed.
    const { count } = await supabase
      .from("knowledge_pages")
      .select("id", { count: "exact", head: true })
      .eq("connection_id", connectionId);
    console.log("PERSISTED knowledge_pages:", count);
    expect((count ?? 0) > 0).toBe(true);
  });

  it("answers a question from the PERSISTED map (production query path)", { timeout: 120000 }, async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const workspaceId = process.env.WS_ID!;
    const dbUrl = process.env.KNOWLEDGE_TEST_DB_URL!;

    const { data: conn } = await supabase
      .from("database_connections")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("name", "chowcentral_staging")
      .single();

    // Load the persisted map exactly like /api/knowledge/query does.
    const { data: pages } = await supabase
      .from("knowledge_pages")
      .select("path, type, title, access_spec")
      .eq("connection_id", conn!.id);
    expect((pages?.length ?? 0)).toBeGreaterThan(0);

    const indexLines = pages!.map((p) => `- ${p.path} — ${p.title}`).join("\n");
    const tablePages = pages!.filter((p) => p.type === "table");
    const pageSpecs = JSON.stringify(
      tablePages.slice(0, 60).map((p) => ({ path: p.path, accessSpec: p.access_spec })),
    );
    const target = (tablePages[0].access_spec as { table?: string }).table ?? "Address";
    const question = `How many rows are in the "${target}" table?`;

    const plan = await planQuery(question, indexLines, pageSpecs);
    console.log("PLANNED SQL:", plan.sql);

    const adapter = await createPostgresAdapter(dbUrl);
    const dig = await sqlDigTool.run(plan, {
      connectionId: conn!.id,
      maxRows: 100,
      query: (sql) => adapter.runReadOnly(sql),
    });
    await adapter.close();
    console.log("DIG:", JSON.stringify(dig.rows).slice(0, 200));

    const answer = await synthesizeAnswer(question, plan, dig);
    console.log("ANSWER:", answer.answerMd);
    expect(answer.answerMd.length).toBeGreaterThan(0);
  });
});
