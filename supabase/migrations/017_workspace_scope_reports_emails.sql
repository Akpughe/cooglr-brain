-- ============================================================
-- Migration 017: Workspace-scoped RLS for reports and email tables
--                + add missing generated_report column to report_runs
-- ============================================================

-- 1. Add missing generated_report column to report_runs
alter table public.report_runs
  add column if not exists generated_report jsonb;

-- ============================================================
-- 2. saved_reports: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own reports" on public.saved_reports;

create policy "Workspace members can view reports"
  on public.saved_reports for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create reports"
  on public.saved_reports for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update reports"
  on public.saved_reports for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Report creator can delete"
  on public.saved_reports for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 3. report_sessions: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own report sessions" on public.report_sessions;

create policy "Workspace members can view report sessions"
  on public.report_sessions for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create report sessions"
  on public.report_sessions for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update report sessions"
  on public.report_sessions for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Report session creator can delete"
  on public.report_sessions for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 4. report_runs: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own report runs" on public.report_runs;

create policy "Workspace members can view report runs"
  on public.report_runs for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create report runs"
  on public.report_runs for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update report runs"
  on public.report_runs for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Report run creator can delete"
  on public.report_runs for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 5. email_providers: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own email providers" on public.email_providers;

create policy "Workspace members can view email providers"
  on public.email_providers for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create email providers"
  on public.email_providers for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update email providers"
  on public.email_providers for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Email provider owner can delete"
  on public.email_providers for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 6. email_templates: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own email templates" on public.email_templates;

create policy "Workspace members can view email templates"
  on public.email_templates for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create email templates"
  on public.email_templates for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update email templates"
  on public.email_templates for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Email template owner can delete"
  on public.email_templates for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 7. email_audiences: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own email audiences" on public.email_audiences;

create policy "Workspace members can view email audiences"
  on public.email_audiences for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create email audiences"
  on public.email_audiences for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update email audiences"
  on public.email_audiences for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Email audience owner can delete"
  on public.email_audiences for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 8. email_contacts: replace user_id policy with workspace scope
-- ============================================================

drop policy if exists "Users manage own email contacts" on public.email_contacts;

create policy "Workspace members can view email contacts"
  on public.email_contacts for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create email contacts"
  on public.email_contacts for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update email contacts"
  on public.email_contacts for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Email contact owner can delete"
  on public.email_contacts for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 9. email_campaigns: replace user_id policies with workspace scope
--    (006 created "Users manage own campaigns"; 011 recreated as
--     "Users manage own email campaigns" on the expanded table)
-- ============================================================

drop policy if exists "Users manage own campaigns" on public.email_campaigns;
drop policy if exists "Users manage own email campaigns" on public.email_campaigns;

create policy "Workspace members can view email campaigns"
  on public.email_campaigns for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create email campaigns"
  on public.email_campaigns for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can update email campaigns"
  on public.email_campaigns for update to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Email campaign owner can delete"
  on public.email_campaigns for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 10. email_events: workspace scope for SELECT; keep service role INSERT
-- ============================================================

drop policy if exists "Users read own email events" on public.email_events;
drop policy if exists "Service inserts email events" on public.email_events;

create policy "Workspace members can view email events"
  on public.email_events for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

-- Preserve service role insert for webhook handlers
create policy "Service inserts email events"
  on public.email_events for insert to service_role
  with check (true);

-- ============================================================
-- 11. email_unsubscribes: workspace scope for SELECT/DELETE; keep service role INSERT
-- ============================================================

drop policy if exists "Users manage own unsubscribes" on public.email_unsubscribes;

create policy "Workspace members can view email unsubscribes"
  on public.email_unsubscribes for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can delete email unsubscribes"
  on public.email_unsubscribes for delete to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

-- Service role handles inserts from webhook/unsubscribe endpoints
create policy "Service inserts email unsubscribes"
  on public.email_unsubscribes for insert to service_role
  with check (true);
