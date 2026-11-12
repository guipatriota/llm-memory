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

// The headless runs (ingest, lint, reconcile) are Claude Code sessions too. The Stop
// hook skips them through CLAUDE_MEMORY_SKIP, but a transcript on disk carries no such
// flag: recognise them by their first user message instead.
const RUNNER_PROMPT = /^You are the (ingest|lint|reconciliation) agent of the llm-memory vault/;

function messageText(rec) {
  const m = rec && rec.message;
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) return m.content.map((c) => (c && c.text) || '').join(' ');
  return '';
}

// { cwd, runner }: first cwd seen and whether the first user message is a runner prompt.
async function transcriptInfo(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }) });
  const info = { cwd: null, runner: false };
  let sawUser = false;
  let n = 0;
  for await (const line of rl) {
    n++;
    try {
      const rec = JSON.parse(line);
      if (rec && typeof rec.cwd === 'string' && rec.cwd && !info.cwd) info.cwd = rec.cwd;
      if (rec && rec.type === 'user' && !sawUser) {
        sawUser = true;
        info.runner = RUNNER_PROMPT.test(messageText(rec).trim());
      }
      if (info.cwd && sawUser) break;
    } catch {
      /* partial or non-JSON line */
    }
    if (n > 200) break;
  }
  rl.close();
  return info;
}

const transcriptCwd = async (file) => (await transcriptInfo(file)).cwd;

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
      const info = await transcriptInfo(file);
      if (info.runner) {
        result.runner = (result.runner || 0) + 1;
        continue;
      }
      const slug = sources.projectSlug(info.cwd || '');
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

module.exports = { backfill, transcriptCwd, transcriptInfo, RUNNER_PROMPT, MAX_BYTES };
