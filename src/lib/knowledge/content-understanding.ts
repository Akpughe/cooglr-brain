import { complete, extractJson, BULK_MODEL } from "./llm";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface Entity {
  name: string;
  type: string;
}
export interface DocSynthesis {
  title: string;
  summary: string;
  category: string;
  topics: string[];
  entities: Entity[];
}

// Understand a document/email at ingest: categorize, extract entities, summarize.
// Uses the fast bulk model. This is the "map" half for content (vs blind RAG).
export async function synthesizeDocument(text: string, hintTitle?: string): Promise<DocSynthesis> {
  const user = `Document${hintTitle ? ` titled "${hintTitle}"` : ""}:
${text.slice(0, 6000)}

Return JSON {"title","summary","category","topics":[],"entities":[{"name","type"}]}.
- category: ONE short label (e.g. invoice, newsletter, meeting, notification, product-update, personal, contract, report).
- topics: up to 5 lowercase tags.
- entities: people / orgs / products / dates mentioned, each {name, type}.
- summary: 1-2 sentences, specific.`;
  try {
    const out = extractJson<Partial<DocSynthesis>>(
      await complete("You categorize and summarize documents and emails for a knowledge index.", user, BULK_MODEL),
    );
    return {
      title: out.title || hintTitle || "Untitled",
      summary: out.summary || "",
      category: (out.category || "uncategorized").toLowerCase(),
      topics: Array.isArray(out.topics) ? out.topics.slice(0, 5) : [],
      entities: Array.isArray(out.entities) ? out.entities.slice(0, 12) : [],
    };
  } catch {
    return { title: hintTitle || "Untitled", summary: "", category: "uncategorized", topics: [], entities: [] };
  }
}

// Persist the understanding as a content page + index entry (the map).
export async function persistUnderstanding(
  supabase: SupabaseServerClient,
  opts: { workspaceId: string; source: string; sourceRef: string; synthesis: DocSynthesis },
): Promise<void> {
  const { workspaceId, source, sourceRef, synthesis } = opts;
  const path = `content/${workspaceId}/${source}/${sourceRef}`;
  const contentMd =
    `# ${synthesis.title}\n\n**Category:** ${synthesis.category}\n\n${synthesis.summary}\n\n` +
    (synthesis.topics.length ? `**Topics:** ${synthesis.topics.join(", ")}\n\n` : "") +
    (synthesis.entities.length ? `**Entities:** ${synthesis.entities.map((e) => `${e.name} (${e.type})`).join(", ")}` : "");

  const { data } = await supabase
    .from("knowledge_pages")
    .upsert(
      {
        workspace_id: workspaceId,
        connection_id: null,
        path,
        type: "document",
        title: synthesis.title,
        content_md: contentMd,
        frontmatter: {
          type: "document",
          category: synthesis.category,
          topics: synthesis.topics,
          entities: synthesis.entities,
          source,
          source_ref: sourceRef,
        },
        access_spec: {},
        confidence: "medium",
        stale: false,
        source,
        source_ref: sourceRef,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,path" },
    )
    .select("id")
    .single();

  if (!data?.id) return;

  await supabase.from("knowledge_index").upsert(
    {
      page_id: data.id,
      workspace_id: workspaceId,
      summary_1line: `${synthesis.title} — ${synthesis.summary}`.slice(0, 200),
      categories: [synthesis.category, ...synthesis.topics].slice(0, 8),
      last_touched: new Date().toISOString(),
    },
    { onConflict: "page_id" },
  );
}

// Pure: aggregate content pages into a workspace content map (the "what do we
// have and how is it organized" view).
export interface ContentPageRow {
  title: string;
  frontmatter: { category?: string; topics?: string[]; entities?: Entity[] } | null;
}
export interface ContentMap {
  documentCount: number;
  categories: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  entities: { name: string; count: number }[];
}
export function aggregateContentMap(pages: ContentPageRow[]): ContentMap {
  const cat = new Map<string, number>();
  const top = new Map<string, number>();
  const ent = new Map<string, number>();
  const bump = (m: Map<string, number>, k?: string) => {
    if (!k) return;
    m.set(k, (m.get(k) ?? 0) + 1);
  };
  for (const p of pages) {
    const fm = p.frontmatter ?? {};
    bump(cat, fm.category);
    (fm.topics ?? []).forEach((t) => bump(top, t));
    (fm.entities ?? []).forEach((e) => bump(ent, e?.name));
  }
  const sorted = (m: Map<string, number>) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return {
    documentCount: pages.length,
    categories: sorted(cat),
    topics: sorted(top).slice(0, 30),
    entities: sorted(ent).slice(0, 50),
  };
}

// Fetch + aggregate the content map for a workspace.
export async function getContentMap(supabase: SupabaseServerClient, workspaceId: string): Promise<ContentMap> {
  const { data } = await supabase
    .from("knowledge_pages")
    .select("title, frontmatter")
    .eq("workspace_id", workspaceId)
    .eq("type", "document")
    .eq("stale", false);
  return aggregateContentMap((data ?? []) as ContentPageRow[]);
}

// A short text overview of the map to ground content answers.
export function contentMapOverview(map: ContentMap): string {
  if (map.documentCount === 0) return "";
  const cats = map.categories.slice(0, 8).map((c) => `${c.name} (${c.count})`).join(", ");
  const ents = map.entities.slice(0, 12).map((e) => e.name).join(", ");
  return `Workspace has ${map.documentCount} indexed documents. Categories: ${cats}.${ents ? ` Key entities: ${ents}.` : ""}`;
}
