# 500Claw Platform Redesign — Progress Tracker

## Vision
Transform 500Claw from a single-user AI ops dashboard into a multi-workspace, team-first platform (Notion + Linear + Slack + AI agent). Inspired by "Core" app. Users connect data sources (Gmail, Google Drive, databases), work natively (messages, projects, docs), and an AI agent operates across everything.

## Sub-Projects

### Sub-Project 1: Workspaces, Apps & Team Collaboration ✅
**Branch:** `feat/workspaces-apps-collaboration`
**Spec:** `docs/superpowers/specs/2026-03-31-workspaces-apps-collaboration-design.md`
**Plan:** `docs/superpowers/plans/2026-03-31-workspaces-apps-collaboration.md`
**Status:** Complete (29 commits)
**Date:** 2026-03-31

**What was built:**
- Multi-workspace system with workspace switcher
- Team membership (Owner + Member roles)
- Invite flow with HMAC tokens and email verification
- App registry with 3 tiers (platform / built-in / add-on)
- App install/uninstall with catalog modal and route guard
- Three-zone shell layout: icon rail (52px) + app sidebar (220px) + main content
- 8 workspace themes (Default, Warm Earth, Midnight, Ocean, Forest, Berry, Monochrome, Sunset)
- Onboarding wizard (4-step with live workspace preview)
- Settings page (members, apps, workspace tabs — fully wired to APIs)
- Open signup (replaced allowlist model)
- Workspace-aware middleware with active workspace cookie
- Styled tooltips on icon rail
- Polished app placeholder pages with Lucide icons

**Database migrations:**
- `012_workspaces_and_apps.sql` — 5 new tables, workspace_id on 17 existing tables
- `013_fix_rls_recursion.sql` — Security definer functions for RLS

**Key decisions:**
- Service client used for bootstrap operations (workspace creation, invite acceptance) to avoid RLS chicken-and-egg
- RLS policies use `get_user_workspace_ids()` / `get_user_owned_workspace_ids()` security definer functions
- external_accounts and profiles are user-scoped (not workspace-scoped)
- database_connections are workspace-scoped
- /onboarding always accessible (users create additional workspaces there)

**Remaining P3 items:**
- [ ] User settings modal (profile, connected accounts, appearance)
- [ ] Responsive behavior (mobile/tablet)
- [ ] Recreate dropped audit_log RLS policy

---

### Sub-Project 2: Messages (Slack-like) ✅
**Branch:** `feat/workspaces-apps-collaboration` (continued)
**Spec:** `docs/superpowers/specs/2026-03-31-messages-design.md`
**Plan:** `docs/superpowers/plans/2026-03-31-messages.md`
**Status:** Complete (10 commits)
**Date:** 2026-03-31

**What was built:**
- Workspace-wide channels (#general auto-created per workspace)
- 1:1 Direct Messages with create/find logic
- Real-time message delivery (Supabase Postgres Changes)
- Typing indicators (Supabase Broadcast, 3s timeout, 2s debounce)
- Online presence with green dots (Supabase Presence, workspace-level)
- Rich text composer (bold, italic, code, link toolbar)
- File attachments (images inline, files as download cards, Supabase Storage)
- Unread tracking (per-channel/DM read watermark)
- Message edit/delete (own messages)
- Create channel modal, new DM picker
- Messages sidebar replacing placeholder (channels list + DMs with presence dots)
- Markdown renderer (HTML-escaped then pattern-matched, safe)
- Channel/DM pages with top bar, message list (infinite scroll), date separators

**Database migration:** `014_messages.sql` — channels, direct_conversations, direct_conversation_members, messages, message_reads + Realtime publication

**Key decisions:**
- Unified messages table (channel_id XOR conversation_id)
- Read watermark (not per-message reads) for efficiency
- DM conversations as join table (future-proofs for group DMs)
- Presence at workspace level (one channel per workspace, not per chat)
- Service client for DM conversation creation (RLS bootstrap)
- PresenceProvider added at workspace layout level

---

### Sub-Project 3: Projects (Linear-like) ✅
**Branch:** `feat/workspaces-apps-collaboration` (continued)
**Spec:** `docs/superpowers/specs/2026-04-01-projects-design.md`
**Plan:** `docs/superpowers/plans/2026-04-01-projects.md`
**Status:** Complete
**Date:** 2026-04-01

**What was built:**
- Multiple projects per workspace with sidebar navigation
- Kanban board view with drag-and-drop (HTML5 API)
- List view with sortable columns
- Task cards with type icons, priority dots, assignee avatars, labels, due dates
- Auto-incrementing task IDs (PROJ-1, PROJ-2)
- Default columns on project creation (To Do, In Progress, Done)
- Add/rename/delete columns
- Task detail slide-over panel with inline editing and auto-save
- Filter bar (assignee, priority, type, active-only toggle)
- Create project modal with name + identifier
- Inline task creation at bottom of each column
- Placeholder AI chat panel
- Projects sidebar replacing placeholder

**Database migration:** `015_projects.sql` — projects, project_columns, tasks

**Key decisions:**
- HTML5 drag-and-drop (no library), optimistic UI + batch reorder endpoint
- Labels as jsonb (no separate table)
- Position as integer (reassign on reorder)
- Task counter atomic increment via service client
- Task detail as side panel (no task-level routing)

---

### Sub-Project 4: Files (Notion-like) ✅
**Branch:** `feat/workspaces-apps-collaboration` (continued)
**Spec:** `docs/superpowers/specs/2026-04-02-files-design.md`
**Plan:** `docs/superpowers/plans/2026-04-02-files.md`
**Status:** Complete
**Date:** 2026-04-02

**What was built:**
- Unified node tree (pages, folders, uploaded files in one table)
- TipTap rich-text editor with formatting toolbar, headings, lists, tables, images, file attachments
- Nested sidebar file tree with collapse/expand, search, context menu, recently edited
- Folder view with contents list
- File preview (images, PDFs, video, audio inline; download for others)
- Auto-save (1s debounce)
- Emoji icons and cover images for pages
- Privacy toggle (public/private) with share modal
- File upload to Supabase Storage (50MB files, 10MB images)
- Realtime sidebar updates via Postgres Changes

**Database migration:** `016_files.sql` — files, file_shares + RLS policies + updated_at trigger

**Key decisions:**
- Unified node table with type discriminator (no separate tables for pages/folders/files)
- TipTap JSON stored in content column (pages only)
- Single dynamic route [fileId] renders page editor, folder view, or file preview based on type
- No real-time collaborative editing (lightweight presence awareness only)
- Client-side tree building from flat API response

---

### Sub-Project 5: Email & Calendar Sync
**Status:** Not started

---

### Sub-Project 6: AI Agent
**Status:** Not started

---

## Architecture Notes

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind CSS 4, Supabase (Auth + Postgres), shadcn/ui, Lucide icons, Resend

**Key patterns:**
- Server components for data fetching (layouts, pages)
- Client components for interactivity ("use client")
- Service client (`createServiceClient()`) for operations that bypass RLS
- Regular client (`createClient()`) for user-scoped queries
- Middleware handles auth + workspace routing + cookie management
- WorkspaceProvider context gives all client components access to workspace, membership, apps, members
- App manifests define sidebar behavior, routes, icons, categories

**Data source strategy:**
- User-level: OAuth connections (Gmail, Google Drive, GitHub) in `external_accounts`
- Workspace-level: Database connections (PostgreSQL, MySQL, ClickHouse) in `database_connections`
- Both feed the future knowledge graph / AI agent context
