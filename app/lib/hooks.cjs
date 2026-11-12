'use strict';
// Claude Code hooks. Both are fail-open: they never block Claude and always exit 0.
//   stop           copy the session transcript into sources/ and back it up
//   session-start  light sync (pull vault, push pending backups) and make sure
//                  <claudeDir>/projects/<slug>/memory links to the vault
const fs = require('fs');
const path = require('path');
const { git } = require('./git.cjs');
const { loadMachine } = require('./config.cjs');
const sources = require('./sources.cjs');

const warn = (msg) => process.stderr.write(`llm-memory hook: ${msg}\n`);

function readStdin() {
  return new Promise((resolve) => {
    let raw = '';
    process.stdin.on('data', (d) => (raw += d));
    process.stdin.on('end', () => resolve(raw));
    process.stdin.resume();
  });
}

function configuredVault() {
  const m = loadMachine();
  if (!m || !m.vaultPath || !fs.existsSync(m.vaultPath)) return null;
  return path.resolve(m.vaultPath);
}

function stop(input) {
  const { session_id: sessionId, transcript_path: transcriptPath, cwd } = input;
  if (!sessionId || !transcriptPath || !fs.existsSync(transcriptPath)) return;
  const vault = configuredVault();
  if (!vault) return;
  const slug = sources.projectSlug(cwd || '');
  if (!slug) return;
  sources.storeTranscript(vault, slug, sessionId, transcriptPath);
  sources.backupSources(vault, { log: warn });
}

// Best effort, short timeouts, silent when offline: the session opens with the
// local memory and the scheduled run reconciles later.
function syncRepos(vault) {
  const r = git(vault, ['pull', '--ff-only', '-q'], { timeout: 8000 });
  if (!r.ok) warn(`vault pull skipped (${(r.out || 'timeout').split('\n')[0].slice(0, 120)})`);
  if (sources.hasSourcesRepo(vault) && sources.pendingPushes(vault) > 0) {
    sources.backupSources(vault, { pushPending: true, rebase: false, pushTimeout: 8000, log: warn });
  }
}

// Returns 'linked' | 'already' | 'foreign' | 'real-dir'
function linkMemoryDir(vault, memoryPath) {
  let st = null;
  try {
    st = fs.lstatSync(memoryPath);
  } catch {
    /* does not exist: create below */
  }
  if (st) {
    if (st.isSymbolicLink()) {
      const target = path.resolve(path.dirname(memoryPath), fs.readlinkSync(memoryPath));
      return path.resolve(target) === path.resolve(vault) ? 'already' : 'foreign';
    }
    return 'real-dir'; // accumulated native memory: migration is explicit (link-memory)
  }
  fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
  // 'junction' applies on Windows and is ignored on Linux/macOS.
  fs.symlinkSync(vault, memoryPath, 'junction');
  return 'linked';
}

function sessionStart(input) {
  const { transcript_path: transcriptPath, cwd } = input;
  if (!transcriptPath) return;
  const vault = configuredVault();
  if (!vault) return;
  syncRepos(vault);
  // Inside the vault itself, memory -> vault would be a loop.
  if (cwd && path.resolve(cwd).startsWith(vault)) return;
  // dirname(transcript) = <claudeDir>/projects/<slug>/
  const memoryPath = path.join(path.dirname(transcriptPath), 'memory');
  const r = linkMemoryDir(vault, memoryPath);
  if (r === 'foreign') warn(`${memoryPath} points elsewhere, left untouched`);
  if (r === 'real-dir') warn(`${memoryPath} is a real directory, run: llm-memory link-memory`);
}

async function run(kind) {
  try {
    if (process.env.CLAUDE_MEMORY_SKIP === '1') return; // anti-loop: ingest/lint sessions
    const input = JSON.parse((await readStdin()) || '{}');
    if (kind === 'stop') stop(input);
    else if (kind === 'session-start') sessionStart(input);
  } catch (err) {
    warn(err.message);
  }
  process.exit(0);
}

module.exports = { run, stop, sessionStart, linkMemoryDir, syncRepos, configuredVault };
