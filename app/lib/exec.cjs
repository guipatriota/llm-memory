'use strict';
// Running external tools (claude, gh, powershell, systemctl) portably. On Windows the
// tool may be a .cmd shim, which only cmd.exe can start; arguments are then quoted
// for cmd.exe, so callers keep prompts free of double quotes and of % ^ & | < >.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WIN = process.platform === 'win32';

// Full path of a command, or null. On Windows honours PATHEXT (.exe, .cmd, .bat).
function which(name) {
  const exts = WIN ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    for (const ext of exts) {
      const candidate = path.join(d, name + (name.toLowerCase().endsWith(ext.toLowerCase()) ? '' : ext));
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        /* keep looking */
      }
    }
  }
  return null;
}

function cmdQuote(arg) {
  if (arg === '' || /[\s"]/.test(arg)) return `"${arg.replace(/"/g, '\\"')}"`;
  return arg;
}

// spawnSync wrapper: { status, stdout, stderr, ok, error }. opts: cwd, env, timeout,
// input, inherit (stdio inherit), capture (default true).
function run(cmd, args = [], opts = {}) {
  let file = cmd;
  let argv = args;
  if (WIN) {
    const resolved = which(cmd) || cmd;
    if (/\.(cmd|bat)$/i.test(resolved)) {
      file = process.env.ComSpec || 'cmd.exe';
      argv = ['/d', '/s', '/c', `"${[cmdQuote(resolved), ...args.map(cmdQuote)].join(' ')}"`];
    } else {
      file = resolved;
    }
  }
  const r = spawnSync(file, argv, {
    cwd: opts.cwd,
    env: opts.env || process.env,
    input: opts.input,
    timeout: opts.timeout,
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
    stdio: opts.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    windowsVerbatimArguments: WIN && file.toLowerCase().endsWith('cmd.exe'),
  });
  return {
    ok: r.status === 0 && !r.error,
    status: r.status,
    stdout: (r.stdout || '').toString().trim(),
    stderr: (r.stderr || '').toString().trim(),
    error: r.error,
  };
}

function nodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}

module.exports = { which, run, cmdQuote, nodeMajor, WIN };
