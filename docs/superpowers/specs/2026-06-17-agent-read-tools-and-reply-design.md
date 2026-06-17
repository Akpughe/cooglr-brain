# Agent Read Tools + Reply-in-Thread — Design Spec

**Date:** 2026-06-17
**Status:** Approved design, ready to build
**Related:** the action-layer spec (`2026-06-17-agent-actions-over-composio-design.md`), `src/lib/composio/toolkit-ingest.ts`, the approvals slice.

## 1. Context & goal

We built the **act** half (gated write actions → approval → execute). This adds the **perceive** half: the agent reads the user's connected sources (Gmail, Slack, GitHub, Drive) to build context, then can **reply within an existing Gmail thread**. Target flow (the Codex-style demo):

```
"@gmail read my thread with Ayo"  → agent reads the thread, summarizes context
"write another follow-up"          → agent drafts a contextual reply (just the model)
"add to the thread (send it)"      → gmail_reply(threadId, body) → approval card → sends in-thread
```

## 2. Decisions (settled in brainstorming)

1. **Scope = universal reads, all four sources** (Gmail/Slack/GitHub/Drive) + `gmail_reply`. All four Composio auth-configs are set, so all are connectable.
2. **Reads are a new NON-approval tool category.** Reading the user's own connected source returns data to the model directly; it is connection-gated and identity-bound, but not approval-gated (it's not an outward/irreversible action). Writes stay gated.
3. **Reuse proven slugs.** Read tools wrap the exact Composio actions the ingestion path already exercises in production (see table). The only unverified calls are `gmail_read_thread` (by-thread-id) and the write `gmail_reply`.
4. **Draft surface = chat + approval card.** The drafted reply is chat text; "send it" routes through the existing approval card for final review. Editable right-canvas draft is deferred (V2).

## 3. Architecture

```
READ tools  (new)   connection-gated, NO approval → call Composio read slug → return data + citations
ACTION tools(built) connection-gated, approval-gated → create pending approval → execute on approve
```
Both are registry-driven, attached to the agent **per run** filtered to connected toolkits (the dynamic-tools path already in place). Identity (the acting user) comes from the trusted RequestContext, never the model.

## 4. Read tools (reusing proven ingestion slugs)

| Source | Tool(s) | Composio slug | Proven? |
|--------|---------|---------------|---------|
| Gmail | `gmail_search(query)` | `GMAIL_FETCH_EMAILS` | ✅ ingestion |
| Gmail | `gmail_read_thread(threadId)` | `GMAIL_FETCH_MESSAGE_BY_THREAD_ID` | ⚠️ verify live |
| Slack | `slack_search(query)` / `slack_read_channel(channel)` | `SLACK_FIND_CHANNELS`, `SLACK_FETCH_CONVERSATION_HISTORY` | ✅ ingestion |
| GitHub | `github_list_issues(repo)` / `github_read_issue` | `GITHUB_LIST_REPOSITORY_ISSUES` | ✅ ingestion |
| Drive | `drive_search(query)` / `drive_read_file(fileId)` | `GOOGLEDRIVE_LIST_FILES`, `..._DOWNLOAD/EXPORT` | ✅ ingestion |
| Gmail (write) | `gmail_reply(threadId, body)` | `GMAIL_REPLY_TO_THREAD` | ⚠️ verify live |

## 5. Components

- `src/lib/composio/reads.ts` (new) — per-source read functions (query/id-driven) over the proven slugs, with **defensive parsing** (external shapes vary, like toolkit-ingest) and **caps** (§7). Returns normalized `{ id, title, text, ref }[]`.
- `src/mastra/tools/read-tools.ts` (new) — read-tool registry + `makeReadTool(entry)` factory + `buildReadTools(connected)`. Each tool's `execute` calls the read function for the acting user and returns `{ source, items, markdown, citations }` so the existing message/sources UI shows "Sources: <toolkit>".
- `src/lib/agent/approvals/executors.ts` (mod) — add the `gmail_reply` action entry (`{ threadId, body }`, toolkit `gmail`).
- `src/mastra/agents/supervisor-agent.ts` (mod) — attach `buildReadTools(connected)` in the dynamic tools fn; instructions note the read tools and that reading needs no approval.
- `src/app/api/agent/route.ts` — unchanged (`connectedToolkits` already in context).

## 6. Trust & safety

- Reads run against the **acting user's own** Composio connection (identity from RequestContext), connection-gated — a user can't read a source they haven't connected, nor another user's.
- Reads are **not** approval-gated by design (reading your own inbox is not outward-facing). Writes (`gmail_reply`) stay approval-gated, requester-only, payload-from-DB — same as `gmail_send_email`.
- Read tool output is capped to avoid context bloat (§7) and to limit how much source content is pulled per call.

## 7. Context budget

Read tools cap and truncate: a thread/channel returns up to ~20 messages, each trimmed (~2k chars); search/list returns top ~10 with snippets. The model summarizes from there. Caps are constants in `reads.ts`, logged when truncation drops content.

## 8. Testing

- **Per source:** connect it (Connectors view), ask the agent to read (`@gmail read my thread with X` / `@slack what's in #growth`), confirm it returns grounded content with a Sources chip.
- **Reply loop (Gmail):** read a thread → "write a follow-up" → "send it" → approval card → approve → reply lands **in the thread**. This verifies `gmail_reply` (and `gmail_read_thread`) arg shapes — the two unverified calls.
- **Disconnected:** a read tool for an unconnected source isn't offered; the agent says to connect it.

**Acceptance:** connect Gmail → "read my latest thread with <someone>" → agent summarizes it → "draft a follow-up" → draft appears → "send it" → approval card → approve → the reply appears in that Gmail thread.

## 9. Scope / non-goals

- **In:** read-tool category; Gmail/Slack/GitHub/Drive reads (search + read-detail); `gmail_reply`; citations→sources UI; context caps.
- **Out:** editable right-canvas draft; reply for non-Gmail sources (Slack reply, GitHub comment) — cheap follow-ons; a contacts/CRM system (person resolution is search + `save_memory`); write actions beyond Gmail.

## 10. Open unknowns

1. `GMAIL_FETCH_MESSAGE_BY_THREAD_ID` and `GMAIL_REPLY_TO_THREAD` arg/result shapes — verify against a live Gmail connection (Tier C).
2. `gmail_reply` recipients — reply-all vs last-sender; confirm what `GMAIL_REPLY_TO_THREAD` does and whether a `to` override is needed.
3. Per-source result shapes — reuse the defensive parsing patterns from `toolkit-ingest.ts`.
