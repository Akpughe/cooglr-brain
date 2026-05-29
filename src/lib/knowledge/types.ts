// Knowledge layer — shared types.
// The map is a navigator (structural understanding), never a data store.

export type KnowledgePageType =
  | "database"
  | "table"
  | "relationship"
  | "metric"
  | "domain";

// A column as introspected, optionally LLM-enriched.
export interface ColumnSpec {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  description?: string; // LLM-enriched
  sampleValues?: string[]; // low-cardinality only
}

// A foreign-key or inferred join path between two tables.
export interface JoinPath {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  declared: boolean; // true = real FK, false = name-heuristic
}

// The machine-readable half of a page — what makes a dig precise.
export interface AccessSpec {
  connectionId: string;
  table?: string;
  grain?: string; // what one row represents
  columns?: ColumnSpec[];
  joins?: JoinPath[];
  metricSql?: string; // metric pages: vetted read-only SQL
  tenantColumn?: string; // scoping column if any
}

export interface KnowledgePage {
  id?: string;
  workspaceId: string;
  connectionId: string;
  path: string; // e.g. db/<conn>/tables/users
  type: KnowledgePageType;
  title: string;
  contentMd: string;
  frontmatter: Record<string, unknown>;
  accessSpec: AccessSpec;
  confidence: "low" | "medium" | "high";
  stale: boolean;
}

// Result of the Plan step.
export interface QueryPlan {
  question: string;
  pagePaths: string[]; // map pages the planner used
  tables: string[];
  joinPath?: JoinPath[];
  sql: string; // grounded SQL to run (SQL dig)
  search?: string; // semantic query string (vector dig)
  category?: string; // optional content category to scope the vector dig
  wantsChart: boolean;
  chartHint?: "bar" | "line" | "pie";
}

// Result of a Dig.
export interface DigResult {
  tool: string; // e.g. "sql"
  sql?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}
