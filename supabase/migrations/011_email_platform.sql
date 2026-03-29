-- Email Platform schema: providers, templates, audiences, contacts, campaigns, events

-- 1. Email Providers (Resend, SES, SendGrid API keys)
create table public.email_providers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'resend' check (name in ('resend', 'ses', 'sendgrid')),
  display_name text,
  encrypted_api_key text not null,
  from_email text not null,
  from_name text,
  reply_to_email text,
  config jsonb default '{}',
  is_default boolean default false,
  status text default 'active' check (status in ('active', 'inactive', 'error')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.email_providers enable row level security;
create policy "Users manage own email providers"
  on public.email_providers for all to authenticated
  using (auth.uid() = user_id);

-- Only one default per user
create unique index idx_email_providers_default
  on public.email_providers(user_id) where is_default = true;

-- 2. Email Templates
create table public.email_templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  subject text not null default '',
  html_content text not null default '',
  json_content jsonb,
  text_content text,
  category text default 'marketing' check (category in ('marketing', 'transactional', 'notification')),
  brand_config jsonb default '{}',
  variables text[] default '{}',
  is_ai_generated boolean default false,
  ai_prompt text,
  status text default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.email_templates enable row level security;
create policy "Users manage own email templates"
  on public.email_templates for all to authenticated
  using (auth.uid() = user_id);

-- 3. Email Audiences
create table public.email_audiences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  source_type text not null check (source_type in ('manual', 'csv_import', 'database_query')),
  source_config jsonb default '{}',
  contact_count integer default 0,
  tags text[] default '{}',
  status text default 'active' check (status in ('active', 'archived')),
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.email_audiences enable row level security;
create policy "Users manage own email audiences"
  on public.email_audiences for all to authenticated
  using (auth.uid() = user_id);

-- 4. Email Contacts
create table public.email_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  first_name text,
  last_name text,
  metadata jsonb default '{}',
  status text default 'active' check (status in ('active', 'unsubscribed', 'bounced', 'complained', 'cleaned')),
  consent_given_at timestamptz,
  consent_source text,
  last_emailed_at timestamptz,
  last_engaged_at timestamptz,
  emails_received integer default 0,
  emails_opened integer default 0,
  emails_clicked integer default 0,
  unsubscribed_at timestamptz,
  bounced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uq_contact_email_user unique (user_id, email)
);

alter table public.email_contacts enable row level security;
create policy "Users manage own email contacts"
  on public.email_contacts for all to authenticated
  using (auth.uid() = user_id);

create index idx_email_contacts_status on public.email_contacts(user_id, status);

-- 5. Audience <-> Contact junction
create table public.email_audience_contacts (
  audience_id uuid not null references public.email_audiences(id) on delete cascade,
  contact_id uuid not null references public.email_contacts(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (audience_id, contact_id)
);

alter table public.email_audience_contacts enable row level security;
create policy "Users manage own audience contacts"
  on public.email_audience_contacts for all to authenticated
  using (
    exists (
      select 1 from public.email_audiences a
      where a.id = audience_id and a.user_id = auth.uid()
    )
  );

-- 6. Email Campaigns
create table public.email_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  subject text not null,
  preview_text text,
  template_id uuid references public.email_templates(id) on delete set null,
  provider_id uuid references public.email_providers(id) on delete set null,
  audience_id uuid references public.email_audiences(id) on delete set null,
  html_content text not null default '',
  text_content text,
  from_email text not null default '',
  from_name text,
  reply_to text,
  campaign_type text default 'marketing' check (campaign_type in ('marketing', 'transactional', 'test')),
  status text default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled', 'failed')),
  is_test boolean default false,
  test_recipients text[],
  scheduled_at timestamptz,
  scheduled_timezone text,
  started_at timestamptz,
  completed_at timestamptz,
  stats jsonb default '{"total":0,"sent":0,"delivered":0,"opened":0,"unique_opened":0,"clicked":0,"unique_clicked":0,"bounced":0,"complained":0,"unsubscribed":0}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.email_campaigns enable row level security;
create policy "Users manage own email campaigns"
  on public.email_campaigns for all to authenticated
  using (auth.uid() = user_id);

create index idx_email_campaigns_status on public.email_campaigns(user_id, status);
create index idx_email_campaigns_scheduled on public.email_campaigns(status, scheduled_at)
  where status = 'scheduled';

-- 7. Email Events (webhook tracking data)
create table public.email_events (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  contact_id uuid references public.email_contacts(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade not null,
  event_type text not null check (event_type in ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed')),
  provider_event_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.email_events enable row level security;
create policy "Users read own email events"
  on public.email_events for select to authenticated
  using (auth.uid() = user_id);
-- Insert via service role from webhook handler (no user auth)
create policy "Service inserts email events"
  on public.email_events for insert to service_role
  with check (true);

create index idx_email_events_campaign on public.email_events(campaign_id, event_type);
create index idx_email_events_contact on public.email_events(contact_id, event_type);
create index idx_email_events_created on public.email_events(created_at);
create unique index idx_email_events_dedupe on public.email_events(provider_event_id)
  where provider_event_id is not null;

-- 8. Global unsubscribe list
create table public.email_unsubscribes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  reason text check (reason in ('manual', 'link_click', 'complaint', 'bounce', 'admin', 'gdpr_request')),
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  created_at timestamptz default now(),
  constraint uq_unsubscribe_email_user unique (user_id, email)
);

alter table public.email_unsubscribes enable row level security;
create policy "Users manage own unsubscribes"
  on public.email_unsubscribes for all to authenticated
  using (auth.uid() = user_id);

-- 9. Atomic stat increment functions (avoid race conditions)
create or replace function public.increment_campaign_stat(p_campaign_id uuid, p_stat_key text)
returns void language plpgsql security definer as $$
begin
  update public.email_campaigns
  set stats = jsonb_set(
    coalesce(stats, '{}'::jsonb),
    array[p_stat_key],
    to_jsonb(coalesce((stats->>p_stat_key)::int, 0) + 1)
  ),
  updated_at = now()
  where id = p_campaign_id;
end;
$$;

create or replace function public.increment_contact_opened(p_contact_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.email_contacts
  set emails_opened = emails_opened + 1, last_engaged_at = now(), updated_at = now()
  where id = p_contact_id;
end;
$$;

create or replace function public.increment_contact_clicked(p_contact_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.email_contacts
  set emails_clicked = emails_clicked + 1, last_engaged_at = now(), updated_at = now()
  where id = p_contact_id;
end;
$$;

-- 10. pg_cron function to process scheduled campaigns
-- This function finds campaigns due for sending and updates their status.
-- The actual send is triggered by the application polling for 'sending' status.
create or replace function public.process_scheduled_campaigns()
returns void
language plpgsql
security definer
as $$
begin
  update public.email_campaigns
  set status = 'sending', started_at = now(), updated_at = now()
  where status = 'scheduled'
    and scheduled_at <= now();
end;
$$;

-- Schedule pg_cron to run every minute (requires pg_cron extension enabled on Supabase Pro)
-- Run this manually in the Supabase SQL editor if pg_cron is available:
-- select cron.schedule('process-scheduled-campaigns', '* * * * *', 'select public.process_scheduled_campaigns()');
