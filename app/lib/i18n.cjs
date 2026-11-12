'use strict';
// CLI messages in English and French. Language: --lang, LLM_MEMORY_LANG, then LANG.
const fs = require('fs');
const path = require('path');

let lang = null;
let table = null;

function detect() {
  const env = process.env.LLM_MEMORY_LANG || process.env.LANG || process.env.LC_ALL || '';
  return /^fr/i.test(env) ? 'fr' : 'en';
}

function setLang(l) {
  lang = l === 'fr' ? 'fr' : 'en';
  table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'i18n', `${lang}.json`), 'utf8'));
}

function t(key, params = {}) {
  if (!table) setLang(detect());
  let s = table[key];
  if (s === undefined) s = key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] === undefined ? `{${k}}` : String(params[k])));
}

const current = () => (lang || (setLang(detect()), lang));

module.exports = { t, setLang, current };
