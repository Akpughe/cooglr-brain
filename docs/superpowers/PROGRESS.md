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

### Sub-Project 2: Messages (Slack-like)
**Branch:** TBD
**Status:** Starting brainstorm

---

### Sub-Project 3: Projects (Linear-like)
**Status:** Not started

---

### Sub-Project 4: Files (Notion-like)
**Status:** Not started

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
