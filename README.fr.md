# llm-memory

Mémoire persistante et partagée pour vos sessions Claude Code. Un coffre wiki privé, versionné avec Git et hébergé dans votre propre compte GitHub, retient ce que vous et Claude avez fait, d'un projet à l'autre et d'une machine à l'autre.

English version: [README.md](README.md) (reference version; keep this file in sync with it)

## Fonctionnement

1. **Capture.** À la fin de chaque session Claude Code, un hook copie la transcription dans `sources/` de votre coffre et la sauvegarde (second dépôt privé, optionnel).
2. **Ingest.** Une exécution planifiée sans interface (`claude -p` avec le skill `ingest-memory`) transforme les nouvelles transcriptions en pages wiki : un résumé par session, des pages durables par projet et par entité, et un court index, `MEMORY.md`, que Claude Code charge automatiquement à chaque session. Les secrets sont caviardés avant toute écriture.
3. **Lint.** Une exécution hebdomadaire audite le coffre : contradictions, pages périmées, orphelines, budget de l'index. Elle ne corrige que ce qui est sûr et signale le reste.

Deux machines du même utilisateur partagent le coffre via GitHub. Un verrou d'écrivain unique sur le dépôt distant empêche les exécutions planifiées d'entrer en collision, et les fusions sont réconciliées automatiquement par une troisième exécution sans interface.

Le coffre est du Markdown ordinaire. Obsidian l'ouvre comme un coffre, mais rien ne dépend d'Obsidian.

## Installation sur Windows

1. Téléchargez `llm-memory-setup-<version>.exe` depuis la page [Releases](https://github.com/guipatriota/llm-memory/releases).
2. Lancez-le. L'installateur n'est pas encore signé numériquement : Windows SmartScreen peut afficher « Windows a protégé votre ordinateur ». Cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'assistant vous guide :
   - **Prérequis** : Git, Node.js, GitHub CLI et Claude Code. Un bouton installe ceux qui manquent avec winget. Après l'installation de Claude Code, ouvrez un terminal et lancez `claude` une fois pour vous connecter.
   - **Compte GitHub** : un bouton ouvre une console avec un code à usage unique et votre navigateur. Connectez-vous et confirmez le code.
   - **Langue de la mémoire** (anglais ou français), **dossier du coffre** (par défaut `%USERPROFILE%\llm-memory`), **nom du dépôt** (par défaut `llm-memory`), **horaires** (ingest chaque jour à 10 h 20 et 14 h 20, lint le jeudi à 11 h).
   - **Sauvegarde des transcriptions** : si les transcriptions brutes vont dans un second dépôt privé nommé `<dépôt>-sources`. Lisez l'avertissement de cette page.
4. L'installateur lance ensuite `llm-memory init` dans une console : création des dépôts privés, des hooks, des skills, des liens de mémoire, des tâches planifiées, et copie des transcriptions des sessions antérieures. Appuyez sur une touche quand il le demande.
5. Ouvrez un **nouveau** terminal : la commande `llm-memory` est disponible.

L'installateur s'exécute par utilisateur et ne demande jamais les droits administrateur.

## Installation sur Ubuntu (24.04 ou plus récent)

```bash
sudo apt install ./llm-memory_<version>_all.deb   # installe git, nodejs et gh
curl -fsSL https://claude.ai/install.sh | bash     # Claude Code, s'il n'est pas déjà installé
claude                                              # se connecter une fois, puis quitter
gh auth login --web                                 # connexion GitHub dans le navigateur
llm-memory init --language fr                       # ou en ; le reste est demandé interactivement
```

Ubuntu 22.04 fournit Node.js 12, trop ancien : installez d'abord Node.js 18 ou plus récent depuis NodeSource, puis le paquet.

Les exécutions planifiées utilisent des timers systemd utilisateur. Si `llm-memory init` indique que les timers n'ont pas pu être activés (typique en SSH ou dans WSL sans systemd), lancez une fois `loginctl enable-linger $USER` depuis une session graphique, ou lancez `llm-memory ingest` à la main.

## Au quotidien

| Commande | Effet |
|---|---|
| `llm-memory status` | Ce qui est configuré sur cette machine et si tout est en ordre. |
| `llm-memory ingest` | Lancer l'ingest maintenant, sans attendre l'horaire. |
| `llm-memory lint` | Lancer le lint maintenant. |
| `llm-memory backfill` | Copier les transcriptions des sessions terminées avant l'installation. |
| `llm-memory link-memory` | Lier le dossier de mémoire de chaque projet Claude Code au coffre. |
| `llm-memory repair` | Réenregistrer hooks, skills et exécutions planifiées à partir de la configuration. |
| `llm-memory uninstall` | Retirer hooks, exécutions planifiées et liens des skills. Le coffre reste. |

Les réglages sont dans `memory.config.json` à la racine du coffre (langue, sauvegarde des transcriptions, horaires). Modifiez-le, puis lancez `llm-memory repair`. Les règles suivies par les agents sont dans `schema.md` dans le coffre : les modifier change leur comportement.

Les journaux d'exécution sont dans `<coffre>/.meta/runs/`. Les rapports de lint sont dans `<coffre>/.meta/lint-<date>.md`.

## Second ordinateur

Installez le paquet, connectez-vous au même compte GitHub et lancez `llm-memory init` (ou l'assistant) avec le même nom de dépôt. Le coffre est cloné au lieu d'être créé, et les deux machines le gardent synchronisé.

## Mise à jour

Windows : lancez le nouveau `setup.exe`. Ubuntu : `sudo apt install ./llm-memory_<nouvelle>_all.deb`. Les hooks et les exécutions planifiées pointent vers le programme installé, aucune autre étape n'est nécessaire. En cas de doute après une mise à jour : `llm-memory repair`.

## Désinstallation

Windows : « Applications > Applications installées > llm-memory > Désinstaller » (ou d'abord `llm-memory uninstall`, puis le désinstallateur). Ubuntu : `llm-memory uninstall`, puis `sudo apt remove llm-memory`. Le dossier du coffre, les transcriptions brutes et les dépôts GitHub ne sont jamais supprimés.

## Notes de sécurité

- **Les transcriptions brutes peuvent contenir des secrets en clair** (jetons, mots de passe, contenus de fichiers). Elles n'entrent jamais dans le dépôt wiki : l'ingest les caviarde. Si vous activez la sauvegarde des transcriptions, ce second dépôt les contient telles quelles : gardez-le privé, ne le partagez jamais, ne le connectez à aucune intégration. La protection des push de GitHub peut rejeter un push contenant un jeton connu ; le commit reste alors local.
- Le dépôt wiki est privé lui aussi. Traitez-le comme des notes personnelles.
- llm-memory ne stocke aucun jeton. L'accès à GitHub passe par GitHub CLI et l'assistant d'identification de Git.
- Les sessions lancées avec la variable d'environnement `CLAUDE_MEMORY_SKIP=1` ne sont pas capturées.

## macOS

Pas encore empaqueté. Voir [docs/macos.md](docs/macos.md) pour ce qui fonctionne déjà à la main.

## Développement

`app/` est du Node.js ordinaire (18 ou plus récent, sans dépendance). `node --test "app/test/*.test.cjs"` lance les tests. `windows/llm-memory.iss` construit l'installateur Windows avec Inno Setup 6 ; `linux/build-deb.sh` construit le paquet Debian. Un tag `v*` publie les deux via GitHub Actions.

Définissez `CLAUDE_CONFIG_DIR` vers un dossier de travail pour tester une installation sans toucher à vos vrais réglages Claude Code.
