create table public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.chat_sessions enable row level security;

create policy "Users manage own chat sessions"
  on public.chat_sessions for all
  to authenticated
  using (auth.uid() = user_id);

create index chat_sessions_user_idx on public.chat_sessions(user_id, updated_at desc);
