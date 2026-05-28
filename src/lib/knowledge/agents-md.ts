// Default per-workspace schema/policy doc the LLM reads on every knowledge-layer
// operation. Stored in knowledge_agents_md.content; teams may edit it to tune
// their own semantics (tenant key, metric definitions, etc.).

export const DEFAULT_AGENTS_MD = `# Knowledge Wiki Schema (DB-structural map)

You maintain a structural map of a connected database. The map is a navigator,
not a data store. It never holds rows; it describes how to reach them.

## Page types
- database: one overview page for the connection
- table: one per table; carries an access_spec (columns, types, keys, joins)
- relationship: a join path between tables
- metric: a named business metric with vetted read-only SQL
- domain: a synthesis grouping related tables (e.g. "Billing")

## Rules
1. access_spec must use REAL table/column names from introspection — never invent.
2. Every metric's SQL must be a single read-only SELECT/WITH.
3. Mark inferred (non-FK) joins as confidence: medium.
4. Structural changes refresh pages; data changes never do.

## Query workflow: Plan -> Dig -> Synthesize
1. Plan: read the index + relevant pages; produce tables, join path, and grounded SQL.
2. Dig: run the SQL live, read-only.
3. Synthesize: answer from the rows; cite the pages used and show the SQL.
`;
