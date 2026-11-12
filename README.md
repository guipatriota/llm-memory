# llm-memory

Persistent, shared memory for your Claude Code sessions. A private Git-backed wiki vault, hosted in your own GitHub account, remembers what you and Claude did across projects and across machines.

Version française : [README.fr.md](README.fr.md)

## How it works

1. **Capture.** At the end of every Claude Code session a hook copies the transcript into `sources/` of your vault and backs it up (optional second private repository).
2. **Ingest.** A scheduled headless run (`claude -p` with the `ingest-memory` skill) turns new transcripts into wiki pages: one summary per session, durable pages per project and per entity, and a short index, `MEMORY.md`, that Claude Code auto-loads in every session. Secrets are redacted before anything is written.
3. **Lint.** A weekly run audits the store: contradictions, stale pages, orphans, index budget. It fixes only what is safe and reports the rest.

Two machines of the same user share the vault through GitHub. A single-writer lock on the remote keeps the scheduled runs from colliding, and merges are reconciled automatically by a third headless run.

The vault is plain Markdown. Obsidian opens it as a vault, but nothing depends on Obsidian.

## Install on Windows

1. Download `llm-memory-setup-<version>.exe` from the [Releases](https://github.com/guipatriota/llm-memory/releases) page.
2. Run it. The installer is not code-signed yet, so Windows SmartScreen may show "Windows protected your PC": click **More info**, then **Run anyway**.
3. The wizard walks you through:
   - **Prerequisites**: Git, Node.js, the GitHub CLI and Claude Code. A button installs the missing ones with winget. After installing Claude Code, open a terminal and run `claude` once to sign in.
   - **GitHub account**: a button opens a console with a one-time code and your browser. Sign in and confirm the code.
   - **Language of the memory** (English or French), **vault folder** (default `%USERPROFILE%\llm-memory`), **repository name** (default `llm-memory`), **schedule** (ingest daily at 10:20 and 14:20, lint on Thursday at 11:00).
   - **Transcript backup**: whether raw transcripts go to a second private repository named `<repository>-sources`. Read the warning on that page.
4. The installer then runs `llm-memory init` in a console: it creates the private repositories, the hooks, the skills, the memory links, the scheduled tasks, and copies transcripts of earlier sessions. Press a key when it says so.
5. Open a **new** terminal: the `llm-memory` command is now available.

The installer runs per user and never asks for administrator rights.

## Install on Ubuntu (24.04 or later)

```bash
sudo apt install ./llm-memory_<version>_all.deb   # pulls git, nodejs and gh
curl -fsSL https://claude.ai/install.sh | bash     # Claude Code, if not installed yet
claude                                              # sign in once, then exit
gh auth login --web                                 # GitHub sign-in in the browser
llm-memory init --language fr                       # or en; answers the rest interactively
```

Ubuntu 22.04 ships Node.js 12, which is too old: install Node.js 18 or newer from NodeSource first, then the package.

Scheduled runs use systemd user timers. If `llm-memory init` reports that the timers could not be enabled (typical over SSH or in WSL without systemd), run `loginctl enable-linger $USER` once from a graphical session, or run `llm-memory ingest` by hand.

## Everyday use

| Command | What it does |
|---|---|
| `llm-memory status` | What is configured on this machine and whether it is healthy. |
| `llm-memory ingest` | Run the ingest now instead of waiting for the schedule. |
| `llm-memory lint` | Run the lint now. |
| `llm-memory backfill` | Copy transcripts of sessions that ended before the install. |
| `llm-memory link-memory` | Link the memory folder of every Claude Code project to the vault. |
| `llm-memory repair` | Re-register hooks, skills and scheduled runs from the configuration. |
| `llm-memory uninstall` | Remove hooks, scheduled runs and skill links. The vault stays. |

Settings live in `memory.config.json` at the root of the vault (language, transcript backup, schedule). Edit it, then run `llm-memory repair`. The rules the agents follow live in `schema.md` in the vault: editing it changes their behaviour.

Run logs are in `<vault>/.meta/runs/`. Lint reports are in `<vault>/.meta/lint-<date>.md`.

## Second computer

Install the package, sign in to the same GitHub account and run `llm-memory init` (or the wizard) with the same repository name. The vault is cloned instead of created, and both machines keep it in sync.

## Updating

Windows: run the new `setup.exe`. Ubuntu: `sudo apt install ./llm-memory_<new>_all.deb`. The hooks and scheduled runs point to the installed program, so an update needs no further step. If something looks off after an update, `llm-memory repair`.

## Uninstalling

Windows: "Apps > Installed apps > llm-memory > Uninstall" (or `llm-memory uninstall` first, then the uninstaller). Ubuntu: `llm-memory uninstall` then `sudo apt remove llm-memory`. The vault folder, the raw transcripts and the GitHub repositories are never deleted.

## Security notes

- **Raw transcripts may contain secrets in plain text** (tokens, passwords, file contents). They never enter the wiki repository: the ingest redacts them. If you enable the transcript backup, that second repository holds them as is: keep it private, never share it, never connect it to any integration. GitHub's push protection may reject a push that contains a known token; the commit then stays local.
- The wiki repository is private too. Treat it like any private notes.
- No token is stored by llm-memory. GitHub access goes through the GitHub CLI and Git's credential helper.
- Sessions started with the environment variable `CLAUDE_MEMORY_SKIP=1` are not captured.

## macOS

Not packaged yet. See [docs/macos.md](docs/macos.md) for what already works by hand.

## Developing

`app/` is plain Node.js (18 or newer, no dependencies). `node --test "app/test/*.test.cjs"` runs the tests. `windows/llm-memory.iss` builds the Windows installer with Inno Setup 6; `linux/build-deb.sh` builds the Debian package. A tag `v*` publishes both through GitHub Actions.

Set `CLAUDE_CONFIG_DIR` to a scratch folder to test an install without touching your real Claude Code settings.
