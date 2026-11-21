# Ultimate Brain

An AI-assisted second brain for solo knowledge workers. Knowledge lives in Markdown + Git, is maintained by coding agents (Claude Code, Codex), and is reviewed and navigated in Notion.

This repository is the **product**: CLI, agent skills, schema, templates and the Notion space design. Each user's brain lives in its own private repository.

> **Setting up a brain? You don't need to clone this repository.** Follow [Get started](#get-started): npm installs everything, skills included.

**Status:** a beta for friends and family. Anyone can follow Get started below. Read [This is a beta](#this-is-a-beta) first.

## This is a beta

Ultimate Brain works end to end, and you are among the first people to use it outside its author's own setup.

- **What may change.** Setup steps, wording and the Notion template change between versions. An update may ask you to run one more step.
- **Your notes are safe from the product.** They are Markdown files in a Git repository on your computer: every change is a commit you can undo, and nothing your brain knows changes without your approval. Keep the backup on.
- **Your data.** Read [PRIVACY.md](PRIVACY.md) before you add client material.
- **Expect issues and bugs** during the beta, with Claude Code, with Codex and with Gemini, which has only been tried in passing. When you find one, tell us.
- **Updating, going back and uninstalling:** [Update](#update), below.
- **Telling us what happened.** Open an issue on this repository with the **Beta feedback** template. Issues are public and appear under your GitHub name, so paste no notes, client names, Notion links or tokens. At the end of setup your agent offers to send a short report of counts and codes the same way, only if you say yes.

## Get started

Six steps take you from nothing to a working brain. Steps 1 to 4 take about ten minutes; step 5 takes about an hour, and you can stop and pick it up later.

Ultimate Brain uses two templates, and you meet both here: the **Notion template**, which you duplicate in step 2, and the **brain folder**, which `brain init` creates in step 4.

### 1. Install what you need

Every grey box on this page is a line to paste into a terminal, then press Return (on Windows: Enter). You also need a Notion account and a free GitHub account. Ultimate Brain itself is free: you pay for your agent's plan, and any Notion plan works, Free included.

You need: **Node 22.6 or later**, **Git**, **the GitHub CLI (`gh`)**, **Python with MarkItDown** (it turns PDFs, Word files and slides into exact text), **Claude Code or Codex**, and **Notion**, on any plan.

**What works on your Notion plan** (checked 2026-11-20 against Notion's [AI Meeting Notes](https://www.notion.com/help/ai-meeting-notes), [Notion AI](https://www.notion.com/help/notion-ai-faqs), [Custom Agents](https://www.notion.com/help/custom-agents) and [Notion credits](https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents) pages):

| Your Notion | Meetings | Notion Brain Assistant and its buttons |
|---|---|---|
| Business or Enterprise, with Notion credits | Notion AI meeting notes and the minutes prompt, or any other tool | Yes |
| Business or Enterprise, without credits | Notion AI meeting notes and the minutes prompt, or any other tool | No: ask Claude Code or Codex for the same skills |
| Free or Plus | Any other tool, pasting, or transcript files: your agent writes the minutes | No: ask Claude Code or Codex for the same skills |

Notion Brain Assistant is a Custom Agent, and Custom Agents run on Notion credits, which only Business and Enterprise can buy. Meetings from another notetaker or pasted: [docs/meetings-from-other-tools.md](docs/meetings-from-other-tools.md).

#### On a Mac

Open the Terminal app (press ⌘ Space and type "Terminal").

1. Install Apple's developer tools, which include Git. A window opens; the download takes several minutes:

   ```sh
   xcode-select --install
   ```

2. Install Homebrew, the Mac's installer for these tools, then run the lines it prints under "Next steps":

   ```sh
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. Install Node, the GitHub CLI, Python and MarkItDown, one line at a time:

   ```sh
   brew install node
   ```

   ```sh
   brew install gh
   ```

   ```sh
   brew install python
   ```

   ```sh
   brew install pipx
   ```

   ```sh
   pipx install 'markitdown[all]'
   ```

   ```sh
   pipx ensurepath
   ```

4. Open a new Terminal window, so it finds what you installed.

Node from Homebrew lets step 3 below install the CLI without an administrator password.

#### On Windows

Open PowerShell (press the Windows key and type "PowerShell").

1. Install Node, Git, the GitHub CLI and Python, one line at a time:

   ```powershell
   winget install --id OpenJS.NodeJS.LTS -e
   ```

   ```powershell
   winget install --id Git.Git -e
   ```

   ```powershell
   winget install --id GitHub.cli -e
   ```

   ```powershell
   winget install --id Python.Python.3.12 -e
   ```

   No `winget`? Update "App Installer" from the Microsoft Store.
2. **Close every terminal, and quit Claude Code or Codex if it's open** (closing its terminal panel is not enough). A program keeps the list of tools it had when it started, so it can't find tools installed after that. Then open PowerShell again.
3. Install MarkItDown:

   ```powershell
   py -m pip install --user pipx
   ```

   ```powershell
   py -m pipx install "markitdown[all]"
   ```

   ```powershell
   py -m pipx ensurepath
   ```

4. Close PowerShell and open it again.

#### Then, on either

Tell Git your name and email, which the brain saves every change with (use your own):

```sh
git config --global user.name "Your Name"
```

```sh
git config --global user.email "you@example.com"
```

Sign in to GitHub. Setup uses `gh` to create your backup: a private copy of your brain on GitHub.

```sh
gh auth login
```

When it asks, choose to let it set up Git's credentials. Check with `gh auth status`.

**Or let your agent do it.** Open Claude Code or Codex in any folder and paste:

```text
Help me set up Ultimate Brain by following https://github.com/superuser-pal/ultimate-brain#get-started. Install the published package with npm install -g ultimate-brain. Don't clone the ultimate-brain or ultimate-brain-skills repositories, don't build anything from source, and don't run their tests. Run the install steps for my computer one at a time and tell me before each one. Stop and tell me when a step needs me, like gh auth login or duplicating the Notion template.
```

### 2. Duplicate the Notion template

Open the Notion template and choose **Duplicate**, into the workspace you'll use for your brain:

**[The Ultimate Brain Notion template](https://sentina.notion.site/TEMPLATE-Ultimate-Brain-419495661e9980859df9ca0c3d836d27)**

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

Your agent walks you through the rest, one step at a time: your settings, connecting Notion, the meeting minutes prompt and Notion Brain Assistant when your plan has them, the names you appear under, a short description of your work, and a first check. Stop whenever you like. Say "set up my brain" again to pick up where you left off.

### 6. What you'll have at the end

- **Your brain:** Markdown notes in a private Git repository, backed up to a private remote.
- **Your Notion space,** connected: your Areas, Projects, the people you work with and a few key documents are already in it.
- **Meetings that feed your brain:** Notion AI, another tool or your agent writes the minutes, you set the meeting Ready, and the next catch-up turns it into your tasks and notes.
- **Notion Brain Assistant's skills:** in Notion, with its buttons, when you have Notion credits (ask it "Run Today"); otherwise ask your agent for the same skills ("what's due today").
- **A first check that passed:** tasks that are really yours, a report on your main project, notes in the right place, and an answer that cites its source.

Why each step is there, every setting, and what to do when something fails: [docs/setup.md](docs/setup.md).

Where your data goes, and what the review rules do and don't protect: [PRIVACY.md](PRIVACY.md). To report a security problem: [SECURITY.md](SECURITY.md).

**Something went wrong, or felt hard?** Tell your agent "show my setup report". It shows a short report with no names or content, and sends it to us only if you say yes.

## Update

```sh
npm install -g ultimate-brain@latest
brain --version   # check it's the version you expect before upgrading
cd ~/brain
brain upgrade
```

`brain upgrade` refreshes the brain's product-owned rules and skills, then commits and pushes. It never touches your notes. Your uncommitted work stays as it is and out of its commit; when a change of yours is in a file it must write, it stops before writing and lists each such file with what to do.

To undo an upgrade, or to remove Ultimate Brain from your computer: [Going back to an earlier version](docs/setup.md#going-back-to-an-earlier-version) and [Uninstalling](docs/setup.md#uninstalling).

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
