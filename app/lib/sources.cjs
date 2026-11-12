'use strict';
// Raw transcript store (<vault>/sources): project slugs, copy of transcripts and the
// best-effort backup of the nested sources repository.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git, stamp } = require('./git.cjs');

const host = () => os.hostname().split('.')[0].toLowerCase();

function kebab(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Project namespace: kebab-cased basename of the session cwd; the home directory
// itself becomes home-<hostname>.
function projectSlug(cwd) {
  if (!cwd) return '';
  if (path.resolve(cwd) === path.resolve(os.homedir())) return 'home-' + kebab(host());
  return kebab(path.basename(cwd));
}

const sourcesDir = (vault) => path.join(vault, 'sources');
const hasSourcesRepo = (vault) => fs.existsSync(path.join(sourcesDir(vault), '.git'));

// Copies one transcript into sources/claude-code/<slug>/<uuid>.jsonl.
// Overwrite is intentional: the Stop hook fires more than once per session and the
// last copy is always the most complete version of the same uuid.
function storeTranscript(vault, slug, sessionId, transcriptPath) {
  const dir = path.join(sourcesDir(vault), 'claude-code', slug);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${sessionId}.jsonl`);
  fs.copyFileSync(transcriptPath, dest);
  return dest;
}

// An orphan index.lock (git killed by a timeout or a reboot) silently blocks every
// later backup. Nothing here runs longer than 5 min, so an older lock has no owner.
function clearStaleLock(dir, log = () => {}) {
  const lock = path.join(dir, '.git', 'index.lock');
  try {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age < 600000) return;
    fs.unlinkSync(lock);
    log(`stale index.lock removed (${Math.round(age / 60000)} min old)`);
  } catch {
    /* no lock (normal) or no permission: let git complain */
  }
}

// Commit always, push best-effort with one rebase retry. Offline is not an error:
// the next session start or the next scheduled run pushes what is pending.
// Returns 'nothing' | 'pushed' | 'push-failed' | 'commit-failed'.
function backupSources(vault, opts = {}) {
  const dir = sourcesDir(vault);
  if (!hasSourcesRepo(vault)) return 'nothing';
  const log = opts.log || (() => {});
  clearStaleLock(dir, log);

  // The first backup of a machine indexes the whole backlog (hundreds of MB):
  // short timeouts kill git mid-way and leave index.lock behind.
  if (!git(dir, ['add', '-A'], { timeout: 300000 }).ok) return 'commit-failed';
  if (git(dir, ['diff', '--cached', '--quiet'], { timeout: 30000 }).ok) {
    if (!opts.pushPending) return 'nothing';
  } else {
    const msg = opts.message || `backup: ${host()} ${stamp()}`;
    if (!git(dir, ['commit', '-q', '-m', msg], { timeout: 300000 }).ok) return 'commit-failed';
  }
  if (!git(dir, ['remote', 'get-url', 'origin']).ok) return 'nothing'; // local-only sources
  const pushTimeout = opts.pushTimeout || 30000;
  if (git(dir, ['push', '-q', 'origin', 'main'], { timeout: pushTimeout }).ok) return 'pushed';
  if (opts.rebase !== false && git(dir, ['pull', '--rebase', '-q'], { timeout: 120000 }).ok) {
    if (git(dir, ['push', '-q', 'origin', 'main'], { timeout: pushTimeout }).ok) return 'pushed';
  }
  log('sources push deferred (offline or not authenticated)');
  return 'push-failed';
}

// Number of local commits not yet on origin/main (cheap, no network).
function pendingPushes(vault) {
  const r = git(sourcesDir(vault), ['rev-list', '--count', 'origin/main..main'], { timeout: 5000 });
  return r.ok ? Number(r.stdout) : 0;
}

module.exports = {
  host, kebab, projectSlug, sourcesDir, hasSourcesRepo, storeTranscript,
  clearStaleLock, backupSources, pendingPushes,
};
