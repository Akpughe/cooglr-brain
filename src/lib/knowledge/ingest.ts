import type { KnowledgePage } from "./types";
import {
  buildAccessSpecs,
  inferJoins,
  type RawTable,
} from "./introspect";
import { DEFAULT_AGENTS_MD } from "./agents-md";
import { complete, extractJson } from "./llm";

// LLM-produced enrichment over the raw schema.
export interface TableEnrichment {
  table: string;
  description?: string;
  grain?: string;
  tenantColumn?: string;
}
export interface MetricEnrichment {
  name: string;
  description?: string;
  sql: string;
}
export interface Enrichment {
  tables: TableEnrichment[];
  metrics: MetricEnrichment[];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

// Pure: turn introspection + enrichment into the set of knowledge pages.
export function buildPages(
  workspaceId: string,
  connectionId: string,
  raw: RawTable[],
  enrichment: Enrichment,
): KnowledgePage[] {
  const pages: KnowledgePage[] = [];
  const specs = buildAccessSpecs(connectionId, raw);
  const enrichByTable = new Map(enrichment.tables.map((t) => [t.table, t]));

  // 1. Database overview page.
  pages.push({
    workspaceId,
    connectionId,
    path: `db/${connectionId}/overview`,
    type: "database",
    title: "Database overview",
    contentMd:
      `# Database overview\n\n${raw.length} tables.\n\n` +
      raw.map((t) => `- ${t.name} (${t.columns.length} cols, ~${t.rowCount ?? 0} rows)`).join("\n"),
    frontmatter: { type: "database", updated: null, sources: [connectionId] },
    accessSpec: { connectionId },
    confidence: "high",
    stale: false,
  });

  // 2. One page per table, carrying its access_spec.
  for (const t of raw) {
    const spec = specs.find((s) => s.table === t.name)!;
    const e = enrichByTable.get(t.name);
    if (e?.grain) spec.grain = e.grain;
    if (e?.tenantColumn) spec.tenantColumn = e.tenantColumn;

    const colLines = t.columns
      .map((c) => `- \`${c.name}\` ${c.type}${c.isPrimaryKey ? " (pk)" : ""}${c.nullable ? "" : " not null"}`)
      .join("\n");
    const joinLines = (spec.joins ?? [])
      .map((j) => `- ${j.fromTable}.${j.fromColumn} → ${j.toTable}.${j.toColumn}${j.declared ? "" : " (inferred)"}`)
      .join("\n");

    pages.push({
      workspaceId,
      connectionId,
      path: `db/${connectionId}/tables/${t.name}`,
      type: "table",
      title: `Table: ${t.name}`,
      contentMd:
        `# ${t.name}\n\n${e?.description ?? ""}\n\n` +
        (e?.grain ? `**Grain:** ${e.grain}\n\n` : "") +
        `## Columns\n${colLines}\n\n` +
        (joinLines ? `## Joins\n${joinLines}\n` : ""),
      frontmatter: { type: "table", updated: null, sources: [connectionId] },
      accessSpec: spec,
      confidence: "high",
      stale: false,
    });
  }

  // 3. Relationship pages (one per inferred/declared join).
  for (const j of inferJoins(raw)) {
    pages.push({
      workspaceId,
      connectionId,
      path: `db/${connectionId}/relationships/${j.fromTable}__${j.fromColumn}__${j.toTable}`,
      type: "relationship",
      title: `${j.fromTable}.${j.fromColumn} → ${j.toTable}.${j.toColumn}`,
      contentMd: `Join ${j.fromTable}.${j.fromColumn} to ${j.toTable}.${j.toColumn}.${j.declared ? " Declared foreign key." : " Inferred by name heuristic."}`,
      frontmatter: { type: "relationship", updated: null, sources: [connectionId] },
      accessSpec: { connectionId, joins: [j] },
      confidence: j.declared ? "high" : "medium",
      stale: false,
    });
  }

  // 4. Metric pages with vetted SQL.
  for (const m of enrichment.metrics) {
    pages.push({
      workspaceId,
      connectionId,
      path: `db/${connectionId}/metrics/${slug(m.name)}`,
      type: "metric",
      title: `Metric: ${m.name}`,
      contentMd: `# ${m.name}\n\n${m.description ?? ""}\n\n\`\`\`sql\n${m.sql}\n\`\`\``,
      frontmatter: { type: "metric", updated: null, sources: [connectionId] },
      accessSpec: { connectionId, metricSql: m.sql },
      confidence: "medium",
      stale: false,
    });
  }

  return pages;
}

// Ask the LLM to enrich the raw schema. Glue (needs an AI key).
export async function enrichSchema(raw: RawTable[]): Promise<Enrichment> {
  const schema = raw
    .map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}`).join(", ")})`)
    .join("\n");
  const user = `Schema:\n${schema}\n\nReturn JSON: {"tables":[{"table","description","grain","tenantColumn"}],"metrics":[{"name","description","sql"}]}. Metrics' sql must be a single read-only SELECT. Use only real table/column names above.`;
  const text = await complete(DEFAULT_AGENTS_MD, user);
  try {
    return extractJson<Enrichment>(text);
  } catch {
    return { tables: [], metrics: [] };
  }
}

// Use the real Supabase server client type (type-only import — erased at runtime,
// so test bundles that import buildPages never pull in server-only code).
import type { createClient } from "@/lib/supabase/server";
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Persist pages + revisions + index entries. Uses the caller's RLS-scoped client.
export async function persistPages(
  supabase: SupabaseServerClient,
  pages: KnowledgePage[],
  operation: "ingest" | "refresh",
  userId: string,
): Promise<void> {
  for (const p of pages) {
    const { data } = await supabase
      .from("knowledge_pages")
      .upsert(
        {
          workspace_id: p.workspaceId,
          connection_id: p.connectionId,
          path: p.path,
          type: p.type,
          title: p.title,
          content_md: p.contentMd,
          frontmatter: p.frontmatter,
          access_spec: p.accessSpec,
          confidence: p.confidence,
          stale: p.stale,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,path" },
      )
      .select("id")
      .single();

    if (!data?.id) continue;

    await supabase.from("knowledge_page_revisions").insert({
      page_id: data.id,
      workspace_id: p.workspaceId,
      content_md: p.contentMd,
      frontmatter: p.frontmatter,
      access_spec: p.accessSpec,
      operation,
      created_by: userId,
    });

    await supabase.from("knowledge_index").upsert(
      {
        page_id: data.id,
        workspace_id: p.workspaceId,
        summary_1line: p.title,
        categories: [p.type],
        last_touched: new Date().toISOString(),
      },
      { onConflict: "page_id" },
    );
  }
}
