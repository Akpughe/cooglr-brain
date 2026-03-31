-- Fix infinite recursion in RLS policies by using a security definer function
-- that bypasses RLS to get the user's workspace IDs

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_owned_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'owner'
$$;

-- Drop and recreate workspace_members policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owners can delete workspace members" ON public.workspace_members;

CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Owners can delete workspace members"
  ON public.workspace_members FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_owned_workspace_ids()));

-- Drop and recreate workspaces SELECT policy
DROP POLICY IF EXISTS "Members can view their workspaces" ON public.workspaces;

CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_user_workspace_ids()));

-- Drop and recreate workspace_invites policies
DROP POLICY IF EXISTS "Workspace members can view invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "Owners can insert invites" ON public.workspace_invites;
DROP POLICY IF EXISTS "Owners can update invites" ON public.workspace_invites;

CREATE POLICY "Workspace members can view invites"
  ON public.workspace_invites FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Owners can insert invites"
  ON public.workspace_invites FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_owned_workspace_ids()));

CREATE POLICY "Owners can update invites"
  ON public.workspace_invites FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_owned_workspace_ids()));

-- Drop and recreate workspace_apps policies
DROP POLICY IF EXISTS "Members can view workspace apps" ON public.workspace_apps;
DROP POLICY IF EXISTS "Owners can insert workspace apps" ON public.workspace_apps;
DROP POLICY IF EXISTS "Owners can delete workspace apps" ON public.workspace_apps;

CREATE POLICY "Members can view workspace apps"
  ON public.workspace_apps FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids()));

CREATE POLICY "Owners can insert workspace apps"
  ON public.workspace_apps FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_user_owned_workspace_ids()));

CREATE POLICY "Owners can delete workspace apps"
  ON public.workspace_apps FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_user_owned_workspace_ids()));
