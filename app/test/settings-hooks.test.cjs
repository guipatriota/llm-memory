'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const s = require('../lib/settings-hooks.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'llm-memory-'));

test('install is idempotent and keeps foreign hooks', () => {
  const f = path.join(tmp(), 'settings.json');
  const foreign = 'node "C:\\x\\llm-memory\\tools\\hooks\\memory-capture.cjs"';
  fs.writeFileSync(f, JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: foreign }] }] } }));
  s.install(f, 'C:\\app');
  s.install(f, 'C:\\app2');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.strictEqual(j.hooks.Stop.length, 2);
  assert.strictEqual(j.hooks.Stop[0].hooks[0].command, foreign);
  assert.match(j.hooks.Stop[1].hooks[0].command, /app2.*cli\.cjs" hook stop$/);
  assert.strictEqual(j.hooks.SessionStart.length, 1);
  assert.deepStrictEqual(s.status(f, 'C:\\app2'), { Stop: true, SessionStart: true });
});

test('uninstall removes only our entries', () => {
  const f = path.join(tmp(), 'settings.json');
  fs.writeFileSync(f, JSON.stringify({ model: 'x', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo hi' }] }] } }));
  s.install(f, '/opt/app');
  const r = s.uninstall(f);
  assert.strictEqual(r.removed, 2);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.strictEqual(j.model, 'x');
  assert.strictEqual(j.hooks.Stop[0].hooks[0].command, 'echo hi');
  assert.strictEqual(j.hooks.SessionStart, undefined);
  assert.deepStrictEqual(s.status(f, '/opt/app'), { Stop: false, SessionStart: false });
});

test('missing settings file is created', () => {
  const f = path.join(tmp(), 'nested', 'settings.json');
  s.install(f, '/opt/app');
  assert.deepStrictEqual(s.status(f, '/opt/app'), { Stop: true, SessionStart: true });
});
