# 500Claw Company Operating System

**Date:** 2026-06-15  
**Status:** Strategic product and architecture blueprint  
**Core decision:** Remove OpenClaw Gateway. Use Mastra as the agent, workflow, model, streaming, approval, and orchestration runtime. Use UltraMem as the long-term memory layer. Keep 500Claw's knowledge layer as the source-grounded understanding layer.

---

## 1. Executive Summary

500Claw should become a company operating system that learns how an organization works and helps employees execute work across departments. It should not be a generic chatbot bolted onto internal tools. It should be a workspace-native intelligence layer that understands the company's data, decisions, workflows, people, reports, documents, approvals, and operating patterns.

The architectural thesis is:

```text
Human capital
  judgment, relationships, domain expertise, taste, context

+ Token capital
  company-owned AI memory, workflows, evals, traces, tools, operating knowledge

= A compounding company learning loop
```

This matches the "human capital + token capital" idea in the article you shared. The future advantage is not simply picking the best model. The advantage is owning the loop where employees use the platform, the platform observes useful traces, the memory layer distills durable institutional knowledge, private evals measure whether the system is improving, and the agent layer executes increasingly valuable work with human approval at the right points.

For 500Claw, the clean architecture is:

```text
Next.js product UI
  workspace shell, apps, chat surfaces, approval inbox, reports, automations

Mastra runtime
  agents, workflows, scheduled/background tasks, streaming, approvals, model calls,
  short-term thread memory, tool calling, observability hooks

500Claw tool layer
  database map query, document query, reports, projects, files, email, messages,
  Composio connectors, Supabase operations

500Claw knowledge layer
  source-grounded maps and dig tools:
  - database structural maps
  - content maps
  - vector search
  - SQL dig
  - future API/GitHub/Slack/Gmail dig tools

UltraMem
  long-term user/team/workspace/company memory:
  - distilled durable facts
  - contradiction/update reconciliation
  - standing profiles
  - cross-session recall
  - institutional preferences and operating patterns

Supabase + Qdrant + external systems
  source of truth, auth/RLS, document vectors, memory vectors, connected apps
```

The product should start with a simple loop:

```text
Ask -> investigate -> draft -> cite -> request approval -> execute -> remember outcome
```

Then it should expand into scheduled workflows, role-specific agents, report factories, process intelligence, and eventually semi-autonomous operations under explicit policy.

---

## 2. Product North Star

500Claw should drastically understand company operations.

That means it should know, within permission boundaries:

- What the company is working on.
- Which people, teams, projects, customers, vendors, campaigns, repositories, and documents matter.
- How each department defines success.
- How metrics are calculated.
- Which workflows repeat every day, week, month, and quarter.
- Which decisions were made before and why.
- Which approvals are needed before risky actions.
- Where the source of truth lives for each question.
- How the organization prefers reports, emails, campaigns, tasks, and updates to be prepared.
- What the organization has learned from prior work.

The target experience:

```text
"Prepare this week's growth report, compare it to last week, explain anomalies,
draft the team update, and create follow-up tasks for anything blocked."
```

500Claw should:

1. Know which database and documents contain the answer.
2. Use the knowledge map to plan the query.
3. Run read-only live SQL for current metrics.
4. Search relevant documents/emails/campaigns.
5. Use UltraMem to remember company preferences and past report style.
6. Generate a cited report.
7. Draft an email.
8. Ask for approval before sending.
9. Send after approval.
10. Create tasks.
11. Remember what was approved and what the user corrected.
12. Improve future reports and workflows from that trace.

This is the "company veteran" effect: the platform gets better because the organization keeps using it.

---

## 3. What Exists Today

The current 500Claw repo already has the skeleton of this product.

### Existing product foundation

- Multi-workspace platform with workspace-scoped routes.
- Supabase auth and RLS.
- App registry and modular installed apps.
- Messages, Projects, Files, Reports, Email Marketing, Settings.
- Database connections.
- Knowledge app and knowledge APIs.
- Qdrant-backed document retrieval.
- Composio connector ingestion for Gmail, Slack, Google Drive, and GitHub.
- Reports already use the knowledge map when available.

### Existing knowledge layer

The core idea in the existing knowledge docs is correct: **the map plans, the source digs.**

The knowledge layer currently separates:

- **Database structural map:** tables, columns, relationships, metric pages, access specs.
- **Content map:** document summaries, categories, topics, entities.
- **Dig tools:** SQL dig and vector dig.
- **Unified router:** routes questions to database or content.
- **Query loop:** Plan -> Dig -> Synthesize.

That foundation should stay.

### What changes now

OpenClaw Gateway should be removed. Its responsibilities move to Mastra:

- Streaming assistant responses.
- Agent execution.
- Tool selection.
- Short-term conversation memory.
- Background tasks.
- Scheduled workflows.
- Human approvals.
- Model calls.
- Tool-call tracing.
- Multi-agent orchestration.

The current `src/lib/gateway/*`, `/api/gateway`, and ticket triage usage should eventually be replaced by Mastra agents/workflows.

The current `src/lib/knowledge/llm.ts` should also be revisited. If the decision is "Mastra only," knowledge enrichment, planning, SQL generation, and synthesis should route through Mastra primitives or a shared Mastra model wrapper rather than a separate Vercel AI SDK/Fireworks helper.

---

## 4. Core Architecture Decision

### Use Mastra for orchestration

Mastra should own:

- Agents.
- Workflows.
- Tools.
- Streaming.
- Request context.
- Short-term message history.
- Approval gates.
- Scheduled/background tasks.
- Multi-agent delegation.
- Observability hooks.
- Model provider routing.

Mastra is a strong fit because the product needs both:

- **Agents** for open-ended work where steps are not fully known in advance.
- **Workflows** for predictable business processes with specific ordered steps.

Examples:

- "Find why signups dropped this week" is agentic.
- "Every Monday at 9 AM, create growth report, send draft for approval, then email leadership" is a workflow.

### Use UltraMem for long-term memory

UltraMem should own:

- Durable facts.
- User preferences.
- Workspace preferences.
- Company terminology.
- Team conventions.
- Past corrections.
- Recurring decisions.
- Operating patterns.
- Long-term profiles.
- Contradiction/update handling.

UltraMem should not be treated as the source of truth. It is not the database, document store, or permission system. It is the long-term memory layer that helps agents behave like they have institutional context.

### Keep 500Claw knowledge layer for source-grounded understanding

The knowledge layer should own:

- What data sources exist.
- How to query them.
- How to cite them.
- How to avoid hallucinated table/column names.
- How to run live read-only SQL.
- How to retrieve current documents and chunks.
- How to map content into topics/entities/categories.

The knowledge layer is the difference between:

```text
"The model remembers something about marketing."
```

and:

```text
"The model can prove this campaign underperformed because the live database says
open rate fell from X to Y, and these three emails/documents explain the likely cause."
```

### Keep Supabase as the permission and product state layer

Supabase should own:

- Users.
- Workspaces.
- Roles.
- Installed apps.
- Product records.
- Approval records.
- Agent run logs.
- Audit logs.
- Workflow definitions.
- Automation schedules.
- Source connection records.
- Integration state.

UltraMem should not replace RLS. Mastra should not replace RLS. The product's security boundary remains Supabase plus explicit server-side checks.

---

## 5. Layer Boundaries

This product will fail if memory, knowledge, chat, and source of truth blur together. Keep the boundaries sharp.

### Source of truth

Examples:

- Supabase product tables.
- Connected customer database.
- Gmail/Drive/Slack/GitHub APIs.
- Files app documents.
- Reports history.
- Email campaign events.

Source of truth answers:

```text
What is actually true right now?
```

### Knowledge map

Examples:

- `knowledge_pages`.
- `knowledge_index`.
- Database table pages.
- Metric pages.
- Document entity/topic/category pages.
- Source access specs.

Knowledge map answers:

```text
Where should I look, how should I query it, and what does this source mean?
```

### UltraMem long-term memory

Examples:

- "The Growth team calls weekly acquisition reports 'Monday Pulse'."
- "Leadership prefers CAC split by paid/social/referral."
- "500Chow's support team escalates delivery delays after 30 minutes."
- "The CEO dislikes vanity metrics without a revenue implication."
- "The user corrected the churn metric to exclude paused subscriptions."

UltraMem answers:

```text
What durable operating context should the agent remember across sessions?
```

### Mastra short-term memory

Examples:

- Current thread messages.
- Recent tool calls in a run.
- Pending workflow state.
- Approval suspension state.
- Multi-agent context for a task.

Mastra memory answers:

```text
What does this agent need to remember for this conversation or workflow run?
```

### Agent run trace

Examples:

- Agent selected `queryDatabaseMap`.
- SQL executed.
- Documents retrieved.
- Email draft generated.
- Approval requested.
- User edited draft.
- Email sent.
- Outcome rated.

Agent trace answers:

```text
What happened, who approved it, what did it cost, and how well did it work?
```

---

## 6. Proposed System Diagram

```text
                        +------------------------------+
                        |         500Claw UI            |
                        | AI Home, Knowledge, Reports, |
                        | Projects, Email, Approvals   |
                        +---------------+--------------+
                                        |
                                        v
                        +------------------------------+
                        |       Next.js API layer       |
                        | Auth, workspace checks, RLS   |
                        +---------------+--------------+
                                        |
                                        v
                        +------------------------------+
                        |          Mastra runtime       |
                        | Agents, workflows, tools,     |
                        | approvals, schedules, stream  |
                        +----+-------------+-----------+
                             |             |
             +---------------+             +----------------+
             v                                              v
+----------------------------+              +-------------------------------+
|  500Claw knowledge tools   |              |        UltraMem tools         |
| query workspace knowledge  |              | get profile, search memory,   |
| run SQL dig, vector dig,   |              | add memory, timeline, forget  |
| create report, cite source |              +---------------+---------------+
+-------------+--------------+                              |
              |                                             v
              v                              +-------------------------------+
+----------------------------+              | UltraMem server + Qdrant       |
| Supabase product database  |              | chunks + facts + profiles      |
| workspace RLS, app data,   |              +-------------------------------+
| agent logs, approvals      |
+-------------+--------------+
              |
              v
+----------------------------+
| External sources           |
| DBs, Gmail, Drive, Slack,  |
| GitHub, Resend, Calendar   |
+----------------------------+
```

---

## 7. Mastra Responsibilities

Mastra becomes the only agent runtime.

### 7.1 Model calls

All LLM calls should route through Mastra or a Mastra-owned model abstraction:

- Chat assistant.
- Knowledge enrichment.
- Database query planning.
- SQL generation.
- Report synthesis.
- Document understanding.
- Ticket triage.
- Email drafting.
- Workflow decisions.
- Memory extraction review, if 500Claw adds its own memory governance layer.

This avoids a split-brain system where some calls happen in Mastra, some in Vercel AI SDK, some in Fireworks directly, and some in legacy Gateway.

### 7.2 Request context

Every Mastra run should receive request-scoped context:

```text
userId
workspaceId
workspaceSlug
role
installedApps
allowedToolScopes
memoryScopes
approvalPolicy
traceId
```

Mastra's current docs use `RequestContext` for request-specific values. The earlier `RuntimeContext` concept should be updated to the current API when implementation starts.

### 7.3 Short-term memory

Mastra memory should store:

- Last N messages.
- Thread state.
- Tool results from the current run.
- Workflow suspension/resume state.
- Subagent context.

Mastra should not be configured as the primary semantic long-term memory if UltraMem is active. Otherwise there will be two systems trying to remember the same company facts.

### 7.4 Tools

Mastra tools should be thin wrappers around 500Claw server functions.

Initial tools:

- `getUltraMemProfile`
- `searchUltraMem`
- `addUltraMemMemory`
- `askWorkspaceKnowledge`
- `queryDatabaseMap`
- `searchWorkspaceDocuments`
- `createReportDraft`
- `createTask`
- `updateTask`
- `draftEmail`
- `sendEmailWithApproval`
- `listWorkspaceSources`
- `syncSource`
- `getProjectStatus`
- `summarizeMessages`

Tool rules:

- Tools must enforce workspace membership server-side.
- Tools must not accept arbitrary workspace IDs from the model without validation.
- Tools that write, send, delete, invite, or spend money require approval.
- Tool outputs should include source citations and trace metadata.
- Tool outputs sent back to the model should be smaller than the full raw payload.

### 7.5 Workflows

Mastra workflows should power repeatable business processes:

- Weekly report generation.
- Campaign performance digest.
- Inbox triage.
- Ticket triage.
- Project health check.
- Incident summary.
- Customer feedback clustering.
- New employee onboarding briefing.
- Vendor renewal reminder.
- Compliance evidence pack.
- Executive daily briefing.

Workflows are the right primitive when the company knows the steps and wants reliable execution.

### 7.6 Agents

Mastra agents should handle open-ended work:

- "Why are signups down?"
- "What should we do about this campaign?"
- "Summarize what changed in engineering this week."
- "Find blockers across projects and messages."
- "Prepare a plan for the next product launch."

Agents can call workflows when they identify a repeatable process.

### 7.7 Approval gates

Any action with external impact needs approval:

- Send email.
- Send campaign.
- Modify a customer record.
- Create or assign many tasks.
- Delete files.
- Invite users.
- Publish report.
- Post in Slack/messages.
- Create GitHub issues/PRs.
- Spend money.
- Connect/disconnect integrations.

Approvals should be first-class product objects, not just modal popups.

Approval record should include:

- Requested action.
- Tool name.
- Arguments.
- Generated content preview.
- Sources used.
- Risk level.
- Requesting agent/workflow.
- Approver.
- Approved/declined/edited.
- Timestamp.
- Final executed payload.

---

## 8. UltraMem Fit Assessment

Reviewed local repo:

```text
/Users/davak/Documents/ultramem
origin: https://github.com/Akpughe/ultramem.git
latest local commit: 80fbf7e feat(server): file upload + URL ingestion on POST /v1/memories
```

The public GitHub URL should still be checked during implementation, but the local checkout appears to be the full repo and contains the engine, server, docs, tests, examples, Docker setup, and API reference.

### 8.1 What UltraMem already does well

UltraMem is a strong conceptual fit for 500Claw because it is not just vector search.

It provides:

- HTTP API.
- Rust core.
- Qdrant-backed chunks and facts.
- `container_tag` namespace isolation.
- Distilled fact extraction.
- UPDATE / EXTEND / DUPLICATE / NEW reconciliation.
- `is_latest` filtering for superseded facts.
- `valid_until` expiration parsing.
- Standing profile endpoint.
- Timeline endpoint.
- Reindex endpoint.
- Delete endpoint.
- File upload and URL ingestion.
- Provider abstraction direction.
- Tests for contradiction handling and tenant isolation.

The most important capability is contradiction handling:

```text
Old fact: "The user prefers Adidas."
New fact: "The user switched to Puma."
UltraMem marks the old fact as no longer latest and serves the new fact.
```

That is exactly the difference between long-term memory and ordinary RAG.

### 8.2 Why UltraMem is useful for companies

For company operations, UltraMem can store durable, reconciled institutional facts:

- Team preferences.
- Report definitions.
- Recurring workflows.
- Company vocabulary.
- Decision history.
- Stakeholder preferences.
- Department conventions.
- Process corrections.
- Current strategic priorities.
- Personal assistant preferences.

This allows agents to start each interaction with the right company context.

### 8.3 Where UltraMem is not enough yet

UltraMem is promising, but it needs enterprise/product hardening before it becomes the institutional memory layer for many companies.

Current gaps and recommendations:

#### 0. Documentation and implementation drift

UltraMem's API docs describe richer fields for search, such as `source`, `after`, `before`, `rerank`, and `mode`. The current local server implementation only accepts `query`, `container_tag`, and `limit` for `/v1/search`; timeline also does not expose the documented `source` filter yet. This is normal for a young repo, but 500Claw should treat the HTTP API as evolving until contract tests are added.

Recommended UltraMem improvement:

- Add contract tests from `docs/API.md` to `ultramem-server`.
- Make docs and server response casing match exactly.
- Implement source/date filters in HTTP search.
- Add versioned API behavior, even if only `v1`.
- Return structured memory objects, not only strings, before enterprise integration.

#### 1. Server-side namespace enforcement

Current API accepts `container_tag` in request bodies/query params. That is fine for local use, but not enough for SaaS.

Important nuance: this is a reasonable design for UltraMem's current intended mode: self-hosted, single-tenant, run on a laptop or a company's own server. In that mode, the caller owns the environment and the static API key is mostly a local/server boundary. The concern below applies when UltraMem is used behind a multi-company 500Claw cloud deployment, or if UltraMem later ships a hosted Studio where many customers call the same cloud service.

For 500Claw:

- Browser clients should never call UltraMem directly.
- Only 500Claw server routes should call UltraMem.
- 500Claw must derive `container_tag` from authenticated user/workspace/team/project context.
- UltraMem should support API keys that map to allowed tenant scopes.
- Ideally UltraMem should reject client-provided tags that are not authorized for the API key.

Recommended UltraMem improvement:

```text
api_keys table/config:
  key_hash
  tenant_id
  allowed_container_prefixes
  rate_limit
  created_at
  revoked_at
```

Then enforce:

```text
request container_tag must start with one allowed prefix
```

#### 2. Memory scopes beyond one flat tag

500Claw needs multiple memory scopes:

- User memory.
- Workspace memory.
- Team memory.
- Project memory.
- Agent memory.
- Source memory.
- Company/global memory.

Recommended tag convention:

```text
org:{orgId}
workspace:{workspaceId}
workspace:{workspaceId}:team:{teamId}
workspace:{workspaceId}:project:{projectId}
workspace:{workspaceId}:user:{userId}
workspace:{workspaceId}:agent:{agentId}
workspace:{workspaceId}:source:{sourceType}:{sourceId}
```

But tags alone are not enough. UltraMem should eventually support structured scopes:

```json
{
  "org_id": "...",
  "workspace_id": "...",
  "team_id": "...",
  "project_id": "...",
  "user_id": "...",
  "agent_id": "...",
  "visibility": "private|team|workspace|org"
}
```

#### 3. Memory governance

Not every observed fact should become company memory.

500Claw needs:

- Candidate memories.
- Confidence score.
- Source link.
- Created by agent/user/system.
- Scope suggestion.
- Review status.
- Ability to pin/approve/reject/edit memories.
- Ability to mark memory as sensitive.
- Ability to delete or expire memory.

Recommended UltraMem improvement:

```text
Memory write modes:
  immediate
  candidate
  approved_only
```

For company-level memory, use `candidate` or `approved_only` at first.

#### 4. Evidence and citations for memories

UltraMem currently returns memory strings. For enterprise use, memory should include evidence:

```json
{
  "memory_id": "...",
  "fact": "...",
  "confidence": 0.87,
  "source_document_id": "...",
  "source_title": "...",
  "source_reference": "...",
  "captured_at": 1760000000,
  "supersedes": "...",
  "is_latest": true
}
```

Agents should be able to say:

```text
"I remember the CEO prefers net revenue reporting because this was corrected
in the Q2 reporting workflow on 2026-05-12."
```

This builds trust.

#### 5. Privacy and sensitive information controls

Company memory can accidentally store:

- Personal employee details.
- Credentials.
- Customer PII.
- Medical/financial/legal data.
- Private HR issues.
- Unapproved strategic plans.

UltraMem should add:

- PII detection/redaction.
- Secret detection.
- Memory class labels.
- Source allow/deny rules.
- Retention policy.
- Right-to-delete by user/workspace/source.
- "Do not memorize" markers.
- Admin memory audit UI in 500Claw.

#### 6. Async ingestion and job status

Current `/v1/memories` does ingestion inline. For large company ingestion, this needs durable jobs:

- Queue ingestion.
- Return job id.
- Stream progress.
- Retry failed docs.
- Resume interrupted syncs.
- Per-source sync state.
- Backpressure and rate limits.

500Claw already has `knowledge_jobs` and `knowledge_sources`; UltraMem should have similar production job primitives.

#### 7. Better multi-tenant production posture

For production:

- API keys must not be static env-only.
- CORS should not be permissive in production.
- Qdrant payload indexes should be created for `container_tag`, timestamps, source, and metadata filters.
- Rate limiting should be built in.
- Request ids and structured logs should exist.
- Health should report provider readiness separately.
- Metrics should include latency, token use, memory writes, failed distill, and search hit quality.

#### 8. TypeScript SDK

500Claw is TypeScript. It should not hand-roll fetch calls forever.

Recommended:

- `@ultramem/client`
- typed methods: `add`, `search`, `profile`, `timeline`, `delete`, `reindex`
- retries/timeouts
- typed response models
- server-only helper for Next.js

#### 9. Memory profile by scope

UltraMem profile currently compiles a namespace profile. 500Claw needs profile composition:

```text
final agent context =
  user profile
  + team profile
  + workspace/company profile
  + project profile
  + agent role profile
```

UltraMem could support multi-tag profile composition:

```json
{
  "container_tags": [
    "workspace:abc:user:u1",
    "workspace:abc:team:growth",
    "workspace:abc"
  ]
}
```

500Claw can also compose this server-side by calling multiple profile/search endpoints.

#### 10. Memory quality evals

UltraMem has a good start with memtest and retrieval benchmarks. For 500Claw, add company-operation evals:

- Does it remember corrected metric definitions?
- Does it avoid superseded report preferences?
- Does it keep team A and team B memories isolated?
- Does it avoid memorizing secrets?
- Does it remember only durable facts, not every transient chat line?
- Does it retrieve the right source evidence for a memory?

### 8.4 UltraMem verdict

UltraMem is good enough as the **starting long-term memory engine** for this product, especially because:

- It is self-hostable.
- It has an HTTP API.
- It handles updates/supersession.
- It can serve standing profiles.
- It is provider-agnostic or moving that way.
- It isolates namespaces with `container_tag`.

But for company-wide multi-tenant use, 500Claw should wrap UltraMem behind its own server-side memory service and should not expose raw UltraMem directly to users or the browser.

Recommended integration pattern:

```text
500Claw Mastra tool -> 500Claw memory service -> UltraMem HTTP API
```

Not:

```text
Browser -> UltraMem
Mastra agent -> arbitrary container_tag from model
```

---

## 9. Memory Strategy for 500Claw

### 9.1 What should be remembered

Remember durable, reusable operating context:

- User preferences.
- Team preferences.
- Metric definitions.
- Report formats.
- Business terminology.
- Repeated decisions.
- Active strategic priorities.
- Long-running projects.
- Known owners/stakeholders.
- Customer/vendor relationships.
- Approved workflow conventions.
- Common escalation rules.
- Recurring meeting/report cadences.
- Corrections users make to agent outputs.

### 9.2 What should not be remembered automatically

Do not automatically remember:

- Passwords, API keys, tokens, secrets.
- Private HR details.
- Sensitive personal information.
- Raw customer PII unless explicitly required and governed.
- One-off chat fragments.
- Temporary facts without expiry.
- Unverified rumors.
- Draft strategy before approval.
- Source data that should be queried live instead.
- Anything the user marks "do not remember."

### 9.3 Memory scopes

Start with these scopes:

```text
user_private
  Personal assistant preferences for a specific user.

workspace
  Shared operating memory for the company/workspace.

team
  Department-level conventions.

project
  Project-specific context and decisions.

agent
  A specialized agent's learned behavior and outcomes.
```

Example:

```text
User asks:
"When you make my growth reports, don't include vanity metrics unless they explain revenue."

Memory candidate:
scope: workspace:{workspaceId}:user:{userId}
fact: "The user prefers growth reports to avoid vanity metrics unless they explain revenue."
source: chat correction
visibility: private
confidence: high
```

Example:

```text
Leadership approves:
"Weekly leadership report should always include orders, GMV, refunds, net revenue, CAC, and delivery SLA."

Memory candidate:
scope: workspace:{workspaceId}
fact: "Weekly leadership reports include orders, GMV, refunds, net revenue, CAC, and delivery SLA."
source: approved report workflow
visibility: workspace
confidence: high
```

### 9.4 Memory write policy

Use three write modes:

```text
Silent private memory
  Low-risk user preferences. User can inspect/delete later.

Candidate memory
  Suggested team/workspace memory shown in Memory Review.

Approved memory
  Company-level memory only after owner/admin approval or after strong repeated evidence.
```

### 9.5 Memory review UI

Add a "Memory" or "Company Brain" admin surface:

- Search memories.
- Filter by scope.
- Filter by source.
- Filter by confidence.
- View superseded facts.
- Approve/reject candidates.
- Edit a memory.
- Pin canonical memories.
- Mark memory sensitive.
- Delete memory.
- Show evidence.
- Show where a memory was used.

This UI is not optional for a company product. If the platform learns company operations, companies need to see and control what it learned.

---

## 10. Knowledge Strategy

The existing knowledge layer should be upgraded, not replaced.

### 10.1 Database understanding

Databases should remain live sources.

Do not put database rows into UltraMem as memory. Instead:

- Build structural maps.
- Store metric definitions.
- Store canonical SQL where appropriate.
- Run read-only live queries at answer time.
- Cite SQL and map pages.
- Log query traces.

UltraMem can remember:

- The user's preferred report style.
- Which metric definition was approved.
- Which anomalies were previously explained.
- Which report cadence is expected.

UltraMem should not remember:

- "There were 12,382 orders last week."

That belongs in live SQL, not long-term memory.

### 10.2 Document understanding

Documents should have two representations:

- Knowledge map pages: summary, category, topics, entities, source metadata.
- Vector chunks: precise retrieval and citations.

UltraMem can additionally remember durable facts extracted from documents, but only after scope/policy checks.

For example:

```text
Document fact:
"The vendor contract renews on October 1."

Knowledge layer:
Stores document chunk and citation.

UltraMem:
May store "Vendor X contract renewal is October 1" as a workspace memory
if policy allows and source is trusted.
```

### 10.3 Source connectors

The product should ingest and understand:

- Gmail.
- Google Drive.
- Slack or Messages.
- GitHub.
- Calendar.
- Databases.
- Files app.
- Email campaigns.
- Projects/tasks.
- Tickets.
- Customer support tools.
- CRM.
- Finance/accounting systems.
- Analytics warehouses.

For each source, define:

```text
source connector -> fetch -> normalize -> understand -> map -> embed -> optionally memorize -> sync state
```

### 10.4 The "company operating map"

Over time, 500Claw should build a higher-level operating map:

- Departments.
- Teams.
- People.
- Projects.
- KPIs.
- Customers.
- Vendors.
- Tools.
- Workflows.
- Reports.
- Meetings.
- Decisions.
- Risks.
- Cadences.

This map can live partly in Supabase and partly as knowledge pages. It should be queryable and inspectable.

---

## 11. Agent and Workflow Model

### 11.1 Supervisor agent

Start with one supervisor agent:

```text
500Claw Workspace Agent
```

Responsibilities:

- Understand the user's request.
- Load relevant UltraMem profile/context.
- Route to knowledge or app tools.
- Decide whether a workflow is better than free-form agent execution.
- Ask for clarification when needed.
- Require approval before risky actions.
- Return cited answers.
- Save useful outcome memory.

### 11.2 Specialist agents

Add specialists as tool scope grows:

- Reports Agent.
- Email Agent.
- Projects Agent.
- Knowledge Agent.
- Engineering Agent.
- Operations Agent.
- Growth/Marketing Agent.
- Finance Agent.
- HR/Admin Agent.
- Compliance Agent.

Specialist agents should be narrow. The supervisor delegates when needed.

### 11.3 Workflows

Initial workflow library:

#### Weekly Growth Report

```text
Schedule Monday 8:00
-> load reporting preferences from UltraMem
-> query database map
-> compare week-over-week
-> search campaign docs/emails
-> explain anomalies
-> draft report
-> request approval
-> send email
-> create follow-up tasks
-> store accepted corrections as candidate memory
```

#### Campaign Launch Assistant

```text
User starts launch
-> gather brief from Files
-> check audience/campaign history
-> draft email variants
-> create project tasks
-> request approval for campaign send
-> track performance
-> generate post-launch report
-> remember winning patterns
```

#### Engineering Release Brief

```text
Schedule or manual
-> fetch GitHub PRs/issues
-> summarize merged work
-> identify blockers
-> link to projects/tasks
-> draft release note
-> ask engineering lead for approval
-> post to channel/email
```

#### Inbox and Customer Signal Digest

```text
Daily
-> ingest Gmail/support messages
-> cluster recurring complaints
-> map to customers/features
-> identify urgent items
-> draft replies or tasks
-> require approval before external replies
```

#### Operations Exception Monitor

```text
Every 30 minutes
-> query operational DB
-> detect SLA breaches/anomalies
-> retrieve SOPs
-> draft recommended action
-> escalate if policy says so
-> remember confirmed resolution pattern
```

### 11.4 Autonomy levels

Define autonomy explicitly:

```text
Level 0: Answer only
  Read sources, cite answers.

Level 1: Draft only
  Prepare report/email/task but do not execute.

Level 2: Approval-gated execution
  Execute only after human approval.

Level 3: Policy-limited execution
  Execute low-risk actions automatically within rules.

Level 4: Autonomous operation
  Reserved for narrow, heavily evaluated workflows.
```

Start at Levels 0-2.

---

## 12. Product Surfaces to Build

### 12.1 AI Home

The main command surface.

Capabilities:

- Ask anything about workspace.
- Trigger workflows.
- Show cited answers.
- Show active/pending automations.
- Show approval requests.
- Show recent agent activity.
- Save useful outputs to apps.

### 12.2 Knowledge App

The "what does 500Claw know?" surface.

Capabilities:

- View connected sources.
- Build/rebuild maps.
- Browse knowledge pages.
- Ask source-grounded questions.
- Inspect citations.
- View sync status.
- View stale sources.
- See coverage gaps.

### 12.3 Memory Center

The "what has 500Claw learned?" surface.

Capabilities:

- View user/team/workspace memories.
- Review candidates.
- Approve company memories.
- Edit/delete memories.
- See superseded memories.
- See evidence.
- Configure memory policy.
- Export memory.

### 12.4 Automation Studio

The workflow builder/monitor.

Capabilities:

- Create scheduled workflows.
- Use templates.
- Define trigger.
- Define approval policy.
- Choose data sources.
- Test run.
- View run history.
- Pause/resume.
- See failures.

### 12.5 Approval Inbox

The human control center.

Capabilities:

- Review pending actions.
- Compare sources.
- Edit generated output before approval.
- Approve/decline.
- Add comment.
- Set future rule: "approve similar automatically" only for safe actions.

### 12.6 Agent Trace Viewer

The trust/debug surface.

Capabilities:

- Show what the agent did.
- Show tools called.
- Show memory used.
- Show SQL/documents retrieved.
- Show model and cost.
- Show approval decisions.
- Show final outcome.

### 12.7 Private Evals Dashboard

The improvement surface.

Capabilities:

- Track report accuracy.
- Track source citation quality.
- Track memory precision.
- Track tool selection.
- Track approval reversal rate.
- Track user edits.
- Track workflow success.

---

## 13. High-Value Use Cases

### 13.1 Executive Daily Briefing

Every morning, leadership receives:

- Revenue/order summary.
- Campaign changes.
- Operational incidents.
- Project blockers.
- Customer/vendor issues.
- Calendar highlights.
- Recommended decisions.

The briefing adapts to leadership preferences stored in UltraMem.

### 13.2 Weekly Department Reports

For each department:

- Marketing performance.
- Engineering progress.
- Operations exceptions.
- Support trends.
- Finance summary.
- HR/admin tasks.

Reports are generated from live data and cited sources, then approved before distribution.

### 13.3 "Why Did This Metric Change?"

User asks:

```text
"Why did delivery SLA drop this week?"
```

Agent:

- Queries live operations DB.
- Finds affected regions/vendors.
- Searches incident messages/docs.
- Checks prior similar incidents in UltraMem.
- Produces explanation with evidence.
- Suggests follow-up actions.

### 13.4 Institutional Onboarding

New employee asks:

```text
"What do I need to know about how Growth works here?"
```

Agent:

- Pulls approved team memory.
- Summarizes key docs.
- Explains metrics.
- Lists recurring meetings.
- Shows current priorities.
- Links source documents.

### 13.5 Report Factory

Users create repeatable report workflows:

- Choose report purpose.
- Select sources.
- Define cadence.
- Define recipients.
- Define approval owner.
- Let agent generate first draft.
- User corrects.
- Corrections become memory/eval data.

### 13.6 Decision Memory

When a decision is made:

- Capture what was decided.
- Capture why.
- Link sources.
- Link people.
- Link date.
- Mark as active/superseded later.

Future agents can answer:

```text
"Why did we stop using Channel X for acquisition?"
```

### 13.7 Process Mining

Over time, the platform can infer:

- Repeated manual steps.
- Common approval paths.
- Bottlenecks.
- Handoffs.
- Unowned work.
- Workflows that should be automated.

Then it can suggest:

```text
"You manually create this report every Monday. Should I turn it into an automation?"
```

### 13.8 Cross-App Execution

Example:

```text
"Turn this customer complaint theme into an engineering project."
```

Agent:

- Searches support emails/messages.
- Summarizes customer theme.
- Finds related GitHub issues.
- Creates project.
- Creates tasks.
- Drafts stakeholder update.
- Requests approval.
- Stores the pattern.

### 13.9 Compliance Evidence Packs

For regulated workflows:

- Gather relevant docs.
- Gather approval logs.
- Gather audit trails.
- Summarize control evidence.
- Export report.

### 13.10 Company Glossary

Automatically learns:

- Internal acronyms.
- Product names.
- Metric names.
- Team names.
- Customer segment names.

But glossary entries should be reviewable and source-backed.

### 13.11 "Ask The Company" Search

This is the user-facing version of the company operating memory:

```text
"Have we ever tried influencer partnerships in Abuja?"
"Who usually approves vendor payment exceptions?"
"What did we learn from the last delivery delay incident?"
"Which customers complained about the checkout redesign?"
```

The answer should combine:

- UltraMem for durable remembered lessons.
- Knowledge maps for where to look.
- Live source retrieval for proof.
- Citations for every factual claim.

### 13.12 Proactive Risk Radar

The platform can watch for operational patterns:

- Repeated campaign underperformance.
- Delivery SLA deterioration.
- Unanswered customer complaints.
- Stale projects with no owner.
- Overdue approvals.
- Vendor renewal risk.
- Engineering issues repeatedly reopened.

The agent should not silently make big decisions. It should surface risk, explain evidence, and suggest actions.

### 13.13 Meeting-to-Operations Loop

After a meeting:

- Summarize decisions.
- Extract tasks.
- Identify owners.
- Link relevant docs/projects.
- Create tasks after approval.
- Propose durable memories for decisions and preferences.
- Add eval cases when a user corrects the summary.

This is especially valuable because meetings contain tacit company judgment that otherwise disappears.

### 13.14 Customer Memory Layer

For sales/support/customer success:

- Remember customer-specific preferences and history.
- Track open promises.
- Summarize relationship context before calls.
- Detect repeated complaints across accounts.
- Draft follow-ups.

This must be permissioned carefully. Customer memory should be scoped, source-backed, and deletable.

---

## 14. Data Model Additions

Add product tables for agent operations.

### `agent_runs`

One row per agent/workflow execution.

```text
id
workspace_id
user_id
agent_id
workflow_id
status
input
output
started_at
finished_at
cost
model_summary
trace_id
```

### `agent_steps`

One row per reasoning/tool/workflow step.

```text
id
run_id
workspace_id
step_index
type
name
input
output
error
started_at
finished_at
```

### `tool_invocations`

Detailed tool call audit.

```text
id
run_id
workspace_id
tool_name
arguments
result_summary
source_refs
risk_level
requires_approval
created_at
```

### `approval_requests`

Human approval queue.

```text
id
workspace_id
run_id
tool_invocation_id
requested_by_agent
requested_for_user_id
approver_user_id
status
risk_level
action_type
payload_preview
payload_final
sources
decision_comment
created_at
decided_at
executed_at
```

### `automations`

Scheduled or event-triggered workflows.

```text
id
workspace_id
name
description
workflow_id
trigger_type
trigger_config
approval_policy
enabled
created_by
created_at
updated_at
```

### `memory_events`

500Claw-side log of memory reads/writes.

```text
id
workspace_id
user_id
run_id
operation
scope
container_tag
memory_id
fact
source_ref
status
created_at
```

### `memory_candidates`

Company-governed memory review.

```text
id
workspace_id
proposed_scope
fact
source_type
source_ref
evidence
confidence
sensitivity
status
proposed_by
reviewed_by
created_at
reviewed_at
```

### `eval_cases`

Private eval suite.

```text
id
workspace_id
name
category
input
expected_behavior
source_refs
created_at
```

### `eval_runs`

Eval execution results.

```text
id
workspace_id
case_id
agent_version
model
result
score
failure_reason
trace_id
created_at
```

### `agent_feedback`

User feedback and correction loop.

```text
id
workspace_id
run_id
user_id
rating
correction
accepted_output
memory_candidate_id
created_at
```

---

## 15. End-to-End Flows

### 15.1 Interactive Question Flow

```text
User asks question in AI Home
-> Next.js authenticates user and workspace
-> Create Mastra RequestContext
-> Load UltraMem profiles for user/workspace/team/project
-> Supervisor agent classifies intent
-> Agent calls askWorkspaceKnowledge
-> Knowledge router chooses SQL/vector/API dig
-> Dig tool returns current cited data
-> Agent synthesizes answer
-> Agent logs run/steps/tool calls
-> Useful durable correction becomes memory candidate
-> UI streams cited answer
```

### 15.2 Report Generation Flow

```text
User asks for report
-> Agent loads report preferences from UltraMem
-> Knowledge layer reads database map
-> SQL dig runs live read-only query
-> Vector/API dig retrieves supporting context
-> Report agent creates structured report
-> User edits report
-> Agent asks whether correction should be remembered
-> Approved correction stored in UltraMem
-> Report saved to Reports app
```

### 15.3 Approval-Gated Email Flow

```text
User: "Email leadership the weekly report"
-> Agent drafts email from report
-> sendEmail tool requires approval
-> Approval request created
-> UI shows recipients, subject, body, sources, risk
-> User edits/approves
-> Tool sends via Resend/Gmail
-> Agent logs final payload
-> UltraMem stores approved style/preference if useful
```

### 15.4 Scheduled Automation Flow

```text
Automation trigger fires
-> Mastra workflow starts
-> Load workspace memory/profile
-> Run deterministic steps
-> Use agents only for judgment/synthesis
-> Pause for approval if required
-> Resume after approval
-> Execute final action
-> Log outcome
-> Update eval metrics
-> Propose memory candidates
```

### 15.5 Source Ingestion Flow

```text
User connects source
-> 500Claw stores connection with workspace scope
-> Sync job fetches source data
-> Normalize docs/events
-> Knowledge layer summarizes/maps/entities
-> Qdrant stores chunks with workspace filter
-> UltraMem optionally receives durable memory candidates
-> Sync state updated
```

### 15.6 Memory Use Flow

```text
Before agent run:
  fetch user private profile
  fetch team/workspace profile
  fetch project profile if relevant
  inject compact profile into instructions/context

During agent run:
  search UltraMem for relevant operating facts
  use source-grounded knowledge for live truth

After agent run:
  detect durable learnings
  write private memory immediately if safe
  create company memory candidate if shared
```

---

## 16. Safety and Governance

### 16.1 Permission model

All tools must enforce:

- Authenticated user.
- Workspace membership.
- Installed app access.
- Role-based write permission.
- Source-level permission.
- Approval policy.

Never rely on model instructions for security.

### 16.2 Approval policy

Default approval requirements:

```text
Read-only queries:
  no approval

Draft generation:
  no approval

Internal write:
  approval for bulk or sensitive actions

External send/publish:
  approval always

Delete/destructive:
  approval always, owner/admin for high risk

Money/billing/legal:
  approval always, strict role policy
```

### 16.3 Memory policy

Default:

- Private user memory can be written with user-visible controls.
- Team/workspace memory starts as candidate.
- Sensitive memory requires admin approval.
- Secrets are blocked.
- Memories need source/evidence.
- Memories can expire.
- Memories can be deleted/exported.

### 16.4 Data isolation

Must test:

- Workspace A cannot access Workspace B knowledge.
- Workspace A cannot access Workspace B UltraMem tags.
- User private memory is not injected into team/shared agent contexts.
- Qdrant filters are always applied.
- Mastra tools cannot bypass RLS with model-provided IDs.

### 16.5 Agent behavior constraints

Agents must:

- Cite sources when answering from company data.
- Distinguish memory from live source truth.
- Say when data is stale or unavailable.
- Ask for approval before action.
- Avoid pretending a draft was sent when it was only drafted.
- Avoid writing company memory without policy.
- Avoid storing secrets.

---

## 17. Private Evals

Private evals are the core compounding mechanism. They turn agent traces into measurable improvement.

### 17.1 Eval categories

#### Source retrieval evals

- Did the agent choose the right source?
- Did it query the right database?
- Did it retrieve the right documents?
- Did it cite the correct evidence?

#### SQL/report evals

- Did generated SQL use correct tables and columns?
- Did it apply approved metric definitions?
- Did it avoid unsafe SQL?
- Did the chart match the data?
- Did the explanation match the rows?

#### Memory evals

- Did the agent use the right memory?
- Did it ignore superseded memory?
- Did it keep private/team/workspace scopes separate?
- Did it avoid memorizing transient facts?
- Did it propose useful memory candidates?

#### Tool/action evals

- Did the agent choose the right tool?
- Did it ask approval at the right time?
- Did it execute the approved payload exactly?
- Did it avoid risky actions?

#### Workflow evals

- Did the workflow finish?
- Were all required steps completed?
- Was the output accepted?
- Did the user edit heavily?
- Was the workflow faster than manual execution?

### 17.2 Eval creation from real work

Every approved/corrected run can become an eval case:

```text
User corrected report definition
-> create eval:
   "When asked for weekly revenue, use net revenue excluding refunds."
```

```text
Agent used wrong source
-> create eval:
   "For support ticket trend questions, search support emails + tickets before database."
```

### 17.3 Success metrics

Track:

- Answer acceptance rate.
- User edit distance.
- Approval rate.
- Approval rejection reason.
- Workflow completion rate.
- Tool error rate.
- Cost per successful workflow.
- Time saved.
- Source citation precision.
- Memory precision/recall.
- Tenancy violation count, must be zero.

---

## 18. Risks and Mitigations

### 18.1 The system learns the wrong thing

Risk:

- The agent stores transient, incorrect, sensitive, or low-confidence facts as institutional memory.

Mitigation:

- Use memory candidates for shared/company memory.
- Require evidence and source refs.
- Add confidence and sensitivity labels.
- Keep memory review UI.
- Use private evals for memory precision.

### 18.2 The system leaks data across workspaces

Risk:

- A model-provided `workspaceId` or `container_tag` causes data from one company to appear in another company's context.

Mitigation:

- Derive workspace and memory tags server-side.
- Enforce RLS and explicit membership checks.
- Add UltraMem API key to allowed-prefix enforcement.
- Add isolation tests for every tool.

### 18.3 The agent takes action too early

Risk:

- The product becomes exciting before it becomes trustworthy and starts sending/updating/deleting without adequate control.

Mitigation:

- Start at autonomy Levels 0-2.
- Approval-gate external and destructive actions.
- Store every approval as an audit object.
- Make approved payloads immutable after execution.

### 18.4 The platform becomes another black box

Risk:

- Users cannot see why the agent answered or acted.

Mitigation:

- Build trace viewer.
- Show citations.
- Show memory used.
- Show tool calls.
- Show approval history.
- Let users correct memory.

### 18.5 Cost grows faster than value

Risk:

- Multi-step agents and ingestion call expensive models too often.

Mitigation:

- Use workflows for deterministic steps.
- Use cheap models for routing/classification.
- Cache profiles and common plans.
- Track cost per successful workflow.
- Use evals to remove low-value tool calls.

### 18.6 Source freshness becomes unclear

Risk:

- Agent answers from stale documents or old syncs.

Mitigation:

- Show source freshness.
- Warn when source is stale.
- Prefer live source digs for operational facts.
- Add re-sync triggers and scheduled refresh.

### 18.7 Users fear surveillance

Risk:

- Company memory feels like monitoring employees rather than amplifying their work.

Mitigation:

- Make memory inspectable.
- Separate private, team, and workspace scopes.
- Let users delete/export private memory.
- Require approval for shared memories.
- State clearly what is remembered and why.

---

## 19. Open Product Decisions

These should be resolved before implementation begins.

### 19.1 Memory defaults

Choose the default for shared memory:

```text
Recommended:
  private user preferences can write immediately with controls
  team/workspace memories become candidates
  admin-approved memories become canonical
```

### 19.2 First automation

Recommended first automation:

```text
Weekly Growth Report
```

Reason:

- It uses databases, documents, memory, reports, email, approvals, and evals.
- It proves the full product loop without requiring dangerous autonomous writes.

### 19.3 Mastra deployment shape

Decide whether Mastra runs:

- Inside the Next.js app runtime.
- As a separate service.
- As background worker plus API route adapter.

Recommendation:

- Start embedded/simple for v1.
- Move long-running scheduled workflows to a worker/service when needed.

### 19.4 UltraMem deployment shape

Decide whether UltraMem is:

- One shared service for all workspaces.
- One service per environment.
- One service per enterprise customer.

Recommendation:

- Start one service per environment with strict server-side tag enforcement.
- For enterprise/self-hosted customers, support isolated UltraMem deployments later.

### 19.5 Company memory ownership

Decide who can approve shared memory:

- Workspace owners.
- Department leads.
- Source owners.
- Admin role.

Recommendation:

- Workspace owners by default.
- Add source/team-level approvers later.

---

## 20. Migration Plan: OpenClaw Gateway -> Mastra

### Phase 1: Introduce Mastra beside existing code

- Install Mastra packages.
- Create `src/mastra`.
- Create supervisor agent.
- Create first tools wrapping existing knowledge functions.
- Create a new `/api/agent` endpoint.
- Keep old gateway temporarily.

### Phase 2: Move AI Home to Mastra

- Replace `/api/gateway` usage.
- Stream from Mastra.
- Persist chat messages through Supabase.
- Use Mastra short-term memory.
- Inject UltraMem profile.

### Phase 3: Move knowledge LLM calls to Mastra

- Replace direct `generateText` helper with Mastra-owned model wrapper.
- Convert plan/synthesize/enrich calls into tools/workflow steps.
- Keep knowledge functions testable by injecting model dependency.

### Phase 4: Replace ticket triage

- Replace `getGateway` ticket triage with a Mastra workflow.
- Log run.
- Store triage result.
- Add approval if triage creates external tasks.

### Phase 5: Add UltraMem memory tools

- Build 500Claw memory service wrapper.
- Add `getProfile`, `searchMemory`, `addMemoryCandidate`, `addPrivateMemory`.
- Add memory event logs.
- Add Memory Center UI.

### Phase 6: Add approvals

- Add approval tables.
- Add Approval Inbox.
- Mark write tools approval-required.
- Implement resume after approval.

### Phase 7: Add automations

- Add automation tables.
- Build first scheduled weekly report workflow.
- Add Automation Studio.
- Add eval logging.

### Phase 8: Remove OpenClaw Gateway

- Delete `src/lib/gateway`.
- Delete `/api/gateway`.
- Delete gateway types.
- Update docs/interface.
- Remove env vars.
- Ensure all chat/agent surfaces use Mastra.

---

## 21. Implementation Notes

### 21.1 Suggested file structure

```text
src/mastra/
  index.ts
  agents/
    supervisor-agent.ts
    reports-agent.ts
    email-agent.ts
    projects-agent.ts
  tools/
    knowledge-tools.ts
    ultramem-tools.ts
    reports-tools.ts
    email-tools.ts
    project-tools.ts
    approval-tools.ts
  workflows/
    weekly-report.ts
    ticket-triage.ts
    campaign-digest.ts
  memory/
    mastra-memory.ts
  context/
    request-context.ts

src/lib/agent/
  runs.ts
  approvals.ts
  traces.ts
  policies.ts

src/lib/memory/
  ultramem-client.ts
  scopes.ts
  policy.ts
  candidates.ts
```

### 21.2 Tool design pattern

Each tool should:

1. Read request context.
2. Validate workspace/user.
3. Validate permission.
4. Validate input with schema.
5. Execute server function.
6. Return compact result to model.
7. Log full result to trace if needed.

### 21.3 Model usage

Use cheaper/faster models for:

- Classification.
- Routing.
- Source selection.
- JSON extraction.
- Summaries over small payloads.

Use stronger models for:

- Complex synthesis.
- Report narrative.
- Multi-source reasoning.
- Memory candidate judgment.
- Ambiguous workflow planning.

Track model usage per run.

### 21.4 Structured output

Important agent outputs should be structured:

- Plans.
- Reports.
- SQL generation.
- Approval requests.
- Memory candidates.
- Workflow summaries.

Free-form prose is for final user-facing communication, not internal control flow.

---

## 22. Things to Take Note Of

### 22.1 Do not let Mastra and UltraMem compete

Mastra:

- Thread memory.
- Workflow state.
- Short-term context.

UltraMem:

- Long-term semantic/institutional memory.

500Claw knowledge:

- Source-grounded truth.

### 22.2 Do not memorize live facts that should be queried

Bad memory:

```text
"There are 183 pending orders today."
```

Good memory:

```text
"Operations defines pending orders as paid orders not yet assigned to a rider."
```

### 22.3 Do not skip evals

Without private evals, the system may feel impressive but not actually improve.

### 22.4 Do not delay the approval system too long

Approval is not just safety. It is product trust. It also creates high-quality training/eval/memory signals.

### 22.5 Do not over-ingest without policy

Company-wide ingestion is powerful and dangerous. Start with explicit connected sources, visible sync state, and admin controls.

### 22.6 Make memory inspectable early

If users cannot see what the system remembers, they will not trust it.

### 22.7 Keep agent traces first-class

When the agent is wrong, developers and users need to see:

- What memory was used.
- What source was queried.
- What tool ran.
- What prompt/model was used.
- What approval was requested.

### 22.8 Build for stale data

Every source should expose:

- Last synced.
- Last successful sync.
- Last failed sync.
- Staleness warning.
- Manual refresh.

### 22.9 Build for correction

The product should ask:

```text
"Should I remember this correction for next time?"
```

This turns human judgment into token capital.

---

## 23. Suggested First Milestone

Build **Workspace Intelligence v1**.

Scope:

- Mastra supervisor agent.
- AI Home powered by Mastra.
- UltraMem profile injection for user/workspace.
- Tools wrapping existing `/lib/knowledge`.
- Read-only answers across DB/documents.
- Report draft generation.
- Approval-gated email draft/send.
- Agent run trace logging.
- Memory candidate creation after user corrections.

Do not include:

- Fully autonomous write actions.
- Broad company-wide silent memory.
- Complex multi-agent hierarchy.
- Visual workflow builder.
- Automatic ingestion of every possible source.

Success criteria:

- User can ask company questions and get cited answers.
- User can generate a report from live data.
- User can approve sending a report email.
- Agent remembers approved report preferences.
- Admin can inspect what was remembered.
- Private evals track whether future reports improve.

---

## 24. Suggested Roadmap

### Stage 0: Documentation and decision cleanup

- Adopt this architecture.
- Update product docs to remove OpenClaw Gateway as future direction.
- Decide memory scope conventions.
- Decide approval policy.

### Stage 1: Mastra foundation

- Add Mastra runtime.
- Build request context.
- Build supervisor agent.
- Build knowledge tools.
- Build streaming endpoint.

### Stage 2: UltraMem integration

- Build server-side UltraMem client.
- Define scope/tag helpers.
- Add profile injection.
- Add memory search tool.
- Add memory write/candidate tool.
- Add memory event logs.

### Stage 3: Trust layer

- Add approval tables.
- Add approval UI.
- Add trace viewer.
- Add model/tool cost logging.

### Stage 4: First workflows

- Weekly report workflow.
- Ticket triage workflow.
- Campaign digest workflow.

### Stage 5: Memory governance

- Memory Center.
- Candidate review.
- Sensitive memory policies.
- Delete/export.

### Stage 6: Private evals

- Eval tables.
- Eval runner.
- Eval dashboard.
- Regression checks before agent changes.

### Stage 7: Department expansion

- Growth agent.
- Ops agent.
- Engineering agent.
- Finance/admin agent.
- Department-specific automations.

---

## 25. Final Recommendation

The combination is strong:

```text
Mastra = action and orchestration
UltraMem = long-term institutional memory
500Claw knowledge layer = grounded source understanding
Supabase = product state and permission boundary
```

This is the right shape for the company learning loop described in the article. It lets the company own its institutional knowledge and workflow intelligence even if the underlying model changes.

The key is discipline:

- Mastra should orchestrate.
- UltraMem should remember.
- Knowledge should ground.
- Supabase should authorize.
- Humans should approve meaningful actions.
- Evals should measure improvement.

If we build those boundaries cleanly, 500Claw can become much more than a workspace app. It can become the system where a company's operating knowledge compounds.

---

## 26. References Reviewed

- Local 500Claw repo: `/Users/davak/Documents/500claw-platform`
- Local UltraMem repo: `/Users/davak/Documents/ultramem`
- UltraMem Git remote: `https://github.com/Akpughe/ultramem.git`
- Mastra docs reviewed:
  - https://mastra.ai/docs/agents/overview
  - https://mastra.ai/docs/agents/using-tools
  - https://mastra.ai/docs/workflows/overview
  - https://mastra.ai/docs/agents/agent-approval
  - https://mastra.ai/docs/server/request-context
  - https://mastra.ai/docs/memory/overview
  - https://mastra.ai/guides/getting-started/next-js
