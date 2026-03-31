-- ============================================================
-- Migration 014: Messages — channels, DMs, messages, reads
-- ============================================================

-- 1. Channels
create table public.channels (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  name varchar(80) not null,
  description text,
  created_by uuid references auth.users(id) not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

alter table public.channels enable row level security;

create policy "Workspace members can view channels"
  on public.channels for select to authenticated
  using (workspace_id in (select public.get_user_workspace_ids()));

create policy "Workspace members can create channels"
  on public.channels for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Channel creator or workspace owner can update"
  on public.channels for update to authenticated
  using (
    created_by = auth.uid()
    or workspace_id in (select public.get_user_owned_workspace_ids())
  );

create policy "Channel creator or workspace owner can delete non-default"
  on public.channels for delete to authenticated
  using (
    is_default = false
    and (
      created_by = auth.uid()
      or workspace_id in (select public.get_user_owned_workspace_ids())
    )
  );

create index idx_channels_workspace on public.channels(workspace_id);

-- 2. Direct conversations
create table public.direct_conversations (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table public.direct_conversations enable row level security;

create table public.direct_conversation_members (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.direct_conversations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  unique(conversation_id, user_id)
);

alter table public.direct_conversation_members enable row level security;

create or replace function public.get_user_conversation_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select conversation_id from public.direct_conversation_members where user_id = auth.uid()
$$;

create policy "Members can view their conversations"
  on public.direct_conversations for select to authenticated
  using (id in (select public.get_user_conversation_ids()));

create policy "Workspace members can create conversations"
  on public.direct_conversations for insert to authenticated
  with check (workspace_id in (select public.get_user_workspace_ids()));

create policy "Members can view conversation members"
  on public.direct_conversation_members for select to authenticated
  using (conversation_id in (select public.get_user_conversation_ids()));

create policy "Users can add themselves to conversations"
  on public.direct_conversation_members for insert to authenticated
  with check (user_id = auth.uid());

create index idx_dc_members_conversation on public.direct_conversation_members(conversation_id);
create index idx_dc_members_user on public.direct_conversation_members(user_id);

-- 3. Messages
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) not null,
  channel_id uuid references public.channels(id) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) not null,
  content text not null default '',
  attachments jsonb default '[]'::jsonb,
  edited_at timestamptz,
  created_at timestamptz default now(),
  constraint messages_target_check check (
    (channel_id is not null and conversation_id is null)
    or (channel_id is null and conversation_id is not null)
  )
);

alter table public.messages enable row level security;

create policy "Users can view messages they have access to"
  on public.messages for select to authenticated
  using (
    (channel_id is not null and workspace_id in (select public.get_user_workspace_ids()))
    or
    (conversation_id is not null and conversation_id in (select public.get_user_conversation_ids()))
  );

create policy "Users can send messages where they have access"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      (channel_id is not null and workspace_id in (select public.get_user_workspace_ids()))
      or
      (conversation_id is not null and conversation_id in (select public.get_user_conversation_ids()))
    )
  );

create policy "Users can edit own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid());

create policy "Users can delete own messages"
  on public.messages for delete to authenticated
  using (sender_id = auth.uid());

create index idx_messages_channel on public.messages(channel_id, created_at desc);
create index idx_messages_conversation on public.messages(conversation_id, created_at desc);
create index idx_messages_workspace on public.messages(workspace_id);

alter publication supabase_realtime add table public.messages;

-- 4. Message reads
create table public.message_reads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  channel_id uuid references public.channels(id) on delete cascade,
  conversation_id uuid references public.direct_conversations(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  constraint reads_target_check check (
    (channel_id is not null and conversation_id is null)
    or (channel_id is null and conversation_id is not null)
  )
);

alter table public.message_reads enable row level security;

create policy "Users manage own reads"
  on public.message_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create unique index idx_message_reads_channel on public.message_reads(user_id, channel_id) where channel_id is not null;
create unique index idx_message_reads_conversation on public.message_reads(user_id, conversation_id) where conversation_id is not null;
