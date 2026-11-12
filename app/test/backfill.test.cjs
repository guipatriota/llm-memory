'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { backfill } = require('../lib/backfill.cjs');
const { prompt } = require('../lib/prompt.cjs');

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-memory-'));
  const claudeDir = path.join(root, 'claude');
  const proj = path.join(claudeDir, 'projects', 'C--Users-x-Demo-App');
  fs.mkdirSync(proj, { recursive: true });
  fs.mkdirSync(path.join(proj, 'sub-uuid', 'subagents'), { recursive: true });
  const lines = [
    JSON.stringify({ type: 'session-owner' }),
    JSON.stringify({ type: 'user', cwd: path.join(os.homedir(), 'Demo App'), message: 'hi' }),
  ];
  fs.writeFileSync(path.join(proj, 'aaaa-1111.jsonl'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(proj, 'sub-uuid', 'subagents', 'x.jsonl'), lines.join('\n'));
  fs.writeFileSync(path.join(proj, 'nocwd.jsonl'), JSON.stringify({ type: 'x' }) + '\n');
  const vault = path.join(root, 'vault');
  fs.mkdirSync(path.join(vault, 'sources'), { recursive: true });
  return { claudeDir, vault, proj };
}

test('backfill copies top-level transcripts by project slug, idempotently', async () => {
  const { claudeDir, vault, proj } = sandbox();
  const old = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = claudeDir;
  try {
    let r = await backfill(vault, { backup: false });
    assert.strictEqual(r.scanned, 2);
    assert.strictEqual(r.copied, 1);
    assert.strictEqual(r.noCwd, 1);
    const dest = path.join(vault, 'sources', 'claude-code', 'demo-app', 'aaaa-1111.jsonl');
    assert.ok(fs.existsSync(dest));
    r = await backfill(vault, { backup: false });
    assert.strictEqual(r.copied, 0);
    assert.strictEqual(r.skipped, 1);
    // a longer local transcript replaces the stored copy
    fs.appendFileSync(path.join(proj, 'aaaa-1111.jsonl'), JSON.stringify({ type: 'assistant', cwd: 'x' }) + '\n');
    r = await backfill(vault, { backup: false });
    assert.strictEqual(r.copied, 1);
  } finally {
    if (old === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = old;
  }
});

test('prompts are single-line ASCII without shell-hostile characters', () => {
  for (const kind of ['ingest', 'lint', 'reconcile']) {
    for (const lang of ['en', 'fr']) {
      const p = prompt(kind, lang);
      assert.ok(!/[\n"%^&|<>]/.test(p), `${kind}/${lang} has a bad character`);
      assert.ok(/^[\x20-\x7e]+$/.test(p), `${kind}/${lang} is not plain ASCII`);
      assert.ok(p.includes(lang === 'fr' ? 'French' : 'English'));
    }
  }
  assert.throws(() => prompt('other'), /unknown/);
});
