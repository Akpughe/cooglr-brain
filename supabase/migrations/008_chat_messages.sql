create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.chat_sessions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users manage own messages"
  on public.chat_messages for all
  to authenticated
  using (auth.uid() = user_id);

create index chat_messages_session_idx on public.chat_messages(session_id, created_at asc);
