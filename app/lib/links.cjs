'use strict';
// Links that make Claude Code see the vault:
//   <claudeDir>/skills/<skill>          -> <app>/skills/<skill>   (ingest-memory, lint-memory)
//   <claudeDir>/projects/<slug>/memory  -> <vault>                (MEMORY.md auto-load)
// Junctions on Windows, symlinks elsewhere. A real directory is never deleted: it is
// renamed to <name>.bak-<date> first (rollback = rename it back).
const fs = require('fs');
const path = require('path');
const { claudeDir, APP_DIR } = require('./config.cjs');
const { linkMemoryDir } = require('./hooks.cjs');

const SKILLS = ['ingest-memory', 'lint-memory'];

const today = () => new Date().toISOString().slice(0, 10);

function linkInfo(p) {
  try {
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) return { kind: 'link', target: path.resolve(path.dirname(p), fs.readlinkSync(p)) };
    if (st.isDirectory()) return { kind: 'dir' };
    return { kind: 'file' };
  } catch {
    return { kind: 'missing' };
  }
}

// Removes only the reparse point / symlink, never the target's content.
function unlinkOnly(p) {
  const st = fs.lstatSync(p);
  if (!st.isSymbolicLink()) throw new Error(`${p} is not a link`);
  if (process.platform === 'win32') fs.rmdirSync(p); // junction: rmdir removes the reparse point only
  else fs.unlinkSync(p);
}

function replaceWithLink(p, target) {
  const info = linkInfo(p);
  let note = 'linked';
  if (info.kind === 'link') {
    if (path.resolve(info.target) === path.resolve(target)) return 'already';
    unlinkOnly(p);
    note = 'relinked';
  } else if (info.kind === 'dir') {
    fs.renameSync(p, `${p}.bak-${today()}`);
    note = 'backed-up-and-linked';
  } else if (info.kind === 'file') {
    fs.renameSync(p, `${p}.bak-${today()}`);
    note = 'backed-up-and-linked';
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.symlinkSync(target, p, 'junction');
  return note;
}

function linkSkills(appDir = APP_DIR) {
  const out = {};
  for (const s of SKILLS) out[s] = replaceWithLink(path.join(claudeDir(), 'skills', s), path.join(appDir, 'skills', s));
  return out;
}

function unlinkSkills(appDir = APP_DIR) {
  const out = {};
  for (const s of SKILLS) {
    const p = path.join(claudeDir(), 'skills', s);
    const info = linkInfo(p);
    if (info.kind === 'link' && path.resolve(info.target).startsWith(path.resolve(appDir))) {
      unlinkOnly(p);
      out[s] = 'removed';
    } else out[s] = 'kept';
  }
  return out;
}

function skillsStatus(appDir = APP_DIR) {
  const out = {};
  for (const s of SKILLS) {
    const info = linkInfo(path.join(claudeDir(), 'skills', s));
    out[s] = info.kind === 'link' ? info.target : info.kind;
  }
  return out;
}

// All <claudeDir>/projects/*/memory: link, or back up a real directory and link.
function linkMemory(vault) {
  const projects = path.join(claudeDir(), 'projects');
  const out = {};
  if (!fs.existsSync(projects)) return out;
  for (const d of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const memory = path.join(projects, d.name, 'memory');
    const info = linkInfo(memory);
    if (info.kind === 'dir') {
      fs.renameSync(memory, `${memory}.bak-${today()}`);
      out[d.name] = 'backed-up-and-linked';
      linkMemoryDir(vault, memory);
    } else out[d.name] = linkMemoryDir(vault, memory);
  }
  return out;
}

function memoryStatus(vault) {
  const projects = path.join(claudeDir(), 'projects');
  const out = {};
  if (!fs.existsSync(projects)) return out;
  for (const d of fs.readdirSync(projects, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const info = linkInfo(path.join(projects, d.name, 'memory'));
    if (info.kind === 'link') out[d.name] = path.resolve(info.target) === path.resolve(vault) ? 'linked' : `foreign: ${info.target}`;
    else out[d.name] = info.kind === 'dir' ? 'real-dir' : 'none';
  }
  return out;
}

module.exports = { SKILLS, linkInfo, unlinkOnly, replaceWithLink, linkSkills, unlinkSkills, skillsStatus, linkMemory, memoryStatus };
