create table public.report_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New Report',
  connection_id uuid references public.database_connections(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.report_runs (
  id uuid default gen_random_uuid() primary key,
  report_session_id uuid references public.report_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  prompt text not null,
  generated_sql text,
  result_columns text[],
  result_row_count int default 0,
  error text,
  created_at timestamptz default now()
);

alter table public.report_sessions enable row level security;
alter table public.report_runs enable row level security;

create policy "Users manage own report sessions" on public.report_sessions
  for all to authenticated using (auth.uid() = user_id);
create policy "Users manage own report runs" on public.report_runs
  for all to authenticated using (auth.uid() = user_id);

create index report_sessions_user_idx on public.report_sessions(user_id, updated_at desc);
create index report_runs_session_idx on public.report_runs(report_session_id, created_at asc);
