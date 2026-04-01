-- ============================================================
-- Migration 015: Projects — projects, columns, tasks
-- ============================================================

-- 1. Projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name varchar(100) not null,
  description text,
  identifier varchar(10) not null,
  task_counter int default 0,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Workspace members can view projects"
  on public.projects for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create projects"
  on public.projects for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Creator or workspace owner can update projects"
  on public.projects for update to authenticated
  using (
    created_by = auth.uid()
    or workspace_id in (select public.get_user_owned_workspace_ids())
  );

create policy "Creator or workspace owner can delete projects"
  on public.projects for delete to authenticated
  using (
    created_by = auth.uid()
    or workspace_id in (select public.get_user_owned_workspace_ids())
  );

create index idx_projects_workspace on public.projects(workspace_id);

-- 2. Project columns
create table public.project_columns (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  name varchar(50) not null,
  color varchar(20) not null default 'gray',
  position int not null default 0,
  created_at timestamptz default now()
);

alter table public.project_columns enable row level security;

create policy "Workspace members can view columns"
  on public.project_columns for select to authenticated
  using (project_id in (select id from public.projects where workspace_id in (select public.get_user_workspace_ids())));

create policy "Workspace members can insert columns"
  on public.project_columns for insert to authenticated
  with check (project_id in (select id from public.projects where workspace_id in (select public.get_user_workspace_ids())));

create policy "Workspace members can update columns"
  on public.project_columns for update to authenticated
  using (project_id in (select id from public.projects where workspace_id in (select public.get_user_workspace_ids())));

create policy "Workspace members can delete columns"
  on public.project_columns for delete to authenticated
  using (project_id in (select id from public.projects where workspace_id in (select public.get_user_workspace_ids())));

create index idx_project_columns_project on public.project_columns(project_id, position);

-- 3. Tasks
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  workspace_id uuid references public.workspaces(id) not null,
  column_id uuid references public.project_columns(id) on delete set null,
  task_number int not null,
  title varchar(255) not null,
  description text,
  task_type varchar(20) not null default 'task' check (task_type in ('bug', 'feature', 'task', 'improvement')),
  priority varchar(10) not null default 'medium' check (priority in ('urgent', 'high', 'medium', 'low')),
  assignee_id uuid references auth.users(id),
  labels jsonb default '[]'::jsonb,
  due_date date,
  github_repo varchar(255),
  position int not null default 0,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;

create policy "Workspace members can view tasks"
  on public.tasks for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create tasks"
  on public.tasks for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update tasks"
  on public.tasks for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can delete tasks"
  on public.tasks for delete to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create index idx_tasks_project_column on public.tasks(project_id, column_id, position);
create index idx_tasks_workspace on public.tasks(workspace_id);
create index idx_tasks_assignee on public.tasks(assignee_id);
