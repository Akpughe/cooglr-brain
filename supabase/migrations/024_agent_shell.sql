-- ============================================================
-- Migration 024: Agent shell — the chat-first agentic surface.
-- Dedicated tables for the Mastra-powered agent experience, kept separate from
-- the legacy human chat_sessions/chat_messages so the two concerns don't blur.
--   agent_threads   one conversation with the workspace agent
--   agent_messages  user/assistant/system turns within a thread
--   agent_runs      one agent execution (model, status, cost, trace)
--   agent_steps     tool/reasoning steps within a run (the "Worked for Ns" trail)
--   agent_artifacts canvas artifacts (report/document/chart/source_trace/...)
-- All workspace-scoped, RLS via public.get_user_workspace_ids() (same idiom as
-- the rest of the platform).
-- ============================================================

-- ---------- agent_threads ----------
create table public.agent_threads (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid not null,                       -- auth.users.id of the creator/owner
  title text not null default 'New chat',
  type text not null default 'private_ai',     -- private_ai | channel_ai_thread | workflow_run | memory_review
  pinned boolean not null default false,
  archived boolean not null default false,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index agent_threads_ws_idx on public.agent_threads (workspace_id, last_message_at desc);
create index agent_threads_user_idx on public.agent_threads (workspace_id, user_id, last_message_at desc);

alter table public.agent_threads enable row level security;
create policy "members read threads" on public.agent_threads for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write threads" on public.agent_threads for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- ---------- agent_runs ----------
-- Declared before agent_messages so messages can FK to a run.
create table public.agent_runs (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.agent_threads(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid not null,
  status text not null default 'running',      -- running | done | error
  input text,
  model_profile text,                          -- auto | fast | deep | <explicit>
  model_used text,                             -- resolved model id actually called
  cost numeric,
  trace_id text,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index agent_runs_thread_idx on public.agent_runs (thread_id, started_at);
create index agent_runs_ws_idx on public.agent_runs (workspace_id, started_at desc);

alter table public.agent_runs enable row level security;
create policy "members read runs" on public.agent_runs for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write runs" on public.agent_runs for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- ---------- agent_messages ----------
create table public.agent_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.agent_threads(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  run_id uuid references public.agent_runs(id) on delete set null,
  role text not null,                          -- user | assistant | system
  content text not null default '',
  parts jsonb not null default '[]'::jsonb,    -- tool steps, citations, artifact refs (AI SDK UI parts)
  created_at timestamptz default now()
);
create index agent_messages_thread_idx on public.agent_messages (thread_id, created_at);

alter table public.agent_messages enable row level security;
create policy "members read messages" on public.agent_messages for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write messages" on public.agent_messages for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- ---------- agent_steps ----------
create table public.agent_steps (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references public.agent_runs(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  step_index int not null default 0,
  type text not null,                          -- tool | reasoning | message
  name text,                                   -- tool name / step label
  input jsonb,
  output jsonb,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);
create index agent_steps_run_idx on public.agent_steps (run_id, step_index);

alter table public.agent_steps enable row level security;
create policy "members read steps" on public.agent_steps for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write steps" on public.agent_steps for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));

-- ---------- agent_artifacts ----------
-- Full type vocabulary declared now so later slices add behaviour without a
-- migration; slice 1 only produces source_trace / chart / table / document / report.
create table public.agent_artifacts (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  thread_id uuid references public.agent_threads(id) on delete cascade,
  run_id uuid references public.agent_runs(id) on delete set null,
  type text not null,                          -- report|document|chart|table|source_trace|email|workflow|approval|memory_candidate
  title text not null default 'Untitled',
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'draft',         -- draft|final|approved|declined
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index agent_artifacts_thread_idx on public.agent_artifacts (thread_id, created_at desc);
create index agent_artifacts_ws_idx on public.agent_artifacts (workspace_id, created_at desc);

alter table public.agent_artifacts enable row level security;
create policy "members read artifacts" on public.agent_artifacts for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write artifacts" on public.agent_artifacts for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
