# 500Claw Platform — Product Overview

## What it is

500Claw is the internal operating platform for **500Chow**. It pulls the tools every department already uses — chat, projects, files, email campaigns, calendars, source control, analytics — into a single workspace that knows who you are, what team you're on, and what data you're allowed to see.

Each team gets its own workspace. Inside a workspace, members install only the apps they need, and a built-in AI assistant sits on top of all of them so anyone can ask "summarise my emails", "what's blocking the launch?", or "pull last week's signups" in plain language.

The goal: stop paying for (and context-switching between) Slack + Notion + Linear + Mailchimp + Looker + Google Calendar + GitHub. One login, one permission model, one assistant.

## How it's built

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Database & auth | Supabase (Postgres + RLS + OAuth) |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Editor | Tiptap 3 (rich-text pages, tables, task lists) |
| Charts | Recharts |
| Email send | Resend |
| AI transport | OpenClaw Gateway (internal WebSocket service over Tailscale) for streaming responses |
| AI models | Gemini for template generation; gateway-routed models for chat |
| Data warehouses | Postgres / MySQL / ClickHouse adapters for the Reports app |
| Secrets | AES-256-GCM encrypted OAuth tokens in `external_accounts` |

### Architectural ideas

- **Multi-tenant by workspace.** URL is `/[workspaceSlug]/...`. Every table is scoped by `workspace_id` and protected by Postgres RLS — a user in one workspace can never see another's rows.
- **Modular app registry.** Apps (Messages, Projects, Files, Email Marketing, Reports, Calendar, GitHub, Settings) are rows in `app_registry`. A workspace turns one on by inserting into `workspace_apps`. The sidebar, routes, and onboarding flows render off this registry — adding a new app is mostly a database row plus a route.
- **Shell + slot pattern.** `src/app/[workspaceSlug]/layout.tsx` loads workspace metadata, members, installed apps, and presence once; each app page renders inside that shell so navigation between apps is instant.
- **Streaming AI.** The home dashboard and the Projects side panel both use SSE-backed chat against the OpenClaw Gateway, so responses render token-by-token instead of blocking.

## How each 500Chow department gets value

### Marketing
- **Email Marketing app** — provider onboarding (Resend), audience import, template library, campaign send + history, webhook-driven open/click tracking.
- **Files app** — shared brand assets, briefs, and approved copy in versioned rich-text pages.
- **Reports app** — campaign performance dashboards without bothering data team.

*Replaces:* Mailchimp + Notion + a spreadsheet.

### Engineering
- **GitHub Repos app** — PRs and issues from the workspace, no tab-switching.
- **Projects app** — Kanban + list views, assignees, priorities, AI side panel for writing task descriptions and breakdowns.
- **Messages** — channels per squad, threaded discussions, file attachments.

*Replaces:* Linear + Slack standups + scattered GitHub tabs.

### Operations
- **Calendar** — Google Calendar (and soon iCloud) sync so ops sees scheduling alongside tasks.
- **Files** — SOPs, runbooks, vendor docs in one searchable place.
- **Messages** — alerting channels, incident threads.

### Data & Analytics
- **Reports app** — connects directly to Postgres, MySQL, or ClickHouse. Gemini generates first-draft SQL/templates from a question; analyst refines. Charts render with Recharts.
- Self-serve: marketing/ops can answer their own basic questions without a ticket.

### People & Admin
- **Settings** — invite members, assign roles (owner / member), install apps, manage workspace theme.
- **Onboarding wizards** — built into Email Marketing and Reports so a new hire can set up their tools without IT.

### Executive / Cross-functional
- **Home AI dashboard** — natural-language layer over emails, calendar, projects, and reports. "What's on the agenda today?", "Where are we on the Q2 launch?", "Summarise this week's signups."
- Because all departments live in the same workspace and same permission model, leadership gets a real cross-functional view instead of stitched-together exports.

## Where the efficiency comes from

1. **One auth, one permission model.** RLS enforces access once, every app inherits it. No per-tool seat sprawl, no "who has access to the marketing folder again?".
2. **App registry, not silos.** Departments turn on what they need; the shell, sidebar, and AI assistant adapt automatically.
3. **AI on top of *your* data.** The assistant reads from the same workspace tables, so its answers are grounded in the team's actual emails, tasks, and reports — not a generic LLM guess.
4. **Internal gateway for AI.** Routing through OpenClaw Gateway means model choice, cost, and audit logging are controlled centrally instead of every team wiring their own provider keys.
5. **Extensible by row.** New internal tools (e.g. an HR app, a finance app) ship as a new app registry entry plus a route — not a new product purchase.
