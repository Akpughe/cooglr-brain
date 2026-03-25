create table public.database_connections (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  encrypted_connection_string text not null,
  db_type text not null default 'postgres' check (db_type in ('postgres', 'mysql')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.database_connections enable row level security;

create policy "Users manage own db connections"
  on public.database_connections for all
  to authenticated
  using (auth.uid() = user_id);
