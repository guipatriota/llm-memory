'use strict';
// status, repair and uninstall. Uninstall removes what init registered on this machine
// (hooks, scheduled runs, skill links, machine config) and keeps the vault, the raw
// transcripts and the memory links, so nothing the user wrote is ever deleted.
const fs = require('fs');
const path = require('path');
const cfg = require('./config.cjs');
const { t } = require('./i18n.cjs');
const { git, isRepo, remoteUrl } = require('./git.cjs');
const { WIN, which } = require('./exec.cjs');
const links = require('./links.cjs');
const settingsHooks = require('./settings-hooks.cjs');
const sources = require('./sources.cjs');
const { lastRun } = require('./runner.cjs');

const say = (msg) => process.stdout.write(msg + '\n');

function scheduler() {
  if (WIN) return require('./scheduler-windows.cjs');
  if (process.platform === 'linux') return require('./scheduler-linux.cjs');
  return null;
}

function status() {
  const machine = cfg.loadMachine();
  say(`llm-memory ${cfg.version()} (${cfg.APP_DIR})`);
  say(`${t('status.claudeDir')}: ${cfg.claudeDir()}`);
  if (!machine) {
    say(t('status.notConfigured'));
    return 1;
  }
  const vault = machine.vaultPath;
  say(`${t('status.vault')}: ${vault}${fs.existsSync(vault) ? '' : ' (MISSING)'}`);
  if (isRepo(vault)) {
    say(`  origin: ${remoteUrl(vault) || '(none)'}`);
    const head = git(vault, ['log', '-1', '--format=%h %s (%cr)']).stdout;
    say(`  HEAD: ${head || '(no commits)'}`);
    const dirty = git(vault, ['status', '--porcelain']).stdout.split('\n').filter(Boolean).length;
    say(`  ${t('status.uncommitted')}: ${dirty}`);
    const vcfg = cfg.loadVault(vault);
    say(`  language: ${vcfg.language}; ingest: ${vcfg.schedule.ingest.join(', ')}; lint: ${vcfg.schedule.lint.day} ${vcfg.schedule.lint.time}`);
    say(`  sources: ${vcfg.sources.enabled ? vcfg.sources.remote : 'disabled'}${sources.hasSourcesRepo(vault) ? '' : ' (no local repo)'}`);
    if (sources.hasSourcesRepo(vault)) say(`  ${t('status.pendingPushes')}: ${sources.pendingPushes(vault)}`);
  }
  const hooks = settingsHooks.status(path.join(cfg.claudeDir(), 'settings.json'), cfg.APP_DIR);
  say(`${t('status.hooks')}: Stop=${hooks.Stop ? 'ok' : 'MISSING'}, SessionStart=${hooks.SessionStart ? 'ok' : 'MISSING'}`);
  const skills = links.skillsStatus();
  say(`${t('status.skills')}: ${Object.entries(skills).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  const sched = scheduler();
  if (sched) {
    const st = sched.status();
    say(`${t('status.schedule')}: ${Object.entries(st).map(([k, v]) => `${k}=${v || 'MISSING'}`).join(', ')}`);
  }
  say(`${t('status.lastRuns')}: ingest=${lastRun(vault, 'ingest') || '-'}, lint=${lastRun(vault, 'lint') || '-'}`);
  const mem = links.memoryStatus(vault);
  const n = Object.values(mem).filter((v) => v === 'linked').length;
  say(`${t('status.memoryLinks')}: ${n}/${Object.keys(mem).length}`);
  for (const [k, v] of Object.entries(mem)) if (v !== 'linked') say(`  ${k}: ${v}`);
  say(`tools: git=${which('git') ? 'ok' : 'MISSING'}, gh=${which('gh') ? 'ok' : 'MISSING'}, claude=${which('claude') ? 'ok' : 'MISSING'}, node=${process.versions.node}`);
  return 0;
}

// Re-registers hooks, skills and scheduled runs from the current configuration
// (after an upgrade, a moved installation or a schedule change).
function repair() {
  const vault = cfg.vaultPath();
  const vcfg = cfg.loadVault(vault);
  cfg.saveMachine({ vaultPath: vault });
  settingsHooks.install(path.join(cfg.claudeDir(), 'settings.json'), cfg.APP_DIR);
  links.linkSkills();
  links.linkMemory(vault);
  const sched = scheduler();
  if (sched) sched.register(cfg.APP_DIR, vcfg.schedule);
  say(t('repair.done'));
  return 0;
}

function uninstall(opts = {}) {
  const sched = scheduler();
  if (sched) sched.unregister();
  settingsHooks.uninstall(path.join(cfg.claudeDir(), 'settings.json'));
  links.unlinkSkills();
  const machine = cfg.loadMachine();
  if (opts.purgeLinks && machine && machine.vaultPath) {
    const projects = path.join(cfg.claudeDir(), 'projects');
    if (fs.existsSync(projects)) {
      for (const d of fs.readdirSync(projects)) {
        const m = path.join(projects, d, 'memory');
        const info = links.linkInfo(m);
        if (info.kind === 'link' && path.resolve(info.target) === path.resolve(machine.vaultPath)) links.unlinkOnly(m);
      }
    }
  }
  cfg.removeMachine();
  say(t('uninstall.done', { vault: machine ? machine.vaultPath : '-' }));
  return 0;
}

module.exports = { status, repair, uninstall };
