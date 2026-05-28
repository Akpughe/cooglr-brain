-- ============================================================
-- Migration 019: knowledge_documents — tracks files ingested into the RAG
-- corpus (chunks/vectors live in Qdrant; this is the workspace-scoped record
-- for listing + RLS-scoped UI).
-- ============================================================

create table public.knowledge_documents (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  file_id uuid references public.files(id) on delete cascade not null,
  title text not null,
  status text not null default 'done' check (status in ('queued','running','done','error')),
  chunk_count int not null default 0,
  error text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (workspace_id, file_id)
);
alter table public.knowledge_documents enable row level security;
create policy "members read documents" on public.knowledge_documents for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write documents" on public.knowledge_documents for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
create index idx_knowledge_documents_ws on public.knowledge_documents(workspace_id);
