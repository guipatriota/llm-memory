'use strict';
// Thin git wrapper. GIT_TERMINAL_PROMPT=0 makes a missing credential fail fast
// instead of hanging a hook or a scheduled run on a password prompt.
const { spawnSync } = require('child_process');

const ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };

function git(dir, args, opts = {}) {
  const r = spawnSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    input: opts.input,
    timeout: opts.timeout,
    env: ENV,
  });
  const stdout = (r.stdout || '').trim();
  const stderr = (r.stderr || '').trim();
  const out = [stdout, stderr].filter(Boolean).join('\n');
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  return { ok: r.status === 0 && !r.error, status: r.status, out, stdout, stderr, timedOut, error: r.error };
}

// Throws on failure (first line of output as message).
function must(dir, args, opts) {
  const r = git(dir, args, opts);
  if (!r.ok) throw new Error(`git ${args[0]}: ${(r.out || (r.error && r.error.message) || 'failed').split('\n')[0]}`);
  return r;
}

const isRepo = (dir) => git(dir, ['rev-parse', '--git-dir']).ok;
const remoteUrl = (dir, name = 'origin') => git(dir, ['remote', 'get-url', name]).stdout;

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const today = () => stamp().slice(0, 10);

module.exports = { git, must, isRepo, remoteUrl, stamp, today, ENV };
