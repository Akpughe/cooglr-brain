create table public.tickets (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'in_progress', 'in_review', 'done', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  type text not null default 'bug' check (type in ('bug', 'feature', 'task', 'improvement')),
  assignee_id uuid references auth.users(id),
  created_by uuid references auth.users(id) not null,
  department text,
  target_repo text,
  ai_triage jsonb default null,
  pr_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.ticket_comments (
  id uuid default gen_random_uuid() primary key,
  ticket_id uuid references public.tickets(id) on delete cascade not null,
  user_id uuid references auth.users(id),
  content text not null,
  is_ai boolean default false,
  created_at timestamptz default now()
);

alter table public.tickets enable row level security;
alter table public.ticket_comments enable row level security;

create policy "Authenticated users can read tickets"
  on public.tickets for select to authenticated using (true);

create policy "Authenticated users can create tickets"
  on public.tickets for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Authenticated users can update tickets"
  on public.tickets for update to authenticated using (true);

create policy "Authenticated users can read comments"
  on public.ticket_comments for select to authenticated using (true);

create policy "Authenticated users can add comments"
  on public.ticket_comments for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);

create index tickets_status_idx on public.tickets(status);
create index tickets_created_by_idx on public.tickets(created_by);
create index ticket_comments_ticket_idx on public.ticket_comments(ticket_id);
