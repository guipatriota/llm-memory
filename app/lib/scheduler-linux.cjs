'use strict';
// systemd user timers (Ubuntu). Persistent=true runs a missed timer as soon as the
// machine is on; OnStartupSec gives a run shortly after login as well.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { run, which } = require('./exec.cjs');

const UNIT_DIR = () => path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'systemd', 'user');
const UNITS = ['llm-memory-ingest.service', 'llm-memory-ingest.timer', 'llm-memory-lint.service', 'llm-memory-lint.timer'];
const TIMERS = ['llm-memory-ingest.timer', 'llm-memory-lint.timer'];

const systemctl = (args) => run('systemctl', ['--user', ...args], { timeout: 60000 });

function available() {
  if (!which('systemctl')) return false;
  return systemctl(['show-environment']).ok; // false when no user session bus (plain WSL, ssh without linger)
}

function service(appDir, kind) {
  const cli = path.join(appDir, 'cli.cjs');
  // Quoted: on WSL the PATH carries Windows folders with spaces, which an unquoted
  // assignment makes systemd reject (and then drop) entirely.
  const envPath = (process.env.PATH || '/usr/local/bin:/usr/bin:/bin').split('"').join('');
  const pathLine = `Environment="PATH=${envPath}"`;
  return `[Unit]
Description=llm-memory: ${kind} (headless Claude Code run)

[Service]
Type=oneshot
Environment=CLAUDE_MEMORY_SKIP=1
${pathLine}
ExecStart=${process.execPath} "${cli}" ${kind}
`;
}

function ingestTimer(times) {
  const cal = times.map((t) => `OnCalendar=*-*-* ${t}:00`).join('\n');
  return `[Unit]
Description=llm-memory: daily ingest (${times.join(', ')}) and after boot

[Timer]
${cal}
OnStartupSec=3min
Persistent=true

[Install]
WantedBy=timers.target
`;
}

function lintTimer(lint) {
  return `[Unit]
Description=llm-memory: weekly lint (${lint.day} ${lint.time})

[Timer]
OnCalendar=${lint.day} *-*-* ${lint.time}:00
Persistent=true

[Install]
WantedBy=timers.target
`;
}

function register(appDir, schedule) {
  const dir = UNIT_DIR();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'llm-memory-ingest.service'), service(appDir, 'ingest'));
  fs.writeFileSync(path.join(dir, 'llm-memory-ingest.timer'), ingestTimer(schedule.ingest));
  fs.writeFileSync(path.join(dir, 'llm-memory-lint.service'), service(appDir, 'lint'));
  fs.writeFileSync(path.join(dir, 'llm-memory-lint.timer'), lintTimer(schedule.lint));
  if (!available()) return { written: true, enabled: false };
  systemctl(['daemon-reload']);
  const r = systemctl(['enable', '--now', ...TIMERS]);
  return { written: true, enabled: r.ok, detail: r.ok ? '' : (r.stderr || r.stdout).split('\n')[0] };
}

function unregister() {
  if (available()) systemctl(['disable', '--now', ...TIMERS]);
  for (const u of UNITS) fs.rmSync(path.join(UNIT_DIR(), u), { force: true });
  if (available()) systemctl(['daemon-reload']);
  return true;
}

// { 'llm-memory-ingest.timer': 'active' | 'inactive' | null, ... }
function status() {
  const out = {};
  for (const t of TIMERS) {
    if (!fs.existsSync(path.join(UNIT_DIR(), t))) {
      out[t] = null;
      continue;
    }
    const r = available() ? systemctl(['is-active', t]) : { stdout: 'unknown (no systemd user session)' };
    out[t] = r.stdout || 'inactive';
  }
  return out;
}

module.exports = { register, unregister, status, available, UNIT_DIR, TIMERS };
