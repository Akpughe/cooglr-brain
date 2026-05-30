# GitHub Code Ingestion — design notes (for later)

**Date:** 2026-05-30
**Status:** Not started — planning notes. Pick up when ready.
**Context:** GitHub is connected via Composio and verified. The current adapter
(`src/lib/composio/toolkit-ingest.ts` → `fetchGithub`) ingests **repo metadata
(name + description + language) + issues** only. It does **not** ingest code/file
contents yet.

## Capability check (confirmed live 2026-05-30)

We have full read access to repository code:
- OAuth scope on the connection includes **`repo`** (full repo read).
- Composio tools available (all under the `github` toolkit), verified to exist:
  - `GITHUB_GET_REPOSITORY_CONTENT` — lists a path's files/dirs (returns
    `data.content[]`, each with `download_url`, `html`, `git` blob links).
    **Tested: works.** `arguments: { owner, repo, path }` (path "" = root).
  - `GITHUB_GET_A_TREE` — full recursive file tree of a ref.
  - `GITHUB_GET_A_BLOB` — raw contents of a single file (the actual code).
  - `GITHUB_GET_A_REPOSITORY_README` — the repo README.
  - `GITHUB_GET_LARGE_FILES`, `GITHUB_GET_A_REPOSITORY_README_FOR_A_DIRECTORY`.

So: **access = yes; ingestion = not built.**

## Design principle

Do NOT embed every line of every repo — repos can have thousands of files /
millions of lines; embedding all of it is expensive and low-signal. Apply the
platform's core principle: **the map plans, the source digs.** Map the repo's
structure (cheap), fetch specific file contents on demand when a question needs
them (the dig) — the same pattern as the DB-structural layer.

## Options (in increasing scope)

### (a) Selective text ingest — quick win, recommended first
Extend `fetchGithub` to also pull, per repo:
- README via `GITHUB_GET_A_REPOSITORY_README` (one call/repo).
- Optionally a few high-signal text files (`*.md` docs, top-level config/manifest)
  by listing root via `GITHUB_GET_REPOSITORY_CONTENT` and fetching `.md`/docs.
Run through the existing content pipeline (`ingestContentDoc`). Makes
"what does repo X do / how do I run it" answerable. Bounded, cheap.

### (b) Structural code map + on-demand file dig — the real version
1. **Map (at ingest):** for each repo, `GITHUB_GET_A_TREE` → a structural map
   page (file tree + what each area does, synthesized from paths + README).
   Store as a `knowledge_pages` entry (type `domain`/`document`), like the DB map.
2. **Dig (at query):** a new dig tool (`githubDigTool`) that, given a question +
   the repo map, fetches the relevant file(s) live via `GITHUB_GET_A_BLOB` (the
   `download_url`s from `GITHUB_GET_REPOSITORY_CONTENT`) and feeds them to
   synthesis. No mass embedding; current code always (live read).
3. Register `githubDigTool` in `src/lib/knowledge/dig/registry.ts` alongside
   `sqlDigTool` and `vectorDigTool`; the router/planner routes code questions to it.

### (c) Leave code out
Repos remain queryable by name/description/issues (current state).

## Notes / gotchas
- Verified result shapes: repos → `data.repositories[]`
  ({name, full_name, owner.login, description, language, open_issues_count});
  issues → `data.issues[]`; content → `data.content[]`.
- Manual `tools.execute` needs `dangerouslySkipVersionCheck: true`.
- Tenancy: GitHub content is per-user (the connected account); ingest under the
  workspace like other sources; Qdrant points carry `workspace_id`.
- Ties into the broader **source-scoped retrieval** refinement (add `source` to
  the Qdrant payload so a "GitHub" question returns only GitHub chunks — currently
  retrieval is global semantic and may also surface Gmail). That refinement needs
  a re-ingest and pairs naturally with this work.
- Large/binary files: skip or route through Nuton (already used for PDFs).

## Recommendation
Do **(a)** first (small, big quality jump), then **(b)** when real code Q&A is
wanted. Bundle the `source`-payload refinement with whichever we do.
