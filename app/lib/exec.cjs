'use strict';
// Running external tools (claude, gh, powershell, systemctl) portably. On Windows the
// tool may be a .cmd shim, which only cmd.exe can start; arguments are then quoted
// for cmd.exe, so callers keep prompts free of double quotes and of % ^ & | < >.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WIN = process.platform === 'win32';

// Full path of a command, or null. On Windows honours PATHEXT (.exe, .cmd, .bat).
let refreshed = false;

function which(name) {
  const found = whichOnPath(name);
  if (found || !WIN || refreshed) return found;
  refreshed = true;
  refreshWindowsPath();
  return whichOnPath(name);
}

function whichOnPath(name) {
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

// A tool installed a minute ago (winget) is on the registry PATH but not on the PATH
// of the process that launched us. Merge both registry values into process.env.PATH.
function refreshWindowsPath() {
  if (!WIN) return;
  const read = (hive) => {
    const r = spawnSync('reg', ['query', `${hive}\\Environment`, '/v', 'Path'], { encoding: 'utf8' });
    const m = /Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i.exec(r.stdout || '');
    return m ? m[1].trim() : '';
  };
  const hklm = read('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager');
  const hkcu = read('HKCU');
  const expand = (s) => s.replace(/%([^%]+)%/g, (_, k) => process.env[k] || process.env[k.toUpperCase()] || '');
  const current = (process.env.PATH || '').split(';');
  const seen = new Set(current.map((p) => p.toLowerCase()));
  for (const p of `${hklm};${hkcu}`.split(';').map(expand).filter(Boolean)) {
    if (!seen.has(p.toLowerCase())) {
      current.push(p);
      seen.add(p.toLowerCase());
    }
  }
  process.env.PATH = current.filter(Boolean).join(';');
}

module.exports = { which, run, cmdQuote, nodeMajor, refreshWindowsPath, WIN };
