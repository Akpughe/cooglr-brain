# Chat-First Agentic Interface Feature Roadmap

**Date:** 2026-06-15  
**Status:** Product and technical planning document  
**Context:** 500Claw is moving from app-destination navigation to a Codex-like agentic workspace interface. The primary surface becomes chat, with @ mentions for tools/resources, right-side canvases for artifacts, and Mastra-powered agents/workflows behind the scenes.  
**Related:** `docs/MASTRA_ULTRAMEM_COMPANY_OPERATING_SYSTEM.md`

---

## 1. Product Direction

The application should feel closer to Codex than to a traditional dashboard with many separate apps.

The user should not need to think:

```text
"I need a report, so I must go to Reports."
"I need a document, so I must go to Files."
"I need an automation, so I must go to Automations."
```

The user should think:

```text
"I ask the company agent to do the work."
```

Then the interface helps them summon context, choose resources, inspect generated work, approve actions, and review automations.

The new mental model:

```text
Chat is the operating surface.
@ mentions summon capabilities and context.
Canvases show generated artifacts and workflow visuals.
Automations are created from conversations and visualized as workflows.
Memory is scoped: personal, team, company, project, and source.
Apps become capabilities behind the agent, not separate places users must visit.
```

This does not mean every old app disappears technically. Reports, Files, Projects, Messages, Email, Calendar, GitHub, and Knowledge still exist as modules, data models, tools, and canvases. They are just no longer the main user navigation model.

---

## 2. Interface Architecture

### 2.1 Primary layout

V1 should use a Codex-like layout:

```text
+------------------+--------------------------------+--------------------------+
| Workspace/Threads | Chat / Agent Conversation      | Canvas / Artifact Panel |
|                  |                                |                          |
| - New chat       | User asks, agent streams steps  | Report, doc, chart,     |
| - Recent chats   | @ mentions, tool chips,         | workflow, approval,     |
| - Suggestions    | approvals, generated results    | source inspector        |
| - Automations    |                                |                          |
+------------------+--------------------------------+--------------------------+
```

The center is always the conversation.

The right canvas opens when there is something worth inspecting:

- Report draft.
- Document draft.
- Chart.
- Table.
- SQL/source trace.
- Workflow/automation graph.
- Approval request.
- Email draft.
- Task/project plan.
- Memory candidate review.

The left side should show:

- Workspace switcher.
- New chat.
- Recent chats.
- Pinned chats.
- Agent suggestions.
- Automations.
- Sources/status.
- Settings/admin, lower priority.

### 2.2 What happens to separate apps

The old app sections should become capability surfaces:

| Existing app | New role |
|---|---|
| Reports | Report artifact type + report tools + report history canvas |
| Files | Document artifact type + source library + file picker |
| Projects | Task/project artifact type + execution tool |
| Messages | Human collaboration spaces + agent mention surface |
| Email Marketing | Email/campaign artifact type + send tool |
| Knowledge | Source coverage, source inspector, map builder |
| GitHub | Engineering source/tool capability |
| Calendar | Scheduling source/tool capability |
| Settings | Admin/configuration surface |

Some surfaces still need views, but they should be opened from chat/sidebar/canvas rather than treated as separate primary apps.

### 2.3 V1 navigation principle

V1 should keep enough navigation that users do not feel lost:

- Left sidebar for chats, suggestions, automations, sources.
- Chat input with @ menu.
- Canvas panel for artifacts.
- Settings/admin accessible from user/workspace menu.

Avoid building a large icon rail with many apps as the main experience.

---

## 3. V1 Product Goal

V1 should not be bare. It should feel like a real agentic work surface.

The V1 user should be able to:

1. Start a new chat.
2. Use @ mentions to reference tools, sources, people, documents, reports, automations, and memory.
3. Ask the agent to generate a report or document.
4. Watch the agent stream steps.
5. See the generated artifact in a right-side canvas.
6. Inspect sources/citations.
7. Approve or edit an action before it executes.
8. Save the artifact.
9. Create a simple automation from the chat.
10. View automations in a workflow/canvas view.
11. Receive suggestions from the agent.
12. Have personal preferences remembered separately from company memory.
13. Use multiple model providers through a controlled model selector/router.

V1 should prove the entire loop:

```text
conversation -> context selection -> agent work -> artifact canvas -> approval -> execution -> memory/eval signal
```

---

## 4. V1 Feature Breakdown

Each feature below includes what it is, how to build it, and what the end result should feel like.

---

## 4.1 Chat-First Workspace Shell

### What this feature is

Replace the current "apps as places" shell with a chat-first workspace shell. The user lands in an agent conversation, not an app grid or dashboard.

### Why it matters

This matches the actual product vision: the platform should operate through an agentic layer, not through users manually navigating every tool.

### How it should work

The workspace root should show:

- Left sidebar:
  - New chat.
  - Recent chats.
  - Pinned chats.
  - Suggestions.
  - Automations.
  - Sources.
  - Settings/admin entry.
- Center chat:
  - Thread title.
  - Agent status.
  - Message stream.
  - Tool activity.
  - Composer with @ mentions.
- Right canvas:
  - Closed by default.
  - Opens when an artifact/tool result needs inspection.

### Technical approach

Current code already has:

- `src/components/chat/*`
- `chat_sessions`
- `chat_messages`
- workspace shell
- command palette

V1 should refactor around:

```text
src/components/agent-shell/
  agent-workspace-shell.tsx
  agent-thread-sidebar.tsx
  agent-chat-surface.tsx
  agent-composer.tsx
  agent-canvas-panel.tsx
  agent-run-steps.tsx
```

The current chat components can be reused conceptually, but they must stop depending on `useGateway` and move to Mastra.

### End result

When a user enters a workspace, it feels like entering a company-aware AI operating desk. They can immediately ask for work to be done, summon resources with @, and inspect generated artifacts on the right.

### V1 scope

- One chat-first workspace route.
- Recent chat list.
- New chat.
- Streaming agent response.
- Tool step display.
- Right canvas open/close.

### Later improvements

- Multiple simultaneous canvases.
- Split canvas tabs.
- Drag artifacts into chat.
- Shared live sessions.
- Voice input.
- Mobile-native chat/canvas switcher.

---

## 4.2 @ Mention System

### What this feature is

The chat composer should support @ mentions like Codex. When the user types `@`, a menu opens with relevant resources, tools, agents, files, sources, workflows, reports, people, channels, and memories.

Examples:

```text
@reports create weekly growth report
@files use the Q2 launch brief
@database query orders from last week
@gmail summarize customer complaints
@projects create launch tasks
@automation make this weekly
@memory remember this as my report style
@model use Claude for this
```

### Why it matters

The @ menu gives users control without forcing them to understand implementation details. It also makes the agent less ambiguous because the user can explicitly attach context.

### Mention categories

V1 categories:

- **Capabilities**
  - Reports
  - Documents
  - Email
  - Projects
  - Automations
  - Knowledge
- **Sources**
  - Databases
  - Files
  - Gmail
  - Google Drive
  - Slack/Messages
  - GitHub
  - Calendar
- **People and teams**
  - Users
  - Teams/departments
  - Channels
- **Artifacts**
  - Existing reports
  - Existing documents
  - Existing workflows
  - Saved charts
- **Memory scopes**
  - My preferences
  - Team memory
  - Company memory
  - Project memory
- **Models**
  - Auto
  - OpenAI
  - Anthropic
  - Groq
  - xAI/Grok
  - Fireworks-hosted models
  - Cerebras-hosted models

### How it should work

When user types `@`:

1. Open popover.
2. Show grouped results.
3. Filter as the user types.
4. Selecting an item inserts a mention token/chip.
5. The token carries structured metadata, not just text.
6. On send, the structured mentions go to Mastra as request context.

Example internal shape:

```json
{
  "type": "source",
  "kind": "database",
  "id": "connection-id",
  "label": "Production Orders DB"
}
```

### Technical approach

Create:

```text
src/lib/mentions/
  types.ts
  registry.ts
  search.ts

src/components/agent-composer/
  mention-composer.tsx
  mention-menu.tsx
  mention-token.tsx
```

Mention search should use:

- Static capability registry.
- Workspace sources.
- Existing files/reports/workflows.
- Workspace members.
- Installed connectors.
- Model provider registry.

### End result

The user can direct the agent naturally:

```text
@reports @orders-db Compare last week's orders with this week and open a chart.
```

The agent receives both natural language and structured context.

### V1 scope

- @ menu UI.
- Capability mentions.
- Source mentions.
- File/report mentions.
- People mentions.
- Model mentions.
- Structured mention payload passed to Mastra.

### Later improvements

- Slash commands.
- `#` channel/document search.
- Smart suggestions based on query.
- Mention permissions and warnings.
- "Use current canvas" mention.
- "Use selected text" mention.

---

## 4.3 Agent Canvas Panel

### What this feature is

The right-side canvas displays the thing the agent is creating or inspecting.

Canvas types:

- Report canvas.
- Document canvas.
- Chart canvas.
- Table/data canvas.
- Email draft canvas.
- Workflow automation canvas.
- Approval canvas.
- Source/citation inspector.
- Memory candidate canvas.

### Why it matters

Long-form work is painful inside chat bubbles. Reports, documents, charts, and workflows need space. The chat should control the work; the canvas should show the work.

### How it should work

The agent can emit an artifact event:

```json
{
  "type": "artifact.created",
  "artifactType": "report",
  "artifactId": "...",
  "title": "Weekly Growth Report"
}
```

The UI opens the canvas with that artifact.

The user can:

- Read.
- Edit.
- Save.
- Export.
- Approve.
- Ask agent to revise.
- View sources.
- Convert to automation.

### Technical approach

Create an artifact abstraction:

```text
artifact_types:
  report
  document
  chart
  table
  email
  workflow
  approval
  source_trace
  memory_candidate
```

Suggested tables:

```text
agent_artifacts
  id
  workspace_id
  run_id
  type
  title
  content
  metadata
  status
  created_by
  created_at
  updated_at
```

Create:

```text
src/components/artifacts/
  artifact-canvas.tsx
  report-artifact.tsx
  document-artifact.tsx
  chart-artifact.tsx
  email-artifact.tsx
  workflow-artifact.tsx
  approval-artifact.tsx
  source-trace-artifact.tsx
```

### End result

The chat says:

```text
"I drafted the weekly report. I opened it on the right."
```

The right panel shows an editable report with charts and citations.

### V1 scope

- Canvas shell.
- Report artifact.
- Document artifact.
- Chart/table artifact.
- Email draft artifact.
- Workflow preview artifact.
- Source/citation inspector.

### Later improvements

- Collaborative canvas editing.
- Version history.
- Comments.
- Canvas tabs.
- Side-by-side source comparison.
- Export to PDF/Docx/Sheets.

---

## 4.4 Suggestions Surface

### What this feature is

The agent should proactively suggest useful actions. These suggestions can appear under the chat start screen, in the left sidebar, or in a dedicated "Suggestions" list.

Examples:

- "Create this week's growth report."
- "Three projects have no recent update."
- "Five customer complaints mention delayed delivery."
- "Your Monday report can be automated."
- "There are unsent campaign drafts waiting for approval."
- "The database map is stale."

### Why it matters

Users should not always need to know what to ask. The system understands the workspace and can surface high-leverage work.

### How it should work

Suggestions come from:

- Stale sources.
- Recent anomalies.
- Recurring manual actions.
- User/team memory.
- Scheduled workflows.
- Pending approvals.
- Unread/undigested source changes.

Each suggestion has:

```text
title
reason
source/evidence
suggested action
risk level
click behavior
```

Clicking a suggestion starts a chat with prefilled context or triggers a workflow draft.

### Technical approach

Tables:

```text
agent_suggestions
  id
  workspace_id
  user_id nullable
  scope
  title
  reason
  action_prompt
  source_refs
  status
  priority
  created_at
  expires_at
```

Suggestion generators:

- Daily workspace scan.
- Source staleness scan.
- Workflow opportunity scan.
- User-specific recommendation scan.

### End result

Below the new chat prompt, users see useful work they can start immediately.

### V1 scope

- Static starter suggestions.
- Dynamic suggestions for stale sources, pending approvals, and report automation opportunities.
- Click-to-start chat.

### Later improvements

- Personalized suggestions from UltraMem.
- Team-level suggestions.
- "Dismiss and remember why."
- Suggestion quality feedback.
- Automated opportunity detection.

---

## 4.5 Automations From Chat

### What this feature is

A user should be able to create automations directly from chat.

Example:

```text
"Every Monday at 8am, create the weekly growth report, open it for approval,
then email leadership after I approve."
```

The agent should understand this as an automation request and create a workflow draft.

### Why it matters

Automations should emerge naturally from work. Users should not have to open a complex builder first.

### How it should work

Conversation flow:

```text
User asks for recurring work
-> agent identifies automation intent
-> agent drafts workflow
-> canvas opens workflow graph
-> user edits schedule/steps/approval
-> user confirms
-> automation is saved and enabled
```

### V1 automation capabilities

Start with:

- Schedule trigger.
- Manual trigger.
- Source refresh trigger.
- Report generation step.
- Document generation step.
- Email draft step.
- Approval step.
- Send email step.
- Create task step.

### Technical approach

Tables:

```text
automations
automation_versions
automation_runs
automation_steps
```

Mastra workflows should be the runtime implementation.

The UI should show workflow graph nodes:

```text
Trigger -> Query data -> Generate report -> Approval -> Send email -> Create tasks
```

### End result

The user can say:

```text
"Make this a weekly automation."
```

The system opens a workflow canvas, asks only necessary clarification, and saves it.

### V1 scope

- Create automation from chat.
- View workflow graph in canvas.
- Edit schedule and approval owner.
- Enable/disable automation.
- Run manually.
- View run history.

### Later improvements

- Full no-code workflow builder.
- Branching conditions.
- Loops.
- Webhooks.
- Multi-source triggers.
- Human assignment nodes.
- Retry policies.
- Failure recovery UI.

---

## 4.6 Automations View and Canvas

### What this feature is

There should be a dedicated automations view, but it should feel like a management surface connected to chat, not a separate app users must live in.

### Why it matters

Automations need visibility:

- What exists?
- What is enabled?
- What ran?
- What failed?
- What is waiting for approval?
- What workflow graph does it follow?

### How it should work

Left sidebar entry:

```text
Automations
```

View modes:

- List of automations.
- Detail canvas for selected automation.
- Run history.
- Pending approvals.
- Failure logs.

Automation canvas:

```text
[Schedule] -> [Fetch sources] -> [Generate report] -> [Approval] -> [Send email]
```

Clicking a node shows:

- Inputs.
- Outputs.
- Last run.
- Errors.
- Approval policy.
- Model/tool used.

### Technical approach

Use a node/edge graph abstraction. V1 can be simple custom SVG/HTML; later can use React Flow if needed.

Do not overbuild graph editing in V1. The priority is clarity.

### End result

The user can inspect automations like connected workflows, understand what happened, and trust scheduled agent work.

### V1 scope

- Automations list.
- Detail canvas.
- Run history.
- Enable/disable.
- Manual run.
- Pending approvals link.

### Later improvements

- Drag-to-edit graph.
- Templates marketplace.
- Department automation libraries.
- Version comparison.
- Simulation/testing mode.

---

## 4.7 Conversation and Memory Modes

### What this feature is

The interface must distinguish between:

- A private conversation with an AI assistant.
- A team/channel conversation between humans.
- A channel where an AI is mentioned.
- A workflow run log.
- A company memory candidate.

This is crucial for Slack-like organization-wide use.

### The problem

If every message in every company channel is stored as memory, the system becomes noisy and unsafe.

People say temporary things, wrong things, jokes, unapproved decisions, sensitive things, and half-formed thoughts. Not all of that should become company memory.

### Conversation surfaces

Use distinct modes:

#### 1. Private AI Chat

User speaks directly with assistant.

Default memory behavior:

- Personal preferences can be remembered.
- Work outputs can generate private memory.
- Company memory requires explicit confirmation or approval.

UI indicators:

- "Private assistant chat."
- Memory chips: "Remembered privately" or "Memory candidate created."

#### 2. Team Channel / Human Conversation

Humans talk to each other.

Default memory behavior:

- Messages are stored as source content if workspace policy allows.
- They are searchable as knowledge with permissions.
- They do not automatically become durable company memory.

UI indicators:

- Normal channel composer.
- Optional "Summarize with AI" or "Ask AI about this thread."

#### 3. AI Mention in Channel

User mentions agent in a channel:

```text
@agent summarize this thread and create tasks
```

Default memory behavior:

- Agent can read the thread as context.
- Generated summary/task output becomes an artifact.
- Durable decisions become memory candidates, not automatic company memory.

UI indicators:

- Agent reply is visibly marked.
- "Used thread context."
- "Created 2 memory candidates" if applicable.

#### 4. Workflow Run Conversation

An automation run has a log.

Default memory behavior:

- Run outcomes are stored as trace.
- Approved corrections can become memory candidates.
- Failed attempts become eval/debug data.

UI indicators:

- Run status.
- Step list.
- Approval checkpoints.

#### 5. Memory Review Conversation

Admin/reviewer accepts or rejects proposed memories.

Default memory behavior:

- Only approved facts enter shared memory.

UI indicators:

- Evidence shown.
- Scope shown.
- Visibility shown.
- Approve/reject/edit buttons.

### Technical approach

Add conversation types:

```text
chat_sessions.type:
  private_ai
  channel_ai_thread
  workflow_run
  memory_review
```

For human channels, keep existing message tables but add AI thread linkage when agent is invoked.

Memory write policy should inspect:

```text
conversation_type
source_type
requested_scope
user_role
approval_policy
```

### End result

Users understand when they are talking to humans, when they are talking to AI, when content is searchable, and when something is being remembered.

### V1 scope

- Private AI chat.
- Channel AI mention/thread distinction in data model/design.
- Memory candidate creation from AI chats and approved artifacts.
- UI labels for memory scope.

### Later improvements

- Full Slack-style channel agent participation.
- Thread-level memory controls.
- Channel policies.
- Per-channel retention.
- "Do not use this thread for memory."

---

## 4.8 Personal vs Company Memory

### What this feature is

Every employee has personal preferences. The company also has shared policies and operating patterns. The system must support both without mixing them.

### Examples

Personal memory:

```text
"Davak likes documents written in a direct, executive style with clear next steps."
```

Company memory:

```text
"500Chow weekly growth reports must include orders, GMV, refunds, net revenue,
CAC, and delivery SLA."
```

Team memory:

```text
"Growth team prefers campaign summaries grouped by channel."
```

Project memory:

```text
"Q3 Launch uses 'merchant activation' as the primary success metric."
```

### How it should work in UI

Generated work should show memory chips:

```text
Used:
- Your writing preferences
- Growth team report standards
- Company reporting policy
```

When the agent learns something:

```text
Should I remember this?
[Remember for me] [Suggest for team] [Suggest for company] [Don't remember]
```

### Technical approach

Memory scope helper:

```text
getMemoryScopes(context):
  user_private_tag
  workspace_tag
  team_tags
  project_tags
```

Before an agent run:

1. Fetch personal profile.
2. Fetch relevant team/workspace profile.
3. Fetch project profile if @project is mentioned.
4. Compose into context with clear labels.

After an agent run:

1. Extract possible learnings.
2. Classify scope.
3. Write private memory if safe.
4. Create candidate for team/company.

### End result

The product feels personally helpful without polluting company-wide behavior.

### V1 scope

- Personal memory.
- Workspace memory.
- Memory scope chips in UI.
- Memory candidate prompt.
- Admin review for company memory.

### Later improvements

- Team and project memory.
- Memory conflict resolution UI.
- Per-user style profiles.
- Department policy memories.
- Memory import/export.

---

## 4.9 Assistant Quality for Documents and Reports

### What this feature is

Every employee should have an assistant that writes high-quality documents and reports using both company standards and personal style.

### Use cases

- Write a report from live data.
- Draft a strategy memo.
- Convert messy notes into a polished document.
- Summarize a meeting into decisions and tasks.
- Prepare a stakeholder update.
- Rewrite a document to company standard.
- Suggest next steps.

### How it should work

User asks:

```text
"Write a launch summary from @q2-launch-brief and @orders-db. Use my style."
```

Agent:

1. Loads user writing preferences from UltraMem.
2. Loads company/team document standards.
3. Retrieves source documents.
4. Queries live data if needed.
5. Opens document/report canvas.
6. Writes draft.
7. Shows sources.
8. Suggests next steps.

### Technical approach

Artifact types:

- `document`
- `report`

Each should support:

- Content.
- Outline.
- Source refs.
- Suggested next steps.
- Export target.
- Save target.
- Revision history.

### End result

The assistant writes useful first drafts that feel like the employee and meet company standards.

### V1 scope

- Report canvas.
- Document canvas.
- Source-grounded writing.
- Personal style memory.
- Company standard memory.
- Suggested next steps.

### Later improvements

- Collaborative editing.
- Templates.
- Brand voice.
- Department-specific document standards.
- Inline comments.
- Version diff.

---

## 4.10 Multi-Model Support

### What this feature is

The platform should support multiple model providers:

- OpenAI.
- Anthropic.
- Groq.
- xAI/Grok.
- Fireworks-hosted models.
- Cerebras-hosted models.
- Other OpenAI-compatible providers.

### Why it matters

Different models are better for different tasks. The product should not be locked into one provider.

### How it should work

V1 model modes:

```text
Auto
  System selects based on task.

Fast
  Cheap/low-latency model for routing and simple summaries.

Deep
  Strong model for analysis, reports, synthesis.

User-selected
  User can mention/select a provider/model when allowed.
```

In chat:

```text
@model Claude analyze this report
@model Groq fast summarize these messages
@model Fireworks use Kimi for this long report
```

### Technical approach

Create model registry:

```text
model_providers
model_profiles
workspace_model_policy
```

Model profile fields:

```text
id
provider
display_name
capabilities
cost_tier
latency_tier
context_window
supports_tools
supports_json
supports_vision
enabled
```

Mastra should use the model registry for routing.

### End result

Admins can enable providers. Users can choose models when allowed. The agent can route automatically most of the time.

### V1 scope

- Model registry config.
- Auto/Fast/Deep model profiles.
- Workspace default model.
- @model mention.
- Trace model used per run.

### Later improvements

- Cost budgets.
- Per-agent model policy.
- Eval-based model selection.
- Fallback routing.
- BYOK per workspace.
- Model comparison mode.

---

## 4.11 Source and Tool Access Through Chat

### What this feature is

Users should access sources and tools through chat rather than manually entering app pages.

Examples:

```text
@gmail what are customers complaining about this week?
@github summarize open issues for checkout
@calendar find time for the launch review
@projects create tasks from this plan
@reports chart signups by channel
```

### How it should work

The @ mention selects the source/tool. Mastra receives the structured context. The tool validates permissions, runs, and returns a compact result.

### Technical approach

Capabilities registry:

```text
capability_id
display_name
description
mention_aliases
required_app
required_connection
tools
artifact_types
approval_policy
```

### End result

The user does not need to care where the data lives. They just summon the source or capability.

### V1 scope

- Reports capability.
- Files/Documents capability.
- Projects capability.
- Email draft capability.
- Knowledge/source query capability.

### Later improvements

- Calendar scheduling.
- GitHub PR/issue actions.
- CRM/customer actions.
- Finance/accounting actions.
- Deep Composio toolkit coverage.

---

## 4.12 Approval Experience

### What this feature is

Approval should appear naturally in chat and canvas.

When the agent wants to send, publish, delete, invite, or modify important data, it pauses and asks.

### How it should work

Chat:

```text
I drafted the email. Approval is required before sending.
```

Canvas:

```text
Recipients
Subject
Body
Sources used
Risk level
[Edit] [Approve and send] [Decline]
```

### Technical approach

Approval artifact:

```text
type: approval
action_type: send_email | create_tasks | publish_report | ...
payload_preview
payload_final
sources
risk_level
status
```

Mastra workflow should suspend until approval and resume after decision.

### End result

The user trusts the system because external actions never happen silently.

### V1 scope

- Approval artifact canvas.
- Email send approval.
- Automation enable approval.
- Bulk task creation approval.

### Later improvements

- Approval delegation.
- Approval rules.
- Multi-step approvals.
- Mobile approval notifications.
- Audit export.

---

## 5. V1 Build Plan

V1 should be built in coherent feature groups.

### Group 1: Chat Shell and Mastra Runtime

Build:

- Chat-first shell.
- Mastra streaming endpoint.
- Thread persistence.
- Agent run steps.
- Right canvas state.

Done when:

- User can create chats.
- Agent streams responses.
- Tool steps appear.
- Canvas can open from agent events.
- No OpenClaw Gateway dependency in the main chat.

### Group 2: @ Mentions and Capability Registry

Build:

- Mention composer.
- Mention menu.
- Capability registry.
- Source/resource search.
- Mention payload sent to agent.

Done when:

- User can type `@reports`, `@files`, `@database`, `@projects`, `@model`.
- Agent receives structured mentions.
- Tool selection is more grounded because of mentions.

### Group 3: Artifacts and Canvas

Build:

- Artifact table.
- Canvas shell.
- Report artifact.
- Document artifact.
- Chart/table artifact.
- Source trace artifact.

Done when:

- Agent can create a report/document and open it in canvas.
- User can inspect sources and save output.

### Group 4: Knowledge and Report Tools

Build:

- Mastra tools wrapping existing knowledge router.
- Report-generation tool.
- Document-drafting tool.
- Source/citation trace.

Done when:

- User can ask source-grounded questions.
- User can create a report from live data.
- User can open report/chart in canvas.

### Group 5: UltraMem Integration

Build:

- UltraMem client wrapper.
- Memory scope helpers.
- Profile injection.
- Memory search tool.
- Memory candidate tool.
- Memory chips in UI.

Done when:

- Agent uses personal/workspace memory.
- User can choose whether a correction is remembered.
- Company memory becomes candidate, not automatic.

### Group 6: Approvals

Build:

- Approval table.
- Approval artifact.
- Approval flow in chat/canvas.
- Resume after approval.

Done when:

- Email draft cannot send without approval.
- Bulk task creation asks approval.
- Approval decisions are logged.

### Group 7: Automations

Build:

- Automation tables.
- Create automation from chat.
- Workflow canvas.
- Manual run.
- Schedule trigger.
- Run history.

Done when:

- User can say "make this weekly."
- Agent creates workflow draft.
- User can approve/enable it.
- User can see automation graph and run history.

### Group 8: Suggestions

Build:

- Starter suggestions.
- Dynamic suggestions from pending approvals, stale sources, and recurring report opportunities.
- Click-to-start chat.

Done when:

- AI Home is useful before the user types.
- Suggestions can start agent runs with context.

---

## 6. V2 Improvements

V2 should deepen the system rather than change the core interface.

### 6.1 Advanced automation builder

- Drag-and-drop workflow editing.
- Conditional branches.
- Retry policies.
- Webhooks.
- Multi-source triggers.
- Simulation/testing mode.
- Workflow templates.

### 6.2 Rich memory governance

- Full Memory Center.
- Team/project memory scopes.
- Memory conflict resolution.
- Memory evidence viewer.
- Retention policies.
- Sensitive memory detection.
- Import/export.

### 6.3 Collaboration

- Shared agent threads.
- Channel agent participation.
- Comments on artifacts.
- Collaborative document/report editing.
- Team review workflows.

### 6.4 Model intelligence

- Eval-based model routing.
- Per-workflow model policy.
- Cost budgets.
- Fallback models.
- BYOK.
- Model comparison on artifacts.

### 6.5 Expanded sources/tools

- Calendar scheduling.
- GitHub issue/PR actions.
- CRM.
- Finance/accounting.
- Support tools.
- HR/admin workflows.

### 6.6 Private evals dashboard

- Create evals from corrected runs.
- Run evals before deploying agent changes.
- Track memory quality.
- Track report accuracy.
- Track tool-choice quality.
- Track approval acceptance.

### 6.7 Proactive company intelligence

- Risk radar.
- Process mining.
- Workflow opportunity detection.
- Department insights.
- Executive briefings.

---

## 7. V1 Data Model Summary

Suggested new tables:

```text
agent_threads
agent_messages
agent_runs
agent_steps
agent_artifacts
agent_mentions
approval_requests
automations
automation_versions
automation_runs
automation_steps
agent_suggestions
memory_candidates
memory_events
model_providers
model_profiles
workspace_model_policy
```

Existing tables to reuse:

```text
workspaces
workspace_members
chat_sessions
chat_messages
knowledge_pages
knowledge_index
knowledge_documents
knowledge_sources
knowledge_query_log
report_sessions
report_runs
saved_reports
files
projects
tasks
messages/channels
external_accounts
database_connections
```

Implementation note:

The existing `chat_sessions`/`chat_messages` tables can either be extended or replaced with `agent_threads`/`agent_messages`. For clarity, V1 can extend existing tables, but long term the product will likely need agent-specific fields that are cleaner in dedicated tables.

---

## 8. Core User Flows

### 8.1 Generate a report

```text
User:
  @reports Compare orders this week vs last week and explain what changed.

System:
  loads memory profile
  uses database/content knowledge
  queries live data
  creates report artifact
  opens canvas
  shows chart and citations
  suggests next steps
```

### 8.2 Create an automation

```text
User:
  Make this report run every Monday at 8am and send after I approve.

System:
  detects automation intent
  creates workflow graph
  opens automation canvas
  asks for missing recipients if needed
  saves disabled draft
  enables after user approval
```

### 8.3 Channel AI use

```text
User in #growth:
  @agent summarize this thread and create follow-up tasks.

System:
  reads thread context
  creates summary artifact
  drafts tasks
  asks approval before creating tasks
  creates memory candidates only for durable decisions
```

### 8.4 Personal style memory

```text
User:
  Rewrite this in my style. Keep it concise and make next steps explicit.

System:
  uses private user memory
  rewrites document
  asks: "Should I remember this as your document style?"
```

### 8.5 Company standard memory

```text
Owner:
  All leadership reports should include net revenue after refunds.

System:
  creates company memory candidate
  owner approves
  future report agents use the standard
```

### 8.6 Model selection

```text
User:
  @model Claude critique this strategy memo.

System:
  checks workspace model policy
  runs allowed model
  logs provider/model/cost in trace
```

---

## 9. Technical Guardrails

### 9.1 Mentions are hints, not permissions

If a user mentions `@database`, the server still checks whether they can access that database.

### 9.2 Models cannot choose raw workspace IDs

Mastra tools must read workspace/user from server request context, not from model-provided arguments.

### 9.3 Channel content is not automatically company memory

Human conversations can be searchable source material under policy, but durable memory requires policy:

- private memory,
- explicit remember action,
- repeated evidence,
- or approval.

### 9.4 External actions require approval

Sending emails, creating campaigns, posting externally, deleting, inviting, or bulk updates should require approval.

### 9.5 Memory must be visible

Users should see when memory is used and when memory is written.

### 9.6 Trace every agent run

Every run should record:

- model,
- tools,
- sources,
- memory used,
- artifact created,
- approval decisions,
- cost,
- errors.

---

## 10. Implementation Order Recommendation

Recommended order:

1. Mastra chat endpoint.
2. Chat-first shell.
3. Artifact/canvas foundation.
4. @ mention composer.
5. Knowledge/report tools.
6. UltraMem profile/search integration.
7. Approval artifact.
8. Report/document artifact.
9. Automation draft from chat.
10. Automation list/canvas.
11. Suggestions.
12. Memory candidate review.
13. Multi-model registry.

This order gives visible product value early while laying the foundation correctly.

---

## 11. What V1 Should Feel Like

V1 should feel like:

- "I can ask one place to do real company work."
- "I can point the agent with @ mentions."
- "I can see the work in a canvas."
- "I can approve before anything important happens."
- "It remembers my preferences but does not confuse them with company policy."
- "It can create a repeatable automation from a conversation."
- "I can see which model, source, and memory it used."

V1 should not feel like:

- A generic chatbot.
- A set of disconnected app pages.
- A half-working demo where chat only gives text.
- A black box that sends or remembers things silently.

---

## 12. Open Questions For Screenshots And Design Pass

When screenshots are available, decide:

1. Should the left sidebar show chats first, or workspace sections first?
2. Should Suggestions live under the empty chat prompt, in the sidebar, or both?
3. Should the canvas be always visible on desktop or open only when needed?
4. Should automations be a sidebar section or a canvas-only artifact list?
5. How dense should the @ menu be?
6. How should memory chips look without making the UI noisy?
7. How should model selection appear: composer control, @ mention, or settings default?

The product direction is clear enough to plan implementation now. The screenshots should refine layout and visual hierarchy, not change the architecture.

---

## 13. Final V1 Feature List

Required for a strong V1:

- Chat-first shell.
- Mastra-powered streaming.
- @ mention menu.
- Capability/source/model mentions.
- Agent run step display.
- Right-side canvas.
- Report/document/chart artifacts.
- Source/citation inspector.
- UltraMem personal/workspace profile injection.
- Memory scope chips.
- Memory candidate prompt.
- Approval artifact.
- Email/send approval.
- Automation creation from chat.
- Automation list and workflow canvas.
- Suggestions surface.
- Model registry with Auto/Fast/Deep and provider support.
- Trace logging.

Deferred to V2:

- Full no-code workflow editor.
- Deep channel AI participation.
- Full Memory Center.
- Private eval dashboard.
- BYOK.
- Advanced model routing.
- Collaboration inside artifacts.
- Expanded enterprise connectors.

