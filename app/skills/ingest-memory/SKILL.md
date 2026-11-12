---
name: ingest-memory
description: Ingests new transcripts from sources/ of the llm-memory vault into wiki pages (sessions, projects, entities), following the rules of schema.md. Use when asked to ingest or process new sources of the LLM memory.
---

# ingest-memory

Turns the raw transcripts in `sources/` of the `llm-memory` vault into wiki pages. **The policy lives in `schema.md` at the root of the vault: read it first and follow it; this file only operationalises the steps.**

## Steps

1. **Read `schema.md`** in full (page format, confidence, namespacing, conventions, fixed tokens versus language).
2. **Read `memory.config.json`**: write all prose in its `language` (`en` or `fr`); frontmatter keys and values, section headings and the `log.md` format stay in English exactly as the schema defines them.
3. **Enumerate the sources**: every `sources/claude-code/<project>/<uuid>.jsonl`.
4. **Skip what is already ingested (idempotence by uuid)**: skip every source whose uuid already appears in the `source:` field of a page under `pages/sessions/<project>/`. Check with a grep of the uuid in `pages/sessions/`.
5. For each new source:
   a. Read the session JSONL.
   b. **Redact secrets BEFORE any write**: tokens, API keys, passwords, connection strings, session cookies become `[REDACTED]`. Never write a secret into the store.
   c. **Trivial session** (empty, only meta commands such as `/exit`, nothing memorable): do not create a page; record a SKIP in the `log.md` entry.
   d. Create `pages/sessions/<project>/<YYYY-MM-DD>_<kebab-slug>.md` with the schema frontmatter (`name`, `type: session`, `date`, `project`, `agent`, `source`, `status`, `tags`, `confidence: inferred`) and the body: summary, `## Decisions`, `## Artifacts`, `## Entities`, `## Pending`, `## Related`, `## Provenance` (link to the source). Non-obvious facts marked inline with `(inferred)`.
   e. **Name collision**: if `<date>_<slug>.md` already exists for ANOTHER uuid, suffix `-2`, `-3`, and so on.
6. **Update the affected durable pages**: `pages/projects/<project>/` (state), `pages/entities/`. **Dedup**: update the existing page, never duplicate it. Cross-references through wikilinks. **Each new session becomes one line** `- [[<session>]] - short hook` **in the `## Sessions` section of the project page** (create the section if missing). A project without a durable page gets `pages/projects/<project>/<project>-sessions.md` (`name: <project>-sessions`, `type: project`, only the session list) and that is the page the index points to. The `## Sessions` section goes before `## Provenance` (or before the `**Provenance:**` / `**Why:**` block when it is a paragraph).
7. **Update `MEMORY.md` within budget** (schema, section "MEMORY.md"): **never add a session line** (a line whose main pointer is a page under `pages/sessions/`). Only the line of the durable page touched, one per durable page (`- [[page]] - hook`, at most 150 characters), in the `## Project: <slug>` section (create it for a new project); update the hook when the state changed. A new dated write-back note at the root of the vault (native memory) gets its own line, same format. **Always, at the end**, check: line count at most 200, byte count at most 25,000, no line over 150 characters. Over budget (including lines that came from write-back or from `merge=union`): move the session line to the project's `## Sessions`, shorten a long line after making sure the detail is on the page, and record in `log.md` what moved.
8. **Append to `log.md`**: `## [YYYY-MM-DD] ingest | <title> | <n> pages` plus bullets (sources processed, SKIPs, secrets redacted if any).

## Inviolable rules

- `sources/` is **immutable**: never edit, move or delete a source.
- Every fact from a transcript is `confidence: inferred`.
- Secrets are redacted before the first write, without exception.
- Running twice in a row must produce zero new pages the second time (idempotence).
- `MEMORY.md` leaves every run within budget (at most 200 lines, 25 KB, 150 characters per line) and without session lines; what leaves the index goes to a page, never lost.
