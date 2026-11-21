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
| Git, with your name and email | Every change the brain makes is a commit. Without a name and email, Git saves nothing. | Yes. Set them before `brain init` (Get started, step 1); `init` stops and tells you how when they're missing. |
| Claude Code or Codex | The agent does the work: it reads your material, writes notes and talks to Notion. | Yes |
| Notion AI | It writes your meeting minutes and runs Notion Brain Assistant. | Yes, for early access. See [Without Notion AI](#without-notion-ai). |
| Business or Enterprise, with Notion credits | Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits. Notion Brain Assistant runs as a Custom Agent whose access you limit to your brain's pages, and Custom Agents use Notion credits each time they run; Notion sells credits only on Business and Enterprise ([Notion's help on credits](https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents)). Without credits, Notion Brain Assistant's skills run from your personal Instructions, asked by name, and its buttons don't work. | No |
| The GitHub CLI (`gh`), signed in | Setup creates your backup with it, checks that the backup stays private, and sends your setup report if you say yes. | Yes, for early access. |
| Python and MarkItDown | MarkItDown turns PDFs, Word files, slides, spreadsheets and saved web pages into exact text, so quotes are exact. It runs on Python. | Yes, for early access. |

Setup checks all of these at once, at the start. It asks you about your Notion plan, since nothing can read it. Install everything and sign in to `gh` before you say "set up my brain", with the commands for your computer in Get started's step 1 (Mac or Windows): without them, setup stops at step 1 and gives the same commands.

On a Mac and on Windows alike, the weekly review and a daily catch-up can run on their own, with Claude Code or Codex (see the settings, item 12).

## The steps

"Set up my brain" runs these in order, because each step needs the one before it.

| # | Step | What you do | Why it is here |
|---|---|---|---|
| 1 | Prerequisites | Answer one question about your Notion plan. | Everything after needs them. |
| 2 | Settings | Read one screen, then say "keep these" or change a line. | Setup creates your backup, and later steps use your drop folder. |
| 3 | Notion template and connection | Duplicate the template, connect your agent to Notion, restart the agent. | The brain needs a space to write to. |
| 4 | Connect the brain to Notion | Say yes to moving the template's example rows to Notion's trash. | The brain stores each database's id and the template's version. The example rows go before anything reads your space, so none of them ever enters your brain. |
| 4a | The minutes prompt | Paste a short invented meeting into a new Meetings page. Open the Notion AI chat on that page, paste the prompt followed by the line "Write the minutes on this page, below the transcript, and nothing else.", and send. Delete the test page afterwards. | Your meeting minutes come out in the shape the brain reads, and the transcript stays on the page. |
| 4b | Notion Brain Assistant | Create your own: duplicating the template doesn't give you one. Follow **First things first**, the page linked from Start here: give it the Brain Data, How it works and Skills under your space's top page, paste its Instructions and replace the mentions, check the mentions in its skills, and select it in **Send message to** of the Tidy capture, Write up and Refresh report buttons. Then ask it **Run Today** once (by name: a Custom Agent doesn't run `/` commands), and click each button on the sample page setup creates for it. | Today must list only the tasks of your space's Tasks database, and each button must reach your own agent. Setup reads the sample pages; what only Notion's interface shows (the agent's access, a button's Send message to) you check and tell it. |
| 5 | Identities | Say which names you appear under in meetings and in Notion. | The brain knows which tasks and commitments are yours. |
| 6 | Seeding | Describe your work in a few sentences, answer one preview, then drop 3 to 5 key documents in your drop folder. | Your brain starts with your Areas, Projects, people and documents, so the first meeting doesn't create duplicates. Nothing is written before your yes. |
| 7 | First value | Judge four checks (below). | It proves the brain works on your own material. |

**Only the brain creates a meeting's Tasks.** It creates them once, when it takes in a meeting you set Ready. If a notetaker (Granola, Fireflies or another) or an automation exports tasks into Notion, turn off its export to your brain's Tasks database, or each of those tasks would arrive twice. Don't ask Notion AI to create Tasks from a meeting either. A task you create yourself stays yours.
| 8 | The schedule | Keep, change or decline two times: the weekly review (Monday 08:00) and a catch-up (every day at 07:30). | It is offered only once first value passes. |
| — | Setup report | Read it, and send it if you like. | It helps fix setup for the next person. |

**Required steps stop setup** until they are done. Setup tells you what is missing and how to fix it. There is no skip list. An optional item is a setting you choose (on or off), so it never holds you up.

**You can stop any time.** Say "set up my brain" again later, and setup picks up at the first unfinished step. Ask "where am I in setup?", or run `brain status`: while setup is unfinished, its first line reads like `Setup: 6 of 9 done · next: connect Notion · say "set up my brain"`.

**First value** is four checks on a document you seeded and your main project. No meeting is needed.
- **Correct tasks:** the tasks taken from one document are exactly your own commitments, with the right project and due date.
- **A report:** "report on <your main project>" lands in Documents, linked from the project, and cites the document.
- **Organised:** each new note sits under the Area and Project you expect, and nobody appears twice.
- **A cited answer:** you say yes to one item the brain read from the document, in your agent session, ask a question you would really ask, and the answer cites the passage it rests on.

You judge the parts only you can ("are these your commitments?"). Setup never invents a task, an item or an answer to pass a check.

**Your first meeting** is checked later. The first catch-up after you set a meeting Ready adds one line saying what came in. Say "that's wrong: …" if something did.

## The settings

Step 2 shows one screen with every setting filled in. Change any of them later by asking your agent in your brain folder, for example "turn on markitdown", "change my drop folder" or "back up: remind me".

1. **Brain folder.** The folder `brain init` made. Everything the brain knows is here. `--set-default` records it, so `brain` finds it from anywhere.
2. **Git identity.** Your name and email, for all your repositories or for this one only. Every change the brain makes is a commit with this name, so you can see and undo it.
3. **Backup.** A private copy of your brain on GitHub, so nothing is lost and another machine can use it. The screen shows `Backup: a private GitHub repository, created for you`: setup creates it with `gh`, named after your brain folder, unless your brain already has one, which it keeps. It must be private, since your notes are about real people and real work: setup checks that it is, and stops if it isn't (see [Your backup is public](#your-backup-is-public-remote-public)).
4. **Drop folder.** Default `~/Documents/brain-dropbox/`, created for you. The next catch-up reads the files you drop here: documents, exports, notes. Each brain has its own: when another brain on this computer already reads `~/Documents/brain-dropbox/`, setup proposes a folder named after the new brain, such as `~/Documents/client-brain-dropbox/`, and says why.
5. **The language your notes are written in.** Default: the language you write to your agent in. The brain writes every note in this language, whatever the language of the source, so search and answers stay consistent.
6. **Modules.** Default: Knowledge, Orgs, Documents, Reports and Tasks on, Planning off, and Domains decided when you describe your work (on when you name two or more contexts, such as work and personal). These are the parts of your Notion space the brain uses. The template holds every part, so turning a module on later needs no work in Notion.
7. **Publish.** Default `ask`: the brain asks before it publishes to Notion. With `auto`, it publishes after each run.
8. **Back up after each run.** Default `on`: the brain backs up after each run, so your backup stays current. With `remind me`, it reminds you instead, and the last line of each report says how many changes aren't backed up yet. Change it by saying "back up: remind me".
9. **Opening recall in linked repos.** Default `off`. When you link a project's repository to the brain, agents working there can load what the brain remembers about that project when a session opens.
10. **MarkItDown.** Shown `on`, since step 1 already checked that it is installed. PDFs, Word files and slides become exact text, so the brain quotes them exactly. Early access needs it, so it can't be turned off. Check it with:

    ```sh
    markitdown --version
    ```

11. **GitHub CLI (`gh`).** Shown `on`, since step 1 already checked that it is signed in. It creates your backup, checks that it stays private, and files your setup report for you. Early access needs it, so it can't be turned off.

12. **The schedule.** Asked in step 8, on a Mac and on Windows alike: "Run the weekly review on its own every Monday at 08:00, and a catch-up every day at 07:30? Keep them, change a time or a day, or say no to either." Say a change as you would to a person ("the weekly review on Fridays at 17:00"). It is offered only after first value passes, so nothing runs on its own in a brain that hasn't proved it works.
    - **What runs.** Your computer's own scheduler starts your agent in your brain folder at those times: launchd on a Mac, Task Scheduler on Windows. With Claude Code it runs `claude -p`, with Codex `codex exec`, each with the model setup pins (with Claude Code a Sonnet model, with Codex the one you use; you can name another). The catch-up only takes in what you've marked ready. The weekly review writes the week's Inbox row and does only the mechanical clean-up on its own, each with an undo; you tick the rest in that row and set it Ready, and the next catch-up applies your ticks ([the weekly row](../notion/views-guide.md#the-weekly-row)).
    - **What your computer needs.** Setup says it in one line for yours:

      | At the time it's due | On a Mac | On Windows |
      |---|---|---|
      | Asleep | Runs when the Mac wakes; several missed times run once ([launchd.plist](https://keith.github.io/xcode-man-pages/launchd.plist.5.html)). | The computer is woken, and it runs ([WakeToRun](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-waketorun)). |
      | Off | Skipped: it runs at the next time ([Apple's Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)). | Set to start as soon as it can once the computer is on again and you're logged in, about 10 minutes later ([StartWhenAvailable](https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-startwhenavailable); Microsoft's page doesn't say for certain that this covers a daily or weekly time). |
      | You're logged out | Doesn't run ([Apple's Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)). | Doesn't run: it runs only while you're logged in ([TASK_LOGON_TYPE](https://learn.microsoft.com/en-us/windows/win32/api/taskschd/ne-taskschd-task_logon_type)). |

      Nothing is lost by a missed run: the next catch-up takes in everything that waits. On a Mac, a weekly review missed because the Mac was off waits for next Monday, or say "weekly review" in your agent when you want it.
    - **With Claude Code,** open Claude Code in your brain folder once and accept its trust dialog before the first run: a scheduled run never shows that dialog, and without it the run can't use the tools your brain allows ([Claude Code's permissions](https://code.claude.com/docs/en/permissions)). **With Codex** there is no such step: the scheduled command itself lets it edit your brain folder and reach the network ([Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)).
    - **One computer at a time.** The schedule is kept in your brain (`brain.json`), so on another computer `brain schedule install`, in the brain folder, sets the same times there. Then, on the old computer, run `brain schedule remove --here` so it doesn't run there too. On Linux, setup gives you the cron lines to add with `crontab -e`.
    - **Change it later** by saying "schedule my brain", or say what you want ("the weekly review on Fridays at 17:00", "stop the daily catch-up"). `brain schedule list` shows what is set on this computer. A Windows brain set up before 0.17.0 never had the question: your agent offers it once after the upgrade.
13. **How the brain talks to you.** Default Standard. Simple uses plain words, short answers and the answer first. Custom lets you choose how much it explains, how long its answers are and what comes first. Change it any time: "talk to me more simply", "shorter answers", "go back to normal".

## When something goes wrong

Setup names what failed and how to fix it, then stops at that step. Fix it, then say "set up my brain" again: setup checks it and goes on from there. The code in brackets is what your setup report shows.

### `brain: command not found`

The CLI isn't installed, or your terminal can't find it. Install it, then open a new terminal:

```sh
npm install -g ultimate-brain
```

Still not found? npm's global folder isn't on your PATH. `npm config get prefix` shows where npm installs; on a Mac its `bin` folder must be on your PATH. If `npm install -g` fails with a permission error (`EACCES`) on a Mac, Node came from the nodejs.org installer: install it with `brew install node` instead, then install again.

### A command isn't found on Windows (`brain`, `gh`, `node`, `markitdown`)

PowerShell says `The term 'gh' is not recognized` (or `brain`, `node`, `markitdown`):

1. **Close every terminal, and quit Claude Code or Codex** (closing its terminal panel is not enough), then open them again. A program keeps the list of tools it had when it started, so it can't find tools installed after that. This is the usual cause.
2. **Check that it is installed:** `winget list --id GitHub.cli` (or `OpenJS.NodeJS.LTS`, `Git.Git`, `Python.Python.3.12`). For `brain`, run `npm config get prefix`: npm puts `brain` in that folder, which must be on your PATH. For `markitdown`, run `py -m pipx ensurepath`, then reopen as in 1.
3. **`brain` is found but won't run** (`running scripts is disabled on this system`): PowerShell's script policy blocks npm's launcher. Allow scripts for your account, then open a new PowerShell:

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

### `brain init` refuses the folder

- **The folder isn't empty** (`TARGET_NOT_EMPTY`): choose a new folder, such as `~/brain`.
- **It is already a brain** (`ALREADY_A_BRAIN`): you made it before. Open your agent there and say "set up my brain".

### `brain init` stops: Git doesn't know your name and email (`GIT_IDENTITY_MISSING`)

The brain saves every change with your name and email, so `brain init` stops before it writes anything. Run these with your own name and email, then run the same `brain init` command again:

```sh
git config --global user.name "Your Name"
```

```sh
git config --global user.email "you@example.com"
```

### `brain init` didn't commit (`GIT_COMMIT_SKIPPED`)

Git isn't installed, or the commit failed for another reason. Nothing is lost: the files are there. Install Git (Get started, step 1), then say "set up my brain": step 2 commits them.

### Node, Git or the agent is missing (`missing-prerequisite`)

Install what setup names, with the commands for your computer from Get started's step 1: on a Mac, `brew install node` and `xcode-select --install` (Git); on Windows, `winget install --id OpenJS.NodeJS.LTS -e` and `winget install --id Git.Git -e`. Then reopen your terminal and your agent, and say "set up my brain" again. Setup runs in Claude Code or Codex: open one of them in your brain folder.

### MarkItDown is missing (`markitdown-missing`)

Setup needs MarkItDown to turn your documents into exact text. It stops at step 1 with the commands for your computer, leaving out what you already have:

- **Mac:** `brew install python`, `brew install pipx`, then `pipx install 'markitdown[all]'` and `pipx ensurepath`. Open a new Terminal window.
- **Windows:** `winget install --id Python.Python.3.12 -e`, then `py -m pip install --user pipx`, `py -m pipx install "markitdown[all]"` and `py -m pipx ensurepath`. Close every terminal, quit your agent and open it again.

Then say "set up my brain" again. Check it with `markitdown --version`.

### `gh` is missing or signed out (`gh-missing`, `gh-signed-out`)

Setup needs the GitHub CLI, signed in, to create your backup. It stops at step 1 with two steps:

1. Install it. On a Mac:

   ```sh
   brew install gh
   ```

   On Windows:

   ```powershell
   winget install --id GitHub.cli -e
   ```

   Then close every terminal, quit your agent and open it again. On another system: follow [cli.github.com](https://cli.github.com).
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

The prompt was pasted only in part, or run outside the page's Notion AI chat. Setup names what is missing ("no `Selection:` line under subject 2"). Run the whole prompt again in the chat on the page, with the line "Write the minutes on this page, below the transcript, and nothing else.", then say "check the minutes prompt again". Delete the test page afterwards.

### The transcript is gone from the page (`transcript-missing`)

Notion AI wrote the minutes but replaced the transcript. The brain needs both, because the minutes quote the transcript. Put the transcript back on the page above the minutes: restore an earlier version from Notion's version history (••• at the top right), or paste it again. Keep the minutes. Then say "check the minutes prompt again". Next time, run the prompt in the Notion AI chat on the page, with the line "Write the minutes on this page, below the transcript, and nothing else."

The same thing can happen to a real meeting. Catch-up then leaves it Ready and says so under Needs you, with this fix. Once the transcript is back, run catch-up again.

### Today shows things from outside your brain (`assistant-reads-outside`)

Setup's check says which Tasks database Today should read: the one under your space's top page › Brain Data. If Today lists a task or meeting from another space, one of two things happened:
- **The run used another space's Today.** Picking "Today" from the `@` picker can pick another space's skill page, which reads that space. Ask Notion Brain Assistant **Run Today** by name, or mention your Today page by its link (open it from your space's Skills database, ••• → Copy link).
- **Notion Brain Assistant can see more than your brain.** A Custom Agent: in Tools and access, keep only the Brain Data, How it works and Skills (in an older space, Brain Assistant Skills) under your top page, and remove any other. Personal Instructions: the instruction to stay inside Ultimate Brain is missing or was pasted in part. Paste the whole text again.

Then say "check Notion Brain Assistant again".

### You have no Notion Brain Assistant yet (`assistant-missing`)

Duplicating the template copied its pages, not an agent. Create your own, as **First things first** says (the page linked from Start here): Agents → New Custom Agent, named Notion Brain Assistant, with no triggers, then its access and Instructions. Then say "check Notion Brain Assistant again". Already have one that answers in its chat? Keep it: setup checks it rather than asking for a second one.

### A skill mentions a page outside your space (`mentions-outside`)

Setup read your Skills pages and found a mention of Brain Data or How it works that opens a page elsewhere, such as the template author's, or one it can't open. It names the skill page and the mention. Replace the mention with one of the page of that name under your top page, then say "check Notion Brain Assistant again".

### A button didn't reach your agent (`button-unbound`)

Setup clicked nothing itself: you clicked the button on a sample page, and setup read the page back and found it unchanged. Open the database as a full page → ••• → Properties → the button, and in **Send message to** select your own Notion Brain Assistant. Keep the message as it is: its skill name, its "I confirm" and its **@This page**. Selecting the agent says who receives the message, and @This page says which page it is about. Then say "check Notion Brain Assistant again". Setup can't read a button's settings: what you see there is your check, and setup says so.

### A sample page is still there (`samples-left`)

Each button check uses a page titled `Setup check: … (delete me)`, and setup moves it to Notion's trash after reading it. When it couldn't, the step stays unfinished until the page is gone. Delete it yourself, then say "check Notion Brain Assistant again". Nothing in your brain is made from a sample.

### First value is unresolved (`first-value-unresolved`)

At least one of the four checks didn't pass. Setup shows one line for each, with the smallest fix:
- **Failed:** something was wrong, such as a task that is someone else's, a note under the wrong Area or a person listed twice. Fix it, or tell your agent what's wrong.
- **Couldn't be shown:** your material can't show it. For example, no document you seeded holds one of your own commitments, or you said yes to no item from your documents. Drop a document that holds one of your commitments, or say yes to an item when your agent asks.

Then say "set up my brain": only the checks that didn't pass run again. The schedule waits until all of them pass.

### The schedule didn't install (`schedule-not-loaded`)

Your computer's scheduler refused the entry: launchd on a Mac, Task Scheduler on Windows. Setup shows its message. Your times are kept in your brain all the same, and `brain status` shows the job as not installed on this computer. Fix what the message names, then say "schedule my brain", or run `brain schedule install` in your brain folder: it installs every time your brain holds. When it says your agent can't be found (`AGENT_NOT_FOUND`), the scheduler looks for `claude` or `codex` where your terminal finds it: open a new terminal, check that `claude --version` or `codex --version` works there, and try again.

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
- The minutes prompt and Notion Brain Assistant are left out, so setup has 7 required items instead of 9.
- You lose structured minutes and the choice of what enters the brain from a meeting. You also lose Notion Brain Assistant's skills, such as Today, and the Notion buttons that message it.
- **Meetings:** paste any transcript or summary onto the meeting page. The brain takes it in whole.
- **How-to questions** go to your agent instead.
- Rewriting a pasted transcript into the minutes format is not offered.

## Building the Notion space yourself

The template is the quick way. If you prefer to build the space yourself from Notion AI prompts, tell your agent at step 3. It gives you the text of [notion/CHECKLIST.md](../notion/CHECKLIST.md), one step at a time, adapted to the modules you chose.

## Updating later

See the README's [Update](../README.md#update). `brain upgrade` also names any Notion changes a new release adds to your space, and your agent applies them when you ask.

## Going back to an earlier version

An upgrade refreshes the rules and skills in your brain, in one commit named `upgrade: ultimate brain <version>, …`. It doesn't change what your notes say; when a release changes how notes are stored, the same commit moves them. To go back, undo that commit and install the version you had, in either order:

```sh
cd ~/brain
git log --oneline --grep "^upgrade: ultimate brain"   # the newest line is the upgrade to undo
git revert <its id>
npm install -g ultimate-brain@<the version you had>
```

`brain upgrade --json` names the version you had as `previous_cli`. Installing the older version alone isn't enough: on a brain whose skills are newer, `brain lint` reports `skills-incompatible` and `brain upgrade` refuses, and both name the version the skills need.

An upgrade also refreshes the rules and skills in each repository linked to your brain, without committing there. The revert doesn't reach them: in each linked repository, discard those changes with Git, or run `brain link` again once the older version is installed.

## Uninstalling

Your notes are plain Markdown in a Git repository. Keep the brain folder and you keep everything; you need nothing else to read them.

Setup put things in these places outside your brain folder. Remove the ones you used, the schedule first, so that no run starts while you remove the rest:

| What | Where | How to remove it |
|---|---|---|
| The scheduled runs | On a Mac, `~/Library/LaunchAgents/eu.ultimate-brain.*.plist`. On Windows, Task Scheduler tasks named `eu.ultimate-brain.*`, with copies in `%LOCALAPPDATA%\ultimate-brain\tasks`. On Linux, lines you added to your crontab. | On a Mac or Windows, in your brain folder: `brain schedule remove --here` (every run of this brain on this computer). On Linux, delete the lines with `crontab -e`. |
| The `brain` command | npm's global folder | `npm uninstall -g ultimate-brain` |
| The default brain setting | `~/.config/ultimate-brain/` | Delete the folder. |
| Run state and logs | `~/.ultimate-brain/`; on a Mac, `~/Library/Logs/ultimate-brain/`; on Windows, `%LOCALAPPDATA%\ultimate-brain\` | Delete the folders. |
| The drop folder | The folder you chose in setup, by default `~/Documents/brain-dropbox/` | Move out any file you still want, then delete it. |
| The backup | A private repository on GitHub | Delete it on github.com (the repository's Settings, Danger Zone), or keep it as an archive. |
| The Notion space | Your workspace | Delete the duplicated space. In Notion's Settings, under Connections, remove your agent's connection. Delete Notion Brain Assistant, or its text in your personal Instructions. |
| Linked repositories | Each repository you linked with `brain link` | Unlinking only removes the brain's record of the repository. In the repository itself, delete `.brain`, `brain-kit.json`, the Ultimate Brain block in `AGENTS.md` and `CLAUDE.md`, and the brain's skills under `.agents/skills/` and `.claude/skills/`. |

Setup may also have set your Git name and email for every repository on this computer, when they were missing. Leave them unless you want them gone: `git config --global --unset user.name` and `git config --global --unset user.email`.

Then delete the brain folder itself, or keep it.
