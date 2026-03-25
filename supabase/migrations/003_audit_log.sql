create table public.audit_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb default '{}',
  ip_address inet,
  created_at timestamptz default now()
);

alter table public.audit_log enable row level security;

create policy "Admins can read audit logs"
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "System can insert audit logs"
  on public.audit_log for insert
  to authenticated
  with check (auth.uid() = user_id);

create index audit_log_user_id_idx on public.audit_log(user_id);
create index audit_log_action_idx on public.audit_log(action);
create index audit_log_created_at_idx on public.audit_log(created_at desc);
