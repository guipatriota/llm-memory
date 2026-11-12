'use strict';
// Registers/removes the two hooks in Claude Code's settings.json, reversibly:
// timestamped backup, idempotent merge, third-party hooks untouched.
const fs = require('fs');
const path = require('path');

const MARKER = /cli\.cjs"?\s+hook\s+(stop|session-start)\b/;

function ourEntries(appDir) {
  const cli = path.join(appDir, 'cli.cjs');
  return {
    Stop: `node "${cli}" hook stop`,
    SessionStart: `node "${cli}" hook session-start`,
  };
}

const isOurs = (hook) => hook && typeof hook.command === 'string' && MARKER.test(hook.command);

function load(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  return text.trim() ? JSON.parse(text) : {};
}

function backup(file) {
  if (!fs.existsSync(file)) return null;
  const s = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');
  const bak = `${file}.bak-${s}`;
  fs.copyFileSync(file, bak);
  return bak;
}

function save(file, settings) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
}

function install(file, appDir) {
  const bak = backup(file);
  const settings = load(file);
  settings.hooks = settings.hooks || {};
  for (const [event, command] of Object.entries(ourEntries(appDir))) {
    const matchers = (settings.hooks[event] = settings.hooks[event] || []);
    const already = matchers.some((m) => (m.hooks || []).some(isOurs));
    if (!already) matchers.push({ hooks: [{ type: 'command', command }] });
    else for (const m of matchers) for (const h of m.hooks || []) if (isOurs(h)) h.command = command;
  }
  save(file, settings);
  return bak;
}

function uninstall(file) {
  if (!fs.existsSync(file)) return { removed: 0, backup: null };
  const bak = backup(file);
  const settings = load(file);
  let removed = 0;
  for (const event of Object.keys(settings.hooks || {})) {
    const matchers = settings.hooks[event]
      .map((m) => {
        const kept = (m.hooks || []).filter((h) => !isOurs(h));
        removed += (m.hooks || []).length - kept.length;
        return { ...m, hooks: kept };
      })
      .filter((m) => (m.hooks || []).length > 0);
    if (matchers.length) settings.hooks[event] = matchers;
    else delete settings.hooks[event];
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  save(file, settings);
  return { removed, backup: bak };
}

// { Stop: true|false, SessionStart: true|false }
function status(file, appDir) {
  const settings = load(file);
  const out = {};
  for (const event of Object.keys(ourEntries(appDir))) {
    out[event] = ((settings.hooks || {})[event] || []).some((m) => (m.hooks || []).some(isOurs));
  }
  return out;
}

module.exports = { install, uninstall, status, ourEntries, MARKER };
