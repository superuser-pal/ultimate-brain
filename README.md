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

The agent skills come with it: `brain init` copies them into the brain for Codex, and Claude Code gets them as the `ultimate-brain` plugin.

## Update

```sh
npm install -g ultimate-brain@latest
cd ~/brain && brain upgrade && git commit -am "upgrade: ultimate brain"
```

`brain upgrade` refreshes the brain's product-owned rules and skills. It never touches your notes.

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
