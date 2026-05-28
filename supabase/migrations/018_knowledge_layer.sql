-- ============================================================
-- Migration 018: Knowledge layer — DB-structural map
-- 6 tables, all workspace-scoped via the get_user_workspace_ids()
-- security-definer RLS pattern from migration 013.
-- ============================================================

-- 1. knowledge_pages — the wiki content (one row per page)
create table public.knowledge_pages (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  connection_id uuid references public.database_connections(id) on delete cascade not null,
  path text not null,
  type text not null check (type in ('database','table','relationship','metric','domain')),
  title text not null,
  content_md text not null default '',
  frontmatter jsonb not null default '{}',
  access_spec jsonb not null default '{}',
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  stale boolean not null default false,
  updated_at timestamptz default now(),
  unique (workspace_id, path)
);
alter table public.knowledge_pages enable row level security;
create policy "members read pages" on public.knowledge_pages for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write pages" on public.knowledge_pages for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
create index idx_knowledge_pages_conn on public.knowledge_pages(connection_id);

-- 2. knowledge_page_revisions — full snapshot per change (git-history replacement)
create table public.knowledge_page_revisions (
  id uuid default gen_random_uuid() primary key,
  page_id uuid references public.knowledge_pages(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  content_md text not null,
  frontmatter jsonb not null default '{}',
  access_spec jsonb not null default '{}',
  operation text not null check (operation in ('ingest','refresh','manual')),
  reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.knowledge_page_revisions enable row level security;
create policy "members read revisions" on public.knowledge_page_revisions for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write revisions" on public.knowledge_page_revisions for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- 3. knowledge_index — fast retrieval layer (the index.md equivalent)
create table public.knowledge_index (
  page_id uuid references public.knowledge_pages(id) on delete cascade primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  summary_1line text not null,
  categories text[] not null default '{}',
  last_touched timestamptz default now()
);
alter table public.knowledge_index enable row level security;
create policy "members read index" on public.knowledge_index for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write index" on public.knowledge_index for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- 4. knowledge_agents_md — per-workspace editable schema/policy doc
create table public.knowledge_agents_md (
  workspace_id uuid references public.workspaces(id) on delete cascade primary key,
  content text not null,
  updated_at timestamptz default now()
);
alter table public.knowledge_agents_md enable row level security;
create policy "members read agents_md" on public.knowledge_agents_md for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "owners write agents_md" on public.knowledge_agents_md for all to authenticated
  using (workspace_id in (select public.get_user_owned_workspace_ids()))
  with check (workspace_id in (select public.get_user_owned_workspace_ids()));

-- 5. knowledge_jobs — async ingest/refresh tracking with streamed logs
create table public.knowledge_jobs (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  connection_id uuid references public.database_connections(id) on delete cascade not null,
  kind text not null check (kind in ('ingest','refresh')),
  status text not null default 'queued' check (status in ('queued','running','done','error')),
  logs jsonb not null default '[]',
  error text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  finished_at timestamptz
);
alter table public.knowledge_jobs enable row level security;
create policy "members read jobs" on public.knowledge_jobs for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write jobs" on public.knowledge_jobs for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- 6. knowledge_query_log — the Plan -> Dig -> Synthesize trace (history + audit)
create table public.knowledge_query_log (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  question text not null,
  plan jsonb,
  sql_executed text,
  row_count int,
  answer_md text,
  citations jsonb,
  conversation_id uuid,
  created_at timestamptz default now()
);
alter table public.knowledge_query_log enable row level security;
create policy "members read query log" on public.knowledge_query_log for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write query log" on public.knowledge_query_log for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));
