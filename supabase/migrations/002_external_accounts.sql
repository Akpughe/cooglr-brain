create table public.external_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  provider_user_id text,
  provider_email text,
  provider_username text,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

alter table public.external_accounts enable row level security;

create policy "Users manage own external accounts"
  on public.external_accounts for all
  to authenticated
  using (auth.uid() = user_id);
