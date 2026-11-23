# Guided setup (contract, decision 0078)

**Status:** contract for release 0.14.0 (CC-188). Built by CC-190 (the CLI side), CC-191 (the `brain-setup` skill and the skill changes it needs, in one fork release: brain-setup, brain-connect-notion, Ultimate Assistant's seeding, brain-ingest's use of `track`, brain-catch-up's first-meeting line, brain-notion-change's template version), CC-192 (the `repository` field of `package.json`) and CC-189 (the Notion template); measured by CC-193. The response style (0081: §4's row, §7 item 13, §7.1) is CC-209's contract, built by CC-210 (the CLI) and CC-211 (the setup item and the chat change). First value (§2, §3, §4.1, §5, §10, §12) was corrected by CC-213: an attempt is not a pass. The template's Example rows (0084: §2 step 4, §3, §4.1, §6.5, §12, §14) are CC-227's, built in the skills fork (brain-setup, brain-ingest, brain-catch-up, brain-sync); 0087's rows in every database and the wider guard (§6.5) are CC-234's (brain-apply, brain-catch-up, ultimate-assistant). The backup and `gh` required for early access (0086: §2, §3, §4, §6.1, §7, §12.2, §15) are CC-235's contract, built by CC-236 (the CLI's working branch, cli.md §5.2, and the brain's rules block), CC-237 (the skills) and CC-238 (the guides). Written by Claude Code. Amended for 0.15.2 by CC-290 (decision [0097](../decisions/0097-easy-setup-on-windows-and-mac-and-markitdown-required.md)): MarkItDown required, install commands for macOS and Windows (§6.1), the schedule on Windows (§7, step 8). **Since 0.16.0 (decision [0096](../decisions/0096-one-place-to-decide.md), CC-295; built by CC-298 and CC-299):** the template has no Review database and no Review example row; what the ingest reads from the seeded documents is decided in the setup session (capture-and-review §7.3), and the first-value checks rest on that session's yes. **Since 0.16.1 (decision [0103](../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md), CC-335; built by CC-337, the Notion checklist, template guidance and migration, and CC-338, the skills):** the template and existing spaces hold **First things first** (§6.4.1), which shows the user how to create and bind their own Notion Brain Assistant and tells them to ask Claude Code or Codex to "set up my brain"; step 4b is done only after the scope check and the button checks (§6.4). **Since 0.17.0 (decision [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) §8.6, moved to 0.17.0 by [0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §4; CC-326, built by CC-327 and CC-328):** Notion AI is optional. Setup asks two questions, and their answers decide whether step 4a (the minutes prompt) and step 4b (Notion Brain Assistant) are taken; nothing else is configured by them (§13). The author's answers of 2026-11-18 (asked through the coordinator during CC-326): the answers are kept on the `prerequisites` line, not in `brain.json`, and setup no longer installs the personal-Instructions path. **Since 0.17.0 (decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §7 to §9, CC-368; built by CC-369, the CLI, and CC-371, the skills):** step 8 asks two slots, the weekly review (Monday 08:00) and the daily catch-up (07:30), on macOS and Windows, with Claude Code or Codex, and `brain schedule` keeps them in `settings.schedule` (§7 item 12).

How this file fits: it holds the whole first-time setup of a new user: what the `brain-setup` skill does and in what order, what it checks and how, what it stores and where, what seeding writes, how first value is checked, and the setup report. Command behaviour is in [cli.md](cli.md) (§5.1 `init`'s next step, §5.2 `status`'s `setup` block, §5.3 `notion.template_version` and `settings.style`, §5.3.1 the style block, §5.15 `upgrade`'s Notion migrations), and file formats are in [schema.md](schema.md) (§4 area `track`, §12 the new-brain modules and the new `brain.json` keys). What a read, an answer or a proposal may rest on is [eligibility.md](eligibility.md), and nothing here changes it.

**Decisions:** [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md) (binding: §1 to §6); [0079](../decisions/0079-lean-minutes-and-follow-ups-as-tasks.md) (the minutes format the minutes check uses, and the follow-ups that become Tasks); [0081](../decisions/0081-response-style-working-principles-and-plain-writing.md) (the response style: §3 to §6); [0084](../decisions/0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md) (the template's Example rows, removed at step 4, and the guard: §6.5); [0087](../decisions/0087-the-template-shows-an-example-in-every-database.md) (an Example row in every database, the Brain Data callout, and the guard's wider list: §6.5); [0086](../decisions/0086-the-brain-works-on-main-and-early-access-requires-gh.md) (one working branch and no pull request, `gh` required for early access, the backup: §6.1, §7, §15; it amends two sentences of 0078 §2, and only those); 0015 (Notion through the MCP), 0037 (identities), 0048 (modules), 0061 (minimal per-area tracking preferences), 0064 and 0072 (Ultimate Assistant guides seeding), 0059 (project adoption), 0070 (lifecycle of structure notes), 0031 (owner rulings); [0103](../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md) §1 (First things first, and Notion Brain Assistant ready only after its checks: §1, §2, §3, §4.1, §6.2, §6.4, §12; it amends 0078 §2).

**The user's choices of 2026-11-10, filling gaps 0078 leaves** (asked through the coordinator during CC-188; each was the recommended option):
1. **Per-area tracking preferences** are an optional `track` list in the area note's frontmatter, in Git only, with no Notion property in 0.14.0; seeding proposes it, the ingest uses it, and Ultimate Assistant's thresholds stay fixed (§11).
2. **What setup records:** each step that only an online or by-hand check can prove is recorded as a `setup` log line (`brain log`), which `brain status` reads offline; the setup items stored as `brain.json` settings are `settings.markitdown`, `settings.gh` and `settings.schedule`, each `on` or `off`, absent meaning `off` (§4, §5); all three were optional in 0.14.0. From 0.17.0 `settings.schedule` holds the schedule itself, an object with the two slots, the runner, the agent and its model, or `off` when the user declined both (schema §12, decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §7, §8). Since 0086, `gh` is required for early access and setup always writes `settings.gh` `on` (§6.1, §7); since 0097, MarkItDown is required too and setup always writes `settings.markitdown` `on`; the choice stays as recorded for the schedule.
3. **The drop folder and the notes' language** stay lines of the user's part of the brain's `AGENTS.md`: `Drop folder: <path>` and `Language: <name>`; `brain status` reads the first (§4).
4. **The template version** is the number of the last Notion migration the template includes (`0024`); `brain upgrade` names the migrations with a higher number (§9).

**The user's choice of 2026-11-11** (asked through the coordinator during CC-191): seeded People are written `draft`, like every new person, since `brain note new` writes a person as `draft` (§8.2).

**Calls taken in this contract** (confirmed by the coordinator on 2026-11-10): a module key absent from a present `modules` block keeps its old default, so only the template's block turns Documents, Reports and Tasks on and existing brains are unchanged (schema §12); `status`'s human setup line shows only while setup is unfinished (cli.md §5.2); 0079 (merged in #289) is followed where it touches setup (§6.3, §10.1).

---

## 1. What setup is

A new user duplicates the published Notion template (0078 §1, CC-189), installs the CLI, runs `brain init` and, in the new brain folder, tells their agent (Claude Code or Codex) **"set up my brain"**. That phrase starts the `brain-setup` skill, which walks the user through §2's steps once, in order, and can be stopped at any point: asked again, it **resumes at the first unfinished step** (§3).

- **No new command and no interactive CLI.** `brain init` stays non-interactive; the skill asks, the CLI writes (cli.md §1). `brain status` is the offline half of the checks (§5); the skill adds the online ones.
- **Nothing is written in the user's Notion workspace or brain without a yes**, except what the CLI records about setup itself (the `setup` log lines and the settings the user confirmed on the settings screen).
- **Setup never sends the user to a path under `npm root -g`.** The skill reads the product's files at `product.path` (cli.md §5.2) and gives the user a link or the text itself: the template link from `notion/TEMPLATE.md`, the steps of a Notion guide, the minutes prompt to paste.
- **First things first** (0103 §1, from 0.16.1) is the Notion side of the same start: a checklist in the duplicated space, linked from Start here, for what only the user can do in Notion (their own Notion Brain Assistant, its access, its mentions and its three buttons), ending with the note to say "set up my brain" here (§6.4.1). It is not a second setup: the steps that connect and populate the brain stay this skill's, with seeding's preview and yes (§8), and step 4b walks the same checklist and checks it (§6.4).
- **The guide is Ultimate Assistant's voice** (0064): short messages, one question at a time except on the settings screen and the seeding preview, each ending with what the user does next.

## 2. The steps, in order (0078 §2)

| # | Step | `setup` log step (§4.1) | Done when |
|---|---|---|---|
| 1 | **Prerequisites**, all checked at once (§6.1) | `prerequisites` | every required prerequisite passes |
| 2 | **The settings screen** (§7), then its items applied: the Git identity, the backup (the private remote, §7), the drop folder created, the `AGENTS.md` lines | `settings` | the user confirmed the screen and each required item of it passes |
| 3 | **The template duplicated, and the agent connected to Notion** (§6.2) | `notion-mcp` | the MCP reaches the duplicated space's Brain Data page |
| 4 | **"Connect the brain to Notion"** (brain-connect-notion): modules on or off, database ids, the Tasks database, the template version | `connect` | every database of Core and of the modules on is stored, with Tasks on the Tasks database's Kind and Document asked checked (§6.2.1, §6.2.2), and the template version is stored when the space has a Template version line (a space built from the prompts has none: the version stays unknown, §9, and the step is still done); in a duplicate of the template, no `Example · ` row is left on Brain Data (§6.5) |
| 4a | **The minutes prompt**, walked through and checked (§6.3); taken only when the meetings answer includes Notion AI meeting notes (§13) | `minutes-prompt` | the check passes |
| 4b | **Notion Brain Assistant**, walked through First things first and checked (§6.4); taken only with Business or Enterprise and Notion credits (§13) | `brain-assistant` | the scope check, the mentions check and every applicable button check pass, and the user reported the access and Instructions checks (§6.4.2); a by-hand step is never recorded done on the API's word alone |
| 5 | **Identities** (0037; brain-connect-notion step 6) | `identities` | `owner.person` is set |
| 6 | **Seeding** (§8) | `seeding` | the preview was answered and its writes published, or the user said there is nothing to seed |
| 7 | **The first-value check** (§10) | `first-value` | first value passes: every applicable check passes (§10). Running the checks records an attempt, not a pass |
| 8 | **The schedule**, offered only after first value passes (§7, item 12): from 0.17.0 the weekly review and the daily catch-up, on macOS and Windows (0110 §8, §9); before, the scheduled catch-up | `schedule` | the user kept or changed at least one slot (and `brain schedule install` succeeded for it) or declined both |
| — | **The setup report**, offered (§12) | `finished` | always the last line, written only once steps 1 to 8 are done, so never while first value is unresolved |

- **Required items stop setup** until done (0078 §2): setup says what is missing and how to fix it, and stops there; asked again later, it resumes at that step. There is **no skip list**: a required item can't be skipped, and an optional one is a setting whose value is recorded (§7), so it never counts as unfinished.
- **The order is fixed** because each step needs the one before: the settings screen chooses the remote and the drop folder that later steps use; Notion is connected before seeding (0078 §3); first value needs seeded material; the schedule is offered only once first value passes (0078 §2).

## 3. Resume (0078 §2)

On "set up my brain", the skill runs `brain status --json` and reads its `setup` block (cli.md §5.2), then:

1. **Re-checks online** what the block can't see and is cheap to re-check: the Notion MCP reaches Brain Data (step 3), and the backup is private (`gh repo view --json isPrivate`; `gh` is required, §6.1). A recorded step whose online check now fails is unfinished again. In a duplicate of the template (`notion.template_version` stored) with no `connect` line `result=done` yet, step 4 is unfinished even when `databases` passes: the Example rows were not yet found gone (§6.5), so step 4 runs again.
2. **Never re-runs a by-hand check that is recorded as done** (the minutes prompt, Notion Brain Assistant): the `setup` line is the proof (choice 2). The user can ask for it again ("check the minutes prompt again"). A `brain-assistant` line recorded done before 0.16.1 has no button keys (§4.1): it stays done, so `brain status` counts it as before, and the skill offers the button checks once ("Check Notion Brain Assistant's three buttons now?"), as the existing space's migration does (0103 §2); a no is not asked again.
3. **Resumes an unresolved first value check by check** (§10), from the block's `first_value`: the checks that passed in the latest `first-value` line are kept, and only the others run again (`fail`, `unsuitable`, or not run yet). All four run again when a `seeding` line is newer than that `first-value` line, since the material changed; `tasks` runs again when it was `skip` and the Tasks module is now on.
4. **Starts at the first step of §2 that is unfinished**, saying in one line what is already done: "Setup: 6 of 9 done. Next: paste the minutes prompt." A step before it that fails a check (a Git identity removed since) is fixed first.
5. When every step is done, says so and offers only what is left: the setup report if it was never offered, the schedule if it was never answered.

A brain made before 0.14.0 that has no `setup` line and whose `databases` and `owner_person` checks pass (§5) is treated as set up (`status` shows no setup line, cli.md §5.2); "set up my brain" on it runs §3 normally and records the steps it checks, so the user can use it to check an older brain.

## 4. What setup stores, and where

| What | Where | Written by |
|---|---|---|
| Steps passed (by-hand and online checks, seeding, first value, the schedule's answer, the end) | `setup` log lines (§4.1), `log/<YYYY-MM>.md` | the skill, with `brain log setup` (cli.md §5.11) |
| The drop folder | the line `Drop folder: <path>` under "My rules" in the brain's `AGENTS.md` (as brain-ingest reads it today) | the skill, after the settings screen's yes |
| The language notes are written in | the line `Language: <name>` under "My rules" in the brain's `AGENTS.md` | the skill, after the settings screen's yes |
| Publish, push, recall | `brain.json` `settings.publish`, `settings.push`, `settings.recall` (schema §12) | `brain config set` |
| The response style (0081) | `brain.json` `settings.style` (schema §12), and the style block it writes in the brain's `AGENTS.md` (cli.md §5.3.1) | `brain config set` |
| The schedule (optional, choice 2) | `brain.json` `settings.schedule`: from 0.17.0 the object of schema §12 (the two slots, `system`, the agent and its model), or `off` when both are declined; `on` or `off` before (schema §12) | `brain schedule install` and `remove` (cli.md §5.21); `off` with `brain config set` |
| MarkItDown (required for early access, 0097 §5) | `brain.json` `settings.markitdown`, always written `on` by setup (schema §12) | `brain config set`, when the screen is applied |
| `gh` (required for early access, 0086 §3) | `brain.json` `settings.gh`, always written `on` by setup (schema §12) | `brain config set`, when the screen is applied |
| Modules | `brain.json` `modules` (schema §12) | `brain modules on|off` |
| The template version | `brain.json` `notion.template_version` (schema §12) | brain-connect-notion, with `brain config set` |
| Database ids, the Tasks mapping, `owner.person` | `brain.json` `notion`, `owner` (schema §12) | brain-connect-notion |
| Git identity | Git's own configuration (global, or the brain repository's when the user prefers) | `git config`, after the screen's yes |
| The backup (the remote) | the brain repository's `origin`, and `refs/remotes/origin/HEAD` naming the working branch (cli.md §5.2) | `gh repo create --private`, then `git remote set-head` (§7); the user's own steps only on 1.0's path |
| The Notion connection | the agent's own MCP configuration | the user, following the skill's steps |

The `AGENTS.md` lines are written under the `## My rules` heading, which follows the rules block's end marker `<!-- ultimate-brain:rules:end -->` (upgrades never touch anything after that marker except the style block, which the CLI keeps right after it, cli.md §5.3.1): each on its own line, after the heading's comment, replacing an earlier line of the same name anywhere after the marker, except between the style markers (`<!-- ultimate-brain:style:start -->` to `<!-- ultimate-brain:style:end -->`, cli.md §5.3.1): that block is the CLI's, and its lines are never read or replaced as "My rules" lines. When the heading is missing, the skill adds `## My rules` at the end of the file first. With the rules block's markers missing (cli.md §5.15 step 1), the skill writes nothing, says why, and setup stops at step 2 until the markers are restored; they are committed on their own (`rules: drop folder and language`).

### 4.1 The `setup` log line

```text
- <timestamp> setup - "" step=<step> result=<done|failed|declined>[ <key>=<value>]…
```

- This is the line `brain log setup - step=<step> result=… [<key>=<value>…]` writes: with `-` for the id, the CLI writes an empty quoted title (cli.md §5.11). This is the form `brain status` reads (the example before CC-191 showed it without the `""`, which the CLI never wrote and `status` doesn't read; no behaviour change). Setup lines are written only through `brain log`.

- `<step>` is one of §2's: `started`, `prerequisites`, `settings`, `notion-mcp`, `connect`, `minutes-prompt`, `brain-assistant`, `identities`, `seeding`, `first-value`, `schedule`, `finished`, and `first-meeting`, written once by brain-catch-up after setup (§10.1), which `brain status` doesn't read. `started` is written once, when the skill first runs in a brain with no `setup` line.
- `result=failed` adds `reason=<code>` from §12.2; `declined` is used only by `schedule` (the user declined both slots; from 0.15.2 to 0.16.x, on `win32` it added `reason=schedule-unsupported`, §7, which `brain status` doesn't count as recorded from 0.17.0, so a Windows brain is offered the schedule once, cli.md §5.2). `first-value` is `done` only when first value passes, else `failed` with `reason=first-value-unresolved` (§10). A step can be logged several times; the latest line of a step is its state.
- Extra keys: `prerequisites` adds, from 0.17.0, `credits=yes|no meetings=<list>` (§13's two answers: `<list>` is one or more of `notion-ai`, `tool`, `paste`, `files`, joined by commas, in that order), and before 0.17.0 added `notion_ai=yes|no custom_agents=yes|no` (the plan, as the user answered), which `brain status` still reads on a line without `credits`; `connect` adds `examples=<n>`, the Example rows this run moved to the trash (`0` when none was left, or in a space built from the prompts; §6.5); `first-value` adds `tasks=`, `report=`, `organised=` and `answer=`, each `pass`, `fail` or `unsuitable` (`tasks` also `skip`, with Tasks off), and leaves out a check not run yet (§10); `seeding` adds `notes=<n> documents=<n>`; `brain-assistant` (from 0.16.1, §6.4) adds `agent=custom|instructions`, `mentions=pass|fail`, and `tidy_capture=`, `write_up=` and `refresh_report=`, each `pass`, `fail` or `skip` (§6.4.2), and leaves out a check not run yet.
- Values carry no names, paths, ids or text (§12.1).

## 5. The offline checks (`brain status`, cli.md §5.2)

`brain status` computes these without a network call. Each is a fact about the brain or the machine it can read:

| Check | Passes when | Counts toward the 9 required |
|---|---|---|
| `git_identity` | `git config user.name` and `git config user.email`, read in the brain folder, are both non-empty | yes |
| `remote` | the brain is a Git repository with a remote `origin` that has a URL (`git remote get-url origin`). Whether it is private is checked online (§3) | yes |
| `databases` | every `notion.databases` key of Core and of each module on is non-empty, and, with Tasks on, `notion.tasks.database` too | yes |
| `drop_folder` | `AGENTS.md` has, after the line `<!-- ultimate-brain:rules:end -->` and outside HTML comments, a line starting with `Drop folder:` (the first one counts; §4) and its path (`~` expanded, backticks removed) is an existing folder. A relative path is read from the brain folder, and the `Drop folder:` and `Language:` lines may be indented | yes |
| `language` | `AGENTS.md` has, read the same way, a line starting with `Language:` | yes |
| `owner_person` | `owner.person` is set and names an existing person note | yes |
| `template_version` | reported as its value, or `null` (unknown) | no |

The other three of the nine required items (0078 §2) are the recorded steps `notion-mcp`, `minutes-prompt` and `brain-assistant` (§4.1, latest line `result=done`). So the count is: the six counted checks that pass, plus those three recorded as done, out of **9**; from 0.17.0, `minutes-prompt` and `brain-assistant` count only when the answers take them (§13), so the total is 7, 8 or 9.

**`first-value` is recorded as done only when its latest line passes** (§10): `result=done`, `report`, `organised` and `answer` each `pass`, and `tasks` `pass`, or `skip` while the Tasks module is off. Any other latest line leaves first value unresolved, so `next` stays `first-value` and the schedule is not offered. That includes a `result=done` line with a `fail` or without one of the four checks, as CC-188's contract wrote it: it is never read as success.

**Finished** when a `setup` line with `step=finished` exists; or, for a brain with no `setup` line at all, when `databases` and `owner_person` pass: a brain connected to Notion before 0.14.0 (§3), which may have no `Language:` or `Drop folder:` line, since nothing asked for them then. `required` and `next` are computed the same way whether or not setup is finished; once it is, they are information only, and `status` shows no setup line. **Next** is the first item not done in §2's order (a check that fails, or a step not recorded as done), as cli.md §5.2 lists them.

## 6. The checks the skill makes

### 6.1 Prerequisites (step 1, all at once)

| Prerequisite | How it is checked | Required |
|---|---|---|
| Node 22.6 or later | `node --version` | yes |
| Git, with an identity | `git --version`; `git config user.name` and `user.email` (set on the settings screen when missing) | yes (the identity can be set in step 2) |
| Claude Code or Codex | the agent running the skill; its name goes in the setup report | yes |
| The Notion MCP connection | a Notion tool is available in the session (reached in step 3) | yes (connected in step 3) |
| `gh`, signed in | `gh --version`, then `gh auth status --hostname github.com` | yes for early access (0086 §3) |
| Python and MarkItDown | `markitdown --version`; when it fails, `python3 --version` (`py --version` on `win32`) and `pipx --version` (`py -m pipx --version` on `win32`) only to choose the message's steps | yes for early access (0097 §5) |
| The Notion plan and the meetings | **asked**, since the API can't read them: §13's two questions (from 0.17.0; before it, "Does your Notion plan include Notion AI? And Custom Agents?") | no: each answer only decides whether step 4a or 4b is taken (§13) |

All are shown in one list (`✓ Node 22.11`, `✗ Git identity: set on the next screen`, `? Notion AI: asked below`). A missing required prerequisite that the next steps don't set (Node, Git, the agent, `gh`, MarkItDown; Notion AI before 0.17.0) stops setup with its fix: the commands of §6.1.1 for the platform, never a path under `npm root -g`. All missing prerequisites are fixed in one message, in the table's order, so the user installs once and restarts once.

#### 6.1.1 The install commands, by platform (0097 §1)

The platform is Node's `process.platform` as the agent sees it (`darwin`, `win32`; any other gets the links). Each command is given exactly as written here; the guides (README Get started, docs/setup.md) use the same commands.

| Prerequisite | macOS (`darwin`) | Windows (`win32`, PowerShell) | Other |
|---|---|---|---|
| Homebrew (only when `brew --version` fails and a `brew` command below is needed) | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`, then the lines it prints under "Next steps" | — | — |
| Node | `brew install node` | `winget install --id OpenJS.NodeJS.LTS -e` | https://nodejs.org |
| Git | `xcode-select --install` (Apple's developer tools: a window opens, and the download takes several minutes) | `winget install --id Git.Git -e` | https://git-scm.com/downloads |
| `gh` | `brew install gh` | `winget install --id GitHub.cli -e` | https://cli.github.com |
| Python | `brew install python` | `winget install --id Python.Python.3.12 -e` | https://www.python.org/downloads |
| `pipx` (only when `pipx --version` fails) | `brew install pipx` | `py -m pip install --user pipx` | https://pipx.pypa.io |
| MarkItDown | `pipx install 'markitdown[all]'`, then `pipx ensurepath` | `py -m pipx install "markitdown[all]"`, then `py -m pipx ensurepath` | https://github.com/microsoft/markitdown |

- **Node through Homebrew on macOS,** so `npm install -g ultimate-brain` needs no administrator rights (Node from the nodejs.org installer usually refuses a global install without them).
- **On Windows, `winget` missing** (`winget --version` fails, an old Windows 10): the Other column's links instead, and the message says to update "App Installer" from the Microsoft Store to get `winget`.
- **After any install, a restart.** A terminal or an agent app keeps the PATH it started with, so a tool installed after it opened isn't found. The message ends: on `win32`, "Close every terminal, quit <agent> and open it again (closing its terminal is not enough), then say "set up my brain" again."; on `darwin`, "Open a new terminal window, then say "set up my brain" again." The skill never edits PATH or the user's shell profile itself.
- A tool that is installed but not found after the restart is named with docs/setup.md's "A command isn't found" entry (CC-293), and the reason code stays the prerequisite's.

**`gh` missing or signed out** (`gh --version` fails: `gh-missing`; or `gh auth status --hostname github.com` exits non-zero: `gh-signed-out`; only github.com is checked, so a broken sign-in to another host doesn't stop setup) stops setup at step 1 with this message, the first step's command chosen by the platform from §6.1.1 (`darwin` gets `brew install gh`, `win32` gets `winget install --id GitHub.cli -e`, any other the link):

```text
Setup needs the GitHub CLI (gh), signed in, to create your backup. Two steps:
1. Install it: brew install gh
2. In your terminal, run: gh auth login
   When it asks, choose to let it set up Git's credentials.
Then say "set up my brain" again.
```

With `gh` installed but signed out, step 1 of the message is left out and step 2 is numbered 1. It is logged `prerequisites result=failed reason=gh-missing` or `reason=gh-signed-out` (§12.2). Asked again, setup re-runs step 1's checks and goes on once `gh auth status --hostname github.com` passes. No other path is offered in early access: the manual steps of §7 are 1.0's. With step 1 shown, the message ends with §6.1.1's restart line instead of "Then say ..." alone.

**MarkItDown missing** (`markitdown --version` fails: `markitdown-missing`, 0097 §5) stops setup at step 1 with this message, the commands from §6.1.1 for the platform (shown for `win32`); the Python step is left out when Python was found, the `pipx` step when `pipx` was found, and the rest renumbered:

```text
Setup needs MarkItDown, which turns PDFs, Word files and slides into exact text, so the brain quotes them exactly.
1. Install Python: winget install --id Python.Python.3.12 -e
2. Install pipx: py -m pip install --user pipx
3. Install MarkItDown:
   py -m pipx install "markitdown[all]"
   py -m pipx ensurepath
Close every terminal, quit Claude Code and open it again (closing its terminal is not enough), then say "set up my brain" again.
```

It is logged `prerequisites result=failed reason=markitdown-missing` (§12.2), and setup goes on once `markitdown --version` passes. When `gh` is missing too, one message holds both, in §6.1.1's order, with one restart line at the end.

### 6.2 The template and the Notion connection (step 3)

- **The template:** the skill gives the link from `<product.path>/notion/TEMPLATE.md` (its only home, 0078 §1) and asks the user to duplicate it into their workspace. It never builds the space from the prompts in setup; a user who prefers to build is pointed to the checklist's text, given by the skill (0078 §1). It says that the duplicate holds **First things first** (§6.4.1), and that the Notion Brain Assistant steps there are walked through together at step 4b: the user may do them before, and step 4b then checks them.
- **The connection:** the skill gives the steps for the agent in use (brain-connect-notion's "Connect your agent to Notion") and waits. Checked by searching for the page **Brain Data** through the MCP, as brain-connect-notion step 1 does: found once → `notion-mcp` done; not found or found twice → the same messages as that step.

#### 6.2.1 The Tasks database's Kind (step 4; 0099 §4, from 0.16.0)

Kind (a select with the options Task, Question and Risk) is how the Tasks page shows the questions and risks you follow up (capture-and-review §6.4). brain-connect-notion checks it with the Tasks database, when the Tasks module is on:
- **The default Tasks database** (the one on the template's Brain Data, schema §12) is expected to have Kind, with those three options. Found → `notion.tasks.properties.kind` = its name (`Kind`). Missing, or missing an option → the check fails: the skill names what is missing and the migration that adds it (the 0.16.0 Notion migration, cli.md §5.14.9), and step 4 is not done until it passes.
- **A database you mapped yourself** (0018) is offered Kind, once, in the mapping's questions: "Add a Kind property (Task, Question, Risk) to your tasks database, so the questions and risks you track can be filtered? a) yes, add it (recommended) b) no: their titles will start with *Question:* or *Risk:*". On a), the skill adds the select property through the MCP with your yes and reads it back; on success it maps it (`kind` = its name). A database that already has a select of that name with those options is mapped without a question. On b), or when the write fails, `kind` stays `""`, and the step is done: a tracking task's title then carries the prefix (cli.md §5.14.5). Asked again only when you ask to change the mapping.

The offline `databases` check (§5) doesn't see properties: Kind is checked here, online, and never by `brain status`.

#### 6.2.2 Document asked on Tasks (step 4; 0100 §1, §5, from 0.16.0)

Document asked (a checkbox) and the **Keep as document** button that ticks it are how you flag a task to be kept as a Document (capture-and-review §13). brain-connect-notion checks them with the Tasks database, when the Tasks module is on, in the same pass as Kind:
- **The default Tasks database** is expected to have Document asked and the button. Found → `notion.tasks.properties.document_asked` = its name (`Document asked`). Missing → the check fails as for Kind: the skill names the 0.16.0 Notion migration that adds them, and step 4 is not done until it passes.
- **A database you mapped yourself** is offered them, once, in the mapping's questions: "Add a Keep as document button to your tasks, so the brain keeps a task's page as a document at the next catch-up? a) yes, add it (recommended) b) no: ask me in the session instead". On a), the skill adds the checkbox through the MCP with your yes and reads it back, then maps it (`document_asked` = its name); the button is added by hand (an API can't create a button, design §3.15), with the steps the skill gives: a button labelled **Keep as document** whose action ticks Document asked on This page. A database that already has a checkbox of that name is mapped without a question, and the skill asks only about the button. On b), or when the write fails, `document_asked` stays `""`, and the step is done: you keep a task as a document by asking in the session. Asked again only when you ask to change the mapping.

Neither needs the Documents module to be mapped, but a task is kept only with Documents on (capture-and-review §13.2).

#### 6.2.3 Domain on Tasks (Domains module; 0113 §9, 0114, from 0.18.0)

**Domain** on Tasks is a read-only rollup (Area → Domain, Show original): the Tasks views of a Domain home filter on it (docs/notion-space-design.md §4.1). The brain never reads or writes it, so `brain.json` maps nothing for it. brain-connect-notion looks at it with Tasks and Domains on: in step 4 when Domains is on already, otherwise when Domains is turned on (seeding §8.2, or "turn on domains"):
- **The default Tasks database** is expected to have it. Missing → the skill names the 0.18.0 Notion migration that adds it; nothing is held back, since the brain doesn't use it.
- **A database you mapped yourself** is offered it, once, when its mapped `area` is a relation to the brain's Areas database: "Add a Domain to your tasks database, so each Domain page can list its tasks? a) yes, add it (recommended) b) no". On a), the skill adds the rollup through the MCP with your yes and reads it back. A database that has the rollup already is not asked about. On b), or when the write fails, nothing is added, the Tasks views are left off the Domain homes, and everything else works. Asked again only when you ask to change the mapping. With no such `area` relation it isn't offered: the skill says in one line that Domain pages won't list tasks.

### 6.3 The minutes prompt (step 4a; 0078 §2, 0079)

Walked through: the skill gives the prompt's text (from `<product.path>/notion/`, the file CC-197 names) and how it runs, as `notion/pasting-the-minutes-prompt.md` says (CC-258, capture-and-review §3.4). The user opens the meeting page, with the transcript on it, and opens the Notion AI chat there. They paste the prompt, then the line **"Write the minutes on this page, below the transcript, and nothing else."**, and send it. The transcript stays on the page: in the meeting-notes block's Transcript when Notion recorded the meeting, or in the page body above the minutes when it was pasted. Checked:

1. The skill gives a short synthetic meeting text (two subjects, one commitment of the owner, one decision; written by the skill from a fixed sample in the setup skill, never from the user's material). It asks the user to paste it into the body of a new Meetings page and run the prompt there, in the chat, as above.
2. It reads the page through the MCP and checks the shape that `spec/capture-and-review.md` defines for the current format (0079 §2): the readable part with **In one line**, **Quick follow-ups** each with a `q` id, **Tasks for the brain** with item ids, one block per subject with its `s` id; and the collapsed **For the brain** toggle with each subject's `Selection:` line and the id → quote list, every quote found in the pasted text. Until 0079's contract (CC-195) is merged, the shape is the one `notion/minutes-format.md` defines (subjects, `Selection:` lines, item ids).
3. **The transcript is still on the page.** Every line of the sample is on the page word for word (spacing aside), outside the minutes and the For the brain toggle: in the page body above the minutes, or in the meeting-notes block's Transcript. When the page has the minutes but not the sample, the check fails with **`transcript-missing`**, whatever the shape. The skill names the fix: "Notion AI replaced the transcript. Put it back on the page above the minutes: restore an earlier version from Notion's version history, or paste the sample again. Keep the minutes. Next time, run the prompt in the Notion AI chat on the page and add: Write the minutes on this page, below the transcript, and nothing else." It names any shape problem in the same message and offers to check again. A page with no minutes at all is `shape-wrong`, as before.
4. Pass (the shape and the transcript) → `minutes-prompt` done. Fail → the skill names what is missing ("no `Selection:` line under subject 2"), says the likely cause (the prompt pasted only in part, or run outside the page's chat) and offers to check again.
5. The test page is never set Ready, so no catch-up reads it; the skill asks the user to delete it after the check.

**If the minutes prompt can live inside the Meetings template** (checked once by CC-193 on the test duplicate, 0078 §2), the template carries it and step 4a becomes the check alone.

### 6.4 Notion Brain Assistant (step 4b; 0078 §2, 0103 §1)

**Running a skill** (CC-260; the same words in `notion/brain-assistant.md`, `docs/setup.md` and the guide). In Notion Brain Assistant's chat the user asks for a skill by its name ("Run Today"), or mentions the skill's page from **this space's** Skills database. A Custom Agent doesn't recognise a skill typed as a `/` command, and no text tells a Custom Agent user to type `/Today`. The `@` picker may offer another space's page of the same name, or none while a fresh duplicate isn't indexed yet, so a mention is made with the page's link (open the page from the space's Skills database, ••• → Copy link, paste it in the chat), never by picking a result whose space can't be seen. With personal Instructions (no Custom Agent) the user asks for it by name in the same way.

**The space's name.** The space is named by its **top page** (Brain Data's topmost parent page, §9; "Ultimate Brain" in a fresh duplicate). Before the walk-through the skill reads that page's title through the MCP and searches the workspace (MCP search, read only) for other pages with the same title and for other databases titled `Skills` or `Brain Assistant Skills`.
- **Another top page has the same title:** the skill asks the user to rename this space's top page first, so the picker can tell the spaces apart ("Your workspace has two pages called Ultimate Brain. Rename this one, for example to Ultimate Brain · Test, then say done."). It reads the title again after the user's "done". Nothing in the brain depends on the title.
- **Other Skills databases exist:** the walk-through says how many, and that the right one is the one under the top page.

**Your own agent (0103 §1).** Duplicating the template doesn't give the user a configured Notion Brain Assistant, and the skill never assumes one came with it: the user creates their own, gives it access, replaces the mentions and selects it in the buttons, as First things first lists (§6.4.1). Before the walk-through the skill asks once: "Does this space already have a Notion Brain Assistant you created (named Brain Assistant before 0.17.0), that answers in its chat?"
- **No** (a fresh duplicate, or not sure): the walk-through goes through §6.4.1's items 1 to 6 in order, one at a time, each ending with what the user does next.
- **Yes** (an existing space, or the user did the checklist before step 4b): the agent is kept, never a second one asked for. One still named Brain Assistant is the same agent: the skill asks the user to rename it Notion Brain Assistant in its settings (0106 §4; migration 0030, part B), and nothing else about it changes. The walk-through starts with the checks below and shows a checklist item only when its check fails, as a repair.

Walked through: the skill gives the steps of `<product.path>/notion/brain-assistant.md`, its only source for the agent's steps, Instructions and skill text (never another copy): a **Custom Agent** (step 4b is taken only with `credits=yes`, §13). Before 0.17.0, a plan without Custom Agents got the same text as **personal Instructions** (the `custom_agents` answer of §6.1); from 0.17.0 setup no longer installs that path, which stays documented by hand in `notion/brain-assistant.md`, and a user without credits asks their agent for the same skills (§13). For a Custom Agent, every database or page given to Tools and access is named by its space: "**Brain Data**, **How it works** and **Skills** under *<top page>*: in the picker each result shows the page it sits under; pick only those under *<top page>*, and if a result doesn't show it, paste the page's link instead." The skill says that a mention in the Instructions doesn't give the agent access: only Tools and access does, and then, word for word: "The agent runs the skills of whichever Skills database is in its Tools and access, so keep exactly one there: the one under your top page." Checked, in this order:

1. **The scope check.** With the user's yes, the skill creates one Task in the brain's Tasks database through the MCP: `Setup check: delete me`, Due today. With Tasks off, no task is created: step 2 then passes when Today lists nothing from outside the brain's databases.
2. The skill asks the user to run Today as above, naming this space's Tasks database: "In Notion Brain Assistant's chat, ask **Run Today** (not `/Today`). It should list **Setup check: delete me** from the Tasks database under *<top page>* › Brain Data, and nothing else from outside *<top page>*. Paste or describe what it lists." It passes when the answer lists that task and nothing that isn't in the brain's databases (no task, meeting or page from another space or elsewhere in the workspace). A user who has no agent to ask yet fails it with `assistant-missing`, and the skill goes back to §6.4.1 item 2.
3. **Today read another space** (a task or meeting the brain's databases don't hold, or the test task missing while other tasks show): the check fails with `assistant-reads-outside`. The skill names what came back that shouldn't have and gives the two fixes, in this order: (a) **the run used another space's Today**: ask by name again in Notion Brain Assistant's chat, or mention the Today page by the link copied from the Skills database under *<top page>*, never from the `@` picker; (b) **the agent's access reaches another space** (a Custom Agent: in Tools and access, remove every Brain Data, How it works or Skills not under *<top page>*; personal Instructions: the instruction to stay inside Ultimate Brain is missing or was pasted in part, so paste the whole text again). It offers to check again.
4. On a pass the skill sets the test task's Status to the mapped closed-without-doing status (`notion.tasks.wont_do_status`), with the same yes.
5. **The mentions check** (read through the MCP). The skill reads every page of the Skills database under *<top page>* and every page mention in it, in its Description property and in its body (*Where a skill's text is*, below). It passes when each mention opens a page under *<top page>* (its parent chain reaches the top page). A mention that opens a page elsewhere, or one the MCP can't open (another person's space, such as the template author's), fails it with `mentions-outside`: the skill names the skill page and the mention's text, and says to replace it with a mention of the page of that name under *<top page>* (§6.4.1 item 5).
6. **The access and the Instructions** (the user's check, in Notion's interface; 0103 §1: the API can't read a Custom Agent's Tools and access or its Instructions). The skill asks the user to open the agent's settings and confirm two things: Tools and access holds Brain Data, How it works and Skills under *<top page>* and nothing else; and every mention in the Instructions opens the page under *<top page>* (hover or open it). The user's answer is recorded as their observation; the skill says "you checked", never that it verified it. A second Skills database in Tools and access is one only the user can see, and removes by hand: setup can't read Tools and access, and Today (check 2) can pass with it there. A no shows §6.4.1's item 3 or 4 again.
7. **The button checks** (Custom Agent only; §6.4.2). For each button that applies, with the user's yes, the skill creates a disposable sample page through the MCP, asks the user to confirm in that button's settings that **Send message to** names their own Notion Brain Assistant (§6.4.1 item 6), to click it on the sample page, and to say when the agent has answered; then it reads the sample page back through the MCP:

   | Button | Applies when | The sample page | Passes when the page, read back, shows |
   |---|---|---|---|
   | **Tidy capture** | always (the Inbox is Core) | an Inbox row titled `Setup check: Tidy capture (delete me)`, Kind Capture, Brain Status New, its body a fixed synthetic note from the setup skill (a few short lines with one name, one number and one date) | a body that differs from the sample and still holds the sample's name, number and date; Brain Status still New |
   | **Write up** | the Documents module is on | a Documents row titled `Setup check: Write up (delete me)`, Origin Promoted, its body one fixed synthetic line | a body that differs from the sample (the first Write up develops the seeded text, design §3.17) |
   | **Refresh report** | the Reports module is on | a Documents row titled `Setup check: Refresh report (delete me)`, Origin Report, its body a fixed synthetic short report | one appended section headed `Proposed refresh · based on Notion`, and the text above it unchanged |

   A button that doesn't apply is `skip`. A page that didn't change as the table says fails that button with `button-unbound`: the skill gives the repair (§6.4.1 item 6: select your own agent in Send message to; keep the message's skill name, confirmation and This page reference) and offers to check again. The sample text never uses the user's material, and no step of setup reads a sample except this check. After each read, with the same yes, the skill moves the sample to Notion's trash (`in_trash: true`); one it couldn't trash leaves the step unfinished with `samples-left` until it is gone (the user may delete it by hand). Setup's catch-up and seeding come later (§2), so nothing in the brain is made from a sample.
8. **Recorded.** `brain-assistant` is done only when checks 2, 5 and 6 pass and every applicable button passed (no `fail`, none left out): `brain log setup - step=brain-assistant result=done agent=custom mentions=pass tidy_capture=pass write_up=pass refresh_report=skip`. Any other ending is `result=failed` with the first failing reason (`assistant-missing`, `assistant-reads-outside`, `mentions-outside`, `button-unbound`, `samples-left`), the keys of the checks run so far, and the concrete next step. **With personal Instructions** (no Custom Agent, `agent=instructions`; a line recorded before 0.17.0, which stays done), the buttons can't message an agent: the three are `skip`, the skill says they won't work on this plan (`notion/brain-assistant.md`), and the step is done on checks 2 and 5 and check 6's Instructions part (there is no Tools and access), as before 0.16.1 with the mentions added.

**Where a skill's text is** (CC-385; docs/notion-space-design.md §5 has the layout in full). A skill page keeps its whole text block in **Description**, with an empty body; only Write minutes holds its Description line there and the minutes prompt in its body. This is the template's layout and the one "publish Notion Brain Assistant's skills" writes ([Prompt 9](../notion/prompts/09-assistant-and-guide.md), step 2). Publishing creates a page only for a skill the Skills database has no page for; it changes no page that is there. Setup accepts a Skills database in the earlier layout (the short Description line, the text in the body), checks it the same way, and asks for no move: a fix to a skill's text is made where its page keeps it.

#### 6.4.1 First things first (0103 §1, §2)

A checklist in the duplicated space for what only the user can do in Notion. **Where:** a page **First things first** under the top page, linked first in the System callout (System stays a callout, 0085) and from the **Start here** callout by its own line, right after the line that says to install and say "set up my brain", so a user who opens the duplicate reaches it first. The published template holds it (U-37), and the migration of CC-337 adds the page and both links to an existing space, once: a rerun finds the page and adds no second one, and it changes no working agent or button (0103 §2). The exact Notion text is in `docs/notion-space-design.md` and `notion/TEMPLATE.md` (CC-337); this section fixes what it must hold, as to-do items in this order:

1. **Your plan.** Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits, linked to Notion's help as the Start here callout is (0101 §7). Without it (from 0.17.0, 0101 §8): skip items 2 to 6 and 8, and ask Claude Code or Codex for the same skills by name ("prep my 3pm", "tidy that capture"; assistant.md §13); the buttons do nothing on that plan. The exact wording is `docs/notion-space-design.md` §10.1's.
2. **Create your own Notion Brain Assistant.** Said plainly: duplicating the template doesn't give you a configured agent, so create your own: Agents → New Custom Agent, named **Notion Brain Assistant**, with no triggers. In a space that already has one that works, keep it and check it instead (items 3 to 6, then 8); one still named Brain Assistant (before 0.17.0) is renamed Notion Brain Assistant, the same agent.
3. **Give it access.** Tools and access: **Brain Data**, **How it works** and **Skills**, each the one under your top page, and nothing else. A mention in its Instructions doesn't give access: only Tools and access does. The agent runs the skills of whichever Skills database is in its Tools and access, so keep exactly one there: the one under your top page.
4. **Paste its Instructions and replace the mentions.** A link to the Instructions in `notion/brain-assistant.md` in the product repository (`package.json` `repository`), its only copy. Each `[@Brain Data]` and `[@How it works]` becomes a mention of that page under your top page.
5. **Check the mentions in the skills.** Each page of **Skills** under your top page: every mention of Brain Data or How it works must open the page under your top page, never another space's or one you can't open. Replace any that doesn't.
6. **Select your agent in the three buttons.** **Tidy capture** (Inbox), **Write up** and **Refresh report** (Documents; each there with its module on): open the button's settings, and in **Send message to** select your own Notion Brain Assistant. Keep the message as it is: the skill's name, the confirmation and the **This page** reference. Selecting the agent says who receives the message; This page in the message says which page it is about: one never replaces the other.
7. **Set up your brain.** Word for word: **Open Claude Code or Codex in your brain folder and say "set up my brain" to connect and populate your brain.** Then a line for a user without a brain folder yet, linking the README's Get started (the same link as Start here): install first. This is the guided setup of this file, with seeding's preview and yes (§8), not another way in.
8. **Run Today and check the buttons.** In Notion Brain Assistant's chat ask **Run Today**, then click each button on the sample page your agent creates for it. Notion Brain Assistant is ready when the guided setup records these checks (step 4b): ticking the to-do isn't the check.

#### 6.4.2 What is verified, and how (0103 §1)

| Check | How | Who can say it passed |
|---|---|---|
| Scope (Today) | the user runs Today and reports what it lists; the test task is read and closed through the MCP | the user's report |
| Mentions in skill pages | read through the MCP (§6.4 check 5) | the API |
| Tools and access, mentions in the Instructions | in Notion's interface; the API can't read them | the user's report |
| Send message to selects the user's agent | in Notion's interface; the API can't read a button's settings | the user's report |
| A button ran and did its skill's work | the sample page read back through the MCP (§6.4 check 7) | the API, for the page's change only |

The skill's messages and the setup report keep that line: "You checked that Tidy capture sends to your Notion Brain Assistant; I read the sample page and it was tidied." It never says it verified through the API what only the user saw.

### 6.5 The Example rows (step 4; 0084 §3, §4)

The published template carries thirteen invented rows (fifteen before 0.16.0) that show a filled space, one or more in every database on Brain Data, all from one story and related to each other: 0084's seven (one Domain, Area, Project, Person, Org, Meeting with short lean minutes, New, and Task), 0087's five left (an Inbox capture, Done; a Document, Kept and Reviewed, nothing asked; a Goal, Active; a Key Result; a second Task, Waiting On) and the kickoff's open question tracked as a third Task, Waiting On, Kind Question (0099). 0087's Review, Decision and Question rows went with their databases in 0.16.0 (0096, 0099, CC-299); in a space duplicated from an earlier template they are Example rows like the others, trashed at step 4 while their databases are on Brain Data, and the migration archives those databases, rows included (capture-and-review §7.9, cli.md §5.14.9). Each is titled with the prefix **`Example · `** (the word `Example`, a space, the middle dot U+00B7, a space; matched exactly, case included). Their exact content is [notion/template-examples.md](../notion/template-examples.md). A callout at the top of Brain Data says they are examples and that setup removes them; it is product text and stays. Nothing in the brain is ever made from an Example row.

**Removed at step 4,** in a duplicate of the template only: a space whose top page has a Template version line (§9). A space built from the prompts has no Example rows, and nothing is searched in it. A duplicate whose Template version line was deleted can't be told from one, so it isn't searched either: the guard below is what keeps its Example rows out of the brain.
1. After brain-connect-notion has found and stored the databases (its steps 2 to 4a), the skill queries **every database on the duplicate's Brain Data page**, whether its module is on or off, for the rows whose title starts with `Example · ` (all pages of each). A database elsewhere in the workspace, such as the user's own tasks database (0018), is never searched.
2. **None found:** log `step=connect result=done examples=0` and go on.
3. **Some found:** show their titles, one per line with their database, and ask once: "Your template still has these <n> example rows. I'll move them to Notion's trash now, so nothing in your brain is made from them. OK?" On the yes, move each to the trash through the MCP (the page updated with `in_trash: true`; `archived: true` on API versions before 2025-09), query again, and when none is left, log `step=connect result=done examples=<n>`.
4. **Declined, or some still there** (a failed write): log `step=connect result=failed reason=examples-left`, say the rows must go before anything reads the space (the user may also delete them in Notion), and stop at step 4, as at any required item (§2).
5. **Resume** (§3): a duplicate with no `connect` line `result=done` runs step 4 again. brain-connect-notion's re-run leaves correct ids alone; the query finds only the rows still there. A row already gone is fine, and none left passes at once.

- A row the user renamed so its title no longer starts with `Example · ` is the user's own, and is left alone; so is every row without the prefix.
- Step 4 comes before identities (5), seeding and its publish (6, whose pull reads Notion), the minutes and Notion Brain Assistant checks (4a, 4b) and any catch-up, so no step reads an Example row.

**The guard,** for a brain connected before its Example rows were removed (brain-connect-notion run on its own, outside setup): every skill that reads Notion rows and could act on one leaves out every row whose title starts with `Example · ` (0084 §4, 0087 §4).
- **brain-sync's pull** leaves it out of the snapshot it gives `brain sync plan`, so it is never imported (0021), corrected or matched. Catch-up's pull is brain-sync's, and brain-ingest's first-run sync too. This covers every database the pull reads, Documents, Goals and Key Results included, and so the requests the plan derives from them: a Document's Accepted wording, a report's Refresh asked and What to fix.
- **brain-ingest and brain-catch-up** skip such a meeting or Inbox row without taking it in: no source, note, proposal, Task, or line in a report the brain writes. The run's own report names how many it skipped, once ("2 example rows skipped: delete them in Notion, or say "set up my brain" to remove them").
- **ultimate-assistant** leaves such a row out of its live snapshot of Tasks, Projects and Areas (`tasks`, `projects`, `areas`). It reads every row of the three, so an Example Task would otherwise become a finding with offers to change it (0084's Task, not started, is `task_stalled` 14 days after the duplicate, spec/assistant.md §3.3), and the Example Project and Area would be read as a project and an Area outside the brain (§3.1). Its report is the CLI's text, so it doesn't name them.

**Why the others can't reach an Example row** (no skip needed):
- **brain-query and its reports** read the brain through the CLI, never Notion rows: `notion_fields` come from the pull. An Ask row reaches a report only through the catch-up's Inbox reads (above); a refresh, a What to fix or an Accept only through the pull's plan.
- **brain-workflow and brain-workflow-adopt** read the tasks related to the workflow's destination, a Project or Area chosen from `brain index`, which never holds an Example row (the pull leaves them out). The Example Tasks are related only to the Example Project. A user who relates one to their own project and keeps its title still has an Example row; renaming it makes it theirs.
- **Tasks sync** (`brain sync tasks`, run by brain-ingest and brain-catch-up) creates Tasks only from the items of a meeting or source the brain has taken in, and reads no Task row to do it. The Example Meeting and Inbox row are never taken in, so no Task is made from them, and the Example Tasks are never read.
- **brain-connect-notion, brain-notion-change, brain-reflect and brain-repos** read no rows (database ids, structure, the brain, a linked repo). **brain-howto** reads a record only to explain it, and changes nothing.
- Notion Brain Assistant, in Notion, sees the Example rows like any page: that is what they are for.
- The CLI has no part in it: it never reads Notion, and receives only what the skills send. A CLI skip in `sync plan` is 0084's follow-up, if a leftover example ever reaches a brain.

## 7. The settings screen (step 2; 0078 §2)

One screen, every item with its default filled in and a one-line explanation. The user answers once ("keep these", or changes: "drop folder ~/Inbox/brain", "push: remind"); the skill shows the screen again with the changes, and applies it on a yes. It also shows **where the brain lives**: the folder, and the backup once there is one. What the user reads calls the remote **the backup** and uses no Git word (0086 §4): items 3 and 8 below give the words; Git's own words (`origin`, push, branch) appear only when the user asks for the details.

| # | Item | Default filled in | One-line explanation shown | Required | Stored (§4) |
|---|---|---|---|---|---|
| 1 | Brain folder | the folder `brain init` made | "Your brain: Markdown notes in a Git repository. Everything the brain knows is here." | shown | the folder; `~/.config/ultimate-brain/config.json` when `init --set-default` was used |
| 2 | Git identity | the current `user.name` and `user.email`, else the owner name and an empty email the user must fill | "Every change the brain makes is a commit with this name; without it nothing is saved." | required | Git configuration |
| 3 | Backup | the current `origin` when there is one; else a new private GitHub repository named after the brain folder, created with `gh repo create --private` (0086 §3). Shown as `Backup: a private GitHub repository, created for you` | "A private copy of your brain on GitHub, so nothing is lost and another machine can use it." | required | `origin` |
| 4 | Drop folder | `~/Documents/brain-dropbox/` (created); a folder named after this brain when another brain on the machine reads that one (below) | "Files you drop here are read by the next catch-up: documents, exports, notes." | required (created) | `Drop folder:` line |
| 5 | Language notes are written in | the language the user writes to the skill in | "The brain writes its notes in this language, whatever the language of the source." | required | `Language:` line |
| 6 | Modules | Orgs, Documents, Reports, Tasks on; Planning off; Domains decided by seeding (§8). Knowledge is retired in 0.16.0 (0099): decisions and questions show on project and area pages | "Which parts of your Notion space the brain uses; you can change this any time." | shown | `modules` |
| 7 | Publish | `ask` | "Ask before the brain publishes to Notion, or publish after each run." | shown | `settings.publish` |
| 8 | Back up after each run | `auto`, shown as `on`; `remind` is shown as `remind me` | "Back up your brain after each run, or remind you to." | shown | `settings.push` |
| 9 | Opening recall in linked repos | `off` | "Agents in your linked repos load what the brain remembers about them when a session opens." | shown | `settings.recall` |
| 10 | MarkItDown | `on`: step 1 already checked it is installed (§6.1) | "Turns PDFs, Word files and slides into exact text, so quotes are exact." | required for early access (0097 §5): shown, not changed | `settings.markitdown` |
| 11 | GitHub CLI (`gh`) | `on`: step 1 already checked it is signed in (§6.1) | "Creates your backup, checks it stays private, and files your setup report for you." | required for early access (0086 §3): shown, not changed | `settings.gh` |
| 12 | The schedule (0.17.0, 0110 §8) | asked in step 8, after first value, on macOS and Windows: the **weekly review, Monday 08:00** (0075 §6) and the **daily catch-up, 07:30**, each kept, changed or declined | "The weekly review and a catch-up run on their own at these times, with your agent; a catch-up only takes in what you've marked ready." | optional | `settings.schedule` |
| 13 | How the brain talks to you (0081) | Standard | "Standard, Simple (plain words, short answers, the answer first) or Custom (you choose how much it explains, how long and how direct it is); change it any time by asking." | optional | `settings.style` |

- **Item 4: one drop folder per brain** (CC-259). Two brains reading one drop folder take each other's files, so the screen never proposes a folder another brain on the machine reads. A brain with a `Drop folder:` line shows that line's folder. Otherwise it proposes `brain status`'s `setup.drop_folder.proposed` (cli.md §5.2): `~/Documents/brain-dropbox/`, unless another brain this machine knows reads it; then a folder named after this brain, `~/Documents/<brain folder slug>-dropbox/`, and the item's line says why: `Drop folder: ~/Documents/client-brain-dropbox/ (created; ~/Documents/brain-dropbox/ is read by your brain at ~/GitHub/brain)`. The brains the machine knows are the default brain (`~/.config/ultimate-brain/config.json`, cli.md §4) and each brain with a scheduled job (`brain schedule`, cli.md §5.21); a brain known neither way can't be seen, so a proposed folder that already exists (`exists`) is shown as `(already there: its files are read by the first catch-up)`, as before. A change the user makes to a folder another brain reads (`setup.drop_folder.others`) is not applied: the screen says which brain reads it and asks again.
- Items 1 to 9 and 13 are on the screen in step 2; item 12 is shown there as "asked after your first check" and answered in step 8.
- **Item 12, step 8 (0.17.0, 0110 §8, §9).** The skill asks both slots in one message, with their defaults: `Run the weekly review on its own every Monday at 08:00, and a catch-up every day at 07:30? Keep them, change a time or a day, or say no to either.` A changed time or day is taken as said ("weekly on Fridays at 17:00"); a slot the user declines is `off`. It then:
  1. takes the **agent** setup is running in (Claude Code or Codex, §4's row) and offers its **model**: with Claude Code a Sonnet full id (`claude-sonnet-<current>`, 0093 §4), with Codex the model Codex is using, by its full name; the user may name another;
  2. offers, once each, what brain-catch-up's and brain-weekly-review's "Run on a schedule" sections offer: `settings.publish: auto` when `ask`, and with Claude Code the allow list (cli.md §5.21, weekly-review.md §11), then says the folder-trust step with Claude Code (`FOLDER_TRUST`);
  3. says in one line what the computer needs, by platform (cli.md §5.21's table): on macOS `Your Mac must be on (asleep is fine) and you logged in at these times; a run missed while it was off waits for the next one.`; on Windows `Your computer will be woken for these times; you must be logged in.`; and that the schedule runs on this computer only (one computer at a time);
  4. runs `brain schedule install <job> --at … [--days …] --agent <agent> --model <id>` for each kept slot (the first with `--agent` and `--model`), which writes `settings.schedule` (cli.md §5.21), and for a declined one, once the object exists, `brain schedule remove <job>` (its slot `off`). Both declined: `brain config set settings.schedule '"off"'`, as before 0.17.0.

  It logs `schedule result=done` when one slot or both are installed, `result=declined` when both are declined, and `result=failed reason=<code>` when an install fails (`AGENT_NOT_FOUND`, `BRAIN_NOT_GIT`, `SCHEDULE_NOT_LOADED` as `schedule-not-loaded`). Before 0.17.0, step 8 asked the catch-up only, through brain-catch-up's "Run on a schedule", and wrote `settings.schedule` `on`.
- The rest of the required items of 0078 §2 are steps, not values: the Notion MCP connection (step 3), the connection to the brain's databases (step 4), identities (step 5), the minutes prompt and Notion Brain Assistant (steps 4a, 4b). The screen lists them under "Still to do after this screen", one line each, so the user sees the whole setup once.
- **Optional means a value, not a skip** (0078 §2): `off` is recorded and never asked again; the user changes it by asking ("turn on markitdown").
- **Items 10 and 11 are not choices in early access** (0086 §3, 0097 §5): the screen shows them `on`, and a user asking to turn one off is told in one line that early access needs it, and nothing is written.
- **Item 12 on Windows** (0110 §9, amending 0097 §4): from 0.17.0 step 8 is offered on Windows as on macOS, installed as a Task Scheduler task (cli.md §5.21). From 0.15.2 to 0.16.x it was not offered on `win32`: the skill said that catch-ups and the weekly review run when the user asks for them, wrote `settings.schedule` `off` and logged `schedule result=declined reason=schedule-unsupported`; such a brain is offered step 8 once after the upgrade (cli.md §5.2).
- Item 8 is changed with the words shown ("back up: remind me"); the setting keeps its values `auto` and `remind` (schema §12).
- **Item 13, the response style** (0081): Standard writes `{ "preset": "standard" }`; Simple writes `{ "preset": "simple" }`; Custom asks the three dials in one message, each with its levels and what they do (schema §12, cli.md §5.3.1), and writes the three chosen values with no preset. With Custom chosen, the screen shows the three choices on the item's line. The new style applies from the next message of the setup, as it does after a change in chat.
- Applying the screen: set the Git identity (with the user's yes on the scope, global or this repository); create the backup; create the drop folder; write the two `AGENTS.md` lines (§4); `brain config set` each setting, `settings.markitdown` and `settings.gh` `on` among them; `brain modules on|off` each module change; commit; push. Then `brain log setup - step=settings result=done`.
- **Creating the backup** (0086 §3), always with `gh`, on the working branch (cli.md §5.2; a new brain has one branch):
  1. With no `origin`: `gh repo create <brain folder name> --private --source <brain folder> --push`. A failure (the name is taken, no network) is `remote-failed`: setup says which, offers another name, and stops at step 2 until it succeeds.
  2. With an `origin` already set, it is kept, and nothing is created.
  3. After the push that ends applying the screen (`git push -u origin <working branch>`, which creates `origin/<working branch>`): `git remote set-head origin <working branch>`, so `brain status` finds the working branch from `origin/HEAD` from then on (cli.md §5.2, `from: origin-head`). It writes only in `.git`, not a file of the brain.
  4. The privacy check: `gh repo view --json isPrivate` must say `true`. A public backup stops step 2 with `remote-public`, and setup offers, on a yes, `gh repo edit --visibility private --accept-visibility-change-consequences`; an `origin` `gh` can't read (another host, or no access) stops with `remote-failed`, since another host is 1.0's path.
- **Another Git host, the manual steps (1.0's path, 0086 §3; not offered in early access):** create an empty private repository (no README) on the host; copy the URL it shows (`https:` or `ssh`); in the brain folder, `git remote add origin <that URL>` and `git push -u origin HEAD`, which also needs a token or an SSH key for the host; then setup checks that `git remote get-url origin` has a URL and `git ls-remote origin` lists the branch, else `remote-failed`. The skill keeps these steps written and doesn't offer them before 1.0, whose opening grill decides how `gh` becomes optional again (0061).

### 7.1 Changing the response style later (0081 §5)

The user changes the style in any later session in the brain by asking, in their own words. The agent:
1. writes the change with `brain config set` (cli.md §5.3):
   - the whole style ("talk to me more simply", "go back to normal", "use Standard"): `settings.style` set to `{ "preset": "simple" }` or `{ "preset": "standard" }`, which clears every dial set before;
   - one dial ("shorter answers", "more detail", "explain less", "skip the jargon", "get to the point"): `settings.style.<dial>` set to that level (`'"short"'`), the other keys kept;
   - a request it can't map to one dial or preset gets one question with the choices, and nothing is written before the answer;
2. commits `brain.json` and `AGENTS.md` when they changed (`settings: response style`), and pushes per `settings.push`;
3. answers in one line, in the new style: what changed, and `Linked folders follow the next time brain link runs there, or brain upgrade for a linked project registered in the brain.` when the brain has linked repos or folders. A linked folder takes the change only when its block is written again (cli.md §5.3.1): by `brain link`, and from 0.13.0 by `brain upgrade` for a project in `brain.json` `repos`, since that upgrade writes what `brain link` would (0077 §4, CC-184).

The new style applies from the agent's next reply. A request made in a linked folder is not written there (the brain is read-only from it): the agent says to ask in a session in the brain. The always-on reply rules and working principles in the rules block (0081 §1, §2) are not part of the style and don't change with it.

## 8. Seeding (step 6; 0078 §3)

### 8.1 Describe, then one preview

1. **A quick map first** (added by the author, 2026-11-17; with Type gone, 0105 §3, a Domain's name and summary carry its meaning, so this is where the user learns them). Before its question, the skill gives one short message of at most 4 lines:
   - a **Domain** is a broad context of your life, such as your job, a side business or your personal life;
   - an **Area** is an ongoing responsibility inside a Domain, with no end date, such as Clients, Finances, Family or Health;
   - a **Project** has an outcome and an end, sits in an Area, such as "Website relaunch";
   - one invitation: name your Domains and Areas if you know them; otherwise the brain proposes them from what you say.

   The examples are generic and invented, never taken from a brain. The wording may vary; for example: "A quick map before you start: a Domain is a big part of your life, like your job, a side business or your personal life. An Area is something you look after inside it with no end date: Clients, Finances, Family, Health. A Project has a goal and an end, like 'Website relaunch', and sits in an Area. Name yours if you know them, or just tell me about your work and I'll propose them." Domains are still proposed only with two or more contexts (step 2): the map explains them, it doesn't add them.

   Then the skill asks the user to describe their work in a few sentences: what they do, for whom, with whom, and any other life context they want in the brain. Optionally, a folder or a repo to adopt (§8.4).
2. Through Ultimate Assistant's "tell it what's on your mind" flow ([assistant.md](assistant.md) §7, extended to Domains, Areas and People by CC-191), it proposes **one preview**, a numbered list in that flow's form:
   - **Domains,** only when the description has **two or more contexts** (work and personal, two businesses): name and summary (a one-line description of the context); no type (0105 §3: Domains have no Type since 0.16.1). With one context, none, and the Domains module stays off; with two or more, the preview says the Domains module will be turned on.
   - **Areas:** name, its Domain (when there are Domains), and its **What to track** list (§11).
   - **Projects:** name, Area, Status, a one-line purpose, the client org if any.
   - **Orgs** that a project's client or a person's org names.
   - **People: the 5 to 10** the user works with most, each with org and role, so the first meeting matches them instead of creating duplicates. Fewer than 5 named → the preview asks for more once; more than 10 → the 10 the user names first, and the rest offered as a later step.
   - **Key documents: 3 to 5,** which the user drops into the drop folder (§8.3).
3. The user answers as in assistant.md §7: "yes to all", "yes 1–7, 9", "4: Status On Hold", "drop 8". The preview is shown again after each change. **Nothing is written before the yes.**
4. Before showing an item, the skill matches it against the brain (titles and aliases, as assistant.md §7 "No second copy"); an existing note is shown as `already in the brain` and not created again. So seeding run again (resume) never duplicates.

### 8.2 The writes, after the yes

- **The description is a source.** The user's description and the preview's answers, verbatim, are kept as one owner-ruling source note (0031, as brain-connect-notion's identities step does): `title` `Setup: my work (owner ruling)`, `source_key` `agent:<agent>/<date>-setup-seeding`. Every seeded note lists it in `sources`, and each role is a `facts.role` with a timeline entry citing it (schema §5).
- **Order:** Orgs, Domains (and `brain modules on domains` when there are any), Areas, Projects, People, so each relation names an existing id. Each with `brain note new`; `lifecycle: reviewed` for Domains, Areas, Projects and Orgs (0070). People are written `draft`, like every new person (cli.md §5.5): they are published as Draft, so the first meeting matches them, and the user marks them Reviewed in Notion when they like (the user's choice of 2026-11-11, asked through the coordinator during CC-191).
- Then `brain index`, `brain views`, `brain lint`, one commit (`setup: seed my work`), and **one publish** of every seeded note (`brain sync render --ids …`, the MCP, `brain sync record`, commit): the preview's yes covers this publish, whatever `settings.publish` says.
- **Home in a duplicate of the template (0.18.0, 0113 §10).** The template's Home holds the tabs of both cases (docs/notion-space-design.md §5), so seeding's report ends with one by-hand line. Domains on: "On Home, delete the tabs Areas and Projects: your Domains tab replaces them." Domains off: "On Home, ignore or delete the Domains tab." "Turn on domains" later says the first line too, when Home has those tabs. Nothing checks it.
- `brain log setup - step=seeding result=done notes=<n> documents=<n>`.

### 8.3 Key documents

The user drops 3 to 5 key documents into the drop folder, and the skill runs the ingest on the drop folder with **Keep as document** for each (the ingest's existing drop-folder flow): each becomes a Document (`reference` note), placed under its Area and Project from the preview. **What the brain reads from them** (decisions, questions, people, tasks) **is decided in the setup session like any attended ingest** (0078 §3, capture-and-review §7.3): one preview and one yes per file, then that file's questions, at most five a round (capture-and-review §7.5). The user's first decisions are on their own material. An item the user leaves for later stays a pending proposal and is asked in a later session.

### 8.4 A folder or a repo

A folder or repo the user points to is adopted through 0.9.0's project adoption (brain-workflow-adopt; connected-workflows.md), with its own preview and yes. Its project joins the seeding preview's Projects as `adopted: <name>`.

## 9. The template version (0078 §1, choice 4)

- **Format:** the four-digit number of the last migration in `notion/migrations/` that the template includes, as a string: `"0024"`. The template shows it as `Template version: 0024`, a line of its own in the **System callout** on the top page "Ultimate Brain" (CC-189; decision 0085: in the template, System is that callout, holding the links to Brain Data, Archive, How it works and Skills, not a page), and `notion/TEMPLATE.md` records it.
- **Stored** by brain-connect-notion at step 4: it reads the text of the space's top page (the page the user duplicated, "Ultimate Brain": Brain Data's topmost parent page) through the MCP, including the blocks inside its callouts, for the line `Template version: NNNN` (four digits). **Matching a line:** each block's text is split at its line breaks, so the line counts whether it is a block of its own or one line within a block of the callout (in the template it follows a line break in the callout's text block); the surrounding whitespace and the backticks of inline-code formatting around the line are removed (`` `Template version: 0024` `` and `Template version: 0024` read alike); what is left must be exactly `Template version: ` followed by four digits, nothing before or after. Found, it runs `brain config set notion.template_version '"0024"'`. A space without the line (built from the prompts, or before 0.14.0) leaves the key absent: the version is **unknown**, never guessed.
- **Kept current** (brain-notion-change, CC-191): when a migration is applied to the space, the skill sets `notion.template_version` to that migration's number if it is higher, and the migration's last step updates that line in the System callout.
- **Named by `brain upgrade`** (cli.md §5.15): the migrations of the installed package with a higher number; with the version unknown, upgrade says so and names none.

## 10. First value (step 7; 0078 §5)

Every user's setup ends with the three checks of 0078 §5, **on a seeded document and a report on the user's main project, with no meeting needed**, and a fourth that walks the loop the brain is for: capture, review, a cited answer (0061's "fresh-user first capture, review and cited answer"; CC-213). The fourth adds to the three and replaces none. The skill runs each, shows its evidence, and asks the user to judge the parts only they can ("are these your commitments?"):

| Check | Key | What is done | Passes when |
|---|---|---|---|
| **Correct tasks** | `tasks` | the tasks the ingest created from one seeded document (§8.3; Tasks on), shown with their Project and Due | the tasks created are exactly the owner's own commitments in that document, with the right Project and due date, and none of someone else's; the user confirms |
| **A report** | `report` | the user asks "report on <main project>" (brain-query report mode) | the report lands in Documents, linked from the project, citing the seeded document |
| **The information organised** | `organised` | the skill lists each note the seeding and the document's ingest wrote, under its Area and Project | each note sits under the Area and Project the user expects, and no person appears twice; the user confirms |
| **A cited answer** | `answer` | the user says yes to one item the ingest read from a seeded document, on that document's preview or in its questions (§8.3, capture-and-review §7.3), and it is taken in; then the user asks one question about it that they would really ask, and the agent answers (brain-query), showing the answer and the source passage it cites | the answer rests on the applied item and cites the seeded document; the user confirms that the answer is useful and that the passage supports it |

A published report that cites a document does not by itself show a useful, supported answer: that is the fourth check's job.

**An attempt is not a pass.** Running the checks records an attempt: one `first-value` line (§4.1), written when the attempt's checks are done or the user stops, with each check's own outcome:
- `pass`: the check passed, and the user confirmed what only they can judge.
- `fail`: it ran and something was wrong; the skill names what ("this task is someone else's commitment", "the person appears twice").
- `unsuitable`: the material can't show it: no seeded document holds a commitment of the owner, there is no main project to report on, a seeded document yields no item to take in, or no useful question can be answered from the item taken in. The skill says why. **It never invents** a commitment, a proposal, an item or an answer to pass a check.
- `skip`: `tasks` only, with the Tasks module off (the user turned it off on the screen). It is shown as `skipped (Tasks off)`, never as a pass.
- A check not run in this attempt (the user stopped first) is left out of the line.

**First value passes** only when every applicable check passes: `report`, `organised` and `answer` are `pass`, and `tasks` is `pass` or, while Tasks is off, `skip`. The line is then `result=done`: `brain log setup - step=first-value result=done tasks=pass report=pass organised=pass answer=pass`. Otherwise first value is **unresolved**, and the line is `result=failed` with the checks as they stand: `brain log setup - step=first-value result=failed reason=first-value-unresolved tasks=pass report=pass organised=fail answer=unsuitable`.

- **Unresolved, setup stops at step 7**, as it does at a required item (§2). The skill shows one line per check not passed: what failed or could not be shown, the smallest next action (move a note under its Area, choose another document that holds one of your commitments, say yes to one item in the session) and how to resume (say "set up my brain" again). The schedule (step 8) is not offered, and no `finished` line is written.
- **Resume** (§3) runs only the checks not passed and carries the passed ones into the new line unchanged, unless the material or the Tasks module changed (§3 step 3). The user can ask for any check again ("check the report again"). After the user's fix, the attempt that passes every applicable check is `result=done`, and setup goes on to step 8.
- **The setup report** can be shown at any point (§12), also while first value is unresolved. Showing or filing it marks nothing done and unlocks nothing: only a passing `first-value` line lets step 8 be offered.
- **The release gate** (CC-193) runs the same four checks on a synthetic persona with one meeting, in a clean duplicate of the template; its record names the reviewed item, the question, the answer and its supporting passage. It is CC-193's contract, not the skill's.

### 10.1 The first meeting (0078 §5, 0079)

The first meeting is checked later. **The first catch-up that ingests a Ready meeting after step 7** (brain-catch-up, CC-191) adds one line to its report, and logs `setup - step=first-meeting result=done`, so it is said once:

```text
First meeting in: 3 tasks for you (1 from a quick follow-up), 4 notes, 2 people matched, 0 new people. Anything wrong? Say "that's wrong: …".
```

- Counted from that meeting's ingest: the owner's Tasks created, of which the quick follow-ups that became Tasks (0079 §4); notes written; attendees matched to existing people and new person notes.
- "First" is read from the log: `first-value` recorded as done (§5: its latest `setup` line with `step=first-value` passes) and no line with `step=first-meeting`. A `first-value` line from an unresolved attempt (`result=failed`, or a check not passed) does not count, so a catch-up while first value is unresolved shows nothing. A brain with no `setup` line never shows it.

## 11. Minimal per-area tracking preferences (0061, choice 1)

- **What:** an optional `track` list on an area note (schema §4): 1 to 8 short lowercase phrases naming the kinds of thing worth extracting in that Area (`[budget, deadlines, scope changes, risks]`). Absent means the generic list, as today.
- **Set** in the seeding preview (each Area shows `What to track: …`, proposed from the description, changed like any preview value), and later by asking the agent ("in Clients, also track renewals"), which writes it as a proposal applied in chat (assistant.md §6.2's yes).
- **Used** by the ingest when it chooses what to extract from an input placed in that Area: items matching a tracked kind are favoured within the budget, and the generic kinds still apply. It changes no schema type, no gate (a tracked kind still passes the decision gate to become a decision) and no rule of what is asked (capture-and-review §7.2).
- **Not in 0.14.0:** a Notion property for it, per-Domain or per-Project lists, and any effect on Ultimate Assistant: its thresholds stay fixed (0072 §3, assistant.md §3.2).

## 12. The setup report (0078 §6)

At the end (and when the user asks "show my setup report", at any point, also while first value is unresolved, §10), the skill writes the report and shows it **whole**, then asks: "Send this to the product as a `beta-setup` issue, to help fix setup? The issue is public and appears under your GitHub name. Nothing else is sent." It files **only after a yes**: with `settings.gh` `on`, `gh issue create --repo <product repository> --label beta-setup --title "Setup report: <CLI version>, <agent>" --body <report>`; with `gh` off (a brain set up before 0.14.0; setup itself always records `on`, §7), it gives the text and the repository's new-issue link for the user to paste. The product repository is the one named by the `repository` field of `<product.path>/package.json` (added by CC-192). No telemetry: nothing is sent any other way.

### 12.1 Fields (no names, no content)

```text
Ultimate Brain setup report
CLI 0.14.0 · skills ultimate-brain-skills 1.4.0 · agent Claude Code · platform darwin
Notion credits: yes · meetings: notion-ai, files · modules: orgs, documents, reports, tasks
Time: 52 min (first setup line to the last)
1 prerequisites: done
2 settings: done (markitdown on, gh on)
3 notion-mcp: failed once (notion-unreachable), then done
4 connect: done (template 0024, 15 examples removed)
4a minutes-prompt: failed once (shape-wrong), then done
4b brain-assistant: done (custom agent, mentions pass, buttons 3 of 3)
5 identities: done
6 seeding: done (14 notes, 4 documents)
7 first value: passed on attempt 2 · tasks pass · report pass · organised pass · answer pass
8 schedule: weekly review Mon 08:00 · catch-up 07:30 · Claude Code
```

- From the `setup` log lines (§4.1), `brain status` and the agent's own name; counts and codes only. The plan line shows §13's answers (`Notion credits: yes|no · meetings: <list>`); a `prerequisites` line from before 0.17.0 shows `Notion AI: yes|no · Custom Agents: yes|no` as before. A step that the answers leave out shows `not taken (no Notion credits)` or `not taken (meetings without Notion AI)`.
- Step 4b, from 0.16.1: the agent kind (`custom agent` or `personal instructions`), `mentions <pass|fail>`, and `buttons <passed> of <applicable>` (`buttons skipped` with personal Instructions); a line recorded before 0.16.1 shows the agent kind alone.
- Step 7 is `passed on attempt <n>` or `unresolved after <n> attempts`, counting its `first-value` lines, then each check from the latest line (`not run` for a check left out, `skip (Tasks off)`). While first value is unresolved, step 8 is `not offered (first value unresolved)`.
- **Never:** a person, org, project, area or document name, a path, a Notion id or URL, an email, the user's words, an error message as printed (only its code, §12.2). The skill checks the text against the brain's titles and aliases before showing it, and drops any line that matches one.

### 12.2 Reason codes

`missing-prerequisite`, `gh-missing` (`gh` not installed, §6.1), `gh-signed-out` (`gh auth status --hostname github.com` fails, §6.1), `markitdown-missing` (`markitdown --version` fails, §6.1; 0097), `schedule-unsupported` (step 8 on `win32`, with `result=declined`, §7; 0097; written from 0.15.2 to 0.16.x only), `schedule-not-loaded` (step 8: the scheduler refused the entry, `SCHEDULE_NOT_LOADED`, cli.md §5.21; 0.17.0), `notion-ai-missing` (before 0.17.0 only: from 0.17.0 Notion AI is optional and setup asks §13's two questions instead), `notion-unreachable`, `brain-data-not-found`, `database-missing`, `shape-wrong` (minutes), `transcript-missing` (the test page has minutes but no transcript, §6.3), `assistant-reads-outside` (Notion Brain Assistant), `assistant-missing` (no Notion Brain Assistant created yet, §6.4), `mentions-outside` (a mention in a skill page opens a page outside the user's copy, §6.4), `button-unbound` (a button check failed, §6.4), `samples-left` (a button check's sample page not moved to the trash, §6.4), `remote-failed`, `remote-public` (the backup is a public repository, §7), `push-failed`, `user-stopped`, `examples-left` (the template's Example rows not removed, §6.5), `first-value-unresolved` (first value, §10), and a CLI error code (cli.md §3.5) when a command failed.

## 13. Two questions: Notion credits and your meetings (0.17.0, 0101 §7, §8.6; replaces 0078 §6's path)

Notion AI is optional from 0.17.0 (0106 §4, reading 0101 §8's "1.0" as 0.17.0). Step 1 asks two questions, after the prerequisites list and in this order, since the Notion API can't read a plan:

1. **"Do you have Notion's Business or Enterprise plan with Notion credits?"** (yes / no / not sure). The question links Notion's help page on credits, the one the Start here callout links (0101 §7). "Not sure" is answered as no, and the skill says how to check (Settings → Billing in Notion) and that the user can ask setup later to ask the two questions again.
2. **"Where do your meeting transcripts come from?"** (several allowed): **Notion AI meeting notes** (`notion-ai`); **another tool** that writes into Meetings, through its Notion integration or an automation (`tool`); **pasting** a transcript or minutes on a meeting page (`paste`); **files** in the drop folder (`files`). All four are offered whatever question 1's answer (a Business plan without credits still has Notion AI meeting notes); nothing checks the answer: step 4a's check does.

Both answers are logged on the `prerequisites` line (§4.1: `credits=yes|no meetings=<list>`), and nothing else records them: no `brain.json` key, no Notion change. What each answer installs or leaves out:

| Answer | Installs | Leaves out |
|---|---|---|
| Credits: yes | step 4b, Notion Brain Assistant as a Custom Agent with its three buttons (§6.4) | — |
| Credits: no | nothing | step 4b; the personal-Instructions path is not installed. **The buttons' line**, said once on the settings screen and in the setup report: "Tidy capture, Write up and Refresh report message Notion Brain Assistant, so they do nothing on your plan. Ask me instead: "tidy that capture", "write up this document", "refresh this report"." The Notion Brain Assistant skills run from the session (assistant.md §13) |
| Meetings include `notion-ai` | step 4a, the minutes prompt walked through and checked in the Notion AI chat (§6.3) | — |
| Meetings without `notion-ai` | nothing | step 4a. The minutes come from the agent (capture-and-review §3.4.2), or from the prompt run in another tool: with `tool`, the skill gives the prompt's text and the guide for other tools (`<product.path>/docs/meetings-from-other-tools.md`, CC-329), unchecked and not a step; with `files`, it says where transcript files go (the drop folder's `meetings/`, capture-and-review §3.4.3) |

- **The count.** `brain status` counts 7 required items, plus `minutes-prompt` when `meetings` holds `notion-ai`, plus `brain-assistant` when `credits=yes` (cli.md §5.2); `next` skips a step the answers leave out. A `prerequisites` line from before 0.17.0 (no `credits` key) is read as before: 7 with `notion_ai=no`, else 9.
- **Changing an answer later.** The latest `prerequisites` line counts. A step newly taken (credits now yes) is next; a step newly left out stays recorded but no longer counts. Nothing installed in Notion is removed by setup.
- **Meetings without Notion AI** work as capture-and-review §3.4.1 says: any tool's transcript or minutes, the agent's minutes for a transcript with none, and a summary not in the format taken in whole.
- **How-to questions** go to the agent (brain-howto), with or without Notion Brain Assistant.

## 14. Out of scope (0078)

An interactive `brain init`; a new diagnostic command (status's `setup` block and the skill's checks are the diagnostics); telemetry; anything in the brain made from an Example row (0084, 0087: the template's Example rows, a meeting among them (and a Review row before 0.16.0), are removed at step 4 and skipped by the skills, §6.5; §6.3's sample text lives in the skill and is deleted after the check); rich profiles and specialised types (0030); the template gallery and the acquisition funnel (1.0); how the template link reaches testers, the npm channel and the number of testers (1.0's opening grill); any operation on the user's brain or Notion workspace without an explicit yes. From 0081: the style changing text a command returns (post-1.0), a style per skill or per agent, and a style switched on per session. From 0086: Git hosts other than GitHub in early access (§7's manual steps are 1.0's); a brain used from two machines (pulling before a push, or merging a backup that moved, `docs/v2-ideas.md`); any automatic merge of diverged histories; the product repository's own pull requests (0040, 0073).

## 15. The backup, and "fix my backup" (0086 §2, §4)

### 15.1 What the user reads

The remote is **the backup** in everything a user reads: the settings screen (§7, items 3 and 8), setup's messages, and the last line of a run's report (a skill's, or setup's own). Git words (`origin`, push, branch, commit, merge) appear only when the user asks for the details ("what happened exactly?"), and then with Git's own message.

The last line of a report, by what happened after the run's last commit:

| Situation | Last line |
|---|---|
| `settings.push` `auto`, the push succeeded | none about the backup (nothing to do) |
| `settings.push` `remind` | `<n> changes not backed up yet (Back up after each run: remind me).` |
| a push that failed | `Not backed up: <reason>. Say "fix my backup".` |
| an unattended run that stopped off the working branch (cli.md §6.1) | `Not run: off-working-branch. The brain is not on its working branch; say "fix my backup" in a session in the brain.` (in the scheduler's log) |

`<n>` is `git rev-list --count @{u}..HEAD`, or every commit when there is no upstream. `<reason>` is the first of these that matches the failure, in these words:

| The failure | `<reason>` |
|---|---|
| no `origin` (`git remote get-url origin` fails) | `no backup is set up` |
| `HEAD` not on the working branch (`brain status`'s warning `BRAIN_OFF_WORKING_BRANCH`, cli.md §5.2) | `the brain is not on its working branch` |
| Git refuses the push because the backup has commits this copy lacks (`rejected`, `non-fast-forward` or `fetch first`) | `your backup has changes this copy doesn't have` |
| an authentication failure (`Authentication failed`, `Permission denied`, HTTP 401 or 403) | `GitHub sign-in needed` |
| a network failure (`Could not resolve host`, `unable to access`, a timeout) | `GitHub can't be reached; check your connection` |
| anything else | `the push failed` |

### 15.2 "Fix my backup"

The user says **"fix my backup"** (or the session offers it, after `brain status`'s warning `BRAIN_OFF_WORKING_BRANCH` or a failed push), in a session in the brain. The skill runs the checks below **in this order**. A check that passes goes on to the next. A check that fails is fixed on the user's yes, when the skill can fix it, and checked again; when only the user can fix it, or the user says no, the skill gives the one step the user must take and **stops there**, with nothing after it run. Every message uses §15.1's words. Nothing is ever done through a pull request or on GitHub's website.

| # | Check | Passes when | On a yes, the skill fixes it by | Or the one step for the user |
|---|---|---|---|---|
| 1 | `gh` signed in | `gh --version` and `gh auth status --hostname github.com` succeed | — | §6.1's two steps (install, then `gh auth login` letting it set up Git's credentials), then "fix my backup" again |
| 2 | The backup is set up | `git remote get-url origin` has a URL | `gh repo create <brain folder name> --private --source <brain folder> --remote origin`, without `--push`: the push waits for check 5, so no branch is pushed before check 4 | on `remote-failed`: the reason, and another name to try |
| 3 | The backup is private | `gh repo view --json isPrivate` says `true` | `gh repo edit --visibility private --accept-visibility-change-consequences` | when `gh` can't read it (another host, no access): "Your backup isn't a GitHub repository I can check: make sure it is private." The skill goes on only once the user says it is |
| 4 | The brain is on its working branch | `brain status`'s `branch` is non-null, with `working` non-null, `on_working` `true` and `unmerged` empty (no warning `BRAIN_OFF_WORKING_BRANCH`) | bringing the work back, below | below |
| 5 | A push | `git push` (`git push -u origin <working>` when the branch has no upstream) succeeds, or there is nothing to push | — (any failure is named, below) | below |

**Check 4, bringing the work back locally** (0086 §2), after one yes for the whole of it, which names what will happen ("Your work on add-notes, 2 changes, will be brought back into your brain's main copy, and add-notes removed."):
1. **Uncommitted changes** (`git status --porcelain` non-empty) stop it before anything changes: the files are named, and the step for the user is to say whether to keep them (the skill commits them, `backup: keep uncommitted changes`, on the branch they are on) or not (the user discards them; the skill never discards).
2. **`working` `null`**: one question, listing the local branches, "Which of these is your brain?"; the answer becomes the working branch: `git push -u origin <it>`, then `git remote set-head origin <it>`, and `brain status` is run again.
3. **Off the working branch:** remember `HEAD` (the branch, or the commit when detached), then `git switch <working>`. A branch checked out in another worktree of the brain stops it: the worktree's path is named, and the step for the user is to close what runs there; the skill then runs `git worktree remove <path>` on a yes, only when that worktree has no uncommitted change.
4. **Each `unmerged` entry, in its order** (the detached `HEAD`'s commits first, by the commit remembered): `git merge --no-edit <branch or commit>`, then, for a branch, `git branch -d <branch>`. A branch already merged and left (not in `unmerged`) is not touched.
5. **A conflict** stops it: `git merge --abort`, the conflicting files named (`git diff --name-only --diff-filter=U`, read before the abort), and nothing pushed; the brain stays on its working branch, with the branches merged so far. The step for the user: "Two changes touch the same lines in <files>. Tell me which to keep, or fix them in your editor, then say "fix my backup" again."
6. `brain status` again: check 4 passes when the warning is gone.

**Check 5, the push:** a push Git refuses because the backup has commits this copy lacks is **named and not merged** (0086 §4, Out of scope): "Your backup has changes this copy doesn't have, from another machine or from GitHub's website. I haven't merged them: nothing was lost on either side." Nothing is pulled, merged or forced. Any other failure gives §15.1's `<reason>` and its step (sign in again with `gh auth login`; check the connection). After a push that succeeds, `git remote set-head origin <working>` runs when `git symbolic-ref --quiet refs/remotes/origin/HEAD` fails or names another branch, so `brain status` finds the working branch from then on (cli.md §5.2).

**The end:** one line, `Backup fixed: <n> changes backed up.` (or `Backup checked: nothing to fix.`), plus the details on request. "Fix my backup" writes no log line and no `setup` line: it is not a setup step, and Git's history holds what it did.
