import { describe, it, expect } from "vitest";
import { persistPages } from "../ingest";
import type { RawTable } from "../introspect";
import { buildPages } from "../ingest";

// Records the prune UPDATE that persistPages issues at the end.
interface PruneCall { table: string; stale: unknown; conn: unknown; ltCol: string }

function makeFakeClient(prune: PruneCall[]) {
  let idCounter = 0;
  const from = (table: string) => ({
    upsert() {
      // knowledge_pages.upsert is chained .select().single(); index.upsert is awaited.
      return table === "knowledge_pages"
        ? { select: () => ({ single: async () => ({ data: { id: `id-${idCounter++}` } }) }) }
        : Promise.resolve({ error: null });
    },
    insert: async () => ({ error: null }),
    update(vals: Record<string, unknown>) {
      const call: PruneCall = { table, stale: vals.stale, conn: undefined, ltCol: "" };
      const chain = {
        eq(col: string, v: unknown) {
          if (col === "connection_id") call.conn = v;
          return chain;
        },
        lt(col: string, v: unknown) {
          call.ltCol = col;
          void v;
          prune.push(call);
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  });
  return { from };
}

const raw: RawTable[] = [
  { name: "users", columns: [{ name: "id", type: "uuid", nullable: false, isPrimaryKey: true }], foreignKeys: [], rowCount: 1 },
];

describe("persistPages stale-prune", () => {
  it("marks pages for the connection not written this run as stale", async () => {
    const prune: PruneCall[] = [];
    const pages = buildPages("ws-1", "conn-x", raw, { tables: [], metrics: [] });

    await persistPages(
      makeFakeClient(prune) as unknown as Parameters<typeof persistPages>[0],
      pages,
      "ingest",
      "user-1",
    );

    expect(prune).toHaveLength(1);
    expect(prune[0].table).toBe("knowledge_pages");
    expect(prune[0].stale).toBe(true);
    expect(prune[0].conn).toBe("conn-x");
    expect(prune[0].ltCol).toBe("updated_at");
  });
});
