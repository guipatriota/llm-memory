'use strict';
// Copies the transcripts that Claude Code already has on this machine (sessions that
// ended before llm-memory was installed) into sources/. Idempotent: a file is copied
// only when missing or when the local copy is larger. Subagent transcripts live in
// subdirectories and are ignored; sources/ is never edited beyond adding files.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { claudeDir } = require('./config.cjs');
const sources = require('./sources.cjs');

const MAX_BYTES = 95 * 1024 * 1024; // GitHub refuses files over 100 MB

// First record with a cwd field, read line by line (the first records have none).
async function transcriptCwd(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }) });
  let found = null;
  let n = 0;
  for await (const line of rl) {
    n++;
    try {
      const rec = JSON.parse(line);
      if (rec && typeof rec.cwd === 'string' && rec.cwd) {
        found = rec.cwd;
        break;
      }
    } catch {
      /* partial or non-JSON line */
    }
    if (n > 200) break;
  }
  rl.close();
  return found;
}

async function backfill(vault, opts = {}) {
  const log = opts.log || (() => {});
  const projects = path.join(claudeDir(), 'projects');
  const result = { scanned: 0, copied: 0, skipped: 0, tooLarge: 0, noCwd: 0 };
  if (!fs.existsSync(projects)) return result;
  for (const proj of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const dir = path.join(projects, proj.name);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      result.scanned++;
      const file = path.join(dir, entry.name);
      const size = fs.statSync(file).size;
      if (size > MAX_BYTES) {
        result.tooLarge++;
        log(`too large for GitHub, skipped: ${file}`);
        continue;
      }
      const cwd = await transcriptCwd(file);
      const slug = sources.projectSlug(cwd || '');
      if (!slug) {
        result.noCwd++;
        continue;
      }
      const dest = path.join(sources.sourcesDir(vault), 'claude-code', slug, entry.name);
      let destSize = -1;
      try {
        destSize = fs.statSync(dest).size;
      } catch {
        /* missing */
      }
      if (destSize >= size) {
        result.skipped++;
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
      result.copied++;
    }
  }
  if (result.copied && opts.backup !== false) {
    result.backup = sources.backupSources(vault, {
      message: `backup: ${sources.host()} backfill ${result.copied} files`,
      log,
    });
  }
  return result;
}

module.exports = { backfill, transcriptCwd, MAX_BYTES };
