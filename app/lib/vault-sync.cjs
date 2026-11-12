'use strict';
// Git synchronisation of the vault for the ingest/lint runs. Single implementation,
// used in-process by the runner and exposed as `llm-memory sync` for debugging.
//
// Why it exists: two machines running the ingest at the same time read the SAME
// sources (sources/ is shared) and an LLM never writes the same text twice, so both
// edit the same pages, the second push is rejected and the next day's rebase always
// conflicts. Three guarantees:
//   1. single writer across machines: an atomic ref on the remote (refs/locks/...);
//      whoever comes second waits, pulls the other's result and only then works;
//   2. push with retry: rejected -> integrate origin and try again;
//   3. a real conflict (interactive write-back vs another machine) never stays
//      "to reconcile by hand": it becomes a merge and the runner calls the
//      reconciliation agent.
//
// begin(kind)   lock + clean state + integrate origin   -> OK | SKIP | CONFLICT
// end(message)  commit + push with retry                 -> OK | SKIP | CONFLICT
// resolve()     validate and commit the reconciled merge -> OK | SKIP
// release()     drop the lock (idempotent)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { git: rawGit } = require('./git.cjs');

const EXIT = { OK: 0, SKIP: 10, CONFLICT: 20 };
const LOCK_REF = 'refs/locks/vault-writer';
const minutes = (name, def) => Number(process.env[name] || def) * 60000;
const PUSH_TRIES = 3;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function createSync(vault, opts = {}) {
  const log = opts.log || ((m) => process.stdout.write(m + '\n'));
  const LOCK_TTL = minutes('VAULT_SYNC_LOCK_TTL_MIN', 60); // older lock = dead owner
  const LOCK_WAIT = minutes('VAULT_SYNC_LOCK_WAIT_MIN', 30); // wait for the other machine
  const LOCK_POLL = minutes('VAULT_SYNC_LOCK_POLL_MIN', 0.5);
  // Lock owner: the runner's own pid; the CLI `sync` subcommands use the parent shell's
  // pid (or VAULT_SYNC_PID) so that begin/end/release from separate invocations agree.
  // Some shells (MSYS bash) give every child a different parent pid, so the CLI also
  // passes sameHostRelease: the lock recorded in this clone's state file is released
  // whenever it belongs to this host.
  const OWNER_PID = Number(process.env.VAULT_SYNC_PID) || opts.ownerPid || process.pid;
  const SAME_HOST_RELEASE = Boolean(opts.sameHostRelease);
  const HOST = (process.env.VAULT_SYNC_HOST || os.hostname().split('.')[0]).toLowerCase();

  function git(args, o = {}) {
    const r = rawGit(vault, args, { input: o.input, timeout: o.timeout });
    if (o.echo && r.out) log(r.out);
    return r;
  }

  const gitDir = () => path.resolve(vault, git(['rev-parse', '--git-dir']).stdout);
  const stateFile = (name) => path.join(gitDir(), name);

  // ------------------------------------------------------------ remote lock

  // Empty commit whose message identifies the owner; the ref is only created when it
  // does not exist (--force-with-lease with an empty expected value, atomic server side).
  function makeLockCommit(kind) {
    const tree = git(['mktree'], { input: '' }).stdout;
    const msg = `${HOST} ${kind} pid=${OWNER_PID} ${new Date().toISOString()}`;
    return git(['commit-tree', tree, '-m', msg]).stdout;
  }

  // { sha } of the current lock, null when free; throws when the remote is unreachable.
  function remoteLock() {
    const r = git(['ls-remote', 'origin', LOCK_REF], { timeout: 30000 });
    if (!r.ok) throw new Error((r.out || 'remote unreachable').split('\n')[0]);
    return r.stdout ? { sha: r.stdout.split(/\s+/)[0] } : null;
  }

  function lockOwner(sha) {
    git(['fetch', '-q', 'origin', LOCK_REF], { timeout: 60000 });
    const r = git(['log', '-1', '--format=%ct %s', sha]);
    if (!r.ok) return { host: '?', kind: '?', pid: 0, age: 0, label: sha.slice(0, 7) };
    const [ct, host, kind, pid] = r.stdout.split(' ');
    return {
      host,
      kind,
      pid: Number((pid || '').replace('pid=', '')),
      age: Date.now() - Number(ct) * 1000,
      label: `${host}/${kind}`,
    };
  }

  function pidAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err.code === 'EPERM';
    }
  }

  const pushLock = (expect, src) =>
    git(['push', '-q', `--force-with-lease=${LOCK_REF}:${expect}`, 'origin', `${src}:${LOCK_REF}`], { timeout: 60000 }).ok;

  function acquireLock(kind) {
    const file = stateFile('vault-sync-lock');
    const mine = makeLockCommit(kind);
    const deadline = Date.now() + LOCK_WAIT;
    let announced = false;
    for (;;) {
      let cur;
      try {
        cur = remoteLock();
      } catch (err) {
        log(`WARNING: remote unreachable (${err.message}); no lock, no write: run skipped`);
        return false;
      }
      if (!cur) {
        if (pushLock('', mine)) {
          fs.writeFileSync(file, mine + '\n');
          log(`lock ${LOCK_REF} acquired (${HOST}/${kind})`);
          return true;
        }
        continue; // another machine created it between ls-remote and push: re-evaluate
      }

      const owner = lockOwner(cur.sha);
      // Same runner calling again (begin repeated after reconciling): the lock is ours.
      // Another live runner on this machine (lint during ingest) waits like anyone else.
      if (owner.host === HOST && owner.pid === OWNER_PID) {
        fs.writeFileSync(file, cur.sha + '\n');
        return true;
      }
      const dead = owner.host === HOST && owner.pid && !pidAlive(owner.pid);
      if (dead || owner.age > LOCK_TTL) {
        log(`orphan lock from ${owner.label} (${Math.round(owner.age / 60000)} min): taking over`);
        if (pushLock(cur.sha, mine)) {
          fs.writeFileSync(file, mine + '\n');
          return true;
        }
        continue;
      }
      if (Date.now() >= deadline) {
        log(`WARNING: lock held by ${owner.label} for ${Math.round(owner.age / 60000)} min: run skipped`);
        return false;
      }
      if (!announced) log(`lock held by ${owner.label}: waiting for it to finish, then pulling its result`);
      announced = true;
      sleep(LOCK_POLL);
    }
  }

  function releaseLock() {
    const file = stateFile('vault-sync-lock');
    if (!fs.existsSync(file)) return;
    const mine = fs.readFileSync(file, 'utf8').trim();
    // The file is per clone: a skipped run must not release the other run's lock.
    const subject = git(['log', '-1', '--format=%s', mine]).stdout;
    const ours = subject.includes(` pid=${OWNER_PID} `) || (SAME_HOST_RELEASE && subject.startsWith(`${HOST} `));
    if (!ours) return;
    // Lease on our sha: if another machine took the lock over (TTL), do not delete it.
    const ok = pushLock(mine, '');
    fs.unlinkSync(file);
    log(ok ? 'lock released' : 'WARNING: lock not released (remote down or taken over); it expires by itself');
  }

  // ------------------------------------------------------------ integration

  const conflictFile = () => stateFile('vault-sync-conflicts');
  const unmerged = () => git(['diff', '--name-only', '--diff-filter=U']).stdout.split('\n').filter(Boolean);

  // Brings origin/main into main. Working tree must be clean.
  // 'ok' | 'offline' | 'conflict' (merge left open, list in .git/vault-sync-conflicts)
  function integrate() {
    if (!git(['fetch', '-q', 'origin'], { echo: true, timeout: 120000 }).ok) return 'offline';
    const counts = git(['rev-list', '--left-right', '--count', 'HEAD...origin/main']).stdout.split(/\s+/).map(Number);
    const [ahead, behind] = counts;
    if (!behind) return 'ok';
    if (!ahead) return git(['merge', '-q', '--ff-only', 'origin/main'], { echo: true }).ok ? 'ok' : 'offline';

    // Diverged. Without overlap the rebase succeeds and history stays linear.
    if (git(['rebase', '-q', 'origin/main']).ok) {
      log(`rebased on origin/main (${ahead} local commit(s))`);
      return 'ok';
    }
    git(['rebase', '--abort']);

    // Overlap: merge (nothing discarded, both sides stay in history).
    const msg = `merge: reconcile ${HOST} with origin (auto)`;
    if (git(['merge', '--no-ff', '-m', msg, 'origin/main']).ok) {
      log('merged origin/main (no conflict)');
      return 'ok';
    }
    const files = unmerged();
    if (!files.length) {
      git(['merge', '--abort']);
      log('ERROR: merge failed without conflicting files; aborted');
      return 'offline';
    }
    fs.writeFileSync(conflictFile(), files.join('\n') + '\n');
    log(`CONFLICT in ${files.length} file(s), automatic reconciliation:\n  ${files.join('\n  ')}`);
    return 'conflict';
  }

  // A broken state left by a previous run must not contaminate this one.
  function cleanState() {
    if (!git(['symbolic-ref', '-q', 'HEAD']).ok) {
      log('ERROR: detached HEAD; reconcile by hand (git checkout -B main; git merge origin/main)');
      return false;
    }
    const dir = gitDir();
    if (fs.existsSync(path.join(dir, 'rebase-merge')) || fs.existsSync(path.join(dir, 'rebase-apply'))) {
      log('WARNING: rebase left over from a previous run; aborting it');
      git(['rebase', '--abort'], { echo: true });
    }
    if (fs.existsSync(path.join(dir, 'MERGE_HEAD'))) {
      log('WARNING: merge left open by a previous run; aborting it');
      git(['merge', '--abort'], { echo: true });
    }
    return true;
  }

  function commitAll(message) {
    git(['add', '-A']);
    if (git(['diff', '--cached', '--quiet']).ok) return false;
    git(['commit', '-q', '-m', message], { echo: true });
    return true;
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ------------------------------------------------------------ commands

  function begin(kind) {
    if (!cleanState()) return EXIT.SKIP;
    // Interactive write-back (native memory link) is committed before anything else.
    if (commitAll(`write-back: ${stamp()}`)) log('local write-back committed');
    if (!acquireLock(kind)) return EXIT.SKIP;
    const r = integrate();
    if (r === 'conflict') return EXIT.CONFLICT;
    if (r === 'offline') {
      log('WARNING: could not integrate origin: run skipped');
      return EXIT.SKIP;
    }
    return EXIT.OK;
  }

  function end(message) {
    if (fs.existsSync(path.join(gitDir(), 'MERGE_HEAD'))) {
      log('ERROR: merge open; run `resolve` before `end`');
      return EXIT.SKIP;
    }
    log(commitAll(message) ? `commit: ${message}` : 'nothing to commit');
    for (let i = 1; i <= PUSH_TRIES; i++) {
      if (git(['push', '-q', 'origin', 'main'], { timeout: 120000 }).ok) {
        log('push ok');
        return EXIT.OK;
      }
      log(`push rejected (attempt ${i}/${PUSH_TRIES}); integrating origin`);
      const r = integrate();
      if (r === 'conflict') return EXIT.CONFLICT;
      if (r === 'offline') break;
    }
    log('WARNING: push failed; local commit kept, next run reconciles');
    return EXIT.SKIP;
  }

  // After the reconciliation agent: commit only when no marker is left.
  function resolve() {
    const dir = gitDir();
    if (!fs.existsSync(path.join(dir, 'MERGE_HEAD'))) {
      log('ERROR: no open merge to resolve');
      return EXIT.SKIP;
    }
    const files = fs.existsSync(conflictFile())
      ? fs.readFileSync(conflictFile(), 'utf8').split('\n').filter(Boolean)
      : unmerged();
    const bad = files.filter((f) => {
      const p = path.join(vault, f);
      if (!fs.existsSync(p)) return false; // resolved by deletion
      const text = fs.readFileSync(p, 'utf8');
      return !text.trim() || /^(<{7}|>{7})( |$)/m.test(text);
    });
    if (bad.length) {
      log(`ERROR: reconciliation incomplete (conflict marker or empty file):\n  ${bad.join('\n  ')}`);
      git(['merge', '--abort'], { echo: true });
      fs.rmSync(conflictFile(), { force: true });
      return EXIT.SKIP;
    }
    git(['add', '-A']);
    const ok = git(['commit', '-q', '--no-edit'], { echo: true }).ok;
    fs.rmSync(conflictFile(), { force: true });
    if (!ok) {
      log('ERROR: merge commit failed; aborting');
      git(['merge', '--abort'], { echo: true });
      return EXIT.SKIP;
    }
    log(`merge reconciled: ${git(['log', '-1', '--format=%h %s']).stdout}`);
    return EXIT.OK;
  }

  return { begin, end, resolve, release: releaseLock, EXIT, LOCK_REF };
}

module.exports = { createSync, EXIT, LOCK_REF };
