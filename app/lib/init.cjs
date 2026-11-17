'use strict';
// First-time setup on a machine (also a second machine of the same user: when the
// repository already exists it is cloned instead of created). Idempotent: every step
// checks its own marker and can be re-run.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const cfg = require('./config.cjs');
const { t } = require('./i18n.cjs');
const { git, must, isRepo, remoteUrl, today } = require('./git.cjs');
const { which, run, nodeMajor, refreshWindowsPath, WIN } = require('./exec.cjs');
const gh = require('./github.cjs');
const links = require('./links.cjs');
const settingsHooks = require('./settings-hooks.cjs');
const { backfill } = require('./backfill.cjs');
const sources = require('./sources.cjs');

const TEMPLATES = path.join(cfg.APP_DIR, 'templates');
const say = (msg) => process.stdout.write(msg + '\n');

// ------------------------------------------------------------------ prompts

function ask(question, def) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(`${question}${def !== undefined ? ` [${def}]` : ''}: `, (a) => {
      rl.close();
      resolve(a.trim() || (def === undefined ? '' : String(def)));
    })
  );
}

async function askYesNo(question, def) {
  const a = (await ask(`${question} (y/n)`, def ? 'y' : 'n')).toLowerCase();
  return a.startsWith('y') || a.startsWith('o');
}

// ------------------------------------------------------------------ steps

function checkPrerequisites() {
  refreshWindowsPath();
  const missing = [];
  if (!which('git')) missing.push('git');
  if (nodeMajor() < 18) missing.push(`node >= 18 (found ${process.versions.node})`);
  if (!which('gh')) missing.push('gh');
  if (!which('claude')) missing.push('claude');
  return missing;
}

function copyTemplate(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyTemplate(s, d);
    } else if (!fs.existsSync(d)) {
      fs.copyFileSync(s, d);
    }
  }
}

// A fresh machine (WSL, a new laptop) often has no git user.name/user.email: commits
// would fail. Set them for this repository only, from the GitHub account.
function ensureIdentity(dir) {
  const has = (k) => git(dir, ['config', '--get', k]).ok;
  if (has('user.name') && has('user.email')) return false;
  const id = gh.identity();
  if (!id) throw new Error(t('init.identity.failed'));
  if (!has('user.name')) must(dir, ['config', 'user.name', id.name]);
  if (!has('user.email')) must(dir, ['config', 'user.email', id.email]);
  say(t('init.identity.set', { name: id.name, email: id.email }));
  return true;
}

function appendLog(vault, line) {
  fs.appendFileSync(path.join(vault, 'log.md'), `\n${line}\n`);
}

function ensureVaultRepo(opts, owner) {
  const full = gh.splitRepo(opts.repo, owner);
  const url = gh.httpsUrl(full);
  const vault = opts.vault;
  if (isRepo(vault)) {
    say(t('init.vault.existing', { vault }));
    return { full, url, created: false };
  }
  if (fs.existsSync(vault) && fs.readdirSync(vault).length) {
    throw new Error(t('init.vault.notEmpty', { vault }));
  }
  if (gh.repoExists(full)) {
    const kind = gh.classifyRepo(full, 'vault', t);
    if (kind === 'empty') {
      say(t('init.vault.emptyRemote', { full }));
    } else {
      say(t('init.vault.cloning', { full }));
      must(path.dirname(vault), ['clone', '-q', url, vault], { timeout: 600000 });
      return { full, url, created: false };
    }
  } else {
    say(t('init.vault.creating', { full }));
    gh.createPrivateRepo(full, 'llm-memory vault: persistent memory for Claude Code sessions');
  }
  fs.mkdirSync(vault, { recursive: true });
  must(vault, ['init', '-q', '-b', 'main']);
  must(vault, ['remote', 'add', 'origin', url]);
  return { full, url, created: true };
}

function populateVault(vault, opts) {
  copyTemplate(path.join(TEMPLATES, 'vault'), vault);
  const vcfg = cfg.saveVault(vault, {
    ...cfg.loadVault(vault),
    language: opts.language,
    sources: { enabled: opts.sources, remote: opts.sources ? cfg.deriveSourcesRemote(remoteUrl(vault)) : '' },
    schedule: { ingest: opts.ingest, lint: opts.lint },
  });
  return vcfg;
}

function ensureSourcesRepo(vault, vcfg, owner, full) {
  const dir = sources.sourcesDir(vault);
  if (!vcfg.sources.enabled) {
    fs.mkdirSync(dir, { recursive: true });
    return 'disabled';
  }
  const sourcesFull = `${full}-sources`;
  if (sources.hasSourcesRepo(vault)) return 'existing';
  if (gh.repoExists(sourcesFull)) {
    const kind = gh.classifyRepo(sourcesFull, 'sources', t);
    if (kind === 'sources') {
      say(t('init.sources.cloning', { full: sourcesFull }));
      must(vault, ['clone', '-q', vcfg.sources.remote, dir], { timeout: 600000 });
      ensureIdentity(dir);
      return 'cloned';
    }
  } else {
    say(t('init.sources.creating', { full: sourcesFull }));
    gh.createPrivateRepo(sourcesFull, 'llm-memory raw transcripts (PRIVATE: may contain secrets)');
  }
  fs.mkdirSync(dir, { recursive: true });
  must(dir, ['init', '-q', '-b', 'main']);
  must(dir, ['remote', 'add', 'origin', vcfg.sources.remote]);
  ensureIdentity(dir);
  copyTemplate(path.join(TEMPLATES, 'sources'), dir);
  must(dir, ['add', '-A']);
  must(dir, ['commit', '-q', '-m', 'init: raw transcript store (private, may contain secrets)']);
  must(dir, ['push', '-q', '-u', 'origin', 'main'], { timeout: 120000 });
  return 'created';
}

function registerScheduler(vcfg) {
  if (WIN) {
    const sched = require('./scheduler-windows.cjs');
    return { tasks: sched.register(cfg.APP_DIR, vcfg.schedule) };
  }
  if (process.platform === 'linux') {
    const sched = require('./scheduler-linux.cjs');
    return sched.register(cfg.APP_DIR, vcfg.schedule);
  }
  return { unsupported: process.platform };
}

// ------------------------------------------------------------------ main

async function resolveOptions(o) {
  const opts = { ...o };
  const interactive = !opts.yes && process.stdin.isTTY;
  if (!opts.language && interactive) opts.language = await ask(t('init.ask.language'), 'en');
  opts.language = (opts.language || 'en').toLowerCase();
  if (!cfg.LANGUAGES.includes(opts.language)) throw new Error(`--language: ${cfg.LANGUAGES.join('|')}`);
  if (!opts.vault && interactive) opts.vault = await ask(t('init.ask.vault'), path.join(os.homedir(), 'llm-memory'));
  opts.vault = path.resolve(opts.vault || path.join(os.homedir(), 'llm-memory'));
  if (!opts.repo && interactive) opts.repo = await ask(t('init.ask.repo'), 'llm-memory');
  opts.repo = opts.repo || 'llm-memory';
  if (opts.sources === undefined) opts.sources = interactive ? await askYesNo(t('init.ask.sources'), true) : true;
  opts.ingest = (opts.ingest || cfg.VAULT_DEFAULTS.schedule.ingest.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const lint = (opts.lint || `${cfg.VAULT_DEFAULTS.schedule.lint.day}@${cfg.VAULT_DEFAULTS.schedule.lint.time}`).split('@');
  opts.lint = { day: lint[0], time: lint[1] || cfg.VAULT_DEFAULTS.schedule.lint.time };
  return opts;
}

async function init(rawOpts) {
  const missing = checkPrerequisites();
  if (missing.length) throw new Error(t('init.missing', { list: missing.join(', ') }));

  say(t('init.step.auth'));
  if (!gh.authStatus().ok) {
    if (rawOpts.yes || !process.stdin.isTTY) throw new Error(t('init.auth.required'));
    say(t('init.auth.browser'));
    if (!gh.webLogin() || !gh.authStatus().ok) throw new Error(t('init.auth.required'));
  }
  const owner = gh.login();
  if (!owner) throw new Error(t('init.auth.required'));
  say(t('init.auth.ok', { owner }));
  gh.setupGit();

  const opts = await resolveOptions(rawOpts);
  say(t('init.summary', { vault: opts.vault, repo: gh.splitRepo(opts.repo, owner), language: opts.language, sources: opts.sources ? 'on' : 'off' }));

  say(t('init.step.vault'));
  const { full, created } = ensureVaultRepo(opts, owner);
  ensureIdentity(opts.vault);
  const vcfg = populateVault(opts.vault, opts);

  say(t('init.step.probe'));
  if (created) {
    must(opts.vault, ['add', '-A']);
    must(opts.vault, ['commit', '-q', '-m', 'init: vault']);
    must(opts.vault, ['push', '-q', '-u', 'origin', 'main'], { timeout: 120000 });
  }
  const probe = gh.probeLockRefs(opts.vault);
  if (!probe.ok) throw new Error(t('init.probe.failed', { detail: probe.detail }));

  say(t('init.step.sources'));
  const sourcesState = ensureSourcesRepo(opts.vault, vcfg, owner, full);
  say(t('init.sources.state', { state: sourcesState }));
  if (vcfg.sources.enabled) say(t('init.sources.warning'));

  say(t('init.step.machine'));
  cfg.saveMachine({ vaultPath: opts.vault });
  const settingsFile = path.join(cfg.claudeDir(), 'settings.json');
  settingsHooks.install(settingsFile, cfg.APP_DIR);
  const skills = links.linkSkills();
  say(t('init.links.skills', { list: Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join(', ') }));
  const mem = links.linkMemory(opts.vault);
  say(t('init.links.memory', { n: Object.keys(mem).length }));

  say(t('init.step.backfill'));
  const bf = await backfill(opts.vault, { log: say, backup: vcfg.sources.enabled });
  say(t('init.backfill.result', { copied: bf.copied, scanned: bf.scanned }));

  say(t('init.step.schedule'));
  const sched = registerScheduler(vcfg);
  if (sched.unsupported) say(t('init.schedule.unsupported', { platform: sched.unsupported }));
  else if (sched.enabled === false) say(t('init.schedule.notEnabled', { detail: sched.detail || '' }));
  else say(t('init.schedule.ok', { ingest: vcfg.schedule.ingest.join(', '), lint: `${vcfg.schedule.lint.day} ${vcfg.schedule.lint.time}` }));

  appendLog(opts.vault, `## [${today()}] init | ${sources.host()} (language=${vcfg.language}, sources=${vcfg.sources.enabled ? 'on' : 'off'}) | 0 pages`);
  git(opts.vault, ['add', '-A']);
  if (!git(opts.vault, ['diff', '--cached', '--quiet']).ok) {
    must(opts.vault, ['commit', '-q', '-m', `init: ${sources.host()}`]);
    const push = git(opts.vault, ['push', '-q', '-u', 'origin', 'main'], { timeout: 120000 });
    if (!push.ok) say(t('init.push.deferred'));
  }

  say('');
  say(t('init.done', { vault: opts.vault }));
  say(t('init.next'));
  return { vault: opts.vault, full, vcfg };
}

module.exports = { init, ensureIdentity, checkPrerequisites, copyTemplate, resolveOptions };
