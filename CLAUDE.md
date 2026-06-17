@AGENTS.md

# cooglr-brain — project notes

A company-OS / chat-first agentic workspace (Next.js 16 App Router, React 19, TypeScript, Supabase, Mastra).

## Architecture
- **Workspace home** (`/[workspaceSlug]`) renders the full-screen chat-first **agent shell** (`src/components/agent-shell/`). Other app routes (messages/projects/files/…) keep the classic icon-rail chrome via `WorkspaceChrome`.
- **Agent**: a single Mastra supervisor (`src/mastra/`) with tools — `ask_workspace_knowledge` (workspace docs/DB), and `save_memory` / `recall_memory` (durable memory).
- **Memory + retrieval foundation: UltraMem** (`src/lib/memory/`). The content path reads UltraMem (`runContentQuery`); ingestion dual-writes into it. `container_tag`s are built server-side via `scopes.ts` and never come from the model.
- **Knowledge layer** (`src/lib/knowledge/`): unified router (database SQL path + content path), local PDF extraction via `unpdf`, deterministic chart/table builder.

## Models
All LLM calls run **Groq `openai/gpt-oss-120b`** (the Fireworks account is suspended). Set via `MODEL_PROFILES` (registry), `KNOWLEDGE_MODEL`, `KNOWLEDGE_MODEL_BULK`. `groq/<model>` ids resolve to the Groq provider; `accounts/fireworks/...` to Fireworks; anything else to the Vercel AI Gateway.

## Local services
- **UltraMem** (`http://localhost:8080`) + its Qdrant — run via the `ultramem` docker compose. App auth via `ULTRAMEM_API_KEY` (must match the service `.env`).

## Conventions
- This is NOT stock Next.js — read the relevant guide in `node_modules/next/dist/docs/` before changing framework behavior (see AGENTS.md).
- Env (`.env`, `.env.local`) is gitignored; never commit secrets. `.env.example` documents the keys.
