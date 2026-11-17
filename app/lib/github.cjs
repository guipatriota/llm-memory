'use strict';
// GitHub through the gh CLI: authentication state, repository creation, git credential
// helper. No token is ever read or stored by llm-memory itself.
const { run } = require('./exec.cjs');
const { git } = require('./git.cjs');

const gh = (args, opts) => run('gh', args, { timeout: 60000, ...opts });

function authStatus() {
  const r = gh(['auth', 'status']);
  return { ok: r.ok, out: r.stdout || r.stderr };
}

function login() {
  const r = gh(['api', 'user', '-q', '.login']);
  return r.ok ? r.stdout.trim() : null;
}

// Interactive browser login (device flow). Inherits the console so the code is visible.
function webLogin() {
  return run('gh', ['auth', 'login', '--web', '--git-protocol', 'https', '--hostname', 'github.com'], { inherit: true }).ok;
}

const setupGit = () => gh(['auth', 'setup-git']).ok;

// Commit identity derived from the GitHub account: display name (or login) and the
// no-reply address GitHub gives every user. { name, email } or null.
function identity() {
  const r = gh(['api', 'user', '--jq', '[.id, .login, (.name // "")] | @tsv']);
  if (!r.ok) return null;
  const [id, login, name] = r.stdout.split('	');
  if (!id || !login) return null;
  return { name: name || login, email: `${id}+${login}@users.noreply.github.com` };
}

// 'owner/name' -> true when the repository exists and is visible to this account.
const repoExists = (full) => gh(['repo', 'view', full, '--json', 'name']).ok;

function repoInfo(full) {
  const r = gh(['repo', 'view', full, '--json', 'name,isPrivate,url,isEmpty']);
  return r.ok ? JSON.parse(r.stdout) : null;
}

// Raw content of one file at the default branch, or null when absent or unreadable.
function readFile(full, filePath) {
  const r = gh(['api', `repos/${full}/contents/${filePath}`, '-H', 'Accept: application/vnd.github.raw+json']);
  return r.ok ? r.stdout : null;
}

// What an existing repository can be used for: 'empty' (initialise it), 'vault' or
// 'sources' (clone it: second machine), or a thrown error when it is public or holds
// something else (for example a code project of the same name).
function classifyRepo(full, kind, t) {
  const info = repoInfo(full);
  if (!info) throw new Error(t('init.repo.unreadable', { full }));
  if (!info.isPrivate) throw new Error(t('init.repo.public', { full }));
  if (info.isEmpty) return 'empty';
  if (kind === 'vault') {
    const raw = readFile(full, 'memory.config.json');
    try {
      if (raw && typeof JSON.parse(raw).language === 'string') return 'vault';
    } catch {
      /* not ours */
    }
    throw new Error(t('init.repo.notVault', { full }));
  }
  const readme = readFile(full, 'README.md') || '';
  if (readme.includes('llm-memory')) return 'sources';
  throw new Error(t('init.repo.notSources', { full }));
}

function createPrivateRepo(full, description) {
  const args = ['repo', 'create', full, '--private'];
  if (description) args.push('--description', description);
  const r = gh(args);
  if (!r.ok) throw new Error(`gh repo create ${full}: ${(r.stderr || r.stdout).split('\n')[0]}`);
  return r.stdout.trim();
}

const httpsUrl = (full) => `https://github.com/${full}.git`;

function splitRepo(spec, owner) {
  const s = spec.trim().replace(/\.git$/, '');
  if (s.includes('/')) return s;
  return `${owner}/${s}`;
}

// The single-writer lock needs pushes to refs/locks/*. GitHub allows custom refs,
// but a ruleset can block them: probe once, loudly.
function probeLockRefs(dir) {
  const ref = 'refs/locks/llm-memory-probe';
  const push = git(dir, ['push', '-q', 'origin', `HEAD:${ref}`], { timeout: 60000 });
  if (!push.ok) return { ok: false, detail: push.out.split('\n')[0] };
  const del = git(dir, ['push', '-q', 'origin', `:${ref}`], { timeout: 60000 });
  return { ok: del.ok, detail: del.ok ? '' : del.out.split('\n')[0] };
}

module.exports = { authStatus, login, webLogin, setupGit, identity, repoExists, repoInfo, readFile, classifyRepo, createPrivateRepo, httpsUrl, splitRepo, probeLockRefs };
