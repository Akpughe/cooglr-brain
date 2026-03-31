# 500Claw Workspace, Apps & Team Collaboration — Design Spec

**Sub-project 1** of the 500Claw platform redesign.
**Date:** 2026-03-31
**Status:** Draft

---

## Overview

Transform 500Claw from a single-user dashboard into a multi-workspace, team-first platform inspired by Core (Notion + Linear + Slack hybrid). This sub-project builds the **foundation layer**: workspaces, team membership, the app system, and the new shell layout. Individual apps (Messages, Projects, Files, etc.) are separate sub-projects that plug into this foundation.

### What's In Scope

- Workspace CRUD (create, rename, delete, transfer ownership)
- Multi-workspace support with workspace switcher (one active at a time)
- Member invite/join/remove with Owner + Member roles
- New shell layout: icon rail + app sidebar + main content (three-zone)
- App registry system (platform / built-in / add-on tiers)
- App install/uninstall per workspace (the "+" icon rail button)
- Workspace settings modal (Members, Apps, Workspace Settings tabs)
- User settings (profile, connected accounts, theme, appearance)
- Onboarding wizard (welcome → name workspace → profile → invite → land in workspace)
- Theme system: preset themes per workspace, light/dark mode
- Database migrations for all new tables + workspace_id on existing tables
- Refactored auth: open signup, workspace-aware middleware

### What's Deferred

- Individual app implementations (Messages, Projects, Files, etc.) — each gets its own spec
- Knowledge graph / indexing layer
- AI agent home screen functionality
- App marketplace UI beyond the basic catalog modal

---

## Architecture Approach

**Big Bang Migration.** The app is not yet deployed to production and has no real users. Rather than gradually wrapping existing features, we add `workspace_id` to every existing table, rebuild the shell layout from scratch, and refactor auth to be workspace-aware in one pass. Existing data gets migrated to a "Default Workspace" per user.

---

## Database Schema

### New Tables

#### `workspaces`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | Default: `gen_random_uuid()` |
| `name` | varchar(50) | Display name |
| `slug` | varchar(50), unique | URL-friendly identifier |
| `avatar_url` | text, nullable | Workspace icon |
| `owner_id` | uuid (FK → auth.users) | Creator, transferable |
| `theme` | varchar(30), default 'default' | Preset theme key |
| `created_at` | timestamptz | Default: `now()` |
| `updated_at` | timestamptz | Default: `now()` |

#### `workspace_members`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `user_id` | uuid (FK → auth.users) | |
| `role` | varchar, check in ('owner', 'member') | |
| `joined_at` | timestamptz | Default: `now()` |
| Unique constraint | `(workspace_id, user_id)` | |

#### `workspace_invites`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `email` | varchar(255) | Invited email |
| `invited_by` | uuid (FK → auth.users) | |
| `role` | varchar, default 'member' | Role on acceptance |
| `status` | varchar, check in ('pending', 'accepted', 'expired') | |
| `token` | varchar, unique | HMAC-signed invite token |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | Default: `now() + interval '7 days'` |

#### `app_registry`

System table seeded from code. Not user-editable.

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | e.g., `messages`, `projects`, `email-marketing` |
| `name` | varchar | Display name |
| `description` | text | One-line description |
| `icon` | varchar | Lucide icon name |
| `category` | varchar, check in ('built_in', 'add_on') | |
| `default_installed` | boolean | Auto-install on workspace creation |
| `sort_order` | int | Position in icon rail |
| `has_sidebar` | boolean | Whether app renders a sidebar |
| `route` | varchar | Path within workspace (e.g., `/messages`) |
| `setup_required` | boolean | Needs OAuth/config before use |

#### `workspace_apps`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `workspace_id` | uuid (FK → workspaces) | ON DELETE CASCADE |
| `app_id` | varchar (FK → app_registry) | |
| `installed_by` | uuid (FK → auth.users) | |
| `installed_at` | timestamptz | Default: `now()` |
| Unique constraint | `(workspace_id, app_id)` | |

### Modifications to Existing Tables

All existing data tables receive a new column:

```sql
ALTER TABLE <table> ADD COLUMN workspace_id uuid REFERENCES workspaces(id);
```

Affected tables:
- `tickets`, `ticket_comments`
- `chat_sessions`, `chat_messages`
- `email_providers`, `email_templates`, `email_audiences`, `email_contacts`, `email_campaigns`, `email_events`, `email_unsubscribes`
- `saved_reports`, `report_sessions`, `report_runs`
- `database_connections`
- `activity_log`, `audit_log`

**NOT workspace-scoped** (these are user-level, not workspace-level):
- `external_accounts` — OAuth connections (GitHub, Google) belong to the user, not a workspace. A user's Gmail connection is available across all their workspaces.
- `profiles` — user profile data (name, avatar) is global. The `role` and `department` columns are removed (roles now live in `workspace_members`).

### `profiles` Table Changes

- Remove `role` column (replaced by `workspace_members.role`)
- Remove `department` column (no longer needed — departments were tied to the old allowlist model)
- Keep: `id`, `email`, `full_name`, `avatar_url`, `created_at`, `updated_at`

### RLS Policy Changes

Current pattern:
```sql
CREATE POLICY "users see own data" ON table
  USING (user_id = auth.uid());
```

New pattern:
```sql
CREATE POLICY "members see workspace data" ON table
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
    )
  );
```

Write policies additionally check role where needed (e.g., only owners can delete workspace-level resources).

### Data Migration Strategy

Single migration that:
1. Creates all new tables
2. Adds `workspace_id` (nullable) to all existing tables
3. For each existing user: creates a "Default Workspace", assigns them as owner, creates membership record, installs default built-in apps
4. Sets all existing data rows' `workspace_id` to the user's default workspace
5. Alters `workspace_id` to NOT NULL on all tables
6. Drops the `allowed_emails` table (replaced by open signup + workspace invites)
7. Updates all RLS policies
8. Seeds `app_registry` with initial app definitions

---

## Auth & Routing

### Signup Flow

1. Open signup — anyone can register via Google OAuth or email/password
2. No allowlist gating. The `allowed_emails` table is removed.
3. New users with no workspaces are redirected to `/onboarding`
4. Existing users with workspaces land in their active workspace

### URL Structure

```
/login                              → login page
/signup                             → signup page (if separate from login)
/onboarding                         → workspace creation wizard
/invite/{token}                     → accept invite, join workspace, redirect in

/{workspaceSlug}                    → AI Home (platform)
/{workspaceSlug}/messages           → Messages app
/{workspaceSlug}/projects           → Projects app
/{workspaceSlug}/files              → Files app
/{workspaceSlug}/settings           → Workspace + User settings
/{workspaceSlug}/email-marketing    → Add-on app
/{workspaceSlug}/reports            → Add-on app
/{workspaceSlug}/github-repos       → Add-on app

/api/workspaces                     → workspace CRUD
/api/workspaces/{id}/members        → member management
/api/workspaces/{id}/apps           → app install/uninstall
/api/workspaces/{id}/invites        → invite management
/api/apps/registry                  → list available apps
```

All existing API routes under `/api/` become workspace-scoped. The workspace ID is resolved from the request context (middleware injects it).

### Middleware Flow

On every request to `/{workspaceSlug}/*`:

1. Authenticate user (existing Supabase JWT check)
2. If no user → redirect to `/login`
3. Resolve workspace from URL slug
4. If workspace not found → 404
5. Check `workspace_members` for (workspace_id, user_id)
6. If not a member → 403 "You don't have access to this workspace"
7. Inject workspace + membership into request context
8. Continue to page/API handler

### Active Workspace Cookie

- Cookie name: `active_workspace_id`
- Set when user navigates to a workspace
- Used for redirecting `/` → `/{activeWorkspaceSlug}`
- If cookie is stale (workspace deleted, membership revoked) → fall back to first available workspace or `/onboarding`

### `useWorkspace` Client Hook

React context provider wrapping the `[workspaceSlug]/layout.tsx`:

```typescript
interface WorkspaceContext {
  workspace: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    theme: string;
  };
  membership: {
    role: 'owner' | 'member';
  };
  installedApps: Array<{
    id: string;
    name: string;
    icon: string;
    route: string;
    hasSidebar: boolean;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  }>;
}
```

Populated on layout mount via a single API call that joins workspace + membership + apps + members.

---

## Shell Layout

Three-zone layout replacing the current single collapsible sidebar.

### Zone 1: Icon Rail (52px, fixed)

Always visible. Contains:
- **Top:** Workspace avatar/initial (click → workspace switcher dropdown)
- **AI Home icon** (platform, always first)
- **Divider line**
- **Installed app icons** (dynamic, ordered by `sort_order`)
- **"+" button** (dashed border, opens app catalog modal)
- **Spacer**
- **Bottom:** Settings icon, user avatar (click → user settings)

Active app: highlighted with a border or background change.
Unread indicators: small badge dots on app icons when relevant.

### Zone 2: App Sidebar (220px, collapsible)

Changes content based on the active app:
- **Messages:** channels list, DMs list, "+" add channel
- **Projects:** project list, "+" create project
- **Files:** file tree, "My Files", "Shared with me"
- **AI Chat:** saved chat sessions, "+" new chat
- **Some apps skip it:** AI Home has no sidebar (full-width). Settings may skip it.

Smooth slide transition when switching apps.

### Zone 3: Main Content (fluid)

- **Top bar:** Context header (channel name, project name, etc.) + action buttons (notifications, search)
- **Body:** App-specific content
- **Optional right panel:** AI chat panel can slide in from the right on any app (contextual assistant)

### Responsive Behavior

- Desktop (>1024px): All three zones visible
- Tablet (768-1024px): Icon rail visible, app sidebar collapsed by default (toggle open)
- Mobile (<768px): Icon rail becomes bottom tab bar, app sidebar hidden (slide-in drawer)

---

## Onboarding Wizard

Full-screen flow, no workspace shell visible. Clean, centered, step-by-step with progress indicator.

### Step 1 — Welcome

- 500Claw logo
- "Your all-in-one workspace for teams"
- "Get Started" CTA (black button, like Core)
- Terms/Privacy links

### Step 2 — Name Your Workspace

- Text input (max 50 chars), placeholder: "e.g., Acme Inc."
- Auto-generates slug (shown below input, editable)
- Character count
- Right side: live preview of icon rail building up
- "Next" button

### Step 3 — Your Profile

- Display name input (pre-filled from OAuth if available)
- Avatar upload (optional, shows initial fallback)
- "Next" button

### Step 4 — Invite Your Team

- Email input with "Add" button, accumulates a list
- Role selector (Member, fixed for now)
- "Skip for now" link
- "Send Invites" button

### Step 5 — Landing

- "Sending invitations..." loading state
- Redirect to `/{workspaceSlug}` (AI Home)

### Invite Acceptance Flow

When an invited user clicks the invite link (`/invite/{token}`):
1. Validate token (not expired, status is 'pending')
2. If user is already authenticated → join workspace immediately, redirect to `/{workspaceSlug}`
3. If user is not authenticated but has an account → redirect to `/login?redirect=/invite/{token}`
4. If user has no account → redirect to `/signup?redirect=/invite/{token}` (signup, then auto-join)
5. On successful join: create `workspace_members` row, update invite status to 'accepted'

### What Onboarding Creates

1. `workspaces` row with name, slug, owner_id
2. `workspace_members` row (owner role)
3. `workspace_apps` rows for all `default_installed` apps from registry
4. `workspace_invites` rows for each invited email
5. Sends invite emails via Resend
6. Sets `active_workspace_id` cookie

---

## Workspace Settings Modal

Triggered from settings icon in icon rail. Three tabs.

### Tab 1 — Members

- Invite input: email field + role dropdown (Member) + "Invite" button
- Pending invites section: email, sent date, "Resend" / "Revoke" actions
- Current members list: avatar, name, email, role badge, joined date
- Owner sees hover-reveal "Remove" button on members
- Cannot remove yourself if you're the only owner

### Tab 2 — Apps

- List of installed apps: icon, name, description, remove button (red)
- Platform apps (AI Home, Settings) are not shown (can't be removed)
- "Browse more apps" link → opens app catalog modal
- Only owners can install/remove apps

### Tab 3 — Workspace Settings

- Workspace name (editable input)
- Workspace avatar (upload/change)
- Workspace slug (editable, uniqueness validation)
- Created date (read-only)
- Transfer ownership: select from current members, confirm dialog
- Danger zone: "Delete workspace" with typed-name confirmation

---

## User Settings

Separate modal, triggered from user avatar in icon rail. Not workspace-scoped.

- **Profile:** display name, avatar, email (read-only)
- **Connected accounts:** list of connected services (Gmail, Google Drive, iCloud, GitHub). Each shows: service icon, account name, email, "Connected" badge. "+ Add another account" button. These are user-level — available across all workspaces.
- **Workspace data sources:** list of database/service connections scoped to the active workspace (PostgreSQL, MySQL, ClickHouse, etc.). Each shows: type icon, connection name, host, status. "+ Add data source" button. These are workspace-level — all workspace members can query them.
- **Appearance:** light / dark / system toggle. Affects content area. User-level preference stored in `profiles`.

Note: Theme selection lives in **Workspace Settings → Workspace tab**, not User Settings. The workspace owner sets the theme for the workspace (all members see the same theme). This helps teams visually identify their workspaces consistently.

---

## App Registry & Install System

### Three Tiers

| Tier | Behavior | Examples |
|------|----------|---------|
| **Platform** | Always present. Not in catalog. Cannot be uninstalled. | AI Home, Settings, User Profile |
| **Built-in** | Auto-installed on workspace creation. Can be uninstalled. Always available to re-install. | Messages, Projects, Files |
| **Add-on** | Not installed by default. Discovered via app catalog. May require setup (OAuth, config). | Email Marketing, Reports, GitHub Repos, Calendar |

### App Manifest (in code)

```typescript
interface AppManifest {
  id: string;              // "messages"
  name: string;            // "Messages"
  description: string;     // "Team channels and direct messages"
  icon: string;            // "MessageSquare" (Lucide icon name)
  category: 'built_in' | 'add_on';
  defaultInstalled: boolean;
  sortOrder: number;
  hasSidebar: boolean;
  route: string;           // "/messages"
  setupRequired: boolean;
}
```

Manifests are defined in `src/lib/apps/registry.ts` and seeded into the `app_registry` table via migration.

### Initial App Registry

| ID | Name | Category | Default Installed | Sort Order | Sidebar | Setup Required |
|----|------|----------|-------------------|------------|---------|----------------|
| `messages` | Messages | built_in | true | 1 | true | false |
| `projects` | Projects | built_in | true | 2 | true | false |
| `files` | Files | built_in | true | 3 | true | false |
| `email-marketing` | Email Marketing | add_on | false | 10 | true | true (needs email provider) |
| `reports` | Reports | add_on | false | 11 | true | false |
| `github-repos` | GitHub Repos | add_on | false | 12 | true | true (needs GitHub OAuth) |
| `calendar` | Calendar | add_on | false | 13 | true | true (needs Google OAuth) |

### App Catalog Modal (the "+" button)

- Grid of app cards grouped by category (Built-in, Add-ons)
- Each card: icon, name, description, "Install" / "Installed" button
- Installing creates `workspace_apps` row → icon appears on rail
- If `setup_required`, after install show a setup nudge ("Connect your GitHub account to get started")

### App Route Guard

In `[workspaceSlug]/layout.tsx`, when rendering an app page:
- Check if the app is installed in the current workspace
- If not → show "This app isn't installed" page with an "Install" button (owner) or "Ask your workspace owner to install this app" (member)

### Migration Path for Existing Features

| Current Feature | New App ID | Tier | Notes |
|-----------------|-----------|------|-------|
| AI Chat (OpenClaw) | — | Platform (AI Home) | Always present, top of icon rail |
| Tickets | `projects` | Built-in | Evolves into Kanban project board |
| GitHub Repos | `github-repos` | Add-on | Keeps OAuth flow |
| Reports | `reports` | Add-on | Keeps report builder + sessions |
| Email Marketing | `email-marketing` | Add-on | Keeps full campaign system |
| Settings | — | Platform | Becomes workspace/user settings modals |
| Admin | — | Platform | Absorbed into workspace Members tab |

---

## Theme System

### Preset Themes

Each theme defines colors for the icon rail and app sidebar only. Main content area stays neutral.

```typescript
interface Theme {
  id: string;
  name: string;
  iconRailBg: string;
  iconRailIcon: string;
  iconRailIconActive: string;
  sidebarBg: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarHover: string;
  sidebarActive: string;
  accentColor: string;
}
```

Ship with 8-10 presets:
- **Default** — light gray rail, white sidebar
- **Warm Earth** — cream/burnt orange (current 500Claw identity)
- **Midnight** — dark navy rail, dark sidebar
- **Ocean** — blue tones
- **Forest** — green tones
- **Berry** — purple tones
- **Monochrome** — black rail, white sidebar
- **Sunset** — warm gradient feel

### Scope

- Theme applies per-workspace (stored in `workspaces.theme`)
- Helps users visually distinguish between workspaces
- Dark mode is a separate system-level toggle affecting the content area
- Themes work in both light and dark mode

### Implementation

CSS custom properties scoped to the shell:
```css
.shell[data-theme="warm-earth"] {
  --rail-bg: #f5f2ed;
  --rail-icon: #78716c;
  --rail-icon-active: #c2410c;
  --sidebar-bg: #faf8f5;
  --sidebar-text: #1c1917;
  --sidebar-muted: #a8a29e;
  --sidebar-hover: #e7e0d5;
  --sidebar-active: #f5f2ed;
  --accent: #c2410c;
}
```

---

## Workspace Switcher

### Trigger

Click workspace avatar in icon rail (top-left corner).

### Dropdown Contents

- All workspaces the user belongs to: avatar/initial, name, role badge
- Active workspace: checkmark indicator
- Divider
- "Create new workspace" button

### Behavior

- Select workspace → update `active_workspace_id` cookie → navigate to `/{newSlug}`
- If the same app exists in the new workspace, stay on that app. Otherwise, go to AI Home.
- Smooth page transition (not hard reload)
- Icon rail re-renders with new workspace's installed apps and theme

### Edge Cases

- User removed from active workspace → middleware redirect to next available workspace or `/onboarding`
- User's only workspace deleted → redirect to workspace creation flow
- Invite accepted → workspace appears in switcher immediately (no refresh needed if using real-time subscription)

---

## Component Architecture

### File Structure

```
src/app/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── callback/route.ts
├── onboarding/
│   └── page.tsx
├── invite/[token]/
│   └── page.tsx
├── [workspaceSlug]/
│   ├── layout.tsx                  ← Shell (icon rail + sidebar + main)
│   ├── page.tsx                    ← AI Home
│   ├── messages/page.tsx
│   ├── projects/page.tsx
│   ├── files/page.tsx
│   ├── settings/page.tsx
│   ├── email-marketing/page.tsx
│   ├── reports/page.tsx
│   └── github-repos/page.tsx
├── api/
│   ├── workspaces/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── members/route.ts
│   │       ├── apps/route.ts
│   │       └── invites/route.ts
│   ├── apps/
│   │   └── registry/route.ts
│   └── ... (existing routes, now workspace-scoped)

src/components/
├── shell/
│   ├── icon-rail.tsx
│   ├── app-sidebar.tsx
│   ├── workspace-switcher.tsx
│   ├── app-catalog-modal.tsx
│   └── theme-provider.tsx
├── onboarding/
│   ├── onboarding-wizard.tsx
│   ├── step-welcome.tsx
│   ├── step-workspace-name.tsx
│   ├── step-profile.tsx
│   └── step-invite.tsx
├── settings/
│   ├── workspace-settings-modal.tsx
│   ├── members-tab.tsx
│   ├── apps-tab.tsx
│   ├── workspace-tab.tsx
│   └── user-settings-modal.tsx
├── apps/
│   ├── messages-sidebar.tsx
│   ├── projects-sidebar.tsx
│   ├── files-sidebar.tsx
│   └── chat-sidebar.tsx
└── ui/                             ← existing shadcn components

src/lib/
├── workspace/
│   ├── context.tsx                 ← useWorkspace provider + hook
│   ├── middleware.ts               ← workspace-aware auth middleware
│   └── themes.ts                   ← theme definitions + utilities
├── apps/
│   ├── registry.ts                 ← app manifests
│   └── types.ts                    ← AppManifest type, AppContext type
└── ... (existing lib files)
```

### Key Patterns

- `[workspaceSlug]/layout.tsx` loads workspace data in a server component, passes to `WorkspaceProvider` client component
- `icon-rail.tsx` reads `installedApps` from context, renders dynamically
- `app-sidebar.tsx` receives the active app ID and renders the matching sidebar component
- Each app's sidebar component is lazy-loaded
- API routes use a `getWorkspaceContext(request)` helper that returns `{ workspace, membership }` or throws 403

---

## Data Sources & Connectors

Central to 500Claw's value: the more data users connect, the smarter the AI becomes. There are two levels of data connections:

### User-Level Connections (in `external_accounts`)

These belong to the user, available across all their workspaces:
- **Google OAuth** — Gmail sync (read/send emails), Google Drive (file access), Google Calendar (event sync)
- **iCloud** — email sync
- **GitHub** — repos, PRs, issues (already built)

Managed in User Settings → Connected Accounts. Uses existing OAuth flow + encrypted token storage in `external_accounts`.

### Workspace-Level Data Sources (in `database_connections`)

These belong to the workspace, accessible by all members:
- **PostgreSQL** — connect via URL or host/port/db/user/pass
- **MySQL** — same connection model
- **ClickHouse** — same connection model (already built)
- **Future:** MongoDB, Redis, Snowflake, BigQuery, Airtable, etc.

Managed in Workspace Settings or a dedicated section in User Settings (workspace-scoped). Uses existing `db-adapter.ts` pattern with encrypted credentials.

### Schema Changes

`database_connections` already exists but needs `workspace_id` added (it's in the existing table modification list). The existing `external_accounts` table stays user-scoped (no `workspace_id`).

### How This Feeds the AI

Both connection types provide data that the AI agent can query:
- User's connected Gmail → AI can search/summarize emails
- Workspace's PostgreSQL connection → AI can query business data
- User's Google Drive → AI can search/reference documents
- All of this builds toward the knowledge graph (deferred sub-project)

The connector architecture is already partially built. This sub-project ensures it's properly workspace-scoped and surfaced in the new settings UI. Full connector expansion (new providers, indexing pipeline, knowledge graph) is a future sub-project.

---

## Key Design Principles

1. **Data sources everywhere.** Every feature should consider how it feeds the knowledge graph. Connected accounts, uploaded files, workspace activity — all indexable.
2. **AI has full context.** The AI agent (platform-level) can reach into any installed app's data within the workspace.
3. **Apps are boundaries.** Each app owns its own data, sidebar, and routes. The shell provides the chrome. Apps communicate through the workspace context, not directly.
4. **Workspace is the container.** All data belongs to a workspace. All access checks go through workspace membership. Multi-tenancy is enforced at the database level via RLS.
5. **Theme the chrome, not the content.** Workspace themes color the icon rail and sidebar. Content areas stay neutral for readability.
