# Setting up Ultimate Brain

The README's [Get started](../README.md#get-started) gives the steps. This page explains why each step is there, what every setting does, and what to do when something fails. You don't need it to get set up: "set up my brain" walks you through everything and checks each step. Read it when you want to know why, or when something goes wrong.

## The two templates

- **The Notion template** is a ready-made Notion space: every database, view, button and page, plus fifteen example rows, one or more in every database on Brain Data ([notion/template-examples.md](../notion/template-examples.md) lists them). You duplicate it into your own workspace. Its link and version are in [notion/TEMPLATE.md](../notion/TEMPLATE.md).
- **The brain folder** is the Git repository `brain init` creates. Your notes live here, as Markdown files.

The brain folder is where your knowledge is kept. Notion is where you read it, review what the brain proposes and capture new things. The brain publishes its notes to Notion, and reads back what you capture and review there.

## What you need, and why

| What | Why | Required |
|---|---|---|
| Node 22.6 or later | The `brain` CLI runs on it. | Yes |
| Git, with your name and email | Every change the brain makes is a commit. Without a name and email, Git saves nothing. | Yes. Setup sets the name and email if they're missing. |
| Claude Code or Codex | The agent does the work: it reads your material, writes notes and talks to Notion. | Yes |
| Notion AI | It writes your meeting minutes and runs Brain Assistant. | Yes, for early access. See [Without Notion AI](#without-notion-ai). |
| Custom Agents (Business and Enterprise plans) | Brain Assistant runs as a Custom Agent whose access you limit to your brain's pages. Without them, it runs from your personal Instructions. | No |
| The GitHub CLI (`gh`), signed in | Setup creates your backup with it, checks that the backup stays private, and sends your setup report if you say yes. | Yes, for early access. |
| MarkItDown | It turns PDFs, Word files, slides, spreadsheets and saved web pages into exact text, so quotes are exact. | No |

Setup checks all of these at once, at the start. It asks you about your Notion plan, since nothing can read it. Install `gh` and sign in to it before you say "set up my brain", as Get started's step 1 shows: without it, setup stops at step 1 (see [`gh` is missing or signed out](#gh-is-missing-or-signed-out-gh-missing-gh-signed-out)).

## The steps

"Set up my brain" runs these in order, because each step needs the one before it.

| # | Step | What you do | Why it is here |
|---|---|---|---|
| 1 | Prerequisites | Answer one question about your Notion plan. | Everything after needs them. |
| 2 | Settings | Read one screen, then say "keep these" or change a line. | Setup creates your backup, and later steps use your drop folder. |
| 3 | Notion template and connection | Duplicate the template, connect your agent to Notion, restart the agent. | The brain needs a space to write to. |
| 4 | Connect the brain to Notion | Say yes to moving the template's example rows to Notion's trash. | The brain stores each database's id and the template's version. The example rows go before anything reads your space, so none of them ever enters your brain. |
| 4a | The minutes prompt | Paste the prompt into your Notion AI settings, then run it on a short invented meeting. Delete the test page afterwards. | Your meeting minutes come out in the shape the brain reads. |
| 4b | Brain Assistant | Set it up, then run `/Today` once. | `/Today` must list only your brain's tasks. |
| 5 | Identities | Say which names you appear under in meetings and in Notion. | The brain knows which tasks and commitments are yours. |
| 6 | Seeding | Describe your work in a few sentences, answer one preview, then drop 3 to 5 key documents in your drop folder. | Your brain starts with your Areas, Projects, people and documents, so the first meeting doesn't create duplicates. Nothing is written before your yes. |
| 7 | First value | Judge four checks (below). | It proves the brain works on your own material. |
| 8 | Scheduled catch-up | Choose on or off. | It is offered only once first value passes. |
| — | Setup report | Read it, and send it if you like. | It helps fix setup for the next person. |

**Required steps stop setup** until they are done. Setup tells you what is missing and how to fix it. There is no skip list. An optional item is a setting you choose (on or off), so it never holds you up.

**You can stop any time.** Say "set up my brain" again later, and setup picks up at the first unfinished step. Ask "where am I in setup?", or run `brain status`: while setup is unfinished, its first line reads like `Setup: 6 of 9 done · next: connect Notion · say "set up my brain"`.

**First value** is four checks on a document you seeded and your main project. No meeting is needed.
- **Correct tasks:** the tasks taken from one document are exactly your own commitments, with the right project and due date.
- **A report:** "report on <your main project>" lands in Documents, linked from the project, and cites the document.
- **Organised:** each new note sits under the Area and Project you expect, and nobody appears twice.
- **A cited answer:** you accept one item from the document in Review, ask a question you would really ask, and the answer cites the passage it rests on.

You judge the parts only you can ("are these your commitments?"). Setup never invents a task, an item or an answer to pass a check.

**Your first meeting** is checked later. The first catch-up after you mark a meeting Reviewed adds one line saying what came in. Say "that's wrong: …" if something did.

## The settings

Step 2 shows one screen with every setting filled in. Change any of them later by asking your agent in your brain folder, for example "turn on markitdown", "change my drop folder" or "back up: remind me".

1. **Brain folder.** The folder `brain init` made. Everything the brain knows is here. `--set-default` records it, so `brain` finds it from anywhere.
2. **Git identity.** Your name and email, for all your repositories or for this one only. Every change the brain makes is a commit with this name, so you can see and undo it.
3. **Backup.** A private copy of your brain on GitHub, so nothing is lost and another machine can use it. The screen shows `Backup: a private GitHub repository, created for you`: setup creates it with `gh`, named after your brain folder, unless your brain already has one, which it keeps. It must be private, since your notes are about real people and real work: setup checks that it is, and stops if it isn't (see [Your backup is public](#your-backup-is-public-remote-public)).
4. **Drop folder.** Default `~/Documents/brain-dropbox/`, created for you. The next catch-up reads the files you drop here: documents, exports, notes.
5. **The language your notes are written in.** Default: the language you write to your agent in. The brain writes every note in this language, whatever the language of the source, so search and answers stay consistent.
6. **Modules.** Default: Knowledge, Orgs, Documents, Reports and Tasks on, Planning off, and Domains decided when you describe your work (on when you name two or more contexts, such as work and personal). These are the parts of your Notion space the brain uses. The template holds every part, so turning a module on later needs no work in Notion.
7. **Publish.** Default `ask`: the brain asks before it publishes to Notion. With `auto`, it publishes after each run.
8. **Back up after each run.** Default `on`: the brain backs up after each run, so your backup stays current. With `remind me`, it reminds you instead, and the last line of each report says how many changes aren't backed up yet. Change it by saying "back up: remind me".
9. **Opening recall in linked repos.** Default `off`. When you link a project's repository to the brain, agents working there can load what the brain remembers about that project when a session opens.
10. **MarkItDown.** Default `on` when it is installed, else `off`. On, PDFs, Word files and slides become exact text. Off, the agent reads files itself: in Claude Code, PDFs and images need nothing extra; in Codex, images are read with its image tool, and PDFs need MarkItDown. To install it:

    ```sh
    pipx install 'markitdown[all]'
    ```

    ```sh
    markitdown --version
    ```

11. **GitHub CLI (`gh`).** Shown `on`, since step 1 already checked that it is signed in. It creates your backup, checks that it stays private, and files your setup report for you. Early access needs it, so it can't be turned off.

12. **Scheduled catch-up.** Default `off`, and asked in step 8. Catch-up then runs on its own at the times you choose. It only takes in what you've marked ready. It is offered only after first value passes, so it never runs on a brain that hasn't proved it works.
13. **How the brain talks to you.** Default Standard. Simple uses plain words, short answers and the answer first. Custom lets you choose how much it explains, how long its answers are and what comes first. Change it any time: "talk to me more simply", "shorter answers", "go back to normal".

## When something goes wrong

Setup names what failed and how to fix it, then stops at that step. Fix it, then say "set up my brain" again: setup checks it and goes on from there. The code in brackets is what your setup report shows.

### `brain: command not found`

The CLI isn't installed, or your terminal can't find it. Install it, then open a new terminal:

```sh
npm install -g ultimate-brain
```

Still not found? npm's global folder isn't on your PATH. `npm config get prefix` shows where npm installs; its `bin` folder must be on your PATH. If `npm install -g` fails with a permission error (`EACCES`), install Node with a version manager such as [nvm](https://github.com/nvm-sh/nvm), then install again.

### `brain init` refuses the folder

- **The folder isn't empty** (`TARGET_NOT_EMPTY`): choose a new folder, such as `~/brain`.
- **It is already a brain** (`ALREADY_A_BRAIN`): you made it before. Open your agent there and say "set up my brain".

### `brain init` didn't commit (`GIT_COMMIT_SKIPPED`)

Git had no name and email yet. Nothing is lost: the files are there, and step 2 sets your identity and commits them.

### Node, Git or the agent is missing (`missing-prerequisite`)

Install what setup names: Node 22.6 or later from [nodejs.org](https://nodejs.org), Git from [git-scm.com](https://git-scm.com/downloads). Then say "set up my brain" again. Setup runs in Claude Code or Codex: open one of them in your brain folder.

### `gh` is missing or signed out (`gh-missing`, `gh-signed-out`)

Setup needs the GitHub CLI, signed in, to create your backup. It stops at step 1 with two steps:

1. Install it. On a Mac:

   ```sh
   brew install gh
   ```

   Not on a Mac: follow [cli.github.com](https://cli.github.com).
2. In your terminal, sign in:

   ```sh
   gh auth login
   ```

   When it asks, choose to let it set up Git's credentials.

Then say "set up my brain" again. With `gh` installed but signed out, only the second step is shown. Setup checks only your sign-in to github.com.

### Your Notion plan has no Notion AI (`notion-ai-missing`)

Early access needs Notion AI. Add it to your plan, then say "set up my brain" again. Not sure what your plan includes? It is in Notion's settings, or ask your workspace's admin. There is also a path without Notion AI, which becomes supported at 1.0: see [Without Notion AI](#without-notion-ai).

### The backup couldn't be created (`remote-failed`)

- **The name is taken, or there is no network:** setup says which and offers another name. It stays at step 2 until the backup is created.
- **Your brain already has a backup that `gh` can't read** (on another Git host, or one your GitHub account can't access): early access supports only a backup on GitHub. A backup on another Git host becomes possible at 1.0.

### Your backup is public (`remote-public`)

Your brain already had a backup, and it is a public repository. Setup stops at step 2 and offers to make it private. Say yes, and it does, then goes on.

### A push failed (`push-failed`)

Setup goes on: your work is saved in the brain folder. Say "fix my backup" (see [Your backup](#your-backup-and-fix-my-backup)).

### Your agent can't reach Notion (`notion-unreachable`)

Your agent has no Notion connection yet, or it wasn't restarted after you added one. Connect it in your own terminal, then restart the agent in your brain folder.

- **Claude Code:**

  ```sh
  claude mcp add --transport http notion https://mcp.notion.com/mcp
  ```

  Then, in Claude Code, run `/mcp`, choose notion and sign in.
- **Codex:** add these lines to `~/.codex/config.toml`:

  ```toml
  [mcp_servers.notion]
  url = "https://mcp.notion.com/mcp"
  ```

  Then sign in:

  ```sh
  codex mcp login notion
  ```

### Brain Data can't be found (`brain-data-not-found`)

- **The duplicate is still being made.** Wait until it opens in your workspace, then say "check again".
- **Your Notion account can't see it.** The connection reaches what the account you signed in with can reach. Sign in with the account that owns the duplicate.
- **You connected with an integration token** instead of signing in: open **Brain Data** in Notion, then `•••` → **Connections**, and add your integration.
- **Two Brain Data pages** (an older space next to the new one): setup asks which one to use, and leaves the other alone. Don't duplicate the template a second time on a resume: that makes a second Brain Data page.

### A database is missing (`database-missing`)

Setup names the databases it can't find. In a duplicate of the template, either the duplicate is incomplete or the connection can't see it. Check that Brain Data holds the databases with their names unchanged. A duplicate you haven't used yet can be deleted and the template duplicated again.

### The example rows are still there (`examples-left`)

The template's example rows must go before anything reads your space. Their titles start with `Example · `. Say "set up my brain" and answer yes, or delete them in Notion yourself. A row you renamed so its title no longer starts with `Example · ` counts as yours, and is left alone.

### The minutes check fails (`shape-wrong`)

The prompt was pasted only in part, or in the wrong place. Setup names what is missing ("no `Selection:` line under subject 2"). Paste the whole prompt again where setup says, then say "check the minutes prompt again". Delete the test page afterwards.

### `/Today` shows things from outside your brain (`assistant-reads-outside`)

Brain Assistant can see more than your brain.
- **A Custom Agent:** limit its Tools and access to Brain Data, How it works and Brain Assistant Skills.
- **Personal Instructions:** the instruction to stay inside Ultimate Brain is missing or was pasted in part. Paste the whole text again.

Then say "check Brain Assistant again".

### First value is unresolved (`first-value-unresolved`)

At least one of the four checks didn't pass. Setup shows one line for each, with the smallest fix:
- **Failed:** something was wrong, such as a task that is someone else's, a note under the wrong Area or a person listed twice. Fix it, or tell your agent what's wrong.
- **Couldn't be shown:** your material can't show it. For example, no document you seeded holds one of your own commitments, or you accepted nothing in Review. Drop a document that holds one of your commitments, or decide an item in Review.

Then say "set up my brain": only the checks that didn't pass run again. The scheduled catch-up waits until all of them pass.

### Something else

Ask "where am I in setup?" or run `brain status`. Say "show my setup report" to see every step and what failed. It holds no names or content, and goes to us only if you say yes.

## Your backup, and "fix my backup"

Your backup is the private copy of your brain on GitHub that setup creates. After a run, the brain backs up on its own (or reminds you, with "Back up after each run: remind me"). What you read calls it **the backup**. Git's own words (`origin`, push, branch) appear only when you ask for the details, such as "what happened exactly?".

When a backup fails, the last line of the report says so and why:

```text
Not backed up: <reason>. Say "fix my backup".
```

| The reason | What happened |
|---|---|
| `no backup is set up` | the brain has no backup yet |
| `the brain is not on its working branch` | the brain's work is on a side copy, not on the one that is backed up |
| `your backup has changes this copy doesn't have` | the backup was changed from another machine or on GitHub's website |
| `GitHub sign-in needed` | `gh` or Git needs you to sign in again |
| `GitHub can't be reached; check your connection` | no network, or GitHub didn't answer |
| `the push failed` | anything else |

With "Back up after each run: remind me", the last line is instead `<n> changes not backed up yet (Back up after each run: remind me).` A scheduled catch-up that finds the brain off its working branch runs nothing and writes, in the scheduler's log: `Not run: off-working-branch. The brain is not on its working branch; say "fix my backup" in a session in the brain.`

**Say "fix my backup"** to your agent in your brain folder. It also offers this itself when `brain status` warns that the brain is off its working branch, or after a failed backup. It checks these in order, fixes each on your yes, and stops at the first one only you can fix, with the one step you take:

1. **`gh` is signed in.** If not, you get the two steps above (install `gh`, then `gh auth login`). Then say "fix my backup" again.
2. **The backup is set up.** If not, it creates one, private, named after your brain folder. If the name is taken, it offers another.
3. **The backup is private.** If not, it makes it private. If it isn't a GitHub repository it can check, it asks you to make sure it is private, and goes on once you say it is.
4. **The brain is on its working branch.** If your work is on a side copy, it brings it back into your brain's main copy, after one yes that names what will happen, for example "Your work on add-notes, 2 changes, will be brought back into your brain's main copy, and add-notes removed." Changes not yet saved stop it first: it names the files and asks whether to keep them; it never discards them. If two changes touch the same lines, it changes nothing, names the files and asks which to keep.
5. **The backup.** It backs up. If your backup has changes this copy doesn't have, it says so and merges nothing: "Your backup has changes this copy doesn't have, from another machine or from GitHub's website. I haven't merged them: nothing was lost on either side."

It ends with one line: `Backup fixed: <n> changes backed up.` or `Backup checked: nothing to fix.` Nothing is done through a pull request or on GitHub's website.

## Without Notion AI

**For 1.0.** Early access needs Notion AI. At 1.0, setup also works without it. Before then, setup offers this path only when you choose it after hearing it isn't supported yet.

Without Notion AI:
- The minutes prompt and Brain Assistant are left out, so setup has 7 required items instead of 9.
- You lose structured minutes and the choice of what enters the brain from a meeting. You also lose `/Today` and the other Notion buttons that message Brain Assistant.
- **Meetings:** paste any transcript or summary onto the meeting page. The brain takes it in whole.
- **How-to questions** go to your agent instead.
- Rewriting a pasted transcript into the minutes format is not offered.

## Building the Notion space yourself

The template is the quick way. If you prefer to build the space yourself from Notion AI prompts, tell your agent at step 3. It gives you the text of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one step at a time, adapted to the modules you chose.

## Updating later

See the README's [Update](../README.md#update). `brain upgrade` also names any Notion changes a new release adds to your space, and your agent applies them when you ask.
