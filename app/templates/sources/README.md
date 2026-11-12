# llm-memory-sources: raw transcript backup

> **SENSITIVE CONTENT.** This repository holds the **raw** transcripts of your LLM sessions (Claude Code JSONL files). They may contain secrets in plain text: tokens, passwords, command output, file contents. **NEVER** make it public, **NEVER** share it, **NEVER** connect it to any integration.
>
> Version française : [README.fr.md](README.fr.md)

## What it is

Central backup of the `sources/` folder of your `llm-memory` vault, layer 1 (raw sources) of the memory system. The vault itself only versions the wiki layer (distilled, with secrets redacted); the raw sources stay **out** of it on purpose.

This repository exists for two reasons: an offsite copy of the transcripts of **all your machines**, and access to the raw history from any machine, for audit or reprocessing.

## Layout

```
claude-code/<project>/<session-uuid>.jsonl   one file per session, from the machine it ran on
```

## How it is fed (automatic)

- On each machine this repository is cloned **inside** the vault's working tree, at `<vault>/sources/` (the vault's `.gitignore` ignores `sources/`, so the two nested repositories coexist).
- The Claude Code **Stop hook** copies the transcript at the end of every session **and commits and pushes** this repository (offline tolerated: local commit always, push best-effort; the scheduled ingest reconciles later).
- The scheduled ingest also syncs this repository (`pull --rebase` + push) as a safety net.

## New machine

Nothing manual: `llm-memory init` clones this repository into `sources/` when it already exists.

## Rules

- **Immutability**: sources are never edited nor deleted. Each machine only adds or updates its own uuids, so merges are trivial.
- **No history rewrite**: this repository is an audit record.
- Automatic commits read `backup: <hostname> <date>`; do not commit here by hand except for deliberate maintenance.
