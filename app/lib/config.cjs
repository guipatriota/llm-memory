'use strict';
// Configuration layout:
//   <claudeDir>/llm-memory.json      machine config: where this machine's vault lives
//   <vault>/memory.config.json       vault config, shared by every machine of the same user
// claudeDir() honours CLAUDE_CONFIG_DIR (the Claude Code setting), so a sandboxed
// config dir isolates hooks, skills, project memory links AND this tool.
const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_DIR = path.resolve(__dirname, '..');
const LANGUAGES = ['en', 'fr'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const VAULT_DEFAULTS = Object.freeze({
  language: 'en',
  sources: { enabled: true, remote: '' },
  schedule: { ingest: ['10:20', '14:20'], lint: { day: 'Thu', time: '11:00' } },
});

function version() {
  return require(path.join(APP_DIR, 'package.json')).version;
}

function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR
    ? path.resolve(process.env.CLAUDE_CONFIG_DIR)
    : path.join(os.homedir(), '.claude');
}

const machineConfigPath = () => path.join(claudeDir(), 'llm-memory.json');

function loadMachine() {
  const file = machineConfigPath();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveMachine(cfg) {
  const file = machineConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...cfg, appDir: APP_DIR, version: version() }, null, 2) + '\n');
  return file;
}

function removeMachine() {
  fs.rmSync(machineConfigPath(), { force: true });
}

// The vault this machine is configured for. LLM_MEMORY_VAULT overrides (tests, repair).
function vaultPath() {
  if (process.env.LLM_MEMORY_VAULT) return path.resolve(process.env.LLM_MEMORY_VAULT);
  const m = loadMachine();
  if (!m || !m.vaultPath) throw new Error('not configured: run `llm-memory init`');
  return path.resolve(m.vaultPath);
}

const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

function validateVault(cfg) {
  const errors = [];
  if (!LANGUAGES.includes(cfg.language)) errors.push(`language must be one of ${LANGUAGES.join(', ')}`);
  if (typeof cfg.sources.enabled !== 'boolean') errors.push('sources.enabled must be true or false');
  if (!Array.isArray(cfg.schedule.ingest) || !cfg.schedule.ingest.every(isTime)) {
    errors.push('schedule.ingest must be a list of HH:MM times');
  }
  if (!DAYS.includes(cfg.schedule.lint.day)) errors.push(`schedule.lint.day must be one of ${DAYS.join(', ')}`);
  if (!isTime(cfg.schedule.lint.time)) errors.push('schedule.lint.time must be HH:MM');
  if (errors.length) throw new Error(`memory.config.json: ${errors.join('; ')}`);
  return cfg;
}

function mergeVault(raw) {
  const r = raw || {};
  return {
    language: r.language || VAULT_DEFAULTS.language,
    sources: { ...VAULT_DEFAULTS.sources, ...(r.sources || {}) },
    schedule: {
      ingest: (r.schedule && r.schedule.ingest) || VAULT_DEFAULTS.schedule.ingest,
      lint: { ...VAULT_DEFAULTS.schedule.lint, ...((r.schedule && r.schedule.lint) || {}) },
    },
  };
}

const vaultConfigPath = (vault) => path.join(vault, 'memory.config.json');

function loadVault(vault) {
  const file = vaultConfigPath(vault);
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return validateVault(mergeVault(raw));
}

function saveVault(vault, cfg) {
  const merged = validateVault(mergeVault(cfg));
  fs.writeFileSync(vaultConfigPath(vault), JSON.stringify(merged, null, 2) + '\n');
  return merged;
}

// https://github.com/alice/llm-memory.git -> https://github.com/alice/llm-memory-sources.git
// git@github.com:alice/llm-memory.git     -> git@github.com:alice/llm-memory-sources.git
function deriveSourcesRemote(originUrl) {
  const m = /^(.*[/:])([^/:]+?)(\.git)?\/?$/.exec(originUrl.trim());
  if (!m) throw new Error(`cannot derive sources remote from "${originUrl}"`);
  return `${m[1]}${m[2]}-sources${m[3] || ''}`;
}

module.exports = {
  APP_DIR, LANGUAGES, DAYS, VAULT_DEFAULTS, version, claudeDir,
  machineConfigPath, loadMachine, saveMachine, removeMachine, vaultPath,
  vaultConfigPath, loadVault, saveVault, deriveSourcesRemote, isTime,
};
