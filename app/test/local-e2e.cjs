'use strict';
// Local end-to-end exercise without GitHub: a bare repository stands in for origin.
// Run by hand:  CLAUDE_CONFIG_DIR=<scratch> node app/test/local-e2e.cjs <scratch-root> [--claude]
// --claude also runs the real headless ingest (needs a signed-in `claude`).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'lm-e2e-')));
const withClaude = process.argv.includes('--claude');
const app = path.resolve(__dirname, '..');
const cli = path.join(app, 'cli.cjs');
process.env.CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(root, 'claude');
const claudeDir = process.env.CLAUDE_CONFIG_DIR;
const vault = path.join(root, 'vault');
const bare = path.join(root, 'origin.git');
const bareSources = path.join(root, 'origin-sources.git');

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
const node = (args, opts) => sh(process.execPath, [cli, ...args], opts);
const step = (m) => console.log(`\n### ${m}`);

fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(claudeDir, { recursive: true });

step('bare origins');
sh('git', ['init', '-q', '--bare', '-b', 'main', bare]);
sh('git', ['init', '-q', '--bare', '-b', 'main', bareSources]);

step('vault from template');
const cfg = require('../lib/config.cjs');
const { copyTemplate } = require('../lib/init.cjs');
fs.mkdirSync(vault, { recursive: true });
sh('git', ['init', '-q', '-b', 'main', vault]);
sh('git', ['-C', vault, 'remote', 'add', 'origin', bare]);
copyTemplate(path.join(app, 'templates', 'vault'), vault);
cfg.saveVault(vault, { language: 'fr', sources: { enabled: true, remote: bareSources } });
sh('git', ['-C', vault, 'add', '-A']);
sh('git', ['-C', vault, 'commit', '-q', '-m', 'init: vault']);
sh('git', ['-C', vault, 'push', '-q', '-u', 'origin', 'main']);
const sources = path.join(vault, 'sources');
fs.mkdirSync(sources);
sh('git', ['init', '-q', '-b', 'main', sources]);
sh('git', ['-C', sources, 'remote', 'add', 'origin', bareSources]);
copyTemplate(path.join(app, 'templates', 'sources'), sources);
sh('git', ['-C', sources, 'add', '-A']);
sh('git', ['-C', sources, 'commit', '-q', '-m', 'init: sources']);
sh('git', ['-C', sources, 'push', '-q', '-u', 'origin', 'main']);
cfg.saveMachine({ vaultPath: vault });

step('hooks, skills, memory links');
require('../lib/settings-hooks.cjs').install(path.join(claudeDir, 'settings.json'), app);
console.log(require('../lib/links.cjs').linkSkills());
const proj = path.join(claudeDir, 'projects', 'C--Users-me-demo-project');
fs.mkdirSync(proj, { recursive: true });
const transcript = path.join(proj, '11111111-2222-3333-4444-555555555555.jsonl');
const cwd = path.join(os.homedir(), 'demo-project');
fs.writeFileSync(transcript, [
  JSON.stringify({ type: 'user', cwd, message: { role: 'user', content: 'Decision: the demo project uses PostgreSQL 16 and deploys on Fridays. Token for later: ghp_FAKE1234567890' } }),
  JSON.stringify({ type: 'assistant', cwd, message: { role: 'assistant', content: 'Noted: PostgreSQL 16, Friday deploys. I will not record the token.' } }),
].join('\n') + '\n');

step('hook session-start');
node(['hook', 'session-start'], { input: JSON.stringify({ transcript_path: transcript, cwd }) });
const mem = path.join(proj, 'memory');
console.log('memory link ->', fs.readlinkSync(mem));
if (path.resolve(fs.readlinkSync(mem)) !== path.resolve(vault)) throw new Error('memory link wrong');

step('hook stop');
node(['hook', 'stop'], { input: JSON.stringify({ session_id: '11111111-2222-3333-4444-555555555555', transcript_path: transcript, cwd }) });
const stored = path.join(sources, 'claude-code', 'demo-project', '11111111-2222-3333-4444-555555555555.jsonl');
if (!fs.existsSync(stored)) throw new Error('transcript not stored');
console.log('sources log:', sh('git', ['-C', sources, 'log', '--oneline', '-2']));
console.log('bare sources head:', sh('git', ['--git-dir', bareSources, 'log', '--oneline', '-1']));

step('skip flag');
node(['hook', 'stop'], { input: JSON.stringify({ session_id: 'skip-me', transcript_path: transcript, cwd }), env: { ...process.env, CLAUDE_MEMORY_SKIP: '1' } });
if (fs.existsSync(path.join(sources, 'claude-code', 'demo-project', 'skip-me.jsonl'))) throw new Error('skip flag ignored');

step('backfill (idempotent)');
console.log(node(['backfill']));

step('status');
console.log(node(['status']));

step('sync begin/end/release with the bare origin');
console.log(node(['sync', 'begin', 'ingest']));
console.log('locks:', sh('git', ['--git-dir', bare, 'for-each-ref', 'refs/locks/']));
console.log(node(['sync', 'end', 'test: sync']));
console.log(node(['sync', 'release']));
console.log('locks after release:', JSON.stringify(sh('git', ['--git-dir', bare, 'for-each-ref', 'refs/locks/'])));

step('remote unreachable -> run skipped');
sh('git', ['-C', vault, 'remote', 'set-url', 'origin', path.join(root, 'missing.git')]);
console.log(node(['ingest']));
sh('git', ['-C', vault, 'remote', 'set-url', 'origin', bare]);

if (withClaude) {
  step('real ingest (claude -p)');
  console.log(node(['ingest'], { env: { ...process.env, CLAUDE_MEMORY_SKIP: '' } }));
  const sessions = path.join(vault, 'pages', 'sessions', 'demo-project');
  console.log('session pages:', fs.existsSync(sessions) ? fs.readdirSync(sessions) : []);
  console.log('MEMORY.md:\n' + fs.readFileSync(path.join(vault, 'MEMORY.md'), 'utf8'));
  const all = sh('git', ['-C', vault, 'grep', '-l', 'ghp_FAKE1234567890'], { stdio: ['pipe', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  if (all.length) throw new Error(`secret leaked into ${all.join(', ')}`);
  console.log('secret not present in the wiki: ok');
  step('second ingest (idempotence)');
  console.log(node(['ingest']));
  console.log('vault log:', sh('git', ['-C', vault, 'log', '--oneline', '-5']));
}

step('uninstall');
console.log(node(['uninstall']));
console.log('settings:', fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
console.log('\nOK', root);
