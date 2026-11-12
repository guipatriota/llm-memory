# llm-memory-sources : sauvegarde des transcriptions brutes

> **CONTENU SENSIBLE.** Ce dépôt contient les transcriptions **brutes** de vos sessions LLM (fichiers JSONL de Claude Code). Elles peuvent contenir des secrets en clair : jetons, mots de passe, sorties de commandes, contenus de fichiers. Ne le rendez **JAMAIS** public, ne le partagez **JAMAIS**, ne le connectez **JAMAIS** à une intégration.
>
> English version: [README.md](README.md)

## Ce que c'est

Sauvegarde centrale du dossier `sources/` de votre coffre `llm-memory`, couche 1 (sources brutes) du système de mémoire. Le coffre lui-même ne versionne que la couche wiki (distillée, secrets caviardés) ; les sources brutes en restent **exclues** volontairement.

Ce dépôt existe pour deux raisons : une copie hors site des transcriptions de **toutes vos machines**, et l'accès à l'historique brut depuis n'importe quelle machine, pour audit ou retraitement.

## Organisation

```
claude-code/<projet>/<uuid-de-session>.jsonl   un fichier par session, depuis la machine d'origine
```

## Comment il est alimenté (automatique)

- Sur chaque machine, ce dépôt est cloné **à l'intérieur** de l'arborescence du coffre, dans `<coffre>/sources/` (le `.gitignore` du coffre ignore `sources/`, les deux dépôts imbriqués coexistent donc).
- Le **hook Stop** de Claude Code copie la transcription à la fin de chaque session **et fait commit et push** de ce dépôt (hors ligne toléré : commit local toujours, push au mieux ; l'ingest planifié réconcilie ensuite).
- L'ingest planifié synchronise aussi ce dépôt (`pull --rebase` + push) comme filet de sécurité.

## Nouvelle machine

Rien de manuel : `llm-memory init` clone ce dépôt dans `sources/` quand il existe déjà.

## Règles

- **Immuabilité** : les sources ne sont jamais modifiées ni supprimées. Chaque machine n'ajoute ou ne met à jour que ses propres uuids, les fusions sont donc triviales.
- **Pas de réécriture d'historique** : ce dépôt est une piste d'audit.
- Les commits automatiques s'intitulent `backup: <machine> <date>` ; ne commitez pas ici à la main, sauf maintenance délibérée.
