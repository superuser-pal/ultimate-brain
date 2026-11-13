# Ultimate Brain

An AI-assisted second brain for solo knowledge workers. Knowledge lives in Markdown + Git, is maintained by coding agents (Claude Code, Codex), and is reviewed and navigated in Notion.

This repository is the **product**: CLI, agent skills, schema, templates and the Notion space design. Each user's brain lives in its own private repository.

**Status:** early access for friends and family. Anyone can follow Get started below. Expect changes, and tell us what was hard.

## Get started

Six steps take you from nothing to a working brain. Steps 1 to 4 take about ten minutes; step 5 takes about an hour, and you can stop and pick it up later.

Ultimate Brain uses two templates, and you meet both here: the **Notion template**, which you duplicate in step 2, and the **brain folder**, which `brain init` creates in step 4.

### 1. Check what you need

- **Node 22.6 or later.** Check with `node --version`. Install it from [nodejs.org](https://nodejs.org).
- **Git.** Check with `git --version`. Install it from [git-scm.com](https://git-scm.com/downloads).
- **Claude Code or Codex**, the agent that runs your brain.
- **A Notion plan with Notion AI.** Notion AI writes your meeting minutes and runs Brain Assistant. Custom Agents (Business and Enterprise plans) are a plus, not a must.
- **The GitHub CLI (`gh`), signed in.** Setup uses it to create your backup: a private copy of your brain on GitHub. Install it with `brew install gh` (not on a Mac: follow [cli.github.com](https://cli.github.com)), then sign in:

  ```sh
  gh auth login
  ```

  When it asks, choose to let it set up Git's credentials. Check with `gh auth status`.

### 2. Duplicate the Notion template

Open the Notion template and choose **Duplicate**, into the workspace you'll use for your brain:

**[The Ultimate Brain Notion template](https://sentina.notion.site/TEMPLATE-Ultimate-Brain-416495661e99806ea2dcca48eb4e55ff)**

Leave the copy as it is. Its example rows go away when setup connects it.

### 3. Install the CLI

```sh
npm install -g ultimate-brain
```

```sh
brain --version
```

### 4. Create your brain folder

```sh
brain init ~/brain --set-default
```

This makes `~/brain`: a Git repository of Markdown notes, where everything your brain knows lives. Choose another folder if you like. `--set-default` lets `brain` find it from anywhere.

### 5. Say "set up my brain"

Open your agent in the brain folder:

```sh
cd ~/brain
```

```sh
claude
```

(or `codex`). Then type:

```text
set up my brain
```

Your agent walks you through the rest, one step at a time: your settings, connecting Notion, the meeting minutes prompt, Brain Assistant, the names you appear under, a short description of your work, and a first check. Stop whenever you like. Say "set up my brain" again to pick up where you left off.

### 6. What you'll have at the end

- **Your brain:** Markdown notes in a private Git repository, backed up to a private remote.
- **Your Notion space,** connected: your Areas, Projects, the people you work with and a few key documents are already in it.
- **Meetings that feed your brain:** Notion AI writes the minutes, you mark the meeting Reviewed, and the next catch-up turns it into your tasks and notes.
- **Brain Assistant** in Notion, for `/Today` and the other buttons.
- **A first check that passed:** tasks that are really yours, a report on your main project, notes in the right place, and an answer that cites its source.

Why each step is there, every setting, and what to do when something fails: [docs/setup.md](docs/setup.md).

**Something went wrong, or felt hard?** Tell your agent "show my setup report". It shows a short report with no names or content, and sends it to us only if you say yes.

## Update

```sh
npm install -g ultimate-brain@latest
brain --version   # check it's the version you expect before upgrading
cd ~/brain
brain upgrade
```

`brain upgrade` refreshes the brain's product-owned rules and skills, then commits and pushes. It never touches your notes, and it refuses to run on a brain with uncommitted changes.

To try a release candidate: `npm install -g ultimate-brain@next`. To go back: `npm install -g ultimate-brain@latest`.

## How it's built

| Document | What it is |
|---|---|
| [docs/vision.md](docs/vision.md) | Product intent, v1 scope and success criterion |
| [synthesis/synthesis.md](synthesis/synthesis.md) | The v1 design: schema, meeting-ingest workflow, Notion bridge |
| [docs/notion-space-design.md](docs/notion-space-design.md) | Notion databases, views, and the Notion AI prompts to build them |
| [decisions/](decisions/) | Every accepted architecture decision |
| [build/TASKS.md](build/TASKS.md) | Build plan: Claude Code builds, a reviewer sub-agent reviews (decisions 0044, 0063) |
| [reviews/](reviews/) | Research: reviews of five open-source second-brain repos |

Agent rules live in [AGENTS.md](AGENTS.md); `CLAUDE.md` imports it.
