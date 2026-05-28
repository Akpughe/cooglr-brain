# Content Ingestion + RAG (Sub-Project 1.5 of the Understanding Layer)

**Date:** 2026-05-28
**Status:** Design — building
**Depends on:** the DB knowledge layer (shared engine + dig seam).

## Goal
Make the AI understand the workspace's *documents*, not just its databases. Ingest the Files app (pages + uploads, incl. PDF/Office) into a vector corpus, and answer content questions via the existing Plan → Dig → Synthesize loop using a new vector dig tool.

## Stack (decided 2026-05-28)
| Concern | Choice |
|---|---|
| Vector store | **Qdrant** (cloud) — one collection, `workspace_id` payload filter for tenancy (Qdrant has no RLS) |
| Embeddings | **Voyage** (`voyage-3.5`, 1024d), `input_type` document/query |
| Doc extraction | **Nuton** `/v2/documents/extract` for PDF/Office; TipTap JSON parsed directly; plain text passthrough |
| Chunking | reuse `chunkArray` (~1500 chars, overlap) |
| Orchestration | reuse the dig seam: new `vectorDigTool` registered beside `sqlDigTool` |

Env: `QDRANT_URL`, `QDRANT_API_KEY`, `VOYAGE_API_KEY`, `NUTON_KEY`, `KNOWLEDGE_EMBED_MODEL`.

## Components (src/lib/knowledge/)
- `embeddings.ts` — Voyage embed helper (`embedDocuments`, `embedQuery`), batched.
- `qdrant.ts` — client wrapper: `ensureCollection`, `upsertChunks`, `search` (workspace-filtered), deterministic point ids.
- `extract.ts` — `tiptapToText` (pure), `extractViaNuton` (glue), plain-text passthrough.
- `content-ingest.ts` — per file: get text → chunk → embed(document) → upsert to Qdrant + record in `knowledge_documents`.
- `dig/vector-dig.ts` — `vectorDigTool`: embed(query) → Qdrant search (workspace filter) → top-K chunks as `DigResult`.
- `content-query.ts` — embed → vector dig → synthesize answer with citations to source files.

## Data
- New Supabase table `knowledge_documents` (workspace_id, file_id, title, status, chunk_count, updated_at) — RLS-scoped, tracks what's ingested for listing/UI. Chunks live in Qdrant.

## Routes
- `POST /api/knowledge/content/ingest` — ingest a workspace's files.
- `POST /api/knowledge/content/query` — ask a content question.

## Tenancy
Qdrant points carry `workspace_id` in payload; every search filters on it. The Supabase `knowledge_documents` table is RLS-scoped as usual.

## Out of scope (v1)
- Re-embedding on file edit (manual re-ingest for now).
- Merging content answers with DB answers in one query (that's the agentic harness, SP3). The vector tool is registered now so the harness can route to it later.
