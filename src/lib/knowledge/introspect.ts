import type { AccessSpec, JoinPath } from "./types";

// Raw shapes returned by db-adapter introspection.
export interface RawColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}
export interface RawForeignKey {
  column: string;
  refTable: string;
  refColumn: string;
}
export interface RawTable {
  name: string;
  columns: RawColumn[];
  foreignKeys: RawForeignKey[];
  rowCount?: number;
}

// Infer join paths: declared foreign keys first, then a name heuristic where a
// column `<base>_id` (snake_case) or `<base>Id` (camelCase, Prisma-style) joins
// to a table named like `<base>` (or its plural) on its primary key. Table
// matching is case-insensitive so `userId` finds the PascalCase `User` table.
// Heuristic joins are flagged declared:false (lower confidence).
export function inferJoins(tables: RawTable[]): JoinPath[] {
  const byLower = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  const out: JoinPath[] = [];

  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      out.push({
        fromTable: t.name,
        fromColumn: fk.column,
        toTable: fk.refTable,
        toColumn: fk.refColumn,
        declared: true,
      });
    }

    const declaredCols = new Set(t.foreignKeys.map((f) => f.column));
    for (const c of t.columns) {
      if (declaredCols.has(c.name)) continue;
      // snake_case `_id` or camelCase `Id` suffix (not bare "id"/"uuid").
      const m = c.name.match(/^(.+?)(?:_id|Id)$/);
      if (!m) continue;
      const base = m[1].toLowerCase();
      const candidates = [base, `${base}s`, `${base}es`];
      const target = candidates
        .map((n) => byLower.get(n))
        .find((x): x is RawTable => Boolean(x));
      if (!target) continue;
      const pk =
        target.columns.find((x) => x.isPrimaryKey) ??
        target.columns.find((x) => x.name.toLowerCase() === "id");
      if (!pk) continue;
      out.push({
        fromTable: t.name,
        fromColumn: c.name,
        toTable: target.name,
        toColumn: pk.name,
        declared: false,
      });
    }
  }
  return out;
}

// Build per-table access specs (the machine-readable half of each table page)
// from raw introspection plus the inferred join graph.
export function buildAccessSpecs(
  connectionId: string,
  raw: RawTable[],
): AccessSpec[] {
  const joins = inferJoins(raw);
  return raw.map((t) => ({
    connectionId,
    table: t.name,
    columns: t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable,
      isPrimaryKey: c.isPrimaryKey,
    })),
    joins: joins.filter((j) => j.fromTable === t.name || j.toTable === t.name),
  }));
}
