-- ============================================================
-- Migration 016: Files — pages, folders, uploaded files + sharing
-- ============================================================

-- 1. Create tables first (files SELECT policy references file_shares)

create table public.files (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  parent_id uuid references public.files(id) on delete cascade,
  type text not null check (type in ('page', 'folder', 'file')),
  title text not null default 'Untitled',
  content jsonb,
  icon text,
  cover_url text,
  storage_path text,
  mime_type text,
  file_size bigint,
  is_private boolean not null default false,
  position int not null default 0,
  created_by uuid references auth.users(id) not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.file_shares (
  id uuid default gen_random_uuid() primary key,
  file_id uuid references public.files(id) on delete cascade not null,
  shared_with uuid references auth.users(id) not null,
  permission text not null check (permission in ('view', 'edit')),
  created_at timestamptz not null default now(),
  unique(file_id, shared_with)
);

-- 2. RLS policies (both tables exist now)

alter table public.files enable row level security;
alter table public.file_shares enable row level security;

create policy "Members can view accessible files"
  on public.files for select to authenticated
  using (
    workspace_id in (select public.get_user_workspace_ids())
    and (
      is_private = false
      or created_by = auth.uid()
      or id in (select file_id from public.file_shares where shared_with = auth.uid())
    )
  );

create policy "Members can create files"
  on public.files for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Members can update accessible files"
  on public.files for update to authenticated
  using (
    workspace_id in (select public.get_user_workspace_ids())
    and (
      is_private = false
      or created_by = auth.uid()
      or id in (select file_id from public.file_shares where shared_with = auth.uid() and permission = 'edit')
    )
  );

create policy "Creator can delete files"
  on public.files for delete to authenticated
  using (created_by = auth.uid());

-- Security definer function to break RLS recursion (files SELECT → file_shares SELECT → files)
create or replace function public.get_files_created_by_user()
returns setof uuid as $$
  select id from public.files where created_by = auth.uid();
$$ language sql security definer stable;

create policy "Users can view their shares or shares they created"
  on public.file_shares for select to authenticated
  using (
    shared_with = auth.uid()
    or file_id in (select public.get_files_created_by_user())
  );

create policy "File creator can share"
  on public.file_shares for insert to authenticated
  with check (
    file_id in (select public.get_files_created_by_user())
  );

create policy "File creator can revoke shares"
  on public.file_shares for delete to authenticated
  using (
    file_id in (select public.get_files_created_by_user())
  );

-- 3. Indexes
create index idx_files_workspace_parent on public.files(workspace_id, parent_id);
create index idx_files_workspace_type on public.files(workspace_id, type);
create index idx_files_created_by on public.files(created_by);
create index idx_files_workspace_updated on public.files(workspace_id, updated_at desc);

-- 4. updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_files_updated_at
  before update on public.files
  for each row
  execute function public.set_updated_at();

-- 5. Realtime
alter publication supabase_realtime add table public.files;
