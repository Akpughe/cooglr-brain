create table public.allowed_emails (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  department text check (department in ('engineering', 'marketing', 'business', 'product', 'operations')),
  invited_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('admin', 'member')),
  department text check (department in ('engineering', 'marketing', 'business', 'product', 'operations')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;

create policy "Anyone authed can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Admins can manage allowlist"
  on public.allowed_emails for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

insert into public.allowed_emails (email, role, department)
values ('tech@500chow.com', 'admin', 'engineering');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  allowed record;
begin
  select * into allowed
  from public.allowed_emails
  where email = new.email;

  if allowed is null then
    raise exception 'Email not in allowlist';
  end if;

  insert into public.profiles (id, email, full_name, avatar_url, role, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', ''),
    allowed.role,
    allowed.department
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
