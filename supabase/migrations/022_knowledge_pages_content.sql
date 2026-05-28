-- ============================================================
-- Migration 022: let knowledge_pages hold CONTENT understanding pages (the map
-- for documents/email), not just DB-structural pages. connection_id becomes
-- optional; add source/source_ref; allow a 'document' (etc.) page type.
-- ============================================================

alter table public.knowledge_pages alter column connection_id drop not null;
alter table public.knowledge_pages add column if not exists source text;
alter table public.knowledge_pages add column if not exists source_ref text;

alter table public.knowledge_pages drop constraint if exists knowledge_pages_type_check;
alter table public.knowledge_pages add constraint knowledge_pages_type_check
  check (type in ('database','table','relationship','metric','domain','document','entity','topic'));

create index if not exists idx_knowledge_pages_ws_type on public.knowledge_pages(workspace_id, type);
