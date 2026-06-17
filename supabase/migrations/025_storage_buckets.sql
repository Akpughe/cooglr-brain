-- ============================================================
-- Migration 025: Storage buckets for file + message uploads
-- ============================================================
-- ADDITIVE + IDEMPOTENT ONLY. Does not drop or alter existing objects.
--
-- The app uploads to two Supabase Storage buckets that did not exist in the
-- live project, so uploads were failing. This migration provisions them.
--
-- Upload routes and the client they use:
--   * src/app/api/files/upload/route.ts    -> bucket 'file-uploads',
--       path '{workspaceId}/{fileId}/{uuid}.{ext}', uploaded with the USER
--       client (createClient) -> RLS APPLIES, so write policies are REQUIRED.
--   * src/app/api/messages/upload/route.ts -> bucket 'message-attachments',
--       path '{workspaceId}/{targetId}/{uuid}.{ext}', uploaded with the USER
--       client (createClient) -> RLS APPLIES, so write policies are REQUIRED.
-- Both routes read back via getPublicUrl(), so the buckets must be PUBLIC.
--
-- Note: get_user_workspace_ids() (migration 013) returns SETOF uuid. The first
-- storage path segment is text, so we cast the uuid set to text for comparison.
-- ============================================================

-- 1. Create the two PUBLIC buckets (idempotent).
insert into storage.buckets (id, name, public)
values
  ('file-uploads', 'file-uploads', true),
  ('message-attachments', 'message-attachments', true)
on conflict (id) do nothing;

-- 2. RLS write policies on storage.objects.
--    Public buckets already serve public SELECT for getPublicUrl, so we focus
--    on gating writes: only authenticated users whose first path segment is a
--    workspace they belong to may INSERT/UPDATE/DELETE.
--    Idempotent via drop policy if exists + create policy.

-- ---- file-uploads ----
drop policy if exists "file-uploads workspace members can insert" on storage.objects;
create policy "file-uploads workspace members can insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'file-uploads'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

drop policy if exists "file-uploads workspace members can update" on storage.objects;
create policy "file-uploads workspace members can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'file-uploads'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  )
  with check (
    bucket_id = 'file-uploads'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

drop policy if exists "file-uploads workspace members can delete" on storage.objects;
create policy "file-uploads workspace members can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'file-uploads'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

-- ---- message-attachments ----
drop policy if exists "message-attachments workspace members can insert" on storage.objects;
create policy "message-attachments workspace members can insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

drop policy if exists "message-attachments workspace members can update" on storage.objects;
create policy "message-attachments workspace members can update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  )
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

drop policy if exists "message-attachments workspace members can delete" on storage.objects;
create policy "message-attachments workspace members can delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[1] in (
      select public.get_user_workspace_ids()::text
    )
  );

-- 3. Explicit public SELECT for both buckets (defense-in-depth for getPublicUrl).
--    Public buckets already allow this, but make it explicit + idempotent.
drop policy if exists "uploads buckets are publicly readable" on storage.objects;
create policy "uploads buckets are publicly readable"
  on storage.objects for select to public
  using (bucket_id in ('file-uploads', 'message-attachments'));
