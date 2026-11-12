# macOS (not packaged yet)

Version française ci-dessous.

The Node.js core works on macOS; only the scheduler (launchd) is missing. What works today, by hand:

```bash
# prerequisites: git, node >= 18, gh, claude (brew install git node gh; Claude Code from claude.com)
git clone https://github.com/guipatriota/llm-memory.git ~/llm-memory-app
gh auth login --web
node ~/llm-memory-app/app/cli.cjs init --language fr      # hooks, skills, memory links, repos, backfill
node ~/llm-memory-app/app/cli.cjs status
node ~/llm-memory-app/app/cli.cjs ingest                 # run by hand (or from a launchd agent you write)
```

`init` prints "no scheduler on darwin": run `ingest` and `lint` yourself, or create a `~/Library/LaunchAgents/llm-memory-ingest.plist` that runs `node <app>/cli.cjs ingest` at the times you want. A packaged `.pkg` with launchd agents is planned.

---

# macOS (pas encore empaqueté)

Le cœur Node.js fonctionne sur macOS ; seul le planificateur (launchd) manque. Ce qui fonctionne aujourd'hui, à la main :

```bash
# prérequis : git, node >= 18, gh, claude (brew install git node gh ; Claude Code depuis claude.com)
git clone https://github.com/guipatriota/llm-memory.git ~/llm-memory-app
gh auth login --web
node ~/llm-memory-app/app/cli.cjs init --language fr      # hooks, skills, liens de mémoire, dépôts, rattrapage
node ~/llm-memory-app/app/cli.cjs status
node ~/llm-memory-app/app/cli.cjs ingest                 # à lancer à la main (ou depuis un agent launchd)
```

`init` affiche « no scheduler on darwin » : lancez `ingest` et `lint` vous-même, ou créez un `~/Library/LaunchAgents/llm-memory-ingest.plist` qui exécute `node <app>/cli.cjs ingest` aux heures voulues. Un `.pkg` avec agents launchd est prévu.
