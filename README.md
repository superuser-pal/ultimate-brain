# Ultimate Brain

An AI-assisted second brain for solo knowledge workers. Knowledge lives in Markdown + Git, is maintained by coding agents (Claude Code, Codex), and is reviewed and navigated in Notion.

This repository is the **product**: CLI, agent skills, schema, templates and the Notion space design. Each user's brain lives in its own private repository.

**Status:** v1, in use by its author. Expect changes.

## Install

Needs Node 22.6 or later.

```sh
npm install -g ultimate-brain
brain init ~/brain --set-default   # a new brain repository
brain --help
```

The agent skills come with it: `brain init` copies them into the brain, in `.agents/skills/` for Codex and `.claude/skills/` for Claude Code, so both agents run the same version (decision 0038).

**To ingest Word, PowerPoint, Excel and saved HTML files** (optional), install [MarkItDown](https://github.com/microsoft/markitdown), the converter the ingest uses for them (decision 0032); it is also the first choice for web pages given by URL (decision 0036). In Claude Code, PDFs and images need nothing extra. In Codex, MarkItDown also converts PDFs, and images are read with Codex's image tool.

```sh
pipx install 'markitdown[all]'
markitdown --version
```

## Update

```sh
npm install -g ultimate-brain@latest
cd ~/brain && brain upgrade
```

`brain upgrade` refreshes the brain's product-owned rules and skills, then commits and pushes. It never touches your notes, and it refuses to run on a brain with uncommitted changes.

To try a release candidate: `npm install -g ultimate-brain@next`. To go back: `npm install -g ultimate-brain@latest`.

## Start here

| Document | What it is |
|---|---|
| [docs/vision.md](docs/vision.md) | Product intent, v1 scope and success criterion |
| [synthesis/synthesis.md](synthesis/synthesis.md) | The v1 design: schema, meeting-ingest workflow, Notion bridge |
| [docs/notion-space-design.md](docs/notion-space-design.md) | Notion databases, views, and the Notion AI prompts to build them |
| [decisions/](decisions/) | Every accepted architecture decision |
| [build/TASKS.md](build/TASKS.md) | Build plan split between Claude Code and Codex |
| [reviews/](reviews/) | Research: reviews of five open-source second-brain repos |

Agent rules live in [AGENTS.md](AGENTS.md); `CLAUDE.md` imports it.
