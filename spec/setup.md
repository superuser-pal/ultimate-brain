# Guided setup (contract, decision 0078)

**Status:** contract for release 0.14.0 (CC-188). Built by CC-190 (the CLI side), CC-191 (the `brain-setup` skill and the skill changes it needs, in one fork release: brain-setup, brain-connect-notion, Ultimate Assistant's seeding, brain-ingest's use of `track`, brain-catch-up's first-meeting line, brain-notion-change's template version), CC-192 (the `repository` field of `package.json`) and CC-189 (the Notion template); measured by CC-193. Written by Claude Code.

How this file fits: it holds the whole first-time setup of a new user: what the `brain-setup` skill does and in what order, what it checks and how, what it stores and where, what seeding writes, how first value is checked, and the setup report. Command behaviour is in [cli.md](cli.md) (§5.1 `init`'s next step, §5.2 `status`'s `setup` block, §5.3 `notion.template_version`, §5.15 `upgrade`'s Notion migrations), and file formats are in [schema.md](schema.md) (§4 area `track`, §12 the new-brain modules and the new `brain.json` keys). What a read, an answer or a proposal may rest on is [eligibility.md](eligibility.md), and nothing here changes it.

**Decisions:** [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md) (binding: §1 to §6); [0079](../decisions/0079-lean-minutes-and-follow-ups-as-tasks.md) (the minutes format the minutes check uses, and the follow-ups that become Tasks); 0015 (Notion through the MCP), 0037 (identities), 0048 (modules), 0061 (minimal per-area tracking preferences), 0064 and 0072 (Ultimate Assistant guides seeding), 0059 (project adoption), 0070 (lifecycle of structure notes), 0031 (owner rulings).

**The user's choices of 2026-11-10, filling gaps 0078 leaves** (asked through the coordinator during CC-188; each was the recommended option):
1. **Per-area tracking preferences** are an optional `track` list in the area note's frontmatter, in Git only, with no Notion property in 0.14.0; seeding proposes it, the ingest uses it, and Ultimate Assistant's thresholds stay fixed (§11).
2. **What setup records:** each step that only an online or by-hand check can prove is recorded as a `setup` log line (`brain log`), which `brain status` reads offline; the optional items are `brain.json` settings, `settings.markitdown`, `settings.gh` and `settings.schedule`, each `on` or `off`, absent meaning `off` (§4, §5).
3. **The drop folder and the notes' language** stay lines of the user's part of the brain's `AGENTS.md`: `Drop folder: <path>` and `Language: <name>`; `brain status` reads the first (§4).
4. **The template version** is the number of the last Notion migration the template includes (`0024`); `brain upgrade` names the migrations with a higher number (§9).

**Calls taken in this contract** (confirmed by the coordinator on 2026-11-10): a module key absent from a present `modules` block keeps its old default, so only the template's block turns Documents, Reports and Tasks on and existing brains are unchanged (schema §12); `status`'s human setup line shows only while setup is unfinished (cli.md §5.2); 0079 (merged in #289) is followed where it touches setup (§6.3, §10.1).

---

## 1. What setup is

A new user duplicates the published Notion template (0078 §1, CC-189), installs the CLI, runs `brain init` and, in the new brain folder, tells their agent (Claude Code or Codex) **"set up my brain"**. That phrase starts the `brain-setup` skill, which walks the user through §2's steps once, in order, and can be stopped at any point: asked again, it **resumes at the first unfinished step** (§3).

- **No new command and no interactive CLI.** `brain init` stays non-interactive; the skill asks, the CLI writes (cli.md §1). `brain status` is the offline half of the checks (§5); the skill adds the online ones.
- **Nothing is written in the user's Notion workspace or brain without a yes**, except what the CLI records about setup itself (the `setup` log lines and the settings the user confirmed on the settings screen).
- **Setup never sends the user to a path under `npm root -g`.** The skill reads the product's files at `product.path` (cli.md §5.2) and gives the user a link or the text itself: the template link from `notion/TEMPLATE.md`, the steps of a Notion guide, the minutes prompt to paste.
- **The guide is Ultimate Assistant's voice** (0064): short messages, one question at a time except on the settings screen and the seeding preview, each ending with what the user does next.

## 2. The steps, in order (0078 §2)

| # | Step | `setup` log step (§4.1) | Done when |
|---|---|---|---|
| 1 | **Prerequisites**, all checked at once (§6.1) | `prerequisites` | every required prerequisite passes |
| 2 | **The settings screen** (§7), then its items applied: the Git identity, the private remote, the drop folder created, the `AGENTS.md` lines | `settings` | the user confirmed the screen and each required item of it passes |
| 3 | **The template duplicated, and the agent connected to Notion** (§6.2) | `notion-mcp` | the MCP reaches the duplicated space's Brain Data page |
| 4 | **"Connect the brain to Notion"** (brain-connect-notion): modules on or off, database ids, the Tasks database, the template version | `connect` | every database of Core and of the modules on is stored, and `notion.template_version` is set |
| 4a | **The minutes prompt**, walked through and checked (§6.3) | `minutes-prompt` | the check passes |
| 4b | **Brain Assistant**, walked through and checked (§6.4) | `brain-assistant` | the check passes |
| 5 | **Identities** (0037; brain-connect-notion step 6) | `identities` | `owner.person` is set |
| 6 | **Seeding** (§8) | `seeding` | the preview was answered and its writes published, or the user said there is nothing to seed |
| 7 | **The first-value check** (§10) | `first-value` | the three checks were run (passed or not, §10) |
| 8 | **The scheduled catch-up**, offered only after step 7 (§7, item 12) | `schedule` | the user chose on (and `brain schedule install` succeeded) or off |
| — | **The setup report**, offered (§12) | `finished` | always the last line |

- **Required items stop setup** until done (0078 §2): setup says what is missing and how to fix it, and stops there; asked again later, it resumes at that step. There is **no skip list**: a required item can't be skipped, and an optional one is a setting whose value is recorded (§7), so it never counts as unfinished.
- **The order is fixed** because each step needs the one before: the settings screen chooses the remote and the drop folder that later steps use; Notion is connected before seeding (0078 §3); first value needs seeded material; the schedule is offered only once first value works (0078 §2).

## 3. Resume (0078 §2)

On "set up my brain", the skill runs `brain status --json` and reads its `setup` block (cli.md §5.2), then:

1. **Re-checks online** what the block can't see and is cheap to re-check: the Notion MCP reaches Brain Data (step 3), and, when `gh` is `on`, the remote is private (`gh repo view --json isPrivate`). A recorded step whose online check now fails is unfinished again.
2. **Never re-runs a by-hand check that is recorded as done** (the minutes prompt, Brain Assistant): the `setup` line is the proof (choice 2). The user can ask for it again ("check the minutes prompt again").
3. **Starts at the first step of §2 that is unfinished**, saying in one line what is already done: "Setup: 6 of 9 done. Next: paste the minutes prompt." A step before it that fails a check (a Git identity removed since) is fixed first.
4. When every step is done, says so and offers only what is left: the setup report if it was never offered, the schedule if it was never answered.

A brain made before 0.14.0 that has every offline check passing and no `setup` line is treated as set up (`status` shows no setup line, cli.md §5.2); "set up my brain" on it runs §3 normally and records the steps it checks, so the user can use it to check an older brain.

## 4. What setup stores, and where

| What | Where | Written by |
|---|---|---|
| Steps passed (by-hand and online checks, seeding, first value, the schedule's answer, the end) | `setup` log lines (§4.1), `log/<YYYY-MM>.md` | the skill, with `brain log setup` (cli.md §5.11) |
| The drop folder | the line `Drop folder: <path>` under "My rules" in the brain's `AGENTS.md` (as brain-ingest reads it today) | the skill, after the settings screen's yes |
| The language notes are written in | the line `Language: <name>` under "My rules" in the brain's `AGENTS.md` | the skill, after the settings screen's yes |
| Publish, push, recall | `brain.json` `settings.publish`, `settings.push`, `settings.recall` (schema §12) | `brain config set` |
| MarkItDown, `gh`, the schedule (optional, choice 2) | `brain.json` `settings.markitdown`, `settings.gh`, `settings.schedule`: `on` or `off`; absent means `off` (schema §12) | `brain config set` |
| Modules | `brain.json` `modules` (schema §12) | `brain modules on|off` |
| The template version | `brain.json` `notion.template_version` (schema §12) | brain-connect-notion, with `brain config set` |
| Database ids, the Tasks mapping, `owner.person` | `brain.json` `notion`, `owner` (schema §12) | brain-connect-notion |
| Git identity | Git's own configuration (global, or the brain repository's when the user prefers) | `git config`, after the screen's yes |
| The remote | the brain repository's `origin` | `gh repo create --private` or the user (§7) |
| The Notion connection | the agent's own MCP configuration | the user, following the skill's steps |

The `AGENTS.md` lines are written only below `<!-- ultimate-brain:rules:end -->` (upgrades never touch that part), each on its own line, replacing an earlier line of the same name; they are committed on their own (`rules: drop folder and language`).

### 4.1 The `setup` log line

```text
- <timestamp> setup - step=<step> result=<done|failed|declined>[ <key>=<value>]…
```

- `<step>` is one of §2's: `started`, `prerequisites`, `settings`, `notion-mcp`, `connect`, `minutes-prompt`, `brain-assistant`, `identities`, `seeding`, `first-value`, `schedule`, `finished`. `started` is written once, when the skill first runs in a brain with no `setup` line.
- `result=failed` adds `reason=<code>` from §12.2; `declined` is used only by `schedule` (the user chose off). A step can be logged several times; the latest line of a step is its state.
- Extra keys: `prerequisites` adds `notion_ai=yes|no custom_agents=yes|no` (the plan, as the user answered); `first-value` adds `tasks=pass|fail report=pass|fail organised=pass|fail`; `seeding` adds `notes=<n> documents=<n>`.
- Values carry no names, paths, ids or text (§12.1).

## 5. The offline checks (`brain status`, cli.md §5.2)

`brain status` computes these without a network call. Each is a fact about the brain or the machine it can read:

| Check | Passes when | Counts toward the 9 required |
|---|---|---|
| `git_identity` | `git config user.name` and `git config user.email`, read in the brain folder, are both non-empty | yes |
| `remote` | the brain is a Git repository with a remote `origin` that has a URL (`git remote get-url origin`). Whether it is private is checked online (§3) | yes |
| `databases` | every `notion.databases` key of Core and of each module on is non-empty, and, with Tasks on, `notion.tasks.database` too | yes |
| `drop_folder` | `AGENTS.md` has a `Drop folder:` line under "My rules" (§4) and its path (`~` expanded, backticks removed) is an existing folder | yes |
| `language` | `AGENTS.md` has a `Language:` line under "My rules" | yes |
| `owner_person` | `owner.person` is set and names an existing person note | yes |
| `template_version` | reported as its value, or `null` (unknown) | no |

The other three of the nine required items (0078 §2) are the recorded steps `notion-mcp`, `minutes-prompt` and `brain-assistant` (§4.1, latest line `result=done`). So the count is: the six counted checks that pass, plus those three recorded as done, out of **9**.

**Finished** when the latest `setup` line with `step=finished` exists; or, for a brain with no `setup` line at all, when the six counted checks pass (a brain set up before 0.14.0, §3). **Next** is the first item not done in §2's order (a check that fails, or a step not recorded as done), as cli.md §5.2 lists them.

## 6. The checks the skill makes

### 6.1 Prerequisites (step 1, all at once)

| Prerequisite | How it is checked | Required |
|---|---|---|
| Node 22.6 or later | `node --version` | yes |
| Git, with an identity | `git --version`; `git config user.name` and `user.email` (set on the settings screen when missing) | yes (the identity can be set in step 2) |
| Claude Code or Codex | the agent running the skill; its name goes in the setup report | yes |
| The Notion MCP connection | a Notion tool is available in the session (reached in step 3) | yes (connected in step 3) |
| `gh` | `gh --version` and `gh auth status` | no: the settings screen's `gh` item (§7) |
| MarkItDown | `markitdown --version` | no: the settings screen's `markitdown` item (§7) |
| The Notion plan | **asked**, since the API can't read it: "Does your Notion plan include Notion AI? And Custom Agents?" | Notion AI: yes for early access (§13) |

All are shown in one list (`✓ Node 22.11`, `✗ Git identity: set on the next screen`, `? Notion AI: asked below`). A missing required prerequisite that the next steps don't set (Node, Git, the agent, Notion AI) stops setup with its fix: a link or one command, never a path under `npm root -g`.

### 6.2 The template and the Notion connection (step 3)

- **The template:** the skill gives the link from `<product.path>/notion/TEMPLATE.md` (its only home, 0078 §1) and asks the user to duplicate it into their workspace. It never builds the space from the prompts in setup; a user who prefers to build is pointed to the checklist's text, given by the skill (0078 §1).
- **The connection:** the skill gives the steps for the agent in use (brain-connect-notion's "Connect your agent to Notion") and waits. Checked by searching for the page **Brain Data** through the MCP, as brain-connect-notion step 1 does: found once → `notion-mcp` done; not found or found twice → the same messages as that step.

### 6.3 The minutes prompt (step 4a; 0078 §2, 0079)

Walked through: the skill gives the prompt's text (from `<product.path>/notion/`, the file CC-197 names) and where it goes (the user's Notion AI settings for Meetings, as `notion/pasting-the-minutes-prompt.md` says). Checked:

1. The skill gives a short synthetic meeting text (two subjects, one commitment of the owner, one decision; written by the skill from a fixed sample in the setup skill, never from the user's material) and asks the user to paste it into a new Meetings page and run the prompt.
2. It reads the page through the MCP and checks the shape that `spec/capture-and-review.md` defines for the current format (0079 §2): the readable part with **In one line**, **Quick follow-ups** each with a `q` id, **Tasks for the brain** with item ids, one block per subject with its `s` id; and the collapsed **For the brain** toggle with each subject's `Selection:` line and the id → quote list, every quote found in the pasted text. Until 0079's contract (CC-195) is merged, the shape is the one `notion/minutes-format.md` defines (subjects, `Selection:` lines, item ids).
3. Pass → `minutes-prompt` done. Fail → the skill names what is missing ("no `Selection:` line under subject 2"), says the likely cause (the prompt pasted only in part, or in the wrong place) and offers to check again.
4. The test page is never marked Reviewed, so no catch-up reads it; the skill asks the user to delete it after the check.

**If the minutes prompt can live inside the Meetings template** (checked once by CC-193 on the test duplicate, 0078 §2), the template carries it and step 4a becomes the check alone.

### 6.4 Brain Assistant (step 4b; 0078 §2)

Walked through: the skill gives the steps of `<product.path>/notion/brain-assistant.md`: a **Custom Agent** on a plan that has them, else the same text as **personal Instructions** (the `custom_agents` answer of §6.1). Checked:

1. With the user's yes, the skill creates one Task in the brain's Tasks database through the MCP: `Setup check: delete me`, Due today. With Tasks off, no task is created: step 2 then passes when `/Today` lists nothing from outside the brain's databases.
2. The user runs `/Today` in Notion and pastes or describes the answer. It passes when it lists that task and nothing that isn't in the brain's Tasks database (no page from elsewhere in the workspace).
3. The skill then sets the test task's Status to the mapped closed-without-doing status (`notion.tasks.wont_do_status`), with the same yes, and records `brain-assistant` done; a fail names what came back that shouldn't have, and the likely cause (the agent's access isn't limited to Brain Data).

## 7. The settings screen (step 2; 0078 §2)

One screen, every item with its default filled in and a one-line explanation. The user answers once ("keep these", or changes: "drop folder ~/Inbox/brain", "push: remind"); the skill shows the screen again with the changes, and applies it on a yes. It also shows **where the brain lives**: the folder, and the remote once there is one.

| # | Item | Default filled in | One-line explanation shown | Required | Stored (§4) |
|---|---|---|---|---|---|
| 1 | Brain folder | the folder `brain init` made | "Your brain: Markdown notes in a Git repository. Everything the brain knows is here." | shown | the folder; `~/.config/ultimate-brain/config.json` when `init --set-default` was used |
| 2 | Git identity | the current `user.name` and `user.email`, else the owner name and an empty email the user must fill | "Every change the brain makes is a commit with this name; without it nothing is saved." | required | Git configuration |
| 3 | Private remote | with `gh` signed in: a new private repository named after the brain folder, created with `gh repo create --private`; else the steps to create one on the user's Git host | "A private copy of your brain, so nothing is lost and another machine can use it." | required | `origin` |
| 4 | Drop folder | `~/Documents/brain-dropbox/` (created) | "Files you drop here are read by the next catch-up: documents, exports, notes." | required (created) | `Drop folder:` line |
| 5 | Language notes are written in | the language the user writes to the skill in | "The brain writes its notes in this language, whatever the language of the source." | required | `Language:` line |
| 6 | Modules | Knowledge, Orgs, Documents, Reports, Tasks on; Planning off; Domains decided by seeding (§8) | "Which parts of your Notion space the brain uses; you can change this any time." | shown | `modules` |
| 7 | Publish | `ask` | "Ask before the brain publishes to Notion, or publish after each run." | shown | `settings.publish` |
| 8 | Push | `auto` | "Push your brain to its remote after each run, or remind you." | shown | `settings.push` |
| 9 | Opening recall in linked repos | `off` | "Agents in your linked repos load what the brain remembers about them when a session opens." | shown | `settings.recall` |
| 10 | MarkItDown | `on` when `markitdown` is found, else `off` | "Turns PDFs, Word files and slides into exact text, so quotes are exact; off, the agent reads files itself." | optional | `settings.markitdown` |
| 11 | `gh` | `on` when `gh auth status` passes, else `off` | "Lets setup create the private remote and file your setup report for you." | optional | `settings.gh` |
| 12 | Scheduled catch-up | `off`; asked in step 8, after first value | "Catch-up runs on its own at set times; it only takes in what you've marked ready." | optional | `settings.schedule` |

- Items 1 to 9 are on the screen in step 2; item 12 is shown there as "asked after your first check" and answered in step 8, where `on` runs brain-catch-up's "Run on a schedule" (its times, days, model and allow list, cli.md §5.21) and then writes `settings.schedule`.
- The rest of the required items of 0078 §2 are steps, not values: the Notion MCP connection (step 3), the connection to the brain's databases (step 4), identities (step 5), the minutes prompt and Brain Assistant (steps 4a, 4b). The screen lists them under "Still to do after this screen", one line each, so the user sees the whole setup once.
- **Optional means a value, not a skip** (0078 §2): `off` is recorded and never asked again; the user changes it by asking ("turn on markitdown").
- Applying the screen: set the Git identity (with the user's yes on the scope, global or this repository), create the remote (`gh repo create <name> --private --source <brain folder> --push` with `gh` on; else wait until `origin` exists), create the drop folder, write the two `AGENTS.md` lines (§4), `brain config set` each setting, `brain modules on|off` each module change, commit, push. Then `brain log setup - step=settings result=done`.

## 8. Seeding (step 6; 0078 §3)

### 8.1 Describe, then one preview

1. The skill asks the user to describe their work in a few sentences: what they do, for whom, with whom, and any other life context they want in the brain. Optionally, a folder or a repo to adopt (§8.4).
2. Through Ultimate Assistant's "tell it what's on your mind" flow ([assistant.md](assistant.md) §7, extended to Domains, Areas and People by CC-191), it proposes **one preview**, a numbered list in that flow's form:
   - **Domains,** only when the description has **two or more contexts** (work and personal, two businesses): name and type. With one context, none, and the Domains module stays off; with two or more, the preview says the Domains module will be turned on.
   - **Areas:** name, its Domain (when there are Domains), and its **What to track** list (§11).
   - **Projects:** name, Area, Status, a one-line purpose, the client org if any.
   - **Orgs** that a project's client or a person's org names.
   - **People: the 5 to 10** the user works with most, each with org and role, so the first meeting matches them instead of creating duplicates. Fewer than 5 named → the preview asks for more once; more than 10 → the 10 the user names first, and the rest offered as a later step.
   - **Key documents: 3 to 5,** which the user drops into the drop folder (§8.3).
3. The user answers as in assistant.md §7: "yes to all", "yes 1–7, 9", "4: Status On Hold", "drop 8". The preview is shown again after each change. **Nothing is written before the yes.**
4. Before showing an item, the skill matches it against the brain (titles and aliases, as assistant.md §7 "No second copy"); an existing note is shown as `already in the brain` and not created again. So seeding run again (resume) never duplicates.

### 8.2 The writes, after the yes

- **The description is a source.** The user's description and the preview's answers, verbatim, are kept as one owner-ruling source note (0031, as brain-connect-notion's identities step does): `title` `Setup: my work (owner ruling)`, `source_key` `agent:<agent>/<date>-setup-seeding`. Every seeded note lists it in `sources`, and each role is a `facts.role` with a timeline entry citing it (schema §5).
- **Order:** Orgs, Domains (and `brain modules on domains` when there are any), Areas, Projects, People, so each relation names an existing id. Each with `brain note new`; `lifecycle: reviewed` (0070 for Domains, Areas, Projects and Orgs; the preview's yes is the review for People, as assistant.md §7's yes is).
- Then `brain index`, `brain views`, `brain lint`, one commit (`setup: seed my work`), and **one publish** of every seeded note (`brain sync render --ids …`, the MCP, `brain sync record`, commit): the preview's yes covers this publish, whatever `settings.publish` says.
- `brain log setup - step=seeding result=done notes=<n> documents=<n>`.

### 8.3 Key documents

The user drops 3 to 5 key documents into the drop folder, and the skill runs the ingest on the drop folder with **Keep as document** for each (the ingest's existing drop-folder flow): each becomes a Document (`reference` note), placed under its Area and Project from the preview. **What the brain reads from them** (decisions, questions, people, tasks) **goes through Review as usual**, one row per file (0078 §3): the user's first Review is on their own material. The skill says so and waits for nothing: deciding those rows is part of step 7.

### 8.4 A folder or a repo

A folder or repo the user points to is adopted through 0.9.0's project adoption (brain-workflow-adopt; connected-workflows.md), with its own preview and yes. Its project joins the seeding preview's Projects as `adopted: <name>`.

## 9. The template version (0078 §1, choice 4)

- **Format:** the four-digit number of the last migration in `notion/migrations/` that the template includes, as a string: `"0024"`. The template's System page shows it as `Template version: 0024` (CC-189), and `notion/TEMPLATE.md` records it.
- **Stored** by brain-connect-notion at step 4: it reads the System page's line through the MCP and runs `brain config set notion.template_version '"0024"'`. A space without the line (built from the prompts, or before 0.14.0) leaves the key absent: the version is **unknown**, never guessed.
- **Kept current** (brain-notion-change, CC-191): when a migration is applied to the space, the skill sets `notion.template_version` to that migration's number if it is higher, and the migration's last step updates the System page's line.
- **Named by `brain upgrade`** (cli.md §5.15): the migrations of the installed package with a higher number; with the version unknown, upgrade says so and names none.

## 10. First value (step 7; 0078 §5)

Every user's setup ends with the three checks of 0078 §5, **on a seeded document and a report on the user's main project, with no meeting needed**. The skill runs each, shows its evidence, and asks the user to judge the parts only they can ("are these your commitments?"):

| Check | What is done | Passes when |
|---|---|---|
| **Correct tasks** | the tasks the ingest created from one seeded document (§8.3; Tasks on), shown with their Project and Due | the tasks created are exactly the owner's own commitments in that document, with the right Project and due date, and none of someone else's; the user confirms |
| **A report** | the user asks "report on <main project>" (brain-query report mode) | the report lands in Documents, linked from the project, citing the seeded document |
| **The information organised** | the skill lists each note the seeding and the document's Review wrote, under its Area and Project | each note sits under the Area and Project the user expects, and no person appears twice; the user confirms |

- Each check passes or fails on its own; a failure names what was wrong and is not retried in setup (it goes in the report, §12). Step 7 is done when the three were run: `brain log setup - step=first-value result=done tasks=pass report=pass organised=fail`.
- With Tasks off (the user turned it off on the screen), the first check is `tasks=skip` and the report says so.
- **The release gate** (CC-193) runs the same three checks on a synthetic persona with one meeting, in a clean duplicate of the template; it is CC-193's contract, not the skill's.

### 10.1 The first meeting (0078 §5, 0079)

The first meeting is checked later. **The first catch-up that ingests a Reviewed meeting after step 7** (brain-catch-up, CC-191) adds one line to its report, and logs `setup - step=first-meeting result=done`, so it is said once:

```text
First meeting in: 3 tasks for you (1 from a quick follow-up), 4 notes, 2 people matched, 0 new people. Anything wrong? Say "that's wrong: …".
```

- Counted from that meeting's ingest: the owner's Tasks created, of which the quick follow-ups that became Tasks (0079 §4); notes written; attendees matched to existing people and new person notes.
- "First" is read from the log: a `setup` line with `step=first-value` and none with `step=first-meeting`. A brain with no `setup` line never shows it.

## 11. Minimal per-area tracking preferences (0061, choice 1)

- **What:** an optional `track` list on an area note (schema §4): 1 to 8 short lowercase phrases naming the kinds of thing worth extracting in that Area (`[budget, deadlines, scope changes, risks]`). Absent means the generic list, as today.
- **Set** in the seeding preview (each Area shows `What to track: …`, proposed from the description, changed like any preview value), and later by asking the agent ("in Clients, also track renewals"), which writes it as a proposal applied in chat (assistant.md §6.2's yes).
- **Used** by the ingest when it chooses what to extract from an input placed in that Area: items matching a tracked kind are favoured within the budget, and the generic kinds still apply. It changes no schema type, no gate (a tracked kind still passes the decision gate to become a decision) and no Review rule.
- **Not in 0.14.0:** a Notion property for it, per-Domain or per-Project lists, and any effect on Ultimate Assistant: its thresholds stay fixed (0072 §3, assistant.md §3.2).

## 12. The setup report (0078 §6)

At the end (and when the user asks "show my setup report"), the skill writes the report and shows it **whole**, then asks: "Send this to the product as a `beta-setup` issue, to help fix setup? Nothing else is sent." It files **only after a yes**: with `settings.gh` `on`, `gh issue create --repo <product repository> --label beta-setup --title "Setup report: <CLI version>, <agent>" --body <report>`; with `gh` off, it gives the text and the repository's new-issue link for the user to paste. The product repository is the one named by the `repository` field of `<product.path>/package.json` (added by CC-192). No telemetry: nothing is sent any other way.

### 12.1 Fields (no names, no content)

```text
Ultimate Brain setup report
CLI 0.14.0 · skills ultimate-brain-skills 1.4.0 · agent Claude Code · platform darwin
Notion AI: yes · Custom Agents: yes · modules: knowledge, orgs, documents, reports, tasks
Time: 52 min (first setup line to the last)
1 prerequisites: done
2 settings: done (markitdown off, gh on)
3 notion-mcp: failed once (notion-unreachable), then done
4 connect: done (template 0024)
4a minutes-prompt: failed once (shape-wrong), then done
4b brain-assistant: done (custom agent)
5 identities: done
6 seeding: done (14 notes, 4 documents)
7 first value: tasks pass · report pass · organised fail
8 schedule: off
```

- From the `setup` log lines (§4.1), `brain status` and the agent's own name; counts and codes only.
- **Never:** a person, org, project, area or document name, a path, a Notion id or URL, an email, the user's words, an error message as printed (only its code, §12.2). The skill checks the text against the brain's titles and aliases before showing it, and drops any line that matches one.

### 12.2 Reason codes

`missing-prerequisite`, `notion-ai-missing`, `notion-unreachable`, `brain-data-not-found`, `database-missing`, `shape-wrong` (minutes), `assistant-reads-outside` (Brain Assistant), `remote-failed`, `push-failed`, `user-stopped`, and a CLI error code (cli.md §3.5) when a command failed.

## 13. Without Notion AI (0078 §6)

**Early access (0.14.0) requires Notion AI**, and the prerequisites check says so when the user answers no. The path below is built in the skill (CC-191) and documented in `docs/setup.md` as 1.0's, when Notion AI becomes optional. Before 1.0 it is taken only when the user chooses it after being told it is not yet supported for early access:

- The minutes prompt (4a) and Brain Assistant (4b) are dropped from the required items; the count becomes 7, and the settings screen says what is lost: no structured minutes and no selection of what enters, no `/Today` or other Notion buttons that message Brain Assistant.
- **Meetings** come from any transcript or summary pasted onto a meeting page, and are ingested whole (no selection, capture-and-review §4's legacy summary).
- **How-to questions** go to the agent (brain-howto).
- Rewriting a pasted transcript into the minutes format is not offered (after 1.0).
- `prerequisites` is logged with `notion_ai=no`, and `status` counts 7 required items when the latest `prerequisites` line says so.

## 14. Out of scope (0078)

An interactive `brain init`; a new diagnostic command (status's `setup` block and the skill's checks are the diagnostics); telemetry; a synthetic sample meeting in the template (§6.3's sample text lives in the skill and is deleted after the check); rich profiles and specialised types (0030); the template gallery and the acquisition funnel (1.0); how the template link reaches testers, the npm channel and the number of testers (1.0's opening grill); any operation on the user's brain or Notion workspace without an explicit yes.
