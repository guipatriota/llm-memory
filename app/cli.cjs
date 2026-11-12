#!/usr/bin/env node
'use strict';
// llm-memory command line. Same entry point for the hooks, the scheduled runs and
// the user-facing commands, on Windows and Linux.
const { t, setLang } = require('./lib/i18n.cjs');

const USAGE = `llm-memory <command> [options]

  init            first-time setup on this machine (GitHub repos, hooks, skills, schedule)
  status          what is configured and whether it is healthy
  ingest          run the ingest now (new transcripts -> wiki pages)
  lint            run the lint now (audit of the wiki)
  backfill        copy transcripts of earlier sessions into sources/
  link-memory     link every project's memory directory to the vault
  repair          re-register hooks, skills and scheduled runs from the config
  uninstall       remove hooks, scheduled runs and skill links (keeps the vault)
  sync <step>     begin <ingest|lint> | end <message> | resolve | release (debug)
  hook <event>    stop | session-start (called by Claude Code)
  version

init options:
  --language en|fr   --vault <dir>   --repo <name|owner/name>   --sources on|off
  --ingest HH:MM[,HH:MM]   --lint Day@HH:MM   --yes   --lang en|fr (messages)
`;

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (key.startsWith('no-')) args[key.slice(3)] = false;
      else if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else args[key] = true;
    } else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (args.lang) setLang(args.lang);
  if (typeof args.log === 'string') {
    // Mirror everything written to the console into a log file (setup wizard).
    const fs = require('fs');
    fs.mkdirSync(require('path').dirname(args.log), { recursive: true });
    const out = fs.openSync(args.log, 'a');
    fs.writeSync(out, `== llm-memory ${process.argv.slice(2).filter((a) => a !== args.log).join(' ')} ${new Date().toISOString()} ==\n`);
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write.bind(stream);
      stream.write = (chunk, ...rest) => {
        try {
          fs.writeSync(out, typeof chunk === 'string' ? chunk : Buffer.from(chunk));
        } catch {
          /* log file unavailable */
        }
        return write(chunk, ...rest);
      };
    }
  }
  const [cmd, sub] = args._;
  try {
    switch (cmd) {
      case 'hook':
        return require('./lib/hooks.cjs').run(sub);
      case 'init': {
        const { init } = require('./lib/init.cjs');
        const opts = { ...args };
        if (typeof opts.sources === 'string') opts.sources = !/^(off|false|no|0)$/i.test(opts.sources);
        await init(opts);
        return 0;
      }
      case 'status':
        return require('./lib/maintain.cjs').status();
      case 'repair':
        return require('./lib/maintain.cjs').repair();
      case 'uninstall':
        return require('./lib/maintain.cjs').uninstall({ purgeLinks: !!args['purge-links'] });
      case 'ingest':
      case 'lint': {
        const { vaultPath } = require('./lib/config.cjs');
        return require('./lib/runner.cjs').runKind(cmd, vaultPath());
      }
      case 'backfill': {
        const { vaultPath } = require('./lib/config.cjs');
        const { backfill } = require('./lib/backfill.cjs');
        const r = await backfill(vaultPath(), { log: console.log });
        console.log(t('backfill.result', r));
        return 0;
      }
      case 'link-memory': {
        const { vaultPath } = require('./lib/config.cjs');
        const r = require('./lib/links.cjs').linkMemory(vaultPath());
        for (const [k, v] of Object.entries(r)) console.log(`${k}: ${v}`);
        return 0;
      }
      case 'sync': {
        const { vaultPath } = require('./lib/config.cjs');
        const { createSync } = require('./lib/vault-sync.cjs');
        const s = createSync(vaultPath());
        const arg = args._[2];
        if (sub === 'begin' && arg) return s.begin(arg);
        if (sub === 'end' && arg) return s.end(arg);
        if (sub === 'resolve') return s.resolve();
        if (sub === 'release') return (s.release(), 0);
        console.error('usage: llm-memory sync begin <ingest|lint> | end <message> | resolve | release');
        return 2;
      }
      case 'version':
      case '--version':
        console.log(require('./lib/config.cjs').version());
        return 0;
      default:
        process.stdout.write(USAGE);
        return cmd ? 2 : 0;
    }
  } catch (err) {
    console.error(`llm-memory ${cmd}: ${err.message}`);
    return 1;
  }
}

main().then((code) => {
  if (typeof code === 'number') process.exitCode = code;
});
