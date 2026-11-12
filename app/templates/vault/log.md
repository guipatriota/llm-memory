# log

Append-only journal of the memory store. One entry per event: `## [YYYY-MM-DD] <type> | <title> | <n> pages touched` (types: ingest, lint, backfill, init, manual). Never rewrite past entries.
