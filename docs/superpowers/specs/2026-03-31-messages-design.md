# 500Claw Messages — Design Spec

**Sub-project 2** of the 500Claw platform redesign.
**Date:** 2026-03-31
**Status:** Draft

---

## Overview

Build a Slack-like messaging system within the 500Claw workspace. Workspace-wide channels (visible to all members) and user-to-user direct messages. Real-time message delivery via Supabase Realtime, typing indicators via Broadcast, and online presence via Presence.

### What's In Scope

- Workspace-wide channels (all members can see all channels)
- Direct messages (1:1 between workspace members)
- Real-time message delivery (Supabase Postgres Changes)
- Typing indicators (Supabase Broadcast)
- Online presence with green dots (Supabase Presence)
- Rich text composer (bold, italic, code, links) with markdown rendering
- File attachments (images inline, files as download cards) via Supabase Storage
- Unread tracking (per-channel/DM read watermark)
- Create/edit/delete channels
- Create/open DM conversations
- Edit/delete own messages
- Auto-create #general channel on workspace creation
- Messages app sidebar with channels list, DMs list, unread indicators

### What's Deferred

- Threaded replies
- Emoji reactions
- Private/invite-only channels
- Group DMs (3+ people)
- Message search
- @mentions with notifications
- Message pinning
- Link previews / unfurling

---

## Database Schema

### New Tables

#### `channels`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `name` | varchar(80) | Lowercase, hyphenated (e.g., "general", "design") |
| `description` | text, nullable | Channel topic/description |
| `created_by` | uuid (FK → auth.users) | |
| `is_default` | boolean, default false | #general — auto-created, cannot be deleted |
| `created_at` | timestamptz | Default: `now()` |

RLS: All workspace members can SELECT. Workspace members can INSERT. Channel creator or workspace owner can UPDATE/DELETE (except is_default channels cannot be deleted).

#### `direct_conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `created_at` | timestamptz | Default: `now()` |

#### `direct_conversation_members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `conversation_id` | uuid (FK → direct_conversations) | ON DELETE CASCADE |
| `user_id` | uuid (FK → auth.users) | ON DELETE CASCADE |
| Unique constraint | `(conversation_id, user_id)` | |

RLS: Users can SELECT conversations they are a member of. Users can INSERT themselves into conversations.

#### `messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `workspace_id` | uuid (FK → workspaces) | |
| `channel_id` | uuid (FK → channels), nullable | Set for channel messages |
| `conversation_id` | uuid (FK → direct_conversations), nullable | Set for DM messages |
| `sender_id` | uuid (FK → auth.users) | |
| `content` | text | Message body (markdown formatted) |
| `attachments` | jsonb, default '[]' | Array of `{ name, url, type, size }` |
| `edited_at` | timestamptz, nullable | Null if never edited |
| `created_at` | timestamptz | Default: `now()` |
| Check constraint | | Exactly one of `channel_id` or `conversation_id` must be non-null |

Indexes: `(channel_id, created_at DESC)`, `(conversation_id, created_at DESC)`, `(workspace_id)`.

RLS: Channel messages — all workspace members can SELECT/INSERT. DM messages — only conversation members can SELECT/INSERT. Sender can UPDATE/DELETE own messages.

#### `message_reads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `user_id` | uuid (FK → auth.users) | |
| `channel_id` | uuid (FK → channels), nullable | |
| `conversation_id` | uuid (FK → direct_conversations), nullable | |
| `last_read_at` | timestamptz | Timestamp of last message user has seen |
| Unique constraint | `(user_id, channel_id)` where channel_id is not null | |
| Unique constraint | `(user_id, conversation_id)` where conversation_id is not null | |

RLS: Users can SELECT/INSERT/UPDATE own rows only.

### Modification to Workspace Creation

In `POST /api/workspaces` (the service-client workspace creation flow), after creating the workspace and installing default apps, also create a `#general` channel with `is_default: true`.

---

## Real-time Architecture

### 1. Message Delivery — Postgres Changes

Subscribe to `INSERT` and `UPDATE` on the `messages` table, filtered by `channel_id` or `conversation_id`. When a message is inserted or edited, all subscribers in that channel/DM receive the update instantly.

```typescript
supabase
  .channel(`messages:${targetId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `channel_id=eq.${targetId}` // or conversation_id
  }, (payload) => {
    // handle INSERT (new message) or UPDATE (edit)
  })
  .subscribe();
```

### 2. Typing Indicators — Broadcast

Ephemeral events with no database writes. When a user types, broadcast a typing event to the channel/conversation room. Other clients display "X is typing..." for 3 seconds, resetting the timer on each new event.

```typescript
// Send typing event (debounced, max once per 2 seconds)
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { user_id, user_name }
});

// Receive typing events
channel.on('broadcast', { event: 'typing' }, (payload) => {
  // Show "X is typing..." for 3 seconds
});
```

### 3. Online Presence — Presence

Track which users are online at the workspace level. On page load, join a workspace-wide presence channel. Supabase handles heartbeat, join, and leave events automatically.

```typescript
const presenceChannel = supabase.channel(`presence:workspace:${workspaceId}`);
presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    // { user_id: [{ user_id, full_name, avatar_url, online_at }] }
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        user_id, full_name, avatar_url, online_at: new Date().toISOString()
      });
    }
  });
```

Provided at the workspace layout level via `usePresence` hook so all components can check `isOnline(userId)`.

---

## UI Components

### Messages App Sidebar (`messages-sidebar-content.tsx`)

Replaces the placeholder sidebar when the Messages app is active.

**Channels section:**
- Header: "Channels" label + "+" button (opens create channel modal)
- List of channels: `# channel-name`, active one highlighted
- Unread indicator: bold text + dot badge when messages exist after `last_read_at`

**Direct Messages section:**
- Header: "Direct Messages" label + "+" button (opens new DM picker)
- List of DM conversations: other user's avatar (with green online dot from Presence) + name
- Active DM highlighted
- Unread indicator: bold text + dot badge

### Message List (`message-list.tsx`)

**Top bar:**
- Channel: `# channel-name` + description
- DM: other user's avatar + name + online status ("Online" or "Offline")
- Bell icon (future: notification settings)
- Search icon (future: message search)

**Message area:**
- Scrollable, newest messages at bottom
- Scroll up to load older messages (infinite scroll, 50 per page)
- Date separators between different days ("Today", "Yesterday", "March 28, 2026")
- New messages divider line when there are unread messages

**Each message (`message-item.tsx`):**
- Left: sender avatar (with online green dot)
- Right: sender name (bold) + timestamp (muted, relative — "2:30 PM", "Yesterday at 4:15 PM")
- Content: rendered markdown (bold, italic, code blocks, inline code, links)
- Attachments: images as inline thumbnails (max 300px wide, clickable to full-size), other files as download cards (icon + name + size)
- Hover actions (appear on hover): Edit (pencil icon, own messages only), Delete (trash icon, own messages only)
- Edited indicator: "(edited)" text after timestamp if `edited_at` is set

**Typing indicator (`typing-indicator.tsx`):**
- Appears below the last message, above the composer
- "David is typing..." or "David and Sarah are typing..." or "3 people are typing..."
- Animated dots (CSS animation)

### Message Composer (`message-composer.tsx`)

- Auto-growing textarea (1 line default, grows up to 4 lines)
- Placeholder: "Message #channel-name" or "Message David"
- **Enter** sends message, **Shift+Enter** for newline
- Toolbar below textarea:
  - Bold (B), Italic (I), Code (`<>`), Link (chain icon) — these wrap selected text in markdown syntax
  - Paperclip icon — file attachment (opens file picker)
  - Send button (arrow up icon, right side) — enabled when content is non-empty
- File attachment flow: click paperclip → file picker → upload starts → show upload progress → on complete, file appears as a chip above the textarea → can remove before sending
- Fires typing indicator on keypress (debounced: max once per 2 seconds)

### Create Channel Modal (`create-channel-modal.tsx`)

- Channel name input (auto-lowercases, replaces spaces with hyphens)
- Optional description textarea
- "Create Channel" button
- Validates: non-empty name, no duplicate names in workspace

### New DM Picker (`new-dm-picker.tsx`)

- Shows workspace members list (from WorkspaceProvider context)
- Each member: avatar (with online dot) + name + email
- Filter/search input at top
- Click a member → check if DM conversation already exists → if yes, navigate to it; if no, create it and navigate
- Don't show yourself in the list

---

## Routing

```
/{workspaceSlug}/messages                      → redirect to #general channel
/{workspaceSlug}/messages/c/{channelId}        → channel message view
/{workspaceSlug}/messages/dm/{conversationId}  → DM message view
```

The Messages app sidebar is always visible when on any `/messages/*` route. The main content area renders the message list + composer for the active channel/DM.

---

## API Routes

### Channels

```
GET    /api/messages/channels                → list workspace channels
POST   /api/messages/channels                → create channel
PATCH  /api/messages/channels/[id]           → update channel (name, description)
DELETE /api/messages/channels/[id]           → delete channel (not default)
```

### Conversations (DMs)

```
GET    /api/messages/conversations           → list user's DM conversations (with other user's profile)
POST   /api/messages/conversations           → create or find existing DM conversation
```

Create/find logic: given `otherUserId`, check if a conversation exists where both users are members. If yes, return it. If no, create a new `direct_conversations` row + two `direct_conversation_members` rows.

### Messages

```
GET    /api/messages/[targetId]              → get messages for channel or conversation (paginated, cursor-based)
POST   /api/messages/[targetId]              → send message to channel or conversation
PATCH  /api/messages/msg/[id]               → edit message (own only)
DELETE /api/messages/msg/[id]               → delete message (own only)
```

Query param `?type=channel|dm` distinguishes whether `targetId` is a channel_id or conversation_id.

### Read Tracking

```
POST   /api/messages/read                    → update read watermark { channelId?, conversationId?, lastReadAt }
```

### File Upload

```
POST   /api/messages/upload                  → upload file to Supabase Storage
```

Returns `{ name, url, type, size }`. Max 10MB per file, max 5 files per message. Stored in `message-attachments` bucket, path: `{workspace_id}/{channel_or_convo_id}/{uuid}-{filename}`.

---

## Client Hooks

### `useMessages(targetId, type: 'channel' | 'dm')`

```typescript
interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  editMessage: (id: string, content: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
}
```

- Loads initial 50 messages on mount (newest first, displayed bottom-to-top)
- Subscribes to Supabase Realtime Postgres Changes for INSERT/UPDATE/DELETE
- `loadMore` fetches next 50 older messages (cursor-based on `created_at`)
- New messages from Realtime are appended to the bottom
- Edited messages update in place
- Deleted messages are removed from the list

### `useTyping(targetId, type: 'channel' | 'dm')`

```typescript
interface UseTypingReturn {
  typingUsers: { userId: string; userName: string }[];
  sendTypingEvent: () => void; // debounced, call on every keystroke
}
```

- `sendTypingEvent` broadcasts to the Supabase channel (debounced: max once per 2 seconds)
- Listens for typing events from other users
- Removes users from `typingUsers` after 3 seconds of no events
- Filters out own user

### `usePresence(workspaceId)`

```typescript
interface UsePresenceReturn {
  onlineUserIds: Set<string>;
  isOnline: (userId: string) => boolean;
}
```

- Joins workspace-level presence channel on mount
- Tracks own presence
- Syncs on presence changes (join, leave, sync events)
- Provided at workspace layout level (in `[workspaceSlug]/layout.tsx`)

---

## Component File Structure

```
src/app/[workspaceSlug]/messages/
├── page.tsx                          → redirect to #general
├── c/[channelId]/page.tsx            → channel view
└── dm/[conversationId]/page.tsx      → DM view

src/components/messages/
├── messages-sidebar-content.tsx      → channels + DMs list for app sidebar
├── message-list.tsx                  → scrollable message area with infinite scroll
├── message-item.tsx                  → single message display
├── message-composer.tsx              → input + toolbar + file upload
├── typing-indicator.tsx              → "X is typing..." with animated dots
├── create-channel-modal.tsx          → new channel form
├── new-dm-picker.tsx                 → member selector for new DMs
├── attachment-preview.tsx            → inline image or file download card
└── markdown-renderer.tsx             → renders markdown content safely

src/hooks/
├── use-messages.ts                   → message CRUD + Realtime subscription
├── use-typing.ts                     → typing Broadcast + listener
└── use-presence.ts                   → workspace-level online presence

src/app/api/messages/
├── channels/
│   ├── route.ts                      → GET (list), POST (create)
│   └── [id]/route.ts                 → PATCH, DELETE
├── conversations/
│   └── route.ts                      → GET (list), POST (create/find)
├── [targetId]/
│   └── route.ts                      → GET (messages), POST (send)
├── msg/
│   └── [id]/route.ts                 → PATCH (edit), DELETE
├── read/
│   └── route.ts                      → POST (update watermark)
└── upload/
    └── route.ts                      → POST (file upload)
```

### Integration with App Sidebar

The `app-sidebar.tsx` currently renders placeholder content per app. For Messages, it will import and render `messages-sidebar-content.tsx` when `activeApp.id === "messages"`. This component receives channels and conversations via its own data fetching (not from workspace context, since messages data changes frequently).

### Integration with Workspace Layout

The `usePresence` hook is initialized in `[workspaceSlug]/layout.tsx` and provided via a `PresenceProvider` context. This way, any component (sidebar DM list, message items, member lists) can check if a user is online.

### Integration with Workspace Creation

The `POST /api/workspaces` route (service client) adds a step after installing default apps: create a `#general` channel with `is_default: true` for the new workspace.

---

## Key Design Decisions

1. **Unified messages table** — channel messages and DM messages share one table, distinguished by `channel_id` vs `conversation_id`. Simpler queries, one Realtime subscription pattern.
2. **Read watermark, not per-message reads** — tracking "last read at" per channel/DM is far more efficient than tracking which individual messages each user has read.
3. **Markdown for rich text** — store messages as markdown, render on display. No complex rich text editor needed — just toolbar buttons that wrap selected text in markdown syntax (`**bold**`, `*italic*`, `` `code` ``).
4. **Supabase Storage for attachments** — files go to a dedicated bucket, URLs stored in the message's `attachments` jsonb array. No separate attachments table needed.
5. **Presence at workspace level** — one presence channel per workspace (not per channel/DM). Fewer subscriptions, consistent online status everywhere.
6. **DM conversations as a join table** — future-proofs for group DMs without schema changes.
