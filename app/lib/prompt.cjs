'use strict';
// Prompts for the headless agents. One line, plain ASCII, no double quotes: they are
// passed as a command-line argument on Windows and on Linux alike.
const LANG_NAME = { en: 'English', fr: 'French' };

function languageClause(language) {
  const name = LANG_NAME[language] || 'English';
  return `Write all prose (summaries, hooks, reports) in ${name}; structural tokens (frontmatter keys and values, section headings, log format) stay in English exactly as defined in schema.md.`;
}

function prompt(kind, language = 'en') {
  const lang = languageClause(language);
  switch (kind) {
    case 'ingest':
      return `You are the ingest agent of the llm-memory vault (current directory). Read schema.md and run the ingest-memory skill on the new sources in sources/. Follow the schema strictly: redact secrets before writing anything, idempotence by uuid, confidence inferred, update MEMORY.md and log.md. A new session = one line in the Sessions section of the project page; MEMORY.md lists only durable pages and stays within budget (200 lines, 25 KB, 150 characters per line). ${lang}`;
    case 'lint':
      return `You are the lint agent of the llm-memory vault (current directory). Read schema.md and run the lint-memory skill: report in .meta/ named lint- followed by the ISO date, auto-fix only what is safe, flag contradictions and never resolve them, append to log.md. Check the MEMORY.md budget (200 lines, 25 KB, 150 characters per line, zero session lines) and fix it in the same run. ${lang}`;
    case 'reconcile':
      return `You are the reconciliation agent of the llm-memory vault (current directory). A git merge of origin/main is open with conflicts; the files are listed in .git/vault-sync-conflicts. Read schema.md and resolve ALL of them following the section Merge reconciliation: union without discarding, no conflict marker left. Only edit files: do not run git add, commit, merge, rebase or push; the runner validates and commits. ${lang}`;
    default:
      throw new Error(`unknown prompt kind: ${kind}`);
  }
}

module.exports = { prompt, languageClause };
