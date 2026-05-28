-- ============================================================
-- Migration 020: database_connections — workspace-shared RLS.
-- Members of a workspace can read/use its connections (build maps, run
-- queries); only the creator or the workspace owner can modify/delete.
-- The `or user_id = auth.uid()` clauses keep legacy rows with a NULL
-- workspace_id accessible to whoever created them.
-- ============================================================

drop policy if exists "Users manage own db connections" on public.database_connections;

create policy "Workspace members read connections"
  on public.database_connections for select to authenticated
  using (
    workspace_id in (select public.get_user_workspace_ids())
    or user_id = auth.uid()
  );

create policy "Workspace members create connections"
  on public.database_connections for insert to authenticated
  with check (
    (workspace_id is null and user_id = auth.uid())
    or workspace_id in (select public.get_user_workspace_ids())
  );

create policy "Creator or owner update connections"
  on public.database_connections for update to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (select public.get_user_owned_workspace_ids())
  );

create policy "Creator or owner delete connections"
  on public.database_connections for delete to authenticated
  using (
    user_id = auth.uid()
    or workspace_id in (select public.get_user_owned_workspace_ids())
  );
