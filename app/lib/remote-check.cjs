'use strict';
// "Is the remote reachable and are we authenticated?" gate used before any scheduled
// run touches the network. Fails fast (20 s) instead of hanging on a prompt.
const { git } = require('./git.cjs');

// { ok, reason } where reason is 'no-remote' | 'auth' | 'unreachable' | 'timeout' | ''
function remoteCheck(dir, timeout = 20000) {
  if (!git(dir, ['remote', 'get-url', 'origin']).ok) return { ok: false, reason: 'no-remote' };
  const r = git(dir, ['ls-remote', '--exit-code', 'origin', 'HEAD'], { timeout });
  if (r.ok) return { ok: true, reason: '' };
  if (r.timedOut) return { ok: false, reason: 'timeout' };
  const text = r.out.toLowerCase();
  if (/authentication|permission denied|could not read username|403|401|invalid credentials/.test(text)) {
    return { ok: false, reason: 'auth' };
  }
  return { ok: false, reason: 'unreachable', detail: r.out.split('\n')[0] };
}

module.exports = { remoteCheck };
