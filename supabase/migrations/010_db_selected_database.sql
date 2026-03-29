-- Add selected_database column for multi-database servers (e.g. ClickHouse)
ALTER TABLE public.database_connections ADD COLUMN IF NOT EXISTS selected_database text;

-- Update check constraint to include clickhouse
ALTER TABLE public.database_connections DROP CONSTRAINT IF EXISTS database_connections_db_type_check;
ALTER TABLE public.database_connections ADD CONSTRAINT database_connections_db_type_check
  CHECK (db_type IN ('postgres', 'mysql', 'clickhouse'));
