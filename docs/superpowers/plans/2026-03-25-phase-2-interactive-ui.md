# Phase 2: Interactive UI — Repos, Reports, Emails, Activity Dashboard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the platform from chat-only to an action-first UI with dedicated pages for GitHub repos/PRs, reports with Google Sheets export, email campaigns via Gmail, and an activity dashboard — all powered by per-user OAuth tokens.

**Architecture:** Each section gets its own API route that uses the user's stored OAuth tokens (decrypted from Supabase) to call GitHub/Google APIs directly. The AI assist layer (OpenClaw) is available contextually on each page but is not the primary interface. The sidebar is reorganized with section groupings.

**Tech Stack:** Next.js 14 App Router, GitHub REST API (via user tokens), Google APIs (Gmail, Sheets), Supabase, shadcn/ui

---

## File Structure

```
src/
├── app/(dashboard)/
│   ├── layout.tsx                          # MODIFY: new sidebar with sections
│   ├── page.tsx                            # MODIFY: activity dashboard (was chat)
│   ├── chat/page.tsx                       # NEW: chat moves here
│   ├── repos/
│   │   ├── page.tsx                        # NEW: repo list
│   │   └── [owner]/[repo]/page.tsx         # NEW: repo detail (PRs, issues)
│   ├── tickets/page.tsx                    # MODIFY: add repo selector
│   ├── reports/page.tsx                    # NEW: reports page
│   └── emails/page.tsx                     # NEW: emails page
├── app/api/
│   ├── github/
│   │   ├── repos/route.ts                  # NEW: list user repos
│   │   ├── pulls/route.ts                  # NEW: list/merge PRs
│   │   └── issues/route.ts                 # NEW: list/create issues
│   ├── reports/route.ts                    # NEW: saved reports CRUD
│   ├── reports/export/route.ts             # NEW: export to Google Sheets
│   ├── emails/route.ts                     # NEW: draft/send emails via Gmail
│   └── activity/route.ts                   # NEW: activity feed
├── components/
│   ├── repos/
│   │   ├── repo-list.tsx                   # NEW: repo cards grid
│   │   └── repo-detail.tsx                 # NEW: PRs/issues tabs
│   ├── reports/
│   │   ├── report-builder.tsx              # NEW: natural language → SQL → results
│   │   └── saved-reports.tsx               # NEW: saved report list
│   ├── emails/
│   │   ├── email-composer.tsx              # NEW: draft + preview + send
│   │   └── email-history.tsx               # NEW: sent emails list
│   ├── dashboard/
│   │   └── activity-feed.tsx               # NEW: recent activity across sections
│   └── tickets/
│       └── ticket-board.tsx                # MODIFY: add repo selector dropdown
├── lib/
│   ├── github.ts                           # NEW: GitHub API helper using user tokens
│   ├── google.ts                           # NEW: Google API helpers (Gmail, Sheets)
│   └── tokens.ts                           # NEW: fetch + decrypt user tokens
└── types/
    ├── github.ts                           # NEW: GitHub API types
    └── reports.ts                          # NEW: report types
```

### Database additions:
- `public.saved_reports` — saved report queries with names
- `public.email_campaigns` — sent email history
- `public.activity_log` — cross-section activity feed

---

## Task 1: Token Helper + GitHub API Library

**Files:**
- Create: `src/lib/tokens.ts`, `src/lib/github.ts`, `src/types/github.ts`

- [ ] **Step 1: Create token helper**

Create `src/lib/tokens.ts` — fetches and decrypts a user's OAuth token for a given provider:
```typescript
import { decrypt } from "@/lib/crypto";

interface SupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: Record<string, unknown> | null }>;
        };
      };
    };
  };
}

export async function getUserToken(
  supabase: SupabaseClient,
  userId: string,
  provider: string
): Promise<string | null> {
  const { data } = await supabase
    .from("external_accounts")
    .select("encrypted_access_token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (!data?.encrypted_access_token) return null;

  try {
    return decrypt(data.encrypted_access_token as string);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Create GitHub types**

Create `src/types/github.ts`:
```typescript
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
  owner: { login: string; avatar_url: string };
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  head: { ref: string };
  base: { ref: string };
  draft: boolean;
  mergeable: boolean | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  created_at: string;
  user: { login: string; avatar_url: string };
  labels: { name: string; color: string }[];
  assignee: { login: string } | null;
}
```

- [ ] **Step 3: Create GitHub API helper**

Create `src/lib/github.ts`:
```typescript
import type { GitHubRepo, GitHubPR, GitHubIssue } from "@/types/github";

const GITHUB_API = "https://api.github.com";

async function githubFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }

  return res.json();
}

export async function listRepos(token: string): Promise<GitHubRepo[]> {
  return githubFetch<GitHubRepo[]>(token, "/user/repos?sort=updated&per_page=50&type=all");
}

export async function listPulls(token: string, owner: string, repo: string): Promise<GitHubPR[]> {
  return githubFetch<GitHubPR[]>(token, `/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
}

export async function getPull(token: string, owner: string, repo: string, number: number): Promise<GitHubPR> {
  return githubFetch<GitHubPR>(token, `/repos/${owner}/${repo}/pulls/${number}`);
}

export async function mergePull(token: string, owner: string, repo: string, number: number): Promise<void> {
  await githubFetch(token, `/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merge_method: "squash" }),
  });
}

export async function listIssues(token: string, owner: string, repo: string): Promise<GitHubIssue[]> {
  return githubFetch<GitHubIssue[]>(token, `/repos/${owner}/${repo}/issues?state=open&per_page=50`);
}

export async function createIssue(
  token: string, owner: string, repo: string,
  title: string, body: string
): Promise<GitHubIssue> {
  return githubFetch<GitHubIssue>(token, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
}

export async function addPRReview(
  token: string, owner: string, repo: string, number: number,
  body: string, event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT"
): Promise<void> {
  await githubFetch(token, `/repos/${owner}/${repo}/pulls/${number}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, event }),
  });
}
```

- [ ] **Step 4: Commit**
```bash
git add src/lib/tokens.ts src/lib/github.ts src/types/github.ts
git commit -m "feat: add token helper and GitHub API library"
```

---

## Task 2: GitHub API Routes

**Files:**
- Create: `src/app/api/github/repos/route.ts`, `src/app/api/github/pulls/route.ts`, `src/app/api/github/issues/route.ts`

- [ ] **Step 1: Create repos API route**

Create `src/app/api/github/repos/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listRepos } from "@/lib/github";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getUserToken(supabase as never, user.id, "github");
  if (!token) {
    return NextResponse.json({ error: "GitHub not connected. Go to Settings to connect." }, { status: 400 });
  }

  try {
    const repos = await listRepos(token);
    return NextResponse.json(repos);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch repos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create pulls API route**

Create `src/app/api/github/pulls/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listPulls, mergePull, addPRReview } from "@/lib/github";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });

  const token = await getUserToken(supabase as never, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const pulls = await listPulls(token, owner, repo);
    return NextResponse.json(pulls);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch PRs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, owner, repo, number, body, event } = await request.json();
  const token = await getUserToken(supabase as never, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    if (action === "merge") {
      await mergePull(token, owner, repo, number);
      return NextResponse.json({ ok: true, message: "PR merged" });
    }
    if (action === "review") {
      await addPRReview(token, owner, repo, number, body, event);
      return NextResponse.json({ ok: true, message: "Review submitted" });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Action failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create issues API route**

Create `src/app/api/github/issues/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserToken } from "@/lib/tokens";
import { listIssues, createIssue } from "@/lib/github";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");
  if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });

  const token = await getUserToken(supabase as never, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const issues = await listIssues(token, owner, repo);
    return NextResponse.json(issues);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch issues";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { owner, repo, title, body } = await request.json();
  if (!owner || !repo || !title) {
    return NextResponse.json({ error: "owner, repo, and title required" }, { status: 400 });
  }

  const token = await getUserToken(supabase as never, user.id, "github");
  if (!token) return NextResponse.json({ error: "GitHub not connected" }, { status: 400 });

  try {
    const issue = await createIssue(token, owner, repo, title, body || "");
    return NextResponse.json(issue);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create issue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit**
```bash
git add src/app/api/github/
git commit -m "feat: add GitHub API routes for repos, PRs, and issues"
```

---

## Task 3: Repos Page UI

**Files:**
- Create: `src/components/repos/repo-list.tsx`, `src/components/repos/repo-detail.tsx`, `src/app/(dashboard)/repos/page.tsx`, `src/app/(dashboard)/repos/[owner]/[repo]/page.tsx`

These are large component files. The subagent implementer should create them with the full code provided in the plan. The repo list is a card grid. The repo detail page has tabs for PRs and Issues with action buttons (Merge, Review, Create Issue).

- [ ] **Step 1: Create repo list component and page**
- [ ] **Step 2: Create repo detail component and dynamic route page**
- [ ] **Step 3: Commit**
```bash
git add src/components/repos/ "src/app/(dashboard)/repos/"
git commit -m "feat: add repos page with PR and issue management"
```

---

## Task 4: Google API Library (Gmail + Sheets)

**Files:**
- Create: `src/lib/google.ts`

- [ ] **Step 1: Create Google API helper**

Create `src/lib/google.ts`:
```typescript
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";
const SHEETS_API = "https://sheets.googleapis.com/v4";

async function googleFetch<T>(token: string, url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google API error: ${res.status}`);
  }

  return res.json();
}

// Gmail
export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  body: string
): Promise<{ id: string; threadId: string }> {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const encoded = Buffer.from(message).toString("base64url");

  return googleFetch(token, `${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw: encoded }),
  });
}

export async function listSentEmails(
  token: string,
  maxResults = 20
): Promise<{ messages: { id: string; snippet: string; payload?: { headers: { name: string; value: string }[] } }[] }> {
  const data = await googleFetch<{ messages: { id: string }[] }>(
    token,
    `${GMAIL_API}/users/me/messages?labelIds=SENT&maxResults=${maxResults}`
  );

  // Fetch details for each message
  const detailed = await Promise.all(
    (data.messages || []).slice(0, 10).map(async (m) => {
      const detail = await googleFetch<Record<string, unknown>>(
        token,
        `${GMAIL_API}/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=To`
      );
      return detail;
    })
  );

  return { messages: detailed as never };
}

// Google Sheets
export async function createSheet(
  token: string,
  title: string,
  headers: string[],
  rows: unknown[][]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const spreadsheet = await googleFetch<{ spreadsheetId: string; spreadsheetUrl: string }>(
    token,
    `${SHEETS_API}/spreadsheets`,
    {
      method: "POST",
      body: JSON.stringify({
        properties: { title },
        sheets: [{
          data: [{
            rowData: [
              { values: headers.map((h) => ({ userEnteredValue: { stringValue: h } })) },
              ...rows.map((row) => ({
                values: row.map((cell) => ({
                  userEnteredValue: { stringValue: String(cell ?? "") },
                })),
              })),
            ],
          }],
        }],
      }),
    }
  );

  return spreadsheet;
}
```

- [ ] **Step 2: Commit**
```bash
git add src/lib/google.ts
git commit -m "feat: add Google API library for Gmail and Sheets"
```

---

## Task 5: Database Migrations (Reports, Emails, Activity)

**Files:**
- Create: `supabase/migrations/006_reports_emails_activity.sql`

- [ ] **Step 1: Create migration and apply via Supabase MCP**

```sql
-- Saved reports
create table public.saved_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  connection_id uuid references public.database_connections(id) on delete set null,
  query_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.saved_reports enable row level security;
create policy "Users manage own reports" on public.saved_reports
  for all to authenticated using (auth.uid() = user_id);

-- Email campaigns
create table public.email_campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  subject text not null,
  body_html text not null,
  recipients text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'sent', 'failed')),
  sent_count int default 0,
  gmail_message_id text,
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table public.email_campaigns enable row level security;
create policy "Users manage own campaigns" on public.email_campaigns
  for all to authenticated using (auth.uid() = user_id);

-- Activity log (cross-section)
create table public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  action text not null,
  section text not null,
  title text not null,
  description text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.activity_log enable row level security;
create policy "Users can read all activity" on public.activity_log
  for select to authenticated using (true);
create policy "Users can insert own activity" on public.activity_log
  for insert to authenticated with check (auth.uid() = user_id);

create index activity_log_created_idx on public.activity_log(created_at desc);
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/006_reports_emails_activity.sql
git commit -m "feat: add migrations for saved reports, email campaigns, activity log"
```

---

## Task 6: Reports API + Page

**Files:**
- Create: `src/app/api/reports/route.ts`, `src/app/api/reports/export/route.ts`, `src/types/reports.ts`, `src/components/reports/report-builder.tsx`, `src/components/reports/saved-reports.tsx`, `src/app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Create reports types**
- [ ] **Step 2: Create reports CRUD API**
- [ ] **Step 3: Create Google Sheets export API**
- [ ] **Step 4: Create report builder and saved reports components**
- [ ] **Step 5: Create reports page**
- [ ] **Step 6: Commit**
```bash
git add src/types/reports.ts src/app/api/reports/ src/components/reports/ "src/app/(dashboard)/reports/"
git commit -m "feat: add reports page with natural language queries and Sheets export"
```

---

## Task 7: Emails API + Page

**Files:**
- Create: `src/app/api/emails/route.ts`, `src/components/emails/email-composer.tsx`, `src/components/emails/email-history.tsx`, `src/app/(dashboard)/emails/page.tsx`

- [ ] **Step 1: Create emails API (draft, send, list)**
- [ ] **Step 2: Create email composer and history components**
- [ ] **Step 3: Create emails page**
- [ ] **Step 4: Commit**
```bash
git add src/app/api/emails/ src/components/emails/ "src/app/(dashboard)/emails/"
git commit -m "feat: add emails page with composer and Gmail send"
```

---

## Task 8: Activity Dashboard + API

**Files:**
- Create: `src/app/api/activity/route.ts`, `src/components/dashboard/activity-feed.tsx`
- Modify: `src/app/(dashboard)/page.tsx` (replace chat with activity dashboard)
- Create: `src/app/(dashboard)/chat/page.tsx` (chat moves here)

- [ ] **Step 1: Create activity API**
- [ ] **Step 2: Create activity feed component**
- [ ] **Step 3: Move chat to /chat, replace / with activity dashboard**
- [ ] **Step 4: Commit**
```bash
git add src/app/api/activity/ src/components/dashboard/ "src/app/(dashboard)/page.tsx" "src/app/(dashboard)/chat/"
git commit -m "feat: add activity dashboard, move chat to /chat"
```

---

## Task 9: Updated Sidebar + Ticket Repo Linking

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx` (new sidebar with section groups)
- Modify: `src/components/tickets/ticket-board.tsx` (add repo selector)

- [ ] **Step 1: Update sidebar with grouped navigation**
- [ ] **Step 2: Add repo selector to ticket creation**
- [ ] **Step 3: Commit**
```bash
git add "src/app/(dashboard)/layout.tsx" src/components/tickets/ticket-board.tsx
git commit -m "feat: update sidebar with sections, link tickets to repos"
```

---

## Task 10: Build Check + Final Commit

- [ ] **Step 1: Type check**
```bash
npx tsc --noEmit
```

- [ ] **Step 2: Build**
```bash
npm run build
```

- [ ] **Step 3: Final commit**
```bash
git add -A
git commit -m "chore: phase 2 complete — repos, reports, emails, activity dashboard"
```
