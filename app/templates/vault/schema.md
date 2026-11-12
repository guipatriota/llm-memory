---
title: Schema of the LLM memory store
type: meta
---

# Schema of the LLM memory store

This file is the **brain** of the system. The ingest agent and the lint agent read these rules and follow them. Editing this file changes their behaviour without touching any code.

## What this store is

The persistent memory of your LLM agents (Claude Code today). It is the **source of truth** of what the agents remember, kept apart from your own notes and documents: here is what the agents remember, there is what you know.

Three layers:
1. **Raw sources** (`sources/`): session transcripts. Immutable. The agent reads them and **never edits or deletes them**.
2. **Wiki** (`pages/` + `MEMORY.md` + `log.md`): pages the agent writes and updates.
3. **Schema** (this file): the rules.

## Layout

```
<vault>/
├─ MEMORY.md                       unified index (auto-loaded; durable pages only; budget: 200 lines / 25 KB)
├─ schema.md                       this file
├─ log.md                          append-only journal
├─ memory.config.json              language, transcript backup, schedule
├─ sources/claude-code/<project>/  raw transcripts, immutable (its own private git repository)
├─ pages/
│  ├─ user/                        stable profile (global)
│  ├─ feedback/                    working guidelines (global)
│  ├─ entities/                    people, tools, repositories, systems (global)
│  ├─ projects/<project>/          durable state per project
│  └─ sessions/<project>/          one summary per ingested session
└─ .meta/                          lint reports and run logs
```

## Namespacing

- **Global** (shared by every project): `pages/user/`, `pages/feedback/`, `pages/entities/`.
- **Per project**: `pages/projects/<project>/`, `pages/sessions/<project>/`, `sources/claude-code/<project>/`.
- `<project>` is the kebab-case slug of the project folder name.

## Language and fixed tokens

- The **language of the prose** (summaries, hooks in the index, reports, page bodies) is the `language` value of `memory.config.json` (`en` or `fr`).
- The following **tokens are always English**, whatever the language, because the tools parse them: frontmatter keys and enumerated values (`type`, `status`, `confidence: stated|inferred`, `local-only`), the section headings `## Global`, `## Project: <slug>`, `## Sessions`, `## Decisions`, `## Artifacts`, `## Entities`, `## Pending`, `## Related`, `## Provenance`, the `log.md` entry format and its event types, slugs and file names.

## MEMORY.md (unified index, auto-loaded)

- This is the file Claude Code auto-loads in every session (through the memory link). The auto-load stops at **200 lines and at about 25 KB**; whatever lies beyond does not exist for the agent. The index therefore has a **fixed budget: at most 200 lines, at most 25,000 bytes, no line longer than 150 characters**. Comfort target: about 120 lines and 20 KB.
- **One line per DURABLE page** (`project`, `entity`, `user`, `feedback`, project indexes, dated write-back notes at the root). **Sessions do not enter the index**: each session is listed on the project page, section `## Sessions` (or in `pages/projects/<project>/<project>-sessions.md` when the project has no durable page), one line with a short hook. The index points to the project page; the project page points to the sessions. A **session line** is a line whose main pointer is a page under `pages/sessions/`.
- Line format: `- [[page]] - hook` (pointer plus hook, at most 150 characters in total: what it is, current state, date of the last milestone). Details, history, commits and lists live on the page. No blank lines. Sections: `## Global`, then one `## Project: <slug>` per project.
- Every write to the index (ingest, lint, interactive write-back, manual edit) ends by checking the budget: line count, byte count and the longest line. Over budget (including lines that arrived through write-back or a `merge=union`): the same run fixes it. A session line moves to the `## Sessions` section of the project page; a long line is shortened after making sure the detail is on the page. Never discard a fact: what leaves the index goes to a page.

## Page format

YAML frontmatter + body + a **Provenance** block. Common frontmatter fields:
`name` (slug) · `type` (session|project|entity|user|feedback) · `updated` (ISO date) · `status` (active|stale|archived) · `tags` · `sources` (links to `sources/`) · `confidence` (`stated`|`inferred`, see below).

- **session**: plus `date`, `project`, `agent`, `source`. Body: summary, decisions, artifacts and files touched, pending items, links to the entities and projects updated.
- **project**: durable state, rewritten at each ingest; lists ALL the sessions of the project in `## Sessions` (one line per session, short hook). It is the only list of sessions: `MEMORY.md` does not list them.
- **entity**: person, tool, repository, system.
- **user**: stable profile.
- **feedback**: a working guideline, followed by `**Why:**` and `**How to apply:**`.

## Confidence: stated versus inferred

Every recorded fact says whether the user **stated** it or the agent **inferred** it:
- `confidence: stated`: the user said it directly.
- `confidence: inferred`: derived from transcripts or exports by the agent. **It may be wrong.**
- Mixed pages: besides the field, mark the specific fact inline with `(inferred)`.
- **Never treat `inferred` as true without the user's confirmation.** The lint lists unconfirmed inferences for you to validate.
- Default for any fact coming from a transcript or export: `inferred`.

## log.md

Append-only. One entry per event:
`## [YYYY-MM-DD] <type> | <title> | <n> pages touched`
Types: `ingest`, `lint`, `backfill`, `init`, `manual`.

## Ingest workflow

Trigger: the Stop hook copies each transcript into `sources/`; the scheduled run (`llm-memory ingest`) starts the ingest agent. Steps of the agent:

1. Read the new sources in `sources/`.
2. **Redact secrets BEFORE writing anything**: tokens, keys, passwords, API keys, connection strings, session cookies become `[REDACTED]`. Never write a secret into the store.
3. Create `pages/sessions/<project>/<date>_<slug>.md` with the frontmatter `name, type: session, date, project, agent, source, status, tags, confidence` and a **Provenance** block. Facts from the source are `inferred` by default; mark the non-obvious ones inline with `(inferred)`.
4. Update the affected `pages/projects/<project>/`, `pages/entities/`, etc. (cross-references through wikilinks). **Dedup**: update the existing page instead of duplicating it. The new session enters the `## Sessions` section of the project page (create `pages/projects/<project>/<project>-sessions.md` when the project has no durable page; the section goes before `## Provenance` or before the `**Provenance:**` / `**Why:**` block).
5. Update `MEMORY.md` in the right section: **only lines of durable pages** (create or update the line of the durable page touched; never one line per session) and check the budget (at most 200 lines, 25,000 bytes, 150 characters per line); over budget, fix it in the same run.
6. Append to `log.md`.

## Raw transcript backup (sources repository)

- `sources/` is a **separate private git repository**, nested in the working tree of this vault (the vault's `.gitignore` ignores `sources/`, so the two coexist). When `sources.enabled` is false in `memory.config.json`, `sources/` is a plain local folder and nothing leaves the machine.
- **Fed at the end of every session, on every machine**: the Stop hook, after copying the transcript, commits and pushes the sources repository (local commit always; push best-effort, offline tolerated). The scheduled ingest reconciles daily (`pull --rebase` + push): it picks up deferred pushes and brings the transcripts of the other machines.
- **This repository contains secrets in plain text.** It must stay private, must never be made public, must never be shared or served by any integration. Enable GitHub secret scanning and push protection on it if your plan offers them.
- **Light sync at the start of every session** (SessionStart hook): `pull --ff-only` of the vault (fresh memory from the other machines) plus push of pending backups. Best effort: short timeouts, silent failure. Offline, the session opens with the local memory and the scheduled run reconciles later. Resilience order: Stop hook (end of session), SessionStart hook (start of the next one), scheduled run.
- Immutability still holds: each machine only adds or updates its own uuids; nothing is edited or deleted; no history rewrite.

## Synchronisation between machines: single writer

(Mechanism: `vault-sync`, used by every scheduled run.)
- **Ingest and lint only write while holding the remote lock** (`refs/locks/vault-writer`, created atomically). Reason: `sources/` is shared, so two machines running at the same time ingest the SAME sources, and two renderings of the same fact always conflict. Whoever arrives second waits for the other to finish (up to 30 min), pulls the result and only then works: the sources already ingested are skipped by uuid idempotence.
- **No lock, no write**: unreachable remote or a lock held beyond the wait means the run is skipped. Nothing is lost (the sources wait for the next run) and no divergent history is born. A lock older than 60 min, or left by a dead run on the same machine, is taken over.
- **Rejected push** (write-back of the other machine in the middle of the run): integrate `origin/main` (rebase; merge when there is overlap) and try again.
- The write-back of interactive sessions (native memory link) still happens without a lock; the run commits it before integrating. It is the only remaining source of real conflicts, handled by the next section.

## Merge reconciliation (automatic)

When the two machines edited the same page, the run leaves a `git merge` of `origin/main` open, lists the files in `.git/vault-sync-conflicts` and calls the reconciliation agent. The agent **only edits those files**; the run validates (no conflict marker left) and commits. Rules:

- **Union without discarding**: every fact present on either side stays. The same fact in two renderings stays **once**, in the more complete rendering, completed with what only the other side had; never the two texts side by side.
- **Frontmatter**: `updated` = the most recent date; `sources`, `tags` and session lists = union, without repetition.
- **Same session under two file names** (same uuid in `source:`): both pages stay, each with the line `- Parallel page (merge of <date>): [[other]]` under `## Related`; the merge of the two is the lint's job. A page created with the SAME name on both sides: one page, merged by the union rule.
- **Contradiction between the sides** (incompatible values, dates or states): keep both, marked `CONTRADICTION (merge <date>)`; never choose. Same rule as the lint.
- **Provenance**: keep both sides' and say that the versions were merged.
- `log.md` and `MEMORY.md` use `merge=union` and do not arrive as conflicts; if they do, `log.md` keeps the entries of both sides and `MEMORY.md` one line per durable page, within budget.
- No git command that changes the repository (`add`, `commit`, `merge`, `rebase`, `push`); nothing outside the list is touched.

## Skip rule (anti-loop, anti-noise)

- Sessions with the environment variable `CLAUDE_MEMORY_SKIP=1` **are not captured nor ingested**: the ingest and lint runs themselves, and any maintenance routine you mark that way. This cuts the **self-ingest loop**.
- **Everything else is ingested**: interactive sessions, developer agents, headless agents without the marker.

## Lint workflow (scheduled)

Scans the store and writes a report to `.meta/lint-<date>.md` plus an entry in `log.md`:
- contradictions, stale pages (status, age), orphans (no incoming link), missing cross-references, duplicates.
- **`MEMORY.md` budget** (lines, bytes, lines over 150 characters, session lines, durable page without a line, session missing from the project's `## Sessions`): measure, record in the report and fix in the same run (including adding the missing session to `## Sessions`). `log.md` is append-only: it is never rewritten and its links to pages since merged or renamed do not count as broken.
- **unconfirmed `inferred` facts**: list them for the user to validate.
- **Auto-fix only what is safe**: merge of an obvious duplicate (including a pair of session pages with the same uuid and the same range, born from a parallel ingest: merge by union without discarding, keep one name), format, missing link, index budget (move a session to the project page, shorten a line after moving the detail to the page).
- **Contradiction: flag it, do NOT resolve it alone** (risk of data loss).

## Provenance and trust

Every statement on a page traces back to a source in `sources/` through a link. The machine writes, but everything is auditable. **Never quote the agent's memory as truth without the source link**, and respect the `confidence` field.

## Local-only pages

`local-only: true` in the frontmatter marks a page that must never be served by any external integration (a future MCP server, a public page, an export). The private git remote is allowed: the trust perimeter is the private repository, not the machine.

## Conventions

- Language of the prose: the `language` value of `memory.config.json`. ISO dates (`YYYY-MM-DD`). Kebab-case slugs. Short wikilinks `[[...]]`. No em dash in generated text; use a plain hyphen or a new sentence.
- `sources/` is immutable: never delete or edit a source.
