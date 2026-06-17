-- ============================================================
-- Migration 026: Approvals — human-in-the-loop gate for external actions.
-- The agent never sends, publishes, or mutates important data silently. When it
-- wants to perform a gated action (send an email, create tasks in bulk, …) it
-- writes a pending approval_requests row instead of acting. The action's real
-- side-effect runs server-side ONLY after a workspace member approves it via
-- POST /api/agent/approvals/[id]. (Roadmap §4.12 / Group 6 / guardrail §9.4.)
--
-- Execution model is deferred, not a blocking workflow suspend: the agent run
-- finishes immediately after creating the request; the side-effect is performed
-- out-of-band on approval. This keeps the streaming request short-lived.
--
-- Workspace-scoped, RLS via public.get_user_workspace_ids() (same idiom as 024).
-- ============================================================

create table public.approval_requests (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  thread_id uuid references public.agent_threads(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  requested_by uuid not null,                  -- auth.users.id of the run's actor

  action_type text not null,                   -- registry key, e.g. 'send_email'
  title text not null default 'Approval required',
  summary text,                                -- one-line human description
  payload jsonb not null default '{}'::jsonb,  -- full action input (e.g. {to,subject,body})
  preview jsonb not null default '{}'::jsonb,  -- safe display-only fields
  sources jsonb not null default '[]'::jsonb,  -- citations/origins the draft used
  risk_level text not null default 'medium',   -- low | medium | high

  status text not null default 'pending',      -- pending | approved | declined | executed | failed
  decided_by uuid,                             -- who approved/declined
  decided_at timestamptz,
  executed_at timestamptz,
  result jsonb,                                -- executor return on success
  error text,                                  -- executor error on failure

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index approval_requests_ws_idx on public.approval_requests (workspace_id, created_at desc);
create index approval_requests_thread_idx on public.approval_requests (thread_id, created_at desc);
-- Fast lookup of the workspace's outstanding approvals (pending-approvals surface).
create index approval_requests_pending_idx on public.approval_requests (workspace_id, status)
  where status = 'pending';

alter table public.approval_requests enable row level security;
create policy "members read approvals" on public.approval_requests for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));
create policy "members write approvals" on public.approval_requests for all to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()))
  with check (workspace_id in (select public.get_user_workspace_ids()));
