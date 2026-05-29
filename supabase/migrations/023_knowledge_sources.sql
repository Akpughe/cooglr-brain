-- ============================================================
-- Migration 023: knowledge_sources — per-source sync state so the UI can show
-- "last synced" + item count, and ingest can pull incrementally.
-- ============================================================
create table public.knowledge_sources (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  source text not null,            -- gmail | slack | github | google-drive | file | database
  last_synced_at timestamptz,
  item_count int not null default 0,
  created_at timestamptz default now(),
  unique (workspace_id, source)
);
alter table public.knowledge_sources enable row level security;
create policy "members read sources" on public.knowledge_sources for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write sources" on public.knowledge_sources for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
