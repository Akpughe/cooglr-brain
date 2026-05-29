# 500Claw — Interface Description

> Canonical description of the application's current interface: what we're building, the navigation model, the design system, and every feature screen-by-screen. Written as the reference for a future UI revamp. Reflects the codebase as of 2026-05-29.

---

## 1. What we're building

500Claw is the internal operating platform for 500Chow: a **multi-workspace, team-first** application that folds the tools each department uses — chat, projects, docs, email campaigns, reports, source control, calendar — into one app behind a single login and one permission model. An AI **knowledge layer** sits across all of it so anyone can ask plain-language questions about the team's data (databases *and* documents) and get grounded, cited answers.

**Stack:** Next.js 16 (App Router) + React 19 · Supabase (Postgres + RLS + Google OAuth) · Tailwind CSS 4 + shadcn/ui · TipTap (docs) · Recharts (charts) · Resend (email) · Qdrant + Voyage + Fireworks/AI-SDK + Composio (knowledge layer) · OpenClaw Gateway (dashboard chat).

**Core model:** everything is scoped to a **workspace** (`/[workspaceSlug]/...`). Each workspace installs the **apps** it needs from a registry; the shell, sidebar, and AI adapt to what's installed. Postgres RLS enforces access once; every app inherits it.

---

## 2. Design system

**Typography:** Geist Sans (UI) and Geist Mono (code). Sizes `text-xs`→`text-4xl`; weights normal/medium/semibold/bold; tight tracking on headings.

**Color (warm, light + dark):**
- Light `:root`: background `#faf8f5` (warm-50), foreground `#1c1917`, card `#ffffff`, primary `#c2410c` (warm orange), destructive `#dc2626`, success `#16a34a`, warning `#d97706`, info `#2563eb`, muted `#f0ece6` / `#78716c`, border `#e7e0d5`. 5-step chart palette.
- Dark `.dark`: background `#0f0e0d`, foreground `#e7e5e4`, card `#1a1816`, primary `#ea580c`; palette shifted for dark.

**Radius:** sm 6 · md 8 · lg 12 · xl 16 · 2xl 20 · full (pills/avatars). **Shadows:** `shadow-surface` / `-md` / `-lg` (and warmer `shadow-warm*`). **Motion:** fade-in + slide-up (≈500ms) for page/modal entry; 150ms hover transitions; spin loaders; pulse/glow status; shimmer skeletons.

**Workspace themes** (`src/lib/workspace/themes.ts`): 8 themes — default, warm-earth, midnight, ocean, forest, berry, monochrome, sunset. Each sets shell CSS vars (`--rail-bg`, `--rail-icon`, `--rail-icon-active`, `--sidebar-bg/-text/-text-muted/-hover/-active`, `--shell-accent`). Applied by `ShellThemeProvider` from `workspace.theme`; chosen in Settings → Workspace as a 4-column swatch grid.

**Components:** shadcn/ui primitives (Button, Input, Textarea, Select, Dialog, Popover, Tabs, DropdownMenu, Tooltip, Badge, Card). Patterns: inputs focus `ring-2 ring-ring/50`, disabled `opacity-50`; buttons hover `opacity-90`, active `scale-[0.98]`; cards `rounded-lg border bg-card shadow-surface`; modals fixed `z-50` over `bg-black/40`.

---

## 3. Navigation model — the three-zone shell

`src/app/[workspaceSlug]/layout.tsx` loads the workspace, membership, installed apps, members, and presence once, then renders three zones (full height, flex):

**Zone 1 — Icon rail (52px, hidden on mobile)** · `src/components/shell/icon-rail.tsx`
- Top: **workspace switcher** (workspace-initial avatar, click to switch).
- **AI Home** (Sparkles), then a divider, then **installed app icons** (from `workspace_apps`, each a Lucide icon), then **+ Add app** (opens the catalog modal).
- Bottom: **Settings** (gear) and **user menu**.
- Active app: 3px `--shell-accent` dot on the left edge (slide-in). Hover: dark tooltip offset left.

**Zone 2 — App sidebar (220px, hidden on mobile)** · `src/components/shell/app-sidebar.tsx`
- Rendered only for apps with `hasSidebar` (Messages, Projects, Files, Email Marketing, Reports). Header = app name + a "+" to add items; body = the app's own sidebar content. Not shown for AI Home, Knowledge, or Settings.

**Zone 3 — Main content (flex-1)** · wrapped in `<AppRouteGuard>` (blocks routes for apps not installed). Mobile gets a bottom `<MobileNav>`.

**Cross-cutting:** a global `<CommandPalette>` (Cmd+K) and presence (workspace-level green dots) live at the layout. `WorkspaceProvider` (`src/lib/workspace/context.tsx`) exposes `workspace`, `membership` (owner|member), `installedApps`, `members`, `currentUserId` to all client components.

**App registry** (`src/lib/apps/registry.ts`): each app = `{ id, name, description, icon, category (built_in|add_on), defaultInstalled, sortOrder, hasSidebar, route, setupRequired }`. A workspace installs an app by inserting into `workspace_apps`; the rail/routes/onboarding render off this.

---

## 4. Entry flows

**Login** (`/login`): centered 380px card, ambient blurred gradients, "5C" badge, "Welcome to 500Claw". Single **Google OAuth** button → `/(auth)/callback` exchanges the code → redirects to the user's first workspace, or `/onboarding` if none. Middleware refreshes the session every request and manages the active-workspace cookie.

**Onboarding** (`/onboarding`, `onboarding-wizard.tsx`): 4 steps with a live workspace preview on the right.
1. **Welcome** — radial glow, "Get Started".
2. **Name workspace** — text input (50 chars) with live slug preview; preview pane shows the mini workspace (initial badge, #general/#random, your avatar).
3. **Profile** — display name.
4. **Invite team** — add emails as removable pills; "Send Invites & Continue" or "Skip". Finish → `POST /api/workspaces` (+ invites). Loading: "Setting up your workspace…".

**Invite** (`/invite/[token]`): states for invalid, expired, not-authenticated (Google sign-in, then auto-accept), wrong-email (sign out hint), and correct-email (auto-inserts membership, marks invite accepted, redirects into the workspace).

---

## 5. Features (app by app)

### 5.1 AI Home dashboard — `/[workspaceSlug]/`
Centered (max-w-2xl). Heading "What's on the agenda?"; an **input card** (2-row textarea "Ask anything…", toolbar: workspace selector pill, Attach, Mention, Send arrow); a list of 4 starter suggestions. Chat streams from the OpenClaw Gateway (SSE) via `src/components/chat/*`. History button top-right. **Status: partial** (chat works; deep cross-app actions are aspirational).

### 5.2 Messages (Slack-like) — `/[workspaceSlug]/messages/{c/[channelId]|dm/[conversationId]}`
**Sidebar:** CHANNELS (hash + name, "+" to create) and DIRECT MESSAGES (avatar + name + green presence dot, "+" opens the new-DM picker). **Channel/DM page:** h-12 header (hash + name + description), scrollable `MessageList` (date separators, infinite scroll, typing indicator), and `MessageComposer` (auto-grow textarea; Bold/Italic/Code/Link markdown buttons; Paperclip uploads shown as removable pills; Send arrow). Real-time delivery, typing (broadcast), presence, and read watermarks. **Status: complete.**

### 5.3 Projects (Linear-like) — `/[workspaceSlug]/projects/[projectId]`
**Sidebar:** PROJECTS list with task counts ("+" → create-project modal). **Top bar:** project name + Filter toggle; Board/List toggle; Add Column; AI-panel (Sparkles) toggle. **Filter bar:** assignee, priority, type, active-only. **Board:** horizontal Kanban columns (header + count + inline add), HTML5 drag-and-drop cards (title, assignee avatar, priority dot, due date). **List:** sortable table. **Task detail panel** (right, 300px): inline-editable title, status/priority/assignee/due, TipTap description, expand → full-screen view; auto-save. **AI chat panel** (right alt): placeholder. **Status: complete (AI panel is a placeholder).**

### 5.4 Files (Notion-like) — `/[workspaceSlug]/files/[fileId]`
**Sidebar:** new-page / upload actions; search; nested **file tree** (pages/folders/uploads, emoji or default icons, expand/collapse, context menu: rename / private↔public / delete); "Recently edited" pills. **Detail page:** meta bar (created-by · edited-ago · save status · privacy toggle). Renders by type: **page** → TipTap editor (formatting toolbar, headings, lists, tables, images, file embeds; 1s-debounce auto-save); **folder** → contents grid + upload; **file** → preview (image/PDF/video/audio inline, else download). Share modal (member picker). Realtime sidebar updates. **Status: complete.**

### 5.5 Email Marketing — `/[workspaceSlug]/email-marketing/{campaigns|templates|audiences|analytics|settings}`
**Onboarding:** connect provider (Resend), verify sender, configure → campaigns. **Sidebar:** campaigns, templates, audiences, analytics. **Campaigns:** list (name/status/sent/open%/click%) + create (subject, audience, template, schedule). **Templates:** library + block editor with preview. **Audiences:** segments with filter rules + contact import. **Analytics:** opens/clicks/bounces charts; export to Sheets/PDF. Webhook-driven open/click tracking (Resend). **Status: built.**

### 5.6 Reports — `/[workspaceSlug]/reports`
**Onboarding (3 steps):** welcome (feature cards) → connect DB (Postgres/MySQL/ClickHouse: type, name, connection string) → ready (example query, "Start Querying"). **Builder:** natural-language input → SQL → run → table + auto-chart (bar/line/pie) + report view; saved reports; export. **Note:** the SQL-generation step (`/api/reports/generate`) is now **re-pointed at the knowledge engine** — it plans SQL from the connection's knowledge map (and shows a "Build knowledge map" button if none exists). **Status: built; powered by the knowledge layer.**

### 5.7 Knowledge — `/[workspaceSlug]/knowledge`
The cross-cutting "ask your data" surface (`knowledge-view.tsx`). Brain header. **Ask box** → `/api/knowledge/ask` (auto-routes to a database or to documents), rendering: a "answered from database/documents" badge, the answer, an optional Recharts chart, collapsible SQL (with row count), and citation count. **Sources panel:** (a) **Databases** — list connections, "Build map" each; (b) **Documents** — "Index documents" + the content map (category badges with counts); (c) **Connected apps** — Gmail (Connect → consent window; Ingest → pull+understand), with Drive/GitHub/Slack staged. **Status: engine complete + live-verified; UI new.** See §6.

### 5.8 GitHub Repos & Calendar — placeholders
Both render `EmptyState` ("coming soon"). GitHub has backend API routes (repos/pulls/issues) but no UI; Calendar has neither yet. **Status: placeholder.**

### 5.9 Settings — `/[workspaceSlug]/settings`
Tabs (underline): **Members** (owner: invite by email, pending invites with revoke; all: member list with role badges, owner can remove), **Apps** (installed list; owner can remove; "browse more via +"), **Workspace** (owner: rename; 8-theme swatch grid; danger zone → delete with type-to-confirm). **App catalog modal** (`app-catalog-modal.tsx`, opened from the rail "+"): built-in vs add-on sections; Install / Installed / "Ask owner" per app.

---

## 6. The knowledge / understanding layer (cross-cutting)

This is the platform's differentiator and spans every data source. Principle: **"the map plans, the source digs."** Understanding is built at **ingest**, not per query.

- **Databases (structural map):** introspect a connection → LLM enriches tables/columns/relationships/metrics into a semantic map (stored as `knowledge_pages`). A question is **planned** against the map → grounded, identifier-quoted SQL → run **live, read-only** (hard SQL guard) → answer. Always current.
- **Documents & email (content map + RAG):** files (TipTap pages, uploads via Nuton for PDF/Office) and Gmail (via Composio) are, at ingest: **understood** (the LLM categorizes, extracts entities/topics, summarizes → a content map in `knowledge_pages`/`knowledge_index`) *and* **embedded** (Voyage → Qdrant `500Claw` collection, chunks tagged with category). A question **picks a category from the map**, then vector-searches scoped to it (falls back to all), and answers with citations. Reflects the last ingest (re-ingest to refresh).
- **Router:** `/api/knowledge/ask` classifies a question and routes to the DB map (SQL dig) or the content corpus (vector dig). One box, both worlds.
- **Connections:** managed via Composio (Gmail live; more toolkits staged); each connected source feeds the same understand→ingest pipeline.

**Tenancy:** all knowledge tables are workspace-scoped via RLS; Qdrant points carry `workspace_id` and every search filters on it; routes also do an explicit membership check.

---

## 7. Completeness snapshot (for the revamp)

| Area | State |
|---|---|
| Workspaces, shell, themes, app registry/catalog, invites | Complete |
| Messages, Projects, Files | Complete (Projects AI panel is a placeholder) |
| Email Marketing, Reports | Built (Reports now knowledge-powered) |
| Knowledge layer (DB + content + Gmail + router) | Engine complete & live-verified; UI new/minimal |
| AI Home dashboard | Partial (chat works; cross-app actions aspirational) |
| GitHub Repos | Backend routes only, no UI |
| Calendar | Placeholder |
| Mobile/responsive | Partial (bottom nav exists; many views desktop-first) |
| Tests | Knowledge layer covered (vitest); rest largely untested |

---

## 8. Notes for the revamp

- **Visual language** is warm/minimal (orange primary on warm neutrals), shadcn-based, with a per-workspace theming system already in place — preserve the theme-token architecture.
- **The shell (rail + sidebar + content) is the backbone**; apps plug in via the registry. Any revamp should keep "an app is a row" extensibility.
- **Knowledge is currently a separate app** but is conceptually cross-cutting — a revamp may want to surface "ask" globally (e.g., in the command palette / AI Home) rather than only under its own icon.
- **Desktop-first**; mobile is thin. Responsive is a known gap.
- **Placeholders to design or remove:** Calendar, GitHub Repos UI, the Projects AI panel.
- **Onboarding sets the tone** (live preview is a strength); the per-app onboardings (Email, Reports) are good patterns to unify.
