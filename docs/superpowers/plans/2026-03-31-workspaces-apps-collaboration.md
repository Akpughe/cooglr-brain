# Workspaces, Apps & Team Collaboration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform 500Claw from a single-user dashboard into a multi-workspace, team-first platform with an app system, team collaboration, and a new three-zone shell layout.

**Architecture:** Big bang migration — add workspace scoping to all existing tables, replace the current single sidebar with an icon rail + app sidebar + main content shell, refactor auth from allowlist-gated to open signup with workspace-aware middleware. All routing moves from `/(dashboard)/...` to `/[workspaceSlug]/...`.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Auth + Postgres + RLS), TypeScript, Tailwind CSS 4, shadcn/ui, Lucide icons, Resend (invite emails)

**Important:** Check `node_modules/next/dist/docs/` before writing Next.js code — this version has breaking changes from training data (per AGENTS.md).

**Testing approach:** No test runner is configured in this project. Verify each task by running `npm run dev` and testing in browser or via API calls. David tests by hitting APIs directly and checking the browser.

---

## File Structure Overview

### New Files to Create

```
src/lib/workspace/
├── context.tsx              — WorkspaceProvider + useWorkspace hook
├── middleware.ts             — workspace-aware auth middleware (replaces current)
└── themes.ts                — theme definitions + CSS variable mappings

src/lib/apps/
├── registry.ts              — app manifest definitions
└── types.ts                 — AppManifest, AppCategory types

src/app/onboarding/
└── page.tsx                 — onboarding wizard (full-screen, no shell)

src/app/invite/[token]/
└── page.tsx                 — invite acceptance flow

src/app/[workspaceSlug]/
├── layout.tsx               — new shell layout (icon rail + sidebar + main)
├── page.tsx                 — AI Home (placeholder for now)
├── messages/page.tsx        — Messages placeholder
├── projects/page.tsx        — Projects placeholder
├── files/page.tsx           — Files placeholder
├── settings/page.tsx        — Settings page
├── email-marketing/page.tsx — Email Marketing (re-house existing)
├── reports/page.tsx         — Reports (re-house existing)
└── github-repos/page.tsx    — GitHub Repos (re-house existing)

src/components/shell/
├── icon-rail.tsx            — Zone 1: icon rail with app icons
├── app-sidebar.tsx          — Zone 2: dynamic per-app sidebar
├── workspace-switcher.tsx   — dropdown for switching workspaces
├── app-catalog-modal.tsx    — "+" button modal for installing apps
└── theme-provider.tsx       — applies workspace theme CSS variables

src/components/onboarding/
├── onboarding-wizard.tsx    — multi-step wizard container
├── step-welcome.tsx         — step 1
├── step-workspace-name.tsx  — step 2
├── step-profile.tsx         — step 3
└── step-invite.tsx          — step 4

src/components/settings/
├── workspace-settings-modal.tsx — 3-tab modal container
├── members-tab.tsx          — invite + member list
├── apps-tab.tsx             — installed apps management
├── workspace-tab.tsx        — workspace name/slug/theme/danger zone
└── user-settings-modal.tsx  — profile, connected accounts, appearance

src/app/api/workspaces/
├── route.ts                 — GET (list user's workspaces), POST (create)
└── [id]/
    ├── route.ts             — GET, PATCH, DELETE workspace
    ├── members/route.ts     — GET, POST (invite), DELETE (remove)
    ├── apps/route.ts        — GET, POST (install), DELETE (uninstall)
    └── invites/route.ts     — GET, POST (create), PATCH (resend/revoke)

src/app/api/apps/
└── registry/route.ts        — GET available apps
```

### Files to Modify

```
middleware.ts                         — update matcher, add workspace routing logic
src/lib/supabase/middleware.ts        — rewrite for workspace-aware auth
src/lib/constants.ts                  — remove ROLES/DEPARTMENTS, add workspace constants
src/app/(auth)/login/page.tsx         — update copy (remove "pre-approved" text)
src/app/globals.css                   — add theme CSS custom properties for shell
```

### Files to Delete (after migration)

```
src/app/(dashboard)/layout.tsx        — replaced by [workspaceSlug]/layout.tsx
src/app/(dashboard)/page.tsx          — replaced by [workspaceSlug]/page.tsx
src/app/(dashboard)/chat/             — replaced by [workspaceSlug]/ AI Home
src/app/(dashboard)/repos/            — replaced by [workspaceSlug]/github-repos/
src/app/(dashboard)/tickets/          — replaced by [workspaceSlug]/projects/
src/app/(dashboard)/reports/          — replaced by [workspaceSlug]/reports/
src/app/(dashboard)/emails/           — replaced by [workspaceSlug]/email-marketing/
src/app/(dashboard)/settings/         — replaced by [workspaceSlug]/settings/
src/app/(dashboard)/admin/            — absorbed into workspace settings members tab
src/components/layout/sidebar.tsx     — replaced by shell/ components
```

---

### Task 1: Database Migration — New Tables + Workspace Scoping

**Files:**
- Create: `supabase/migrations/012_workspaces_and_apps.sql`

This is the foundational migration. Run via Supabase MCP.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/012_workspaces_and_apps.sql`:

```sql
-- ============================================================
-- Migration 012: Workspaces, Members, Invites, App Registry
-- ============================================================

-- 1. Create workspaces table
create table public.workspaces (
  id uuid default gen_random_uuid() primary key,
  name varchar(50) not null,
  slug varchar(50) not null unique,
  avatar_url text,
  owner_id uuid references auth.users(id) not null,
  theme varchar(30) default 'default',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.workspaces enable row level security;

create policy "Members can view their workspaces"
  on public.workspaces for select
  to authenticated
  using (
    id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "Owners can update their workspaces"
  on public.workspaces for update
  to authenticated
  using (owner_id = auth.uid());

create policy "Authenticated users can create workspaces"
  on public.workspaces for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "Owners can delete their workspaces"
  on public.workspaces for delete
  to authenticated
  using (owner_id = auth.uid());

-- 2. Create workspace_members table
create table public.workspace_members (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role varchar(10) not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  unique(workspace_id, user_id)
);

alter table public.workspace_members enable row level security;

create policy "Members can view workspace members"
  on public.workspace_members for select
  to authenticated
  using (
    workspace_id in (select workspace_id from public.workspace_members wm where wm.user_id = auth.uid())
  );

create policy "Owners can manage workspace members"
  on public.workspace_members for all
  to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid() and wm.role = 'owner'
    )
  );

create policy "Users can insert themselves via invite"
  on public.workspace_members for insert
  to authenticated
  with check (user_id = auth.uid());

-- 3. Create workspace_invites table
create table public.workspace_invites (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  email varchar(255) not null,
  invited_by uuid references auth.users(id) not null,
  role varchar(10) default 'member',
  status varchar(10) default 'pending' check (status in ('pending', 'accepted', 'expired')),
  token varchar(255) not null unique,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

alter table public.workspace_invites enable row level security;

create policy "Workspace members can view invites"
  on public.workspace_invites for select
  to authenticated
  using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "Owners can manage invites"
  on public.workspace_invites for all
  to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid() and wm.role = 'owner'
    )
  );

-- Allow invited users to update their own invite status to 'accepted'
create policy "Invited users can accept invites"
  on public.workspace_invites for update
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'))
  with check (status = 'accepted');

-- 4. Create app_registry table (system table)
create table public.app_registry (
  id varchar(50) primary key,
  name varchar(100) not null,
  description text,
  icon varchar(50) not null,
  category varchar(20) not null check (category in ('built_in', 'add_on')),
  default_installed boolean default false,
  sort_order int default 0,
  has_sidebar boolean default true,
  route varchar(100) not null,
  setup_required boolean default false
);

-- No RLS needed — this is a read-only system table
alter table public.app_registry enable row level security;

create policy "Anyone authenticated can read app registry"
  on public.app_registry for select
  to authenticated
  using (true);

-- Seed initial apps
insert into public.app_registry (id, name, description, icon, category, default_installed, sort_order, has_sidebar, route, setup_required) values
  ('messages', 'Messages', 'Team channels and direct messages', 'MessageSquare', 'built_in', true, 1, true, '/messages', false),
  ('projects', 'Projects', 'Kanban boards and task management', 'LayoutGrid', 'built_in', true, 2, true, '/projects', false),
  ('files', 'Files', 'Documents, notes, and file storage', 'FileText', 'built_in', true, 3, true, '/files', false),
  ('email-marketing', 'Email Marketing', 'Campaigns, templates, and audience management', 'Mail', 'add_on', false, 10, true, '/email-marketing', true),
  ('reports', 'Reports', 'AI-powered data analysis and reporting', 'BarChart3', 'add_on', false, 11, true, '/reports', false),
  ('github-repos', 'GitHub Repos', 'Repository management, PRs, and issues', 'Github', 'add_on', false, 12, true, '/github-repos', true),
  ('calendar', 'Calendar', 'Synced calendar from Google and iCloud', 'Calendar', 'add_on', false, 13, true, '/calendar', true);

-- 5. Create workspace_apps table
create table public.workspace_apps (
  id uuid default gen_random_uuid() primary key,
  workspace_id uuid references public.workspaces(id) on delete cascade not null,
  app_id varchar(50) references public.app_registry(id) not null,
  installed_by uuid references auth.users(id) not null,
  installed_at timestamptz default now(),
  unique(workspace_id, app_id)
);

alter table public.workspace_apps enable row level security;

create policy "Members can view workspace apps"
  on public.workspace_apps for select
  to authenticated
  using (
    workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid())
  );

create policy "Owners can manage workspace apps"
  on public.workspace_apps for all
  to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members wm
      where wm.user_id = auth.uid() and wm.role = 'owner'
    )
  );

-- 6. Add workspace_id to existing tables
alter table public.tickets add column workspace_id uuid references public.workspaces(id);
alter table public.ticket_comments add column workspace_id uuid references public.workspaces(id);
alter table public.chat_sessions add column workspace_id uuid references public.workspaces(id);
alter table public.chat_messages add column workspace_id uuid references public.workspaces(id);
alter table public.email_providers add column workspace_id uuid references public.workspaces(id);
alter table public.email_templates add column workspace_id uuid references public.workspaces(id);
alter table public.email_audiences add column workspace_id uuid references public.workspaces(id);
alter table public.email_contacts add column workspace_id uuid references public.workspaces(id);
alter table public.email_campaigns add column workspace_id uuid references public.workspaces(id);
alter table public.email_events add column workspace_id uuid references public.workspaces(id);
alter table public.email_unsubscribes add column workspace_id uuid references public.workspaces(id);
alter table public.saved_reports add column workspace_id uuid references public.workspaces(id);
alter table public.report_sessions add column workspace_id uuid references public.workspaces(id);
alter table public.report_runs add column workspace_id uuid references public.workspaces(id);
alter table public.database_connections add column workspace_id uuid references public.workspaces(id);
alter table public.activity_log add column workspace_id uuid references public.workspaces(id);
alter table public.audit_log add column workspace_id uuid references public.workspaces(id);

-- 7. Remove role/department from profiles (now in workspace_members)
alter table public.profiles drop column if exists role;
alter table public.profiles drop column if exists department;

-- 8. Update handle_new_user trigger — remove allowlist check, just create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );
  return new;
end;
$$;

-- 9. Drop allowed_emails table
drop policy if exists "Admins can manage allowlist" on public.allowed_emails;
drop table if exists public.allowed_emails;

-- 10. Add workspace_id indexes for performance
create index idx_workspace_members_user on public.workspace_members(user_id);
create index idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index idx_workspace_apps_workspace on public.workspace_apps(workspace_id);
create index idx_workspace_invites_token on public.workspace_invites(token);
create index idx_workspace_invites_email on public.workspace_invites(email);
create index idx_workspaces_slug on public.workspaces(slug);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool with name `012_workspaces_and_apps` and the SQL above.

- [ ] **Step 3: Verify migration applied**

Use Supabase MCP `list_tables` to confirm all new tables exist: `workspaces`, `workspace_members`, `workspace_invites`, `app_registry`, `workspace_apps`.

Use Supabase MCP `execute_sql` to verify app registry seeded:
```sql
SELECT id, name, category FROM app_registry ORDER BY sort_order;
```

Expected: 7 rows (messages, projects, files, email-marketing, reports, github-repos, calendar).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/012_workspaces_and_apps.sql
git commit -m "feat: add workspaces, members, invites, and app registry tables"
```

---

### Task 2: Types and App Registry

**Files:**
- Create: `src/lib/apps/types.ts`
- Create: `src/lib/apps/registry.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Create app types**

Create `src/lib/apps/types.ts`:

```typescript
export type AppCategory = "built_in" | "add_on";

export interface AppManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AppCategory;
  defaultInstalled: boolean;
  sortOrder: number;
  hasSidebar: boolean;
  route: string;
  setupRequired: boolean;
}

export interface InstalledApp {
  id: string;
  name: string;
  icon: string;
  route: string;
  hasSidebar: boolean;
  category: AppCategory;
}

export interface WorkspaceMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  ownerId: string;
  theme: string;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  email: string;
  role: string;
  status: "pending" | "accepted" | "expired";
  createdAt: string;
  expiresAt: string;
}
```

- [ ] **Step 2: Create app registry constants**

Create `src/lib/apps/registry.ts`:

```typescript
import type { AppManifest } from "./types";

export const APP_REGISTRY: AppManifest[] = [
  {
    id: "messages",
    name: "Messages",
    description: "Team channels and direct messages",
    icon: "MessageSquare",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 1,
    hasSidebar: true,
    route: "/messages",
    setupRequired: false,
  },
  {
    id: "projects",
    name: "Projects",
    description: "Kanban boards and task management",
    icon: "LayoutGrid",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 2,
    hasSidebar: true,
    route: "/projects",
    setupRequired: false,
  },
  {
    id: "files",
    name: "Files",
    description: "Documents, notes, and file storage",
    icon: "FileText",
    category: "built_in",
    defaultInstalled: true,
    sortOrder: 3,
    hasSidebar: true,
    route: "/files",
    setupRequired: false,
  },
  {
    id: "email-marketing",
    name: "Email Marketing",
    description: "Campaigns, templates, and audience management",
    icon: "Mail",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 10,
    hasSidebar: true,
    route: "/email-marketing",
    setupRequired: true,
  },
  {
    id: "reports",
    name: "Reports",
    description: "AI-powered data analysis and reporting",
    icon: "BarChart3",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 11,
    hasSidebar: true,
    route: "/reports",
    setupRequired: false,
  },
  {
    id: "github-repos",
    name: "GitHub Repos",
    description: "Repository management, PRs, and issues",
    icon: "Github",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 12,
    hasSidebar: true,
    route: "/github-repos",
    setupRequired: true,
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Synced calendar from Google and iCloud",
    icon: "Calendar",
    category: "add_on",
    defaultInstalled: false,
    sortOrder: 13,
    hasSidebar: true,
    route: "/calendar",
    setupRequired: true,
  },
];

export const PLATFORM_APPS = ["ai-home", "settings"] as const;

export function getDefaultApps(): AppManifest[] {
  return APP_REGISTRY.filter((app) => app.defaultInstalled);
}

export function getAppById(id: string): AppManifest | undefined {
  return APP_REGISTRY.find((app) => app.id === id);
}
```

- [ ] **Step 3: Update constants**

Modify `src/lib/constants.ts` — replace ROLES and DEPARTMENTS:

```typescript
export const GATEWAY = {
  host: process.env.OPENCLAW_GATEWAY_HOST || "127.0.0.1",
  port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789"),
  token: process.env.OPENCLAW_GATEWAY_TOKEN!,
  get wsUrl() {
    return `ws://${this.host}:${this.port}`;
  },
};

export const WORKSPACE_ROLES = {
  OWNER: "owner",
  MEMBER: "member",
} as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[keyof typeof WORKSPACE_ROLES];

export const WORKSPACE_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const WORKSPACE_NAME_MAX_LENGTH = 50;
export const WORKSPACE_SLUG_MAX_LENGTH = 50;
export const INVITE_EXPIRY_DAYS = 7;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/apps/ src/lib/constants.ts
git commit -m "feat: add app types, registry, and workspace constants"
```

---

### Task 3: Theme System

**Files:**
- Create: `src/lib/workspace/themes.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create theme definitions**

Create `src/lib/workspace/themes.ts`:

```typescript
export interface WorkspaceTheme {
  id: string;
  name: string;
  railBg: string;
  railIcon: string;
  railIconActive: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarHover: string;
  sidebarActive: string;
  accent: string;
}

export const THEMES: WorkspaceTheme[] = [
  {
    id: "default",
    name: "Default",
    railBg: "#f5f5f5",
    railIcon: "#888888",
    railIconActive: "#1a1a1a",
    sidebarBg: "#ffffff",
    sidebarText: "#1a1a1a",
    sidebarTextMuted: "#999999",
    sidebarHover: "#f0f0f0",
    sidebarActive: "#f5f5f5",
    accent: "#1a1a1a",
  },
  {
    id: "warm-earth",
    name: "Warm Earth",
    railBg: "#f5f2ed",
    railIcon: "#78716c",
    railIconActive: "#c2410c",
    sidebarBg: "#faf8f5",
    sidebarText: "#1c1917",
    sidebarTextMuted: "#a8a29e",
    sidebarHover: "#e7e0d5",
    sidebarActive: "#f5f2ed",
    accent: "#c2410c",
  },
  {
    id: "midnight",
    name: "Midnight",
    railBg: "#1e1b2e",
    railIcon: "#8b85a0",
    railIconActive: "#c4b5fd",
    sidebarBg: "#272340",
    sidebarText: "#e8e5f0",
    sidebarTextMuted: "#8b85a0",
    sidebarHover: "#332e50",
    sidebarActive: "#3d3760",
    accent: "#c4b5fd",
  },
  {
    id: "ocean",
    name: "Ocean",
    railBg: "#eff6ff",
    railIcon: "#64748b",
    railIconActive: "#2563eb",
    sidebarBg: "#f8fafc",
    sidebarText: "#0f172a",
    sidebarTextMuted: "#94a3b8",
    sidebarHover: "#e2e8f0",
    sidebarActive: "#eff6ff",
    accent: "#2563eb",
  },
  {
    id: "forest",
    name: "Forest",
    railBg: "#f0fdf4",
    railIcon: "#64748b",
    railIconActive: "#16a34a",
    sidebarBg: "#f8fdf9",
    sidebarText: "#14532d",
    sidebarTextMuted: "#86978d",
    sidebarHover: "#dcfce7",
    sidebarActive: "#f0fdf4",
    accent: "#16a34a",
  },
  {
    id: "berry",
    name: "Berry",
    railBg: "#fdf2f8",
    railIcon: "#9ca3af",
    railIconActive: "#db2777",
    sidebarBg: "#fefafc",
    sidebarText: "#1f2937",
    sidebarTextMuted: "#9ca3af",
    sidebarHover: "#fce7f3",
    sidebarActive: "#fdf2f8",
    accent: "#db2777",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    railBg: "#171717",
    railIcon: "#737373",
    railIconActive: "#ffffff",
    sidebarBg: "#262626",
    sidebarText: "#e5e5e5",
    sidebarTextMuted: "#737373",
    sidebarHover: "#333333",
    sidebarActive: "#404040",
    accent: "#ffffff",
  },
  {
    id: "sunset",
    name: "Sunset",
    railBg: "#fff7ed",
    railIcon: "#a3a3a3",
    railIconActive: "#ea580c",
    sidebarBg: "#fffbf5",
    sidebarText: "#1c1917",
    sidebarTextMuted: "#a8a29e",
    sidebarHover: "#fed7aa",
    sidebarActive: "#fff7ed",
    accent: "#ea580c",
  },
];

export function getThemeById(id: string): WorkspaceTheme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getThemeCssVars(theme: WorkspaceTheme): Record<string, string> {
  return {
    "--rail-bg": theme.railBg,
    "--rail-icon": theme.railIcon,
    "--rail-icon-active": theme.railIconActive,
    "--sidebar-bg": theme.sidebarBg,
    "--sidebar-text": theme.sidebarText,
    "--sidebar-text-muted": theme.sidebarTextMuted,
    "--sidebar-hover": theme.sidebarHover,
    "--sidebar-active": theme.sidebarActive,
    "--shell-accent": theme.accent,
  };
}
```

- [ ] **Step 2: Add theme CSS variables to globals.css**

Add after the existing `:root` block in `src/app/globals.css`:

```css
/* ---- Shell Theme Variables (defaults, overridden by workspace theme) ---- */
:root {
  --rail-bg: #f5f5f5;
  --rail-icon: #888888;
  --rail-icon-active: #1a1a1a;
  --sidebar-bg: #ffffff;
  --sidebar-text: #1a1a1a;
  --sidebar-text-muted: #999999;
  --sidebar-hover: #f0f0f0;
  --sidebar-active: #f5f5f5;
  --shell-accent: #1a1a1a;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/workspace/themes.ts src/app/globals.css
git commit -m "feat: add workspace theme system with 8 presets"
```

---

### Task 4: Workspace Context Provider

**Files:**
- Create: `src/lib/workspace/context.tsx`

- [ ] **Step 1: Create the workspace context and hook**

Create `src/lib/workspace/context.tsx`:

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { InstalledApp, Workspace, WorkspaceMember } from "@/lib/apps/types";

interface WorkspaceContextValue {
  workspace: Workspace;
  membership: {
    role: "owner" | "member";
  };
  installedApps: InstalledApp[];
  members: WorkspaceMember[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: WorkspaceContextValue;
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}

export function useIsOwner(): boolean {
  const { membership } = useWorkspace();
  return membership.role === "owner";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/workspace/context.tsx
git commit -m "feat: add workspace context provider and hooks"
```

---

### Task 5: Workspace-Aware Middleware

**Files:**
- Modify: `src/lib/supabase/middleware.ts`
- Modify: `middleware.ts` (root)

- [ ] **Step 1: Rewrite the auth middleware**

Replace `src/lib/supabase/middleware.ts` entirely:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public paths that don't need auth
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/callback") ||
    pathname.startsWith("/invite");

  // If not authenticated and not on a public path, redirect to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If authenticated and on login/signup, redirect to root
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If authenticated and hitting root "/", resolve active workspace
  if (user && pathname === "/") {
    // Check for active workspace cookie
    const activeWorkspaceId = request.cookies.get("active_workspace_id")?.value;

    let slug: string | null = null;

    if (activeWorkspaceId) {
      // Verify membership still valid
      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", user.id)
        .eq("workspace_id", activeWorkspaceId)
        .single();

      if (membership?.workspaces) {
        slug = (membership.workspaces as { slug: string }).slug;
      }
    }

    if (!slug) {
      // Fall back to first workspace user belongs to
      const { data: firstMembership } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(slug)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
        .single();

      if (firstMembership?.workspaces) {
        slug = (firstMembership.workspaces as { slug: string }).slug;
      }
    }

    const url = request.nextUrl.clone();
    if (slug) {
      url.pathname = `/${slug}`;
    } else {
      // No workspaces — send to onboarding
      url.pathname = "/onboarding";
    }
    return NextResponse.redirect(url);
  }

  // If authenticated and on /onboarding, check if they already have workspaces
  if (user && pathname === "/onboarding") {
    const { count } = await supabase
      .from("workspace_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    // If they have workspaces, redirect to root (which will resolve to active workspace)
    if (count && count > 0) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Update root middleware matcher**

Replace `middleware.ts` (root):

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Verify by running dev server**

Run: `npm run dev`

Visit `http://localhost:3000` — should redirect to `/login` (since no user) or `/onboarding` (if authenticated but no workspaces).

- [ ] **Step 4: Commit**

```bash
git add middleware.ts src/lib/supabase/middleware.ts
git commit -m "feat: workspace-aware auth middleware with active workspace routing"
```

---

### Task 6: Workspace API Routes

**Files:**
- Create: `src/app/api/workspaces/route.ts`
- Create: `src/app/api/workspaces/[id]/route.ts`
- Create: `src/app/api/workspaces/[id]/members/route.ts`
- Create: `src/app/api/workspaces/[id]/apps/route.ts`
- Create: `src/app/api/workspaces/[id]/invites/route.ts`
- Create: `src/app/api/apps/registry/route.ts`

- [ ] **Step 1: Create workspace CRUD route**

Create `src/app/api/workspaces/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WORKSPACE_SLUG_REGEX, WORKSPACE_NAME_MAX_LENGTH } from "@/lib/constants";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

// GET /api/workspaces — list user's workspaces
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      joined_at,
      workspaces (
        id, name, slug, avatar_url, owner_id, theme, created_at
      )
    `)
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const workspaces = (data || []).map((m) => ({
    ...m.workspaces,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({ workspaces });
}

// POST /api/workspaces — create workspace
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, slug: requestedSlug } = body;

  if (!name || name.length > WORKSPACE_NAME_MAX_LENGTH) {
    return NextResponse.json({ error: "Name is required (max 50 chars)" }, { status: 400 });
  }

  const slug = requestedSlug || slugify(name);
  if (!WORKSPACE_SLUG_REGEX.test(slug)) {
    return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
  }

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
  }

  // Create workspace
  const { data: workspace, error: wsError } = await supabase
    .from("workspaces")
    .insert({ name, slug, owner_id: user.id })
    .select()
    .single();

  if (wsError) return NextResponse.json({ error: wsError.message }, { status: 500 });

  // Add creator as owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  // Install default apps
  const { data: defaultApps } = await supabase
    .from("app_registry")
    .select("id")
    .eq("default_installed", true);

  if (defaultApps && defaultApps.length > 0) {
    const appInserts = defaultApps.map((app) => ({
      workspace_id: workspace.id,
      app_id: app.id,
      installed_by: user.id,
    }));

    await supabase.from("workspace_apps").insert(appInserts);
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
```

- [ ] **Step 2: Create single workspace route**

Create `src/app/api/workspaces/[id]/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { WORKSPACE_SLUG_REGEX } from "@/lib/constants";

// GET /api/workspaces/[id] — get workspace with members and apps
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Get workspace
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", id)
    .single();

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get members with profiles
  const { data: members } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", id);

  // Get installed apps
  const { data: apps } = await supabase
    .from("workspace_apps")
    .select(`
      app_id, installed_at,
      app_registry:app_id (id, name, icon, route, has_sidebar, category, sort_order)
    `)
    .eq("workspace_id", id)
    .order("installed_at", { ascending: true });

  const installedApps = (apps || [])
    .map((a) => a.app_registry)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  const formattedMembers = (members || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    fullName: (m.profiles as any)?.full_name || "",
    email: (m.profiles as any)?.email || "",
    avatarUrl: (m.profiles as any)?.avatar_url || null,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({
    workspace,
    membership: { role: membership.role },
    installedApps,
    members: formattedMembers,
  });
}

// PATCH /api/workspaces/[id] — update workspace
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can update workspace" }, { status: 403 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name) updates.name = body.name;
  if (body.slug) {
    if (!WORKSPACE_SLUG_REGEX.test(body.slug)) {
      return NextResponse.json({ error: "Invalid slug format" }, { status: 400 });
    }
    // Check uniqueness
    const { data: existing } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", body.slug)
      .neq("id", id)
      .single();
    if (existing) return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    updates.slug = body.slug;
  }
  if (body.theme) updates.theme = body.theme;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const { data, error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ workspace: data });
}

// DELETE /api/workspaces/[id] — delete workspace
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!workspace || workspace.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the owner can delete a workspace" }, { status: 403 });
  }

  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create members route**

Create `src/app/api/workspaces/[id]/members/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/workspaces/[id]/members
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: members, error } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const formatted = (members || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    fullName: (m.profiles as any)?.full_name || "",
    email: (m.profiles as any)?.email || "",
    avatarUrl: (m.profiles as any)?.avatar_url || null,
    role: m.role,
    joinedAt: m.joined_at,
  }));

  return NextResponse.json({ members: formatted });
}

// DELETE /api/workspaces/[id]/members — remove member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is owner
  const { data: callerMembership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (callerMembership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove members" }, { status: 403 });
  }

  const { userId } = await request.json();

  // Can't remove yourself if you're the only owner
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot remove yourself as owner" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Create apps route**

Create `src/app/api/workspaces/[id]/apps/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/workspaces/[id]/apps — list installed apps
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_apps")
    .select(`
      app_id, installed_at, installed_by,
      app_registry:app_id (id, name, description, icon, route, has_sidebar, category, sort_order, setup_required)
    `)
    .eq("workspace_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const apps = (data || [])
    .map((a) => ({ ...a.app_registry, installedAt: a.installed_at }))
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order);

  return NextResponse.json({ apps });
}

// POST /api/workspaces/[id]/apps — install app
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can install apps" }, { status: 403 });
  }

  const { appId } = await request.json();

  // Verify app exists in registry
  const { data: app } = await supabase
    .from("app_registry")
    .select("id")
    .eq("id", appId)
    .single();

  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const { error } = await supabase
    .from("workspace_apps")
    .insert({ workspace_id: id, app_id: appId, installed_by: user.id });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "App already installed" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

// DELETE /api/workspaces/[id]/apps — uninstall app
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can uninstall apps" }, { status: 403 });
  }

  const { appId } = await request.json();

  const { error } = await supabase
    .from("workspace_apps")
    .delete()
    .eq("workspace_id", id)
    .eq("app_id", appId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Create invites route**

Create `src/app/api/workspaces/[id]/invites/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

function generateInviteToken(): string {
  const raw = randomBytes(32).toString("hex");
  const hmac = createHmac("sha256", process.env.CREDENTIAL_ENCRYPTION_KEY || "fallback");
  return hmac.update(raw).digest("hex");
}

// GET /api/workspaces/[id]/invites — list pending invites
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workspace_invites")
    .select("*")
    .eq("workspace_id", id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ invites: data });
}

// POST /api/workspaces/[id]/invites — create invite
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify owner
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", id)
    .eq("user_id", user.id)
    .single();

  if (membership?.role !== "owner") {
    return NextResponse.json({ error: "Only owners can invite members" }, { status: 403 });
  }

  const { emails } = await request.json();

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "At least one email required" }, { status: 400 });
  }

  // Get workspace name for the invite email
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("name, slug")
    .eq("id", id)
    .single();

  const results = [];

  for (const email of emails) {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", id)
      .eq("user_id", (
        await supabase.from("profiles").select("id").eq("email", normalizedEmail).single()
      ).data?.id || "00000000-0000-0000-0000-000000000000")
      .single();

    if (existingMember) {
      results.push({ email: normalizedEmail, status: "already_member" });
      continue;
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", id)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      results.push({ email: normalizedEmail, status: "already_invited" });
      continue;
    }

    const token = generateInviteToken();

    const { error } = await supabase
      .from("workspace_invites")
      .insert({
        workspace_id: id,
        email: normalizedEmail,
        invited_by: user.id,
        token,
      });

    if (error) {
      results.push({ email: normalizedEmail, status: "error", error: error.message });
      continue;
    }

    // Send invite email via Resend (if configured)
    try {
      const { Resend } = await import("resend");
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const resend = new Resend(resendKey);
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`;
        await resend.emails.send({
          from: "500Claw <noreply@500chow.app>",
          to: normalizedEmail,
          subject: `You're invited to join ${workspace?.name} on 500Claw`,
          html: `
            <p>You've been invited to join <strong>${workspace?.name}</strong> on 500Claw.</p>
            <p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;">Accept Invite</a></p>
            <p>This invite expires in 7 days.</p>
          `,
        });
      }
    } catch {
      // Email sending is best-effort
    }

    results.push({ email: normalizedEmail, status: "invited" });
  }

  return NextResponse.json({ results }, { status: 201 });
}

// PATCH /api/workspaces/[id]/invites — revoke invite
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { inviteId, action } = await request.json();

  if (action === "revoke") {
    const { error } = await supabase
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", inviteId)
      .eq("workspace_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Create app registry route**

Create `src/app/api/apps/registry/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/apps/registry — list all available apps
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("app_registry")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ apps: data });
}
```

- [ ] **Step 7: Verify APIs work**

Run `npm run dev`. Use browser or curl to test:

```bash
# After logging in, create a workspace
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-auth-cookie>" \
  -d '{"name":"Test Workspace"}'

# List workspaces
curl http://localhost:3000/api/workspaces \
  -H "Cookie: <your-auth-cookie>"
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/workspaces/ src/app/api/apps/
git commit -m "feat: workspace, members, apps, and invites API routes"
```

---

### Task 7: Invite Acceptance Page

**Files:**
- Create: `src/app/invite/[token]/page.tsx`

- [ ] **Step 1: Create the invite acceptance page**

Create `src/app/invite/[token]/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  // Verify token
  const { data: invite } = await supabase
    .from("workspace_invites")
    .select("*, workspaces(name, slug)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Invalid or Expired Invite</h1>
          <p className="text-muted-foreground">This invite link is no longer valid.</p>
          <a href="/login" className="text-primary underline">Go to login</a>
        </div>
      </div>
    );
  }

  // Check if expired
  if (new Date(invite.expires_at) < new Date()) {
    await supabase
      .from("workspace_invites")
      .update({ status: "expired" })
      .eq("id", invite.id);

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Invite Expired</h1>
          <p className="text-muted-foreground">Ask the workspace owner to send a new invite.</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with return URL
    redirect(`/login?redirect=/invite/${token}`);
  }

  // User is authenticated — join the workspace
  const workspaceId = invite.workspace_id;

  // Check if already a member
  const { data: existingMembership } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!existingMembership) {
    // Add as member
    await supabase.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: invite.role || "member",
    });
  }

  // Mark invite as accepted
  await supabase
    .from("workspace_invites")
    .update({ status: "accepted" })
    .eq("id", invite.id);

  // Redirect to the workspace
  const slug = (invite.workspaces as any)?.slug;
  redirect(`/${slug || ""}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/invite/
git commit -m "feat: invite acceptance page with token validation"
```

---

### Task 8: Onboarding Wizard

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/components/onboarding/onboarding-wizard.tsx`

- [ ] **Step 1: Create the onboarding page**

Create `src/app/onboarding/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // If user already has workspaces, redirect
  const { count } = await supabase
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (count && count > 0) redirect("/");

  // Get profile for pre-filling
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, email")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen bg-background">
      <OnboardingWizard
        user={{
          id: user.id,
          email: user.email || "",
          fullName: profile?.full_name || "",
          avatarUrl: profile?.avatar_url || "",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the wizard component**

Create `src/components/onboarding/onboarding-wizard.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OnboardingWizardProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string;
  };
}

export function OnboardingWizard({ user }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [workspaceName, setWorkspaceName] = useState("");
  const [displayName, setDisplayName] = useState(user.fullName);
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);
  }

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (email && email.includes("@") && !inviteEmails.includes(email)) {
      setInviteEmails([...inviteEmails, email]);
      setEmailInput("");
    }
  }

  function removeEmail(email: string) {
    setInviteEmails(inviteEmails.filter((e) => e !== email));
  }

  async function handleFinish() {
    setLoading(true);
    setError("");

    try {
      // Update profile name if changed
      if (displayName !== user.fullName) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: displayName }),
        });
      }

      // Create workspace
      const wsRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName }),
      });

      if (!wsRes.ok) {
        const data = await wsRes.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const { workspace } = await wsRes.json();

      // Send invites if any
      if (inviteEmails.length > 0) {
        await fetch(`/api/workspaces/${workspace.id}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: inviteEmails }),
        });
      }

      // Navigate to workspace
      router.push(`/${workspace.slug}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  // Step 0: Welcome
  if (step === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-foreground rounded-2xl text-background text-xl font-extrabold">
            5C
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to 500Claw</h1>
            <p className="text-muted-foreground mt-2">
              Your all-in-one workspace for teams.
              <br />
              Let&apos;s get you set up in a few quick steps.
            </p>
          </div>
          <button
            onClick={() => setStep(1)}
            className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Name workspace
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-muted" />
            <div className="w-4 h-1 rounded-full bg-muted" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Name your workspace</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Choose something your team will recognize like the name of your organization or team.
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Core Inc."
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value.slice(0, 50))}
                className="w-full h-11 px-4 pr-12 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {workspaceName.length}/50
              </span>
            </div>
            {workspaceName && (
              <p className="text-xs text-muted-foreground">
                Workspace URL: .../{slugify(workspaceName)}
              </p>
            )}
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!workspaceName.trim()}
            className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Profile
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-muted" />
          </div>
          <div>
            <h1 className="text-xl font-bold">What&apos;s your name?</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              {displayName ? displayName[0].toUpperCase() : user.email[0].toUpperCase()}
            </div>
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 50))}
              className="flex-1 h-11 px-4 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <button
            onClick={() => setStep(3)}
            disabled={!displayName.trim()}
            className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Invite team
  if (step === 3 && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-full max-w-md space-y-6 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
            <div className="w-4 h-1 rounded-full bg-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Invite your team</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Add teammates by email. You can always invite more later.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="teammate@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className="flex-1 h-11 px-4 border border-border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={addEmail}
                className="h-11 px-4 border border-border rounded-lg text-sm hover:bg-muted transition-colors"
              >
                Add
              </button>
            </div>
            {inviteEmails.length > 0 && (
              <div className="space-y-1">
                {inviteEmails.map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg text-sm"
                  >
                    <span>{email}</span>
                    <button
                      onClick={() => removeEmail(email)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleFinish}
              className="inline-flex items-center justify-center h-11 px-8 bg-foreground text-background rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {inviteEmails.length > 0 ? "Send Invites & Continue" : "Continue"}
            </button>
            {inviteEmails.length === 0 && (
              <button
                onClick={handleFinish}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 animate-in fade-in duration-300">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-full animate-pulse">
          <div className="w-6 h-6 bg-muted-foreground/30 rounded-full" />
        </div>
        <p className="text-lg font-medium">
          {inviteEmails.length > 0 ? "Sending invitations..." : "Setting up your workspace..."}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/ src/components/onboarding/
git commit -m "feat: onboarding wizard with workspace creation and team invites"
```

---

### Task 9: Shell Layout — Icon Rail + App Sidebar

**Files:**
- Create: `src/components/shell/icon-rail.tsx`
- Create: `src/components/shell/app-sidebar.tsx`
- Create: `src/components/shell/workspace-switcher.tsx`
- Create: `src/components/shell/theme-provider.tsx`
- Create: `src/app/[workspaceSlug]/layout.tsx`

- [ ] **Step 1: Create theme provider**

Create `src/components/shell/theme-provider.tsx`:

```typescript
"use client";

import type { ReactNode } from "react";
import { getThemeById, getThemeCssVars } from "@/lib/workspace/themes";

export function ShellThemeProvider({
  themeId,
  children,
}: {
  themeId: string;
  children: ReactNode;
}) {
  const theme = getThemeById(themeId);
  const cssVars = getThemeCssVars(theme);

  return (
    <div style={cssVars as React.CSSProperties} data-theme={themeId}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create workspace switcher**

Create `src/components/shell/workspace-switcher.tsx`:

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/lib/apps/types";
import { Check, Plus } from "lucide-react";

interface WorkspaceSwitcherProps {
  activeWorkspace: Workspace;
}

export function WorkspaceSwitcher({ activeWorkspace }: WorkspaceSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<(Workspace & { role: string })[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      fetch("/api/workspaces")
        .then((r) => r.json())
        .then((data) => setWorkspaces(data.workspaces || []));
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchWorkspace(slug: string) {
    setOpen(false);
    router.push(`/${slug}`);
  }

  const initial = activeWorkspace.name?.[0]?.toUpperCase() || "W";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-[34px] h-[34px] rounded-[9px] bg-foreground text-background flex items-center justify-center font-bold text-[13px] hover:opacity-90 transition-opacity"
        title={activeWorkspace.name}
      >
        {initial}
      </button>

      {open && (
        <div className="absolute left-[52px] top-0 z-50 w-[240px] bg-popover border border-border rounded-xl shadow-lg py-1 animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Workspaces
            </p>
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => switchWorkspace(ws.slug)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-sm transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                {ws.name[0].toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium truncate">{ws.name}</div>
                <div className="text-xs text-muted-foreground">{ws.role}</div>
              </div>
              {ws.id === activeWorkspace.id && (
                <Check className="w-4 h-4 text-foreground shrink-0" />
              )}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={() => { setOpen(false); router.push("/onboarding"); }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-sm transition-colors text-muted-foreground"
            >
              <div className="w-7 h-7 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>Create new workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create icon rail**

Create `src/components/shell/icon-rail.tsx`:

```typescript
"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";
import { WorkspaceSwitcher } from "./workspace-switcher";
import * as LucideIcons from "lucide-react";
import { Plus, Settings, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { AppCatalogModal } from "./app-catalog-modal";

export function IconRail() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();
  const [catalogOpen, setCatalogOpen] = useState(false);

  const workspaceBase = `/${workspace.slug}`;

  function isActive(route: string): boolean {
    const fullRoute = `${workspaceBase}${route}`;
    if (route === "") return pathname === workspaceBase || pathname === `${workspaceBase}/`;
    return pathname.startsWith(fullRoute);
  }

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-[18px] h-[18px]" /> : <MessageSquare className="w-[18px] h-[18px]" />;
  }

  return (
    <>
      <div className="w-[52px] min-w-[52px] h-full flex flex-col items-center py-3 gap-1 border-r"
        style={{ background: "var(--rail-bg)", borderColor: "var(--sidebar-hover)" }}
      >
        {/* Workspace switcher */}
        <WorkspaceSwitcher activeWorkspace={workspace} />

        {/* AI Home (platform) */}
        <div className="mt-3">
          <a
            href={workspaceBase}
            title="AI Home"
            className={cn(
              "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
              isActive("")
                ? "border-2"
                : "hover:opacity-80"
            )}
            style={{
              color: isActive("") ? "var(--rail-icon-active)" : "var(--rail-icon)",
              background: isActive("") ? "var(--sidebar-bg)" : "transparent",
              borderColor: isActive("") ? "var(--rail-icon-active)" : "transparent",
            }}
          >
            <MessageSquare className="w-[18px] h-[18px]" />
          </a>
        </div>

        {/* Divider */}
        <div className="w-5 h-px my-1" style={{ background: "var(--sidebar-hover)" }} />

        {/* Installed apps */}
        {installedApps.map((app) => (
          <a
            key={app.id}
            href={`${workspaceBase}${app.route}`}
            title={app.name}
            className={cn(
              "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
              isActive(app.route)
                ? "border-2"
                : "hover:opacity-80"
            )}
            style={{
              color: isActive(app.route) ? "var(--rail-icon-active)" : "var(--rail-icon)",
              background: isActive(app.route) ? "var(--sidebar-bg)" : "transparent",
              borderColor: isActive(app.route) ? "var(--rail-icon-active)" : "transparent",
            }}
          >
            {getIcon(app.icon)}
          </a>
        ))}

        {/* Add app button */}
        <button
          onClick={() => setCatalogOpen(true)}
          title="Add app"
          className="w-[38px] h-[38px] rounded-[10px] border-2 border-dashed flex items-center justify-center mt-1 hover:opacity-80 transition-opacity"
          style={{ borderColor: "var(--rail-icon)", color: "var(--rail-icon)" }}
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <a
          href={`${workspaceBase}/settings`}
          title="Settings"
          className={cn(
            "w-[38px] h-[38px] rounded-[10px] flex items-center justify-center transition-all duration-150",
            isActive("/settings") ? "border-2" : "hover:opacity-80"
          )}
          style={{
            color: isActive("/settings") ? "var(--rail-icon-active)" : "var(--rail-icon)",
            background: isActive("/settings") ? "var(--sidebar-bg)" : "transparent",
            borderColor: isActive("/settings") ? "var(--rail-icon-active)" : "transparent",
          }}
        >
          <Settings className="w-[18px] h-[18px]" />
        </a>

        {/* User avatar */}
        <div className="w-[30px] h-[30px] rounded-full bg-foreground mt-1 cursor-pointer" title="User settings" />
      </div>

      {catalogOpen && (
        <AppCatalogModal onClose={() => setCatalogOpen(false)} />
      )}
    </>
  );
}
```

- [ ] **Step 4: Create app sidebar**

Create `src/components/shell/app-sidebar.tsx`:

```typescript
"use client";

import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace/context";

export function AppSidebar() {
  const pathname = usePathname();
  const { workspace, installedApps } = useWorkspace();

  const workspaceBase = `/${workspace.slug}`;

  // Determine which app is active
  const activeApp = installedApps.find((app) =>
    pathname.startsWith(`${workspaceBase}${app.route}`)
  );

  // AI Home and Settings have no sidebar
  if (!activeApp || !activeApp.hasSidebar) {
    // Check if we're on settings or the root (AI Home)
    if (pathname === workspaceBase || pathname === `${workspaceBase}/` || pathname.startsWith(`${workspaceBase}/settings`)) {
      return null;
    }
  }

  if (!activeApp) return null;

  // Each app will eventually have its own sidebar content.
  // For now, render a placeholder sidebar for each app.
  return (
    <div
      className="w-[220px] min-w-[220px] h-full border-r flex flex-col overflow-y-auto"
      style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-hover)" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2
          className="font-semibold text-[15px]"
          style={{ color: "var(--sidebar-text)" }}
        >
          {activeApp.name}
        </h2>
      </div>

      <div className="px-4 py-2">
        <p className="text-xs" style={{ color: "var(--sidebar-text-muted)" }}>
          {activeApp.name} sidebar content will be implemented in the {activeApp.name} sub-project.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create app catalog modal**

Create `src/components/shell/app-catalog-modal.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import * as LucideIcons from "lucide-react";
import { X, MessageSquare } from "lucide-react";
import type { AppManifest } from "@/lib/apps/types";

interface AppCatalogModalProps {
  onClose: () => void;
}

export function AppCatalogModal({ onClose }: AppCatalogModalProps) {
  const { workspace, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [allApps, setAllApps] = useState<AppManifest[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/apps/registry")
      .then((r) => r.json())
      .then((data) => setAllApps(data.apps || []));
  }, []);

  const installedIds = new Set(installedApps.map((a) => a.id));

  function getIcon(iconName: string) {
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />;
  }

  async function installApp(appId: string) {
    setInstalling(appId);
    await fetch(`/api/workspaces/${workspace.id}/apps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appId }),
    });
    // Reload page to reflect changes
    window.location.reload();
  }

  const builtIn = allApps.filter((a) => a.category === "built_in");
  const addOns = allApps.filter((a) => a.category === "add_on");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-popover rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">App Catalog</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {builtIn.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Built-in
              </h3>
              <div className="space-y-2">
                {builtIn.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    installed={installedIds.has(app.id)}
                    installing={installing === app.id}
                    canInstall={isOwner}
                    onInstall={() => installApp(app.id)}
                    getIcon={getIcon}
                  />
                ))}
              </div>
            </div>
          )}

          {addOns.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Add-ons
              </h3>
              <div className="space-y-2">
                {addOns.map((app) => (
                  <AppRow
                    key={app.id}
                    app={app}
                    installed={installedIds.has(app.id)}
                    installing={installing === app.id}
                    canInstall={isOwner}
                    onInstall={() => installApp(app.id)}
                    getIcon={getIcon}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppRow({
  app,
  installed,
  installing,
  canInstall,
  onInstall,
  getIcon,
}: {
  app: AppManifest;
  installed: boolean;
  installing: boolean;
  canInstall: boolean;
  onInstall: () => void;
  getIcon: (name: string) => React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border">
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
        {getIcon(app.icon)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{app.name}</div>
        <div className="text-xs text-muted-foreground truncate">{app.description}</div>
      </div>
      {installed ? (
        <span className="text-xs text-muted-foreground px-3 py-1 bg-muted rounded-full">
          Installed
        </span>
      ) : canInstall ? (
        <button
          onClick={onInstall}
          disabled={installing}
          className="text-xs font-medium px-3 py-1 bg-foreground text-background rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {installing ? "..." : "Install"}
        </button>
      ) : (
        <span className="text-xs text-muted-foreground">Ask owner</span>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create workspace layout**

Create `src/app/[workspaceSlug]/layout.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { WorkspaceProvider } from "@/lib/workspace/context";
import { ShellThemeProvider } from "@/components/shell/theme-provider";
import { IconRail } from "@/components/shell/icon-rail";
import { AppSidebar } from "@/components/shell/app-sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Resolve workspace by slug
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .single();

  if (!workspace) notFound();

  // Verify membership
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    redirect("/");
  }

  // Get installed apps
  const { data: appsData } = await supabase
    .from("workspace_apps")
    .select(`
      app_id,
      app_registry:app_id (id, name, icon, route, has_sidebar, category, sort_order)
    `)
    .eq("workspace_id", workspace.id);

  const installedApps = (appsData || [])
    .map((a) => a.app_registry as any)
    .filter(Boolean)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((a: any) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      route: a.route,
      hasSidebar: a.has_sidebar,
      category: a.category,
    }));

  // Get members
  const { data: membersData } = await supabase
    .from("workspace_members")
    .select(`
      id, user_id, role, joined_at,
      profiles:user_id (full_name, email, avatar_url)
    `)
    .eq("workspace_id", workspace.id);

  const members = (membersData || []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    fullName: (m.profiles as any)?.full_name || "",
    email: (m.profiles as any)?.email || "",
    avatarUrl: (m.profiles as any)?.avatar_url || null,
    role: m.role as "owner" | "member",
    joinedAt: m.joined_at,
  }));

  // Set active workspace cookie
  const cookieStore = await cookies();
  cookieStore.set("active_workspace_id", workspace.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  const contextValue = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      avatarUrl: workspace.avatar_url,
      ownerId: workspace.owner_id,
      theme: workspace.theme || "default",
      createdAt: workspace.created_at,
    },
    membership: { role: membership.role as "owner" | "member" },
    installedApps,
    members,
  };

  return (
    <WorkspaceProvider value={contextValue}>
      <ShellThemeProvider themeId={workspace.theme || "default"}>
        <div className="flex h-screen bg-background">
          <IconRail />
          <AppSidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </ShellThemeProvider>
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/ src/app/[workspaceSlug]/layout.tsx
git commit -m "feat: three-zone shell layout with icon rail, app sidebar, workspace switcher"
```

---

### Task 10: Workspace Pages — AI Home + Placeholder App Pages

**Files:**
- Create: `src/app/[workspaceSlug]/page.tsx`
- Create: `src/app/[workspaceSlug]/messages/page.tsx`
- Create: `src/app/[workspaceSlug]/projects/page.tsx`
- Create: `src/app/[workspaceSlug]/files/page.tsx`
- Create: `src/app/[workspaceSlug]/email-marketing/page.tsx`
- Create: `src/app/[workspaceSlug]/reports/page.tsx`
- Create: `src/app/[workspaceSlug]/github-repos/page.tsx`
- Create: `src/app/[workspaceSlug]/settings/page.tsx`

- [ ] **Step 1: Create AI Home page**

Create `src/app/[workspaceSlug]/page.tsx`:

```typescript
"use client";

import { useWorkspace } from "@/lib/workspace/context";

export default function AIHomePage() {
  const { workspace } = useWorkspace();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">What&apos;s on the agenda?</h1>

        <div className="border border-border rounded-xl p-4 bg-card">
          <input
            type="text"
            placeholder="Ask anything"
            className="w-full bg-transparent text-sm focus:outline-none"
          />
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
              {workspace.name}
            </span>
            <button className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
              Attach
            </button>
            <button className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1">
              Mention
            </button>
          </div>
        </div>

        <div className="space-y-1 text-left max-w-lg mx-auto">
          {[
            "What should I work on today?",
            "Check my recent emails",
            "Summarize my upcoming calendar events",
            "What should I focus on this week?",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border-b border-border last:border-0"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create placeholder app pages**

Create each placeholder page. They all follow the same pattern — a centered message indicating the app will be implemented in its own sub-project.

Create `src/app/[workspaceSlug]/messages/page.tsx`:

```typescript
export default function MessagesPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Messages</h1>
        <p className="text-muted-foreground text-sm">Team channels and direct messages — coming in sub-project 2.</p>
      </div>
    </div>
  );
}
```

Create `src/app/[workspaceSlug]/projects/page.tsx`:

```typescript
export default function ProjectsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Projects</h1>
        <p className="text-muted-foreground text-sm">Kanban boards and task management — coming in sub-project 3.</p>
      </div>
    </div>
  );
}
```

Create `src/app/[workspaceSlug]/files/page.tsx`:

```typescript
export default function FilesPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Files</h1>
        <p className="text-muted-foreground text-sm">Documents, notes, and file storage — coming in sub-project 4.</p>
      </div>
    </div>
  );
}
```

Create `src/app/[workspaceSlug]/email-marketing/page.tsx`:

```typescript
export default function EmailMarketingPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Email Marketing</h1>
        <p className="text-muted-foreground text-sm">Existing email platform — will be migrated to workspace scope.</p>
      </div>
    </div>
  );
}
```

Create `src/app/[workspaceSlug]/reports/page.tsx`:

```typescript
export default function ReportsPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-muted-foreground text-sm">Existing reports — will be migrated to workspace scope.</p>
      </div>
    </div>
  );
}
```

Create `src/app/[workspaceSlug]/github-repos/page.tsx`:

```typescript
export default function GitHubReposPage() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold">GitHub Repos</h1>
        <p className="text-muted-foreground text-sm">Existing repos — will be migrated to workspace scope.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create settings page**

Create `src/app/[workspaceSlug]/settings/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useWorkspace, useIsOwner } from "@/lib/workspace/context";
import { THEMES } from "@/lib/workspace/themes";

export default function SettingsPage() {
  const { workspace, membership, members, installedApps } = useWorkspace();
  const isOwner = useIsOwner();
  const [activeTab, setActiveTab] = useState<"members" | "apps" | "workspace">("members");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-10">
        <h1 className="text-xl font-semibold mb-6">Workspace Settings</h1>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(["members", "apps", "workspace"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {isOwner && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Invite members</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to invite"
                    className="flex-1 h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button className="h-10 px-4 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90">
                    Invite
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-3">Current members</h3>
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                      {member.fullName?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{member.fullName || member.email}</div>
                      <div className="text-xs text-muted-foreground">{member.email}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Apps tab */}
        {activeTab === "apps" && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Installed apps</h3>
            {installedApps.map((app) => (
              <div key={app.id} className="flex items-center gap-3 p-3 border border-border rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                  <span className="text-xs">{app.name[0]}</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{app.name}</div>
                </div>
                {isOwner && (
                  <button className="text-xs text-destructive hover:underline">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Workspace tab */}
        {activeTab === "workspace" && isOwner && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Workspace name</label>
              <input
                type="text"
                defaultValue={workspace.name}
                className="w-full h-10 px-3 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <div className="grid grid-cols-4 gap-2">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      workspace.theme === theme.id
                        ? "border-foreground ring-1 ring-foreground"
                        : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex gap-1 mb-2">
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.railBg, border: "1px solid #ddd" }} />
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.accent }} />
                      <div className="w-4 h-4 rounded-sm" style={{ background: theme.sidebarBg, border: "1px solid #ddd" }} />
                    </div>
                    <div className="text-xs font-medium">{theme.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-medium text-destructive mb-2">Danger zone</h3>
              <button className="text-sm text-destructive border border-destructive/30 px-4 py-2 rounded-lg hover:bg-destructive/10 transition-colors">
                Delete workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[workspaceSlug]/
git commit -m "feat: AI home, settings, and placeholder app pages for workspace shell"
```

---

### Task 11: Update Login Page + Profile API

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/app/api/profile/route.ts`

- [ ] **Step 1: Update login page copy**

In `src/app/(auth)/login/page.tsx`, change the bottom text from:

```typescript
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Only pre-approved emails can access this platform
        </p>
```

to:

```typescript
        <p className="text-[11px] text-muted-foreground/50 text-center">
          Create a workspace or join your team
        </p>
```

Also change the subtitle from `"Sign in to your workspace"` to `"Sign in or create an account"`.

- [ ] **Step 2: Create profile API route**

Create `src/app/api/profile/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profile — get current user profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile });
}

// PATCH /api/profile — update current user profile
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.full_name !== undefined) updates.full_name = body.full_name;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ profile: data });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/api/profile/
git commit -m "feat: update login copy for open signup, add profile API"
```

---

### Task 12: Remove Old Dashboard Routes

**Files:**
- Delete: `src/app/(dashboard)/` directory
- Delete: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Remove old dashboard route group**

```bash
rm -rf src/app/\(dashboard\)/
```

- [ ] **Step 2: Remove old sidebar component**

```bash
rm src/components/layout/sidebar.tsx
```

- [ ] **Step 3: Verify app still builds**

```bash
npm run dev
```

Check that navigating to `http://localhost:3000` properly redirects through the new flow (login → onboarding → workspace).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old dashboard routes and sidebar, replaced by workspace shell"
```

---

### Task 13: End-to-End Verification

No new files. This is a manual verification task.

- [ ] **Step 1: Test full signup → onboarding → workspace flow**

1. Start dev server: `npm run dev`
2. Open `http://localhost:3000` — should redirect to `/login`
3. Sign up with a new email (or Google OAuth)
4. After auth, should redirect to `/onboarding` (since no workspaces)
5. Complete wizard: name workspace, set name, optionally invite
6. Should land in `/{workspaceSlug}` with the AI Home page
7. Icon rail should show: workspace avatar, AI Home icon, divider, Messages/Projects/Files icons, "+" button, settings, user avatar

- [ ] **Step 2: Test workspace settings**

1. Click settings icon in icon rail
2. Members tab: verify yourself as "owner"
3. Apps tab: verify Messages, Projects, Files installed
4. Workspace tab: verify name, theme selector, delete button

- [ ] **Step 3: Test app install/uninstall**

1. Click "+" button in icon rail
2. App catalog modal should show all 7 apps (3 installed, 4 available)
3. Install "Reports" — icon should appear on rail after page reload
4. Navigate to `/{slug}/reports` — should show placeholder page

- [ ] **Step 4: Test workspace switcher**

1. Click workspace avatar (top-left of icon rail)
2. Should show dropdown with current workspace + "Create new workspace"
3. Click "Create new workspace" — should go to `/onboarding`
4. Create a second workspace
5. Click avatar again — should show both workspaces
6. Switch between them — URL and icon rail should update

- [ ] **Step 5: Commit final state**

```bash
git add -A
git commit -m "feat: complete workspace foundation — shell layout, onboarding, settings, app system"
```
