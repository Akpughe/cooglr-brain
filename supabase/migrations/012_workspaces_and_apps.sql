-- ============================================================
-- Migration 012: Workspaces, Members, Invites, App Registry
-- ============================================================

-- 0. Drop dependent policies/tables FIRST before altering profiles

drop policy if exists "Admins can manage allowlist" on public.allowed_emails;
drop table if exists public.allowed_emails;

drop policy if exists "Admins can read audit logs" on public.audit_log;

-- Now safe to drop role/department from profiles
alter table public.profiles drop column if exists role cascade;
alter table public.profiles drop column if exists department cascade;

-- 1. Create all tables

create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name varchar(50) not null,
  slug varchar(50) not null unique,
  avatar_url text,
  owner_id uuid references auth.users(id) not null,
  theme varchar(30) default 'default',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role varchar(10) not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table public.workspace_invites (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email varchar(255) not null,
  invited_by uuid references auth.users(id) not null,
  role varchar(10) default 'member',
  status varchar(10) default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token varchar(255) not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

create table public.app_registry (
  id varchar(50) primary key,
  name varchar(100) not null,
  description text,
  icon varchar(50) not null,
  category varchar(20) not null check (category in ('built_in', 'add_on')),
  default_installed boolean default false,
  sort_order int default 0,
  has_sidebar boolean default true,
  route varchar(100) not null,
  setup_required boolean default false
);

create table public.workspace_apps (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  app_id varchar(50) references public.app_registry(id) not null,
  installed_by uuid references auth.users(id) not null,
  installed_at timestamptz default now(),
  unique(workspace_id, app_id)
);

-- 2. Enable RLS

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.app_registry enable row level security;
alter table public.workspace_apps enable row level security;

-- 3. Workspaces policies

create policy "Members can view their workspaces"
  on public.workspaces for select to authenticated
  using (id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Owners can update their workspaces"
  on public.workspaces for update to authenticated
  using (owner_id = auth.uid());

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can delete their workspaces"
  on public.workspaces for delete to authenticated
  using (owner_id = auth.uid());

-- 4. Workspace members policies

create policy "Members can view workspace members"
  on public.workspace_members for select to authenticated
  using (workspace_id in (select wm.workspace_id from public.workspace_members wm where wm.user_id = auth.uid()));

create policy "Owners can delete workspace members"
  on public.workspace_members for delete to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.role = 'owner'
  ));

create policy "Users can insert themselves"
  on public.workspace_members for insert to authenticated
  with check (user_id = auth.uid());

-- 5. Workspace invites policies

create policy "Workspace members can view invites"
  on public.workspace_invites for select to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Owners can insert invites"
  on public.workspace_invites for insert to authenticated
  with check (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.role = 'owner'
  ));

create policy "Owners can update invites"
  on public.workspace_invites for update to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.role = 'owner'
  ));

create policy "Invited users can accept invites"
  on public.workspace_invites for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (status = 'accepted');

-- 6. App registry policy

create policy "Anyone authenticated can read app registry"
  on public.app_registry for select to authenticated
  using (true);

-- 7. Workspace apps policies

create policy "Members can view workspace apps"
  on public.workspace_apps for select to authenticated
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Owners can insert workspace apps"
  on public.workspace_apps for insert to authenticated
  with check (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.role = 'owner'
  ));

create policy "Owners can delete workspace apps"
  on public.workspace_apps for delete to authenticated
  using (workspace_id in (
    select wm.workspace_id from public.workspace_members wm
    where wm.user_id = auth.uid() and wm.role = 'owner'
  ));

-- 8. Seed apps

insert into public.app_registry (id, name, description, icon, category, default_installed, sort_order, has_sidebar, route, setup_required) values
  ('messages', 'Messages', 'Team channels and direct messages', 'MessageSquare', 'built_in', true, 1, true, '/messages', false),
  ('projects', 'Projects', 'Kanban boards and task management', 'LayoutGrid', 'built_in', true, 2, true, '/projects', false),
  ('files', 'Files', 'Documents, notes, and file storage', 'FileText', 'built_in', true, 3, true, '/files', false),
  ('email-marketing', 'Email Marketing', 'Campaigns, templates, and audience management', 'Mail', 'add_on', false, 10, true, '/email-marketing', true),
  ('reports', 'Reports', 'AI-powered data analysis and reporting', 'BarChart3', 'add_on', false, 11, true, '/reports', false),
  ('github-repos', 'GitHub Repos', 'Repository management, PRs, and issues', 'Github', 'add_on', false, 12, true, '/github-repos', true),
  ('calendar', 'Calendar', 'Synced calendar from Google and iCloud', 'Calendar', 'add_on', false, 13, true, '/calendar', true);

-- 9. Add workspace_id to existing tables

alter table public.tickets add column workspace_id uuid references public.workspaces(id);
alter table public.ticket_comments add column workspace_id uuid references public.workspaces(id);
alter table public.chat_sessions add column workspace_id uuid references public.workspaces(id);
alter table public.chat_messages add column workspace_id uuid references public.workspaces(id);
alter table public.email_providers add column workspace_id uuid references public.workspaces(id);
alter table public.email_templates add column workspace_id uuid references public.workspaces(id);
alter table public.email_audiences add column workspace_id uuid references public.workspaces(id);
alter table public.email_contacts add column workspace_id uuid references public.workspaces(id);
alter table public.email_campaigns add column workspace_id uuid references public.workspaces(id);
alter table public.email_events add column workspace_id uuid references public.workspaces(id);
alter table public.email_unsubscribes add column workspace_id uuid references public.workspaces(id);
alter table public.saved_reports add column workspace_id uuid references public.workspaces(id);
alter table public.report_sessions add column workspace_id uuid references public.workspaces(id);
alter table public.report_runs add column workspace_id uuid references public.workspaces(id);
alter table public.database_connections add column workspace_id uuid references public.workspaces(id);
alter table public.activity_log add column workspace_id uuid references public.workspaces(id);
alter table public.audit_log add column workspace_id uuid references public.workspaces(id);

-- 10. Update handle_new_user trigger

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

-- 11. Indexes

create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index idx_workspace_apps_workspace on public.workspace_apps(workspace_id);
create index idx_workspace_invites_token on public.workspace_invites(token);
create index idx_workspace_invites_email on public.workspace_invites(email);
create index idx_workspaces_slug on public.workspaces(slug);
