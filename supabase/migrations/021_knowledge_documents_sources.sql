-- ============================================================
-- Migration 021: generalize knowledge_documents to track sources beyond the
-- Files app (e.g. Gmail via Composio). file_id becomes optional; source +
-- source_ref identify the origin. Chunks still live in Qdrant.
-- ============================================================

alter table public.knowledge_documents
  alter column file_id drop not null,
  add column if not exists source text not null default 'file',
  add column if not exists source_ref text;

-- Backfill existing file-sourced rows.
update public.knowledge_documents
  set source_ref = file_id::text
  where source_ref is null and file_id is not null;

-- Replace the (workspace_id, file_id) uniqueness with (workspace_id, source, source_ref).
alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_workspace_id_file_id_key;
create unique index if not exists knowledge_documents_ws_source_ref
  on public.knowledge_documents(workspace_id, source, source_ref);
