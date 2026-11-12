---
name: lint-memory
description: Lint of the llm-memory vault. Scans the store, writes a report under .meta/ and auto-fixes only what is safe, following schema.md. Use when asked to lint or audit the LLM memory.
---

# lint-memory

Periodic audit of the `llm-memory` vault. **The policy lives in `schema.md` at the root of the vault: read it first; this file only operationalises.**

## Steps

1. **Read `schema.md`** (section "Lint workflow" and the page format) and **`memory.config.json`** (write the report and any new prose in its `language`; fixed tokens stay in English).
2. **Scan the store** (`pages/`, `MEMORY.md`, `log.md`) looking for:
   - **Contradictions** between pages (fact X on one, not X on another).
   - **Stale pages**: `status: active` without an update for a long time, or a state clearly superseded.
   - **Orphans**: pages with no incoming link (not even from `MEMORY.md`).
   - **Missing cross-references**: entities or projects mentioned without a wikilink or without a page.
   - **Duplicates**: the same fact or entity on two pages.
   - **Unconfirmed inferences**: relevant `confidence: inferred` facts the user has not validated yet; list them for validation.
   - **Index out of sync**: durable page without a line in `MEMORY.md`, line pointing to a missing page, or session without a line in the `## Sessions` section of its project page.
   - **`MEMORY.md` budget** (schema, section "MEMORY.md"): measure the line count (at most 200), the byte count (at most 25,000), the number of lines over 150 characters (must be 0) and the number of session lines (main pointer = a page that exists under `pages/sessions/`; a dated note at the root is durable and does not count; must be 0). Always record the four numbers in the report.
   - **Duplicated session pairs**: two pages with the same uuid in `source:` AND the same range of the source (parallel ingest on two machines). Distinct tails of the same source (different line ranges) are NOT duplicates.
3. **Write the report** to `.meta/lint-<YYYY-MM-DD>.md` with the sections above.
4. **Auto-fix ONLY what is safe**: format or frontmatter off the standard, missing durable line in `MEMORY.md` (if it fits the budget), obvious missing wikilink, merge of a trivial and unambiguous duplicate, and:
   - **Index budget exceeded**: move each session line to the `## Sessions` of the project page (create `pages/projects/<project>/<project>-sessions.md` when there is no durable page; the section goes before `## Provenance` or before the `**Provenance:**` / `**Why:**` block) without losing the hook; **add to `## Sessions`** any session of the project not listed there yet (links only in the body or in Provenance do not count); shorten a line over 150 characters AFTER checking that the detail is on the page (if it is not, add it to the page first). Record in the report what moved.
   - **Duplicated session pair** (same uuid, same range): merge into a single page by union without discarding (schema, "Merge reconciliation"), keep the more descriptive name, record the old name under `## Related` and in Provenance, repoint every wikilink and remove the other page.
5. **Contradiction: flag it, NEVER resolve it alone** (risk of data loss). Same for archiving or deleting pages: only propose in the report.
6. **Append to `log.md`**: `## [YYYY-MM-DD] lint | <summary> | <n> pages touched`.

## Inviolable rules

- Do not touch `sources/`.
- Do not delete the user's content; propose instead of acting.
- Automatic fixes are limited to the list in step 4.
- `MEMORY.md` leaves every lint within budget and without session lines.
- `log.md` is append-only: never rewrite it; its links to merged or renamed pages do not count as broken.
