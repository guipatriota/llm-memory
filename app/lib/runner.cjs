'use strict';
// Scheduled runs (ingest, lint), the same on every OS:
//   local lock -> log file -> remote check -> sources sync -> vault-sync begin ->
//   claude -p (skill) -> vault-sync end -> release.
// Exit 20 from a sync step means an open merge with conflicts: the reconciliation
// agent edits the files, `resolve` validates and commits, and the step is repeated.
const fs = require('fs');
const path = require('path');
const { loadVault } = require('./config.cjs');
const { createSync, EXIT } = require('./vault-sync.cjs');
const { remoteCheck } = require('./remote-check.cjs');
const { prompt } = require('./prompt.cjs');
const sources = require('./sources.cjs');
const { git, today } = require('./git.cjs');
const { run: exec } = require('./exec.cjs');

const LOCK_MAX_AGE = 72 * 3600 * 1000;

function fileStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// mkdir is atomic on every platform: the directory is the lock.
function takeLocalLock(runs, kind) {
  const dir = path.join(runs, `.${kind}.lock`);
  const pidFile = path.join(dir, 'pid');
  try {
    fs.mkdirSync(dir);
  } catch {
    let stale = false;
    try {
      const pid = Number(fs.readFileSync(pidFile, 'utf8'));
      const age = Date.now() - fs.statSync(dir).mtimeMs;
      stale = (pid && !pidAlive(pid)) || age > LOCK_MAX_AGE;
    } catch {
      stale = true;
    }
    if (!stale) return null;
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(pidFile, String(process.pid));
  return () => fs.rmSync(dir, { recursive: true, force: true });
}

function claude(promptText, vault, log) {
  const env = { ...process.env, CLAUDE_MEMORY_SKIP: '1' }; // this headless session is not captured
  const r = exec('claude', ['-p', promptText, '--permission-mode', 'bypassPermissions'], { cwd: vault, env });
  if (r.stdout) log(r.stdout);
  if (r.stderr) log(r.stderr);
  if (r.error) log(`ERROR: could not start claude: ${r.error.message}`);
  return r.ok;
}

function runKind(kind, vault) {
  const cfg = loadVault(vault);
  const runs = path.join(vault, '.meta', 'runs');
  fs.mkdirSync(runs, { recursive: true });
  const unlock = takeLocalLock(runs, kind);
  if (!unlock) {
    process.stdout.write(`another ${kind} run is active; exiting\n`);
    return 0;
  }
  const logFile = path.join(runs, `${kind}-${fileStamp()}.log`);
  const out = fs.openSync(logFile, 'a');
  const log = (msg) => {
    const line = msg.endsWith('\n') ? msg : msg + '\n';
    process.stdout.write(line);
    fs.writeSync(out, line);
  };
  const sync = createSync(vault, { log });

  // One sync step; on CONFLICT the agent reconciles and the step is repeated (3x).
  function syncStep(fn) {
    for (let i = 0; i < 3; i++) {
      const code = fn();
      if (code !== EXIT.CONFLICT) return code;
      claude(prompt('reconcile', cfg.language), vault, log);
      const r = sync.resolve();
      if (r !== EXIT.OK) return r;
    }
    return EXIT.SKIP;
  }

  let result = 0;
  try {
    log(`== ${kind} ${new Date().toISOString()} ==`);
    const rc = remoteCheck(vault);
    if (!rc.ok) {
      log(`== end (run skipped: remote ${rc.reason}${rc.detail ? `: ${rc.detail}` : ''}; check 'gh auth status') ==`);
      return 0;
    }
    if (kind === 'ingest' && sources.hasSourcesRepo(vault)) {
      // Picks up pushes deferred by the Stop hook and brings the other machines' files.
      const r = sources.backupSources(vault, {
        message: `backup: ${sources.host()} ${today()} (scheduled)`,
        pushPending: true,
        log,
      });
      log(`sources backup: ${r}`);
    }
    // Without the lock (another machine writing, remote down) there is no run: the
    // sources wait for the next one and no divergent history is born.
    if (syncStep(() => sync.begin(kind)) === EXIT.OK) {
      claude(prompt(kind, cfg.language), vault, log);
      result = syncStep(() => sync.end(`${kind}: ${today()}`));
    }
    sync.release();
    log(`== end ${new Date().toISOString()} ==`);
  } catch (err) {
    log(`ERROR: ${err.stack || err.message}`);
    result = 1;
  } finally {
    fs.closeSync(out);
    unlock();
  }
  process.stdout.write(`Done. Log: ${logFile}\n`);
  return result === EXIT.OK ? 0 : result;
}

// Writes the git status summary used by `status`.
function lastRun(vault, kind) {
  const runs = path.join(vault, '.meta', 'runs');
  if (!fs.existsSync(runs)) return null;
  const files = fs.readdirSync(runs).filter((f) => f.startsWith(`${kind}-`) && f.endsWith('.log')).sort();
  return files.length ? files[files.length - 1] : null;
}

module.exports = { runKind, lastRun, takeLocalLock, git };
