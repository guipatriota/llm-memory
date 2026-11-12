'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const c = require('../lib/config.cjs');
const sources = require('../lib/sources.cjs');

test('deriveSourcesRemote handles https and ssh forms', () => {
  assert.strictEqual(c.deriveSourcesRemote('https://github.com/alice/llm-memory.git'), 'https://github.com/alice/llm-memory-sources.git');
  assert.strictEqual(c.deriveSourcesRemote('https://github.com/alice/llm-memory'), 'https://github.com/alice/llm-memory-sources');
  assert.strictEqual(c.deriveSourcesRemote('git@github.com:alice/memo.git'), 'git@github.com:alice/memo-sources.git');
});

test('vault config merges defaults and validates', () => {
  const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-memory-'));
  assert.deepStrictEqual(c.loadVault(vault), c.VAULT_DEFAULTS);
  c.saveVault(vault, { language: 'fr', schedule: { ingest: ['09:00'] } });
  const cfg = c.loadVault(vault);
  assert.strictEqual(cfg.language, 'fr');
  assert.deepStrictEqual(cfg.schedule.ingest, ['09:00']);
  assert.strictEqual(cfg.schedule.lint.day, 'Thu');
  assert.throws(() => c.saveVault(vault, { language: 'pt' }), /language/);
  assert.throws(() => c.saveVault(vault, { schedule: { ingest: ['25:00'] } }), /HH:MM/);
});

test('claudeDir honours CLAUDE_CONFIG_DIR', () => {
  const old = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = path.join(os.tmpdir(), 'sandbox-claude');
  assert.strictEqual(c.claudeDir(), path.join(os.tmpdir(), 'sandbox-claude'));
  assert.strictEqual(c.machineConfigPath(), path.join(os.tmpdir(), 'sandbox-claude', 'llm-memory.json'));
  if (old === undefined) delete process.env.CLAUDE_CONFIG_DIR;
  else process.env.CLAUDE_CONFIG_DIR = old;
});

test('projectSlug kebab-cases the cwd basename and maps home', () => {
  assert.strictEqual(sources.projectSlug(path.join(os.homedir(), 'My Project!')), 'my-project');
  assert.match(sources.projectSlug(os.homedir()), /^home-[a-z0-9-]+$/);
  assert.strictEqual(sources.projectSlug(''), '');
});
