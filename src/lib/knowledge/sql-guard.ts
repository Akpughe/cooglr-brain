// Read-only SQL guard. The "dig" step must never mutate a connected database.
// This is the hard boundary chosen in the design spec (§7): SELECT/WITH only,
// no write/DDL keywords, single statement, enforced LIMIT.

export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}

const FORBIDDEN = [
  "insert", "update", "delete", "drop", "alter", "create", "truncate",
  "grant", "revoke", "comment", "merge", "call", "do", "copy",
  "vacuum", "analyze", "reindex", "set", "reset", "lock", "begin",
  "commit", "rollback", "savepoint", "listen", "notify", "explain",
  // `SELECT ... INTO` creates a table — a write disguised as a SELECT.
  "into",
  // Server-side functions that read the filesystem or reach other systems.
  "pg_read_file", "pg_read_binary_file", "pg_ls_dir", "lo_import",
  "lo_export", "dblink",
];

// Remove block and line comments before keyword scanning so writes cannot be
// smuggled behind a comment.
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

export function guardReadOnlySql(raw: string, opts: { maxRows: number }): string {
  const trimmed = raw.trim().replace(/;\s*$/, "");
  const scan = stripComments(trimmed).trim();

  if (!scan) throw new GuardError("Empty statement");

  // Single statement only — no semicolons in the (comment-stripped) body.
  if (scan.includes(";")) {
    throw new GuardError("Multiple statements are not allowed");
  }

  const lower = scan.toLowerCase();

  // Must start with SELECT or WITH.
  if (!/^(select|with)\b/.test(lower)) {
    throw new GuardError("Only SELECT/WITH queries are allowed");
  }

  // No forbidden keyword anywhere (word-boundary match).
  for (const kw of FORBIDDEN) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(scan)) {
      throw new GuardError(`Forbidden keyword: ${kw}`);
    }
  }

  // Enforce a LIMIT. Preserve an existing LIMIT at or under the cap; otherwise
  // wrap the query so it cannot return more than maxRows.
  const m = lower.match(/\blimit\s+(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n <= opts.maxRows) return trimmed;
  }
  return `SELECT * FROM (${trimmed}) AS _guarded LIMIT ${opts.maxRows}`;
}
