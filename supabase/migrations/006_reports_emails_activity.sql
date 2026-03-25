create table public.saved_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  connection_id uuid references public.database_connections(id) on delete set null,
  query_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.saved_reports enable row level security;
create policy "Users manage own reports" on public.saved_reports
  for all to authenticated using (auth.uid() = user_id);

create table public.email_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  body_html text not null,
  recipients text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  sent_count int default 0,
  gmail_message_id text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.email_campaigns enable row level security;
create policy "Users manage own campaigns" on public.email_campaigns
  for all to authenticated using (auth.uid() = user_id);

create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null,
  section text not null,
  title text not null,
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;
create policy "Users can read all activity" on public.activity_log
  for select to authenticated using (true);
create policy "Users can insert own activity" on public.activity_log
  for insert to authenticated with check (auth.uid() = user_id);

create index activity_log_created_idx on public.activity_log(created_at desc);
