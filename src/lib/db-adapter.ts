/**
 * Database adapter — supports Postgres and ClickHouse
 * Each adapter implements: connect, query, getSchema, testConnection
 */

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface SchemaTable {
  table_name: string;
  columns: string;
}

export interface DbAdapter {
  testConnection(): Promise<void>;
  listDatabases(): Promise<string[]>;
  getSchema(): Promise<SchemaTable[]>;
  query(sql: string): Promise<QueryResult>;
  close(): Promise<void>;
}

// ---- Postgres Adapter ----

export async function createPostgresAdapter(connectionString: string): Promise<DbAdapter> {
  const { Client } = await import("pg");

  let client: InstanceType<typeof Client> | null = null;

  // Try SSL first, then without
  for (const sslOpt of [{ rejectUnauthorized: false }, false as const]) {
    const c = new Client({ connectionString, ssl: sslOpt, statement_timeout: 30000 });
    try {
      await c.connect();
      client = c;
      break;
    } catch {
      await c.end().catch(() => {});
    }
  }

  if (!client) throw new Error("Could not connect to PostgreSQL database");

  return {
    async testConnection() {
      await client!.query("SELECT 1");
    },

    async listDatabases() {
      // Postgres connects to a specific database already, return just that one
      const result = await client!.query("SELECT current_database() as db");
      return [result.rows[0].db];
    },

    async getSchema() {
      const result = await client!.query(`
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
      return result.rows;
    },

    async query(sql: string) {
      const cleanSql = sql.replace(/;\s*$/, "").trim();
      await client!.query("BEGIN READ ONLY");
      const result = await client!.query(
        `SELECT * FROM (${cleanSql}) AS _user_query LIMIT 1000`
      );
      await client!.query("COMMIT");
      return {
        columns: result.fields.map((f: { name: string }) => f.name),
        rows: result.rows,
        rowCount: result.rowCount || 0,
      };
    },

    async close() {
      await client!.end().catch(() => {});
    },
  };
}

// ---- ClickHouse Adapter ----

export async function createClickHouseAdapter(connectionString: string, selectedDatabase?: string): Promise<DbAdapter> {
  const { createClient } = await import("@clickhouse/client");

  // Parse connection string: clickhouse://user:pass@host:port/database
  // or https://host:port?user=X&password=Y&database=Z
  let config: { url: string; username?: string; password?: string; database?: string };

  try {
    const url = new URL(connectionString);
    if (url.protocol === "clickhouse:" || url.protocol === "ch:") {
      const secure = url.searchParams.get("secure") === "true" || url.port === "443";
      const scheme = secure ? "https" : "http";
      const defaultPort = secure ? "443" : "8123";
      config = {
        url: `${scheme}://${url.hostname}:${url.port || defaultPort}`,
        username: url.username || "default",
        password: url.password || "",
        database: url.pathname.replace("/", "") || "default",
      };
    } else {
      // HTTP URL format
      config = {
        url: connectionString,
        username: url.searchParams.get("user") || url.username || "default",
        password: url.searchParams.get("password") || url.password || "",
        database: url.searchParams.get("database") || url.pathname.replace("/", "") || "default",
      };
    }
  } catch {
    config = { url: connectionString };
  }

  // Override database if user selected one
  if (selectedDatabase) {
    config.database = selectedDatabase;
  }

  // For HTTPS connections, use keep_alive and let Node handle TLS
  const client = createClient({
    ...config,
    keep_alive: { enabled: true },
  });

  // Track which database to query schema from
  const dbName = config.database && config.database !== "default" ? config.database : null;

  return {
    async testConnection() {
      await client.query({ query: "SELECT 1" });
    },

    async listDatabases() {
      const result = await client.query({
        query: `SELECT name FROM system.databases WHERE name NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA', 'default') ORDER BY name`,
        format: "JSONEachRow",
      });
      const rows = await result.json<{ name: string }>();
      return rows.map((r) => r.name);
    },

    async getSchema() {
      // If a specific database is set, use it; otherwise query all non-system databases
      const dbFilter = dbName
        ? `database = '${dbName}'`
        : `database NOT IN ('system', 'information_schema', 'INFORMATION_SCHEMA')`;

      // If querying a specific database, just use table name; otherwise prefix with database
      const tableNameExpr = dbName
        ? `table`
        : `concat(database, '.', table)`;

      const result = await client.query({
        query: `
          SELECT
            ${tableNameExpr} as table_name,
            groupArray(concat(name, ' ', type)) as column_list
          FROM system.columns
          WHERE ${dbFilter}
          GROUP BY database, table
          ORDER BY database, table
        `,
        format: "JSONEachRow",
      });
      const rows = await result.json<{ table_name: string; column_list: string[] }>();
      return rows.map((r) => ({
        table_name: r.table_name,
        columns: r.column_list.join(", "),
      }));
    },

    async query(sql: string) {
      const cleanSql = sql.replace(/;\s*$/, "").trim();
      // ClickHouse doesn't support subquery wrapping the same way, apply LIMIT directly
      const limitedSql = /\bLIMIT\b/i.test(cleanSql) ? cleanSql : `${cleanSql} LIMIT 1000`;

      const result = await client.query({
        query: limitedSql,
        format: "JSONEachRow",
      });

      const rows = await result.json<Record<string, unknown>>();
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      return { columns, rows, rowCount: rows.length };
    },

    async close() {
      await client.close();
    },
  };
}

// ---- Factory ----

export async function createDbAdapter(dbType: string, connectionString: string, selectedDatabase?: string): Promise<DbAdapter> {
  switch (dbType) {
    case "postgres":
      return createPostgresAdapter(connectionString);
    case "clickhouse":
      return createClickHouseAdapter(connectionString, selectedDatabase);
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}
