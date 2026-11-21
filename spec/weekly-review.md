# The weekly review (contract, decisions 0075, 0093 and 0096)

**Status:** contract for release 0.15.0 (CC-111). Written by Claude Code. It is built by CC-253 (the CLI), CC-254 (correction checks), CC-255 (the skill and the schedule offer) and CC-256 (Weekly review in Notion), and tried in the author's brain by U-29. **Since 0.16.0 (decision [0096](../decisions/0096-one-place-to-decide.md), CC-295; built by CC-297):** the report is published as one Inbox row per week, Kind Weekly, not a Documents row; its decisions are made in the Claude Code or Codex session (capture-and-review §7.5), not in Review rows; the Reports offer is retired; and Weekly review in Notion reads the week's row and decides nothing (§13; from 0.17.0 it sets a task's Status or Due after the user's answer, 0101 §3). `spec/schemas/weekly.schema.json` (`lives: "session"`, the record input's `publish`) follows in CC-297. Reports published as Documents rows in 0.15.x stay as they are, as history. **Since 0.17.0 (decision [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md), CC-368; built by CC-370, the CLI, CC-371, the skills, and CC-372, Notion and the guides; tried by U-43):** the row has two parts, Your week and Clean-up (§3); the run applies a closed list of mechanical items alone, each in its own commit with its undo (§15.2, §15.3); its Actions and doubtful items are decided by ticks in Notion and applied by a catch-up once the row is Ready (§15.4); the rest stays in the session, counted under Waiting for you (§6.1); and the schedule is kept in `brain.json`, on macOS and Windows (§11). The numbers in §12 come from the resource-budget trials, run read-only in the author's brain (0075 §7, 0093 §4, §6).

How this file fits: it holds the whole weekly review. That covers what a run reads, the report and its identity, its two parts (three sections before 0.17.0), the change window and coverage, the two shared limits, repetition and dismissals, the correction queue and its claim groups, budgets and partial runs, delivery, the schedule, Brain Assistant's Weekly review skill, the acceptance scenarios, and the clean-up with your ticks (§15). It reuses what exists. Ultimate Assistant's findings ([assistant.md](assistant.md) §3, cli.md §5.31) are the work stream. `brain reflect --candidates` (cli.md §5.32, §6.2) is the knowledge stream, the only scheduled reflection (0076 §5). Proposals (schema §11, cli.md §5.6) and their questions in the session (capture-and-review §7.5), the Inbox (docs/notion-space-design.md §3.11) and `brain schedule` (cli.md §5.21) are used as they are. The command surface (`brain weekly`) is cli.md §5.34, and the clean-up's (`brain cleanup`) cli.md §5.38; the fields are in schema §2, §4 view, §11 and §12.

**Decisions:** [0075](../decisions/0075-weekly-review-and-targeted-corrections.md) (binding, all of it), [0093](../decisions/0093-the-0-15-0-scope-grill.md) (the Weekly review entry point, Sonnet by default, the trials in the author's brain; its Reports offer is retired by 0096), [0051](../decisions/0051-unattended-catch-up-and-schedules.md) (unattended runs, the no-op rule, a schedule pins a model), [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) and [0072](../decisions/0072-ultimate-assistant.md) (the assistant's findings, dismissals), [0076](../decisions/0076-reflection-chat-first.md) (reflection's skips and holds), [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) (its 800-token budget is separate), [0048](../decisions/0048-modules-and-simpler-rows.md) (modules), [0090](../decisions/0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) (the grill style, kept for the session's rounds), [0096](../decisions/0096-one-place-to-decide.md) (decisions in the session; the Inbox row; the Reports offer retired), [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) (binding, §1 to §10: the two parts, the clean-up, ticks then Ready, the carry-over, the schedule in `brain.json`, macOS and Windows).

**Calls taken in this contract that the user may veto** (each the simplest reading of 0075, 0093 and, from item 9, 0110; none contradicts their rules, and item 8 departs only from 0093 §2's wording):
1. **One new skill, `brain-weekly-review`** (written in the fork, delivered in the pinned snapshot). It runs the assistant's and reflection's deterministic halves itself, so neither skill gains an unattended mode (§1).
2. **A week is the ISO week of the run's local date.** The Monday 08:00 run opens the new week's report, and its What changed covers the week before (§2).
3. **The report is a new view kind, `weekly_review`,** in `reports/`, published as one Inbox row per week, Kind Weekly (§2, §9.3; a Documents row with Origin Report before 0.16.0). It is not a `report`, because it doesn't have the six sections of schema §16.4.
4. **Run state lives in `_weekly/state.json`.** It is JSON, not a note, like `_assistant/dismissals.json`. It holds coverage, what earlier reports showed, and the correction queue's cursor (§4, §7, §8). The queue itself is read from the Git record, so `brain apply` and `sync apply` gain no new step.
5. **A body-line correction is a new change kind, `replace_line`.** It replaces one exact line of a brain-owned body and is stale when that line changed. No existing kind can change a restatement in a project's or a person's prose (§8.3).
6. **A decision item is a proposal or a task** (0093 §2: "decided where it lives"; from 0.17.0 §6.1's table says where each item is decided). A proposal is decided in the session (capture-and-review §7.5). An overdue or stalled task that has no recommendation with a value is a task item: the user sets it in Notion, and no proposal is written (§6.1).
7. **The normal brief is at most 450 words**, links and the header excluded (from 0.17.0, Your week's prose and lines, §3.3). That is the two-minute reading target at about 200 words a minute (0075 §1), and it is checked in the acceptance (§14).
8. **"Run Weekly review", not `/Weekly review`** (a deviation from 0093 §2's words, not its rule): since CC-260 a Notion Custom Agent doesn't run a skill typed as a `/` command, so the way in is asking Brain Assistant for the Weekly review skill by name (§13). The behaviour 0093 §2 decides is unchanged.
9. **Already cleaned's undo is a tick too** (0.17.0): each line is a `U` to-do, and a tick then Ready undoes it, so the undo 0110 §3 requires can be asked from Notion as well as in the session (§15.3).
10. **Actions take a Your note line** like doubtful items (0110 §2 names it for the clean-up): it is how a new task's words are changed before the tick is applied (§3.3, §15.4).
11. **Actions carry over with the clean-up** (0110 §5 names the clean-up): a row never set Ready moves both, so a finding held by §7's repetition rule isn't lost (§15.6).
12. **At most 20 mechanical items a run**, the rest next week, so a first run on an untidy brain makes a reviewable number of commits (§15.2).
13. **A contradiction counts one target** in T with the correction groups (§5): 0110 keeps the five-target limit for groups and sets no other limit on what goes to the session.

---

## 1. A run

Two prompts start the skill `brain-weekly-review`:
- **`weekly review`**: attended. The user asks for it, or a schedule isn't set. The report comes first in the chat. The run then writes it as §9 says and ends. A weekly run decides nothing, attended or not (0075 §6): from 0.17.0 it applies only the mechanical items of §15.2, alone. Its Actions and doubtful items are decided by ticks in the week's row, then Ready (§15.4); its session items with "what needs my decision" (capture-and-review §7.5), which may follow at once in the same chat; a task's own date or status is set on the task in Notion. An attended run that the user follows with "yes C2" is told to tick it in the row and set the row Ready, or that the item is the session's.
- **`weekly review unattended`**: the schedule's prompt (§11). It asks no questions.

Both modes run the same steps and write the same things. The one difference is that an attended run shows the report in the chat (Your week, then Clean-up) and may ask "publish now?" under `settings.publish: ask`, as attended catch-up does.

**Steps** (normative order):
1. **Preconditions.** `brain status --json`. Off the working branch, the run stops as unattended catch-up does (cli.md §6.1, 0086 §2): it writes nothing, and its last line is `Not run: off-working-branch. …`.
2. **Read Notion live** into the assistant snapshot (assistant.md §2.1), saving the MCP results to files and reading them with `jq` rather than into the context (§12), and write the snapshot with the file-writing tool to the `weekly_snapshot` path of `brain status` (cli.md §5.34: outside the brain, one per brain, overwritten each run). Notion unreachable means brain only (assistant.md §2.3), and that is a **failure** for this run (§9.4). It is not a reason to stop.
3. **Candidates** (deterministic, no model judgment): `brain weekly plan --snapshot <file>` (cli.md §5.34). It saves the plan as a hand-off file next to the snapshot and prints a short summary (`week`, `quiet`, `input_hash`, the file's path and counts); the skill reads the file in parts with its file-reading tool, never as command output (a large brain's plan is far above the 30k Bash output limit, and a scheduled run's allow list can't read Claude Code's saved outputs back). The plan holds the week, the window, the What changed candidates (§4), the assistant findings (`brain assistant findings`' rules, every finding, not a page of 10), the reflection clusters (`brain reflect --candidates`' rules), the correction queue (§8), the repetition state of each candidate (§7), the pending proposals it already has, from 0.17.0 the mechanical items (`cleanup`, §15.2), the earlier rows' items to carry (§15.6) and the snapshot's Done this week, and `quiet`.
4. **Quiet?** When `quiet` is true and step 2 didn't fail, the run stops: **no report, no commit, no Notion call after the reads, no log line, no state write** (0075 §5, 0051). §9.1 defines quiet.
5. **Attempt marker.** The run writes `_weekly/attempt.json` (§9.5), which is gitignored. It marks the first write that isn't a no-op, so a run killed after this point can be seen.
5a. **Clean** (0.17.0, 0110 §3): with `settings.cleanup.auto` on, `brain cleanup apply` (cli.md §5.38) applies the plan's mechanical items alone, each in its own commit with its undo (§15.2), and returns what it applied; the skill commits nothing of its own before it (the tree is clean). With `auto` off this step is skipped, and the items are offered at step 7.
6. **Judge** (the model's work, within the budget of §12): the reflection clusters in rank order, as cli.md §6.2 step 2 judges them, and the correction targets of the queue (§8.2). The deadline is checked before each cluster or target. When the budget runs out, the run stops judging and goes on to step 7 with what it has; the run is then **partial** (§10).
7. **Select** (deterministic): `brain weekly select --input <judged>`, the input naming the plan by its `input_hash` (no copy of the plan), applies the limits (§5), repetition and dismissals (§7), and the priority order. It returns the row's items (Actions, doubtful items, session items, §6.1), the queued remainder and the counts, and saves them as a second hand-off file.
8. **Write the proposals** for new items (§6.2): `brain proposal new`, all `pending`, nothing applied; a carried item's proposal gets this week in `weekly` (§15.6).
9. **Write the report**: the skill writes Your week's prose (In short, the Highlights, Focus first's reasons) from step 3's candidates (§3). `brain weekly record --input`, naming the plan by its `input_hash` and carrying only the proposals, the prose and step 5a's result, reads the two hand-off files, renders the rest (Done this week, Actions, Waiting for you, Already cleaned, For you to tick) from steps 5a and 7, checks the shape (§3.3), writes the report (§2), updates `_weekly/state.json`, logs, and removes the hand-off files. Then `brain index`, `brain views`, `brain lint`, and a commit of exactly the paths written.
10. **Publish** (§9.3): the week's Inbox row, Kind Weekly, with the ticks and notes it already has (§15.7), and an earlier row whose items moved (§15.6). Then `brain sync record`, commit, push per `settings.push`, and remove the attempt marker. No proposal is published (capture-and-review §7.1).

**It never:** applies a proposal, including one the user already approved or ticked (that is catch-up's job, 0075 §6, §15.4), except the mechanical items of §15.2 it applies alone; reads or applies a tick; runs catch-up or ingests an input; writes a Notion-owned field; asks a question unattended; or starts a research agent or a sub-agent (0075 §7).

## 2. Identity: one report per week

- **The week** is the ISO 8601 week (`2026-W46`) of the run's **local date**: the date in the machine's time zone when step 2 starts (`as_of` stays UTC, as everywhere). The schedule runs on Monday at 08:00 local (§11), so a scheduled run always opens a new week.
- **The file** is `reports/<Monday of the week, YYYY-MM-DD>-weekly-review.md`, for example `reports/2026-11-09-weekly-review.md`. A `view` with `view_kind: weekly_review` (schema §4 view): its `title` is `Weekly review · <D Mon>–<D Mon YYYY>` (the Monday and Sunday of the week; `Weekly review · 9–15 Nov 2026`, or `30 Nov–6 Dec 2026` across a month).
- **A rerun in the same week updates that file in place, and its row keeps your ticks and notes** (0110 §1, §15.7), as a report refresh does (schema §16.4, "Refreshing"). It gets new sections, `generated_at`, `generated_from`, `window.to` and coverage. The path, id, `week`, `window.from` and `notion` (its Inbox row) stay the same. Git keeps each version. A new week gets a new file, so past reviews stay browsable (0075 §5). There is one file per week, never one living file for every week. An earlier week's file changes once more only when its items move to a later week (§15.6).
- **Frontmatter** (schema §4 view, the `weekly_review` rows): `week`, `window` `{ from, to }` (timestamps, §4), `coverage` (`complete` or `partial`), `omitted` `{ clusters, correction_targets }` (§10), `counts` (from 0.17.0 `{ actions, doubtful, cleaned, targets, queued }`, §5; `{ decisions, new_items, targets, queued }` in a report written before, which stays valid), `generated_from`, `generated_at`, `notion`, `last_synced`, `notion_published`.
- **What a weekly review is not:** it is never evidence (lint rejects a note that cites it), never a proposal target, and never reviewed. It has no Lifecycle, as a report has none (schema §4 view). It has no Refresh asked and no What to fix, and a rerun is the refresh.
- **Its Inbox row** (0096 §7): one per ISO week, **Kind Weekly**, Name `Week of <D Mon YYYY>` (the Monday: `Week of 9 Nov 2026`), Brain ID = the view's id, the body = the report as `sync render` renders it (§3, §15.5). A rerun in the same week updates that row, never adds one, and keeps its ticks, notes and Brain Status (§15.7). It is **never taken in as an input**: catch-up takes only Ready rows of the kinds it ingests, never a Weekly or Catch-up row; from 0.17.0 a catch-up **reads a Ready Weekly row for its ticks** (0110 §4, §15.4), which is a request, not an input. Its **Brain Status** (0.17.0): `New` when first published; **you** set it `Ready` once you have ticked; the brain sets it **`Done`** at the publish that finds nothing in it waiting (§15.4: every Action and doubtful item applied, declined, closed or moved, and no item with a note left), so a row with no Action and no doubtful item is `Done` at its first publish. Before 0.17.0 it was set `Done` once every proposal its decision items named was terminal. It needs neither the Documents nor the Reports module. A weekly review published as a Documents row in 0.15.x stays there, as history.

## 3. The body: Your week, then Clean-up (0.17.0, decision 0110 §2)

**Since 0.17.0** the body has two parts, **Your week** and **Clean-up**, which replace 0.15.0's three sections (What changed, Task analysis, What needs your decision): What changed becomes In short and Highlights; Task analysis becomes Done this week and Focus first; What needs your decision becomes Actions, Waiting for you and Clean-up (0110, "What changes in each amended decision", 0075). A report written before 0.17.0 keeps its three sections: it is history, and a same-week rerun after the upgrade writes the two parts.

The body is the two-line header of §3.1, then exactly these two `##` sections, in this order, with nothing between the header and the first. Within them, the parts below come in this order, each a bold line; a part with nothing is left out unless it says otherwise. Links are relative to the report file. A line that rests on a `draft` note ends ` *(not reviewed)*`, as in every report.

```markdown
Week of 9 Nov 2026 · changes since Mon 2 Nov 08:04 · Notion read live
Covered: 14 changes from 6 meetings and 3 sources. 2 more items wait from earlier weeks.

## Your week
**In short:** Harbor's launch moved to March and Quarry's budget grew to 18k; Conference talk proposal has no next step.

**Highlights**
- **Decided:** launch the Harbor app in March, not January ([Launch Harbor app in March](../knowledge/decisions/2026-11-04-launch-harbor-app-in-march.md), 4 Nov).
- **Changed:** Quarry website's budget is 18k, was 12k ([Quarry kickoff](../knowledge/meetings/2026-11-05-quarry-kickoff.md), 5 Nov) *(not reviewed)*.
- **Open:** who signs off the Harbor security review? ([question](../knowledge/questions/harbor-security-sign-off.md), raised 6 Nov).
- **Next:** send the Quarry estimate by Friday (task, due 13 Nov).

**Done this week**
- "Send the logo proposals" (Harbor app), done 6 Nov.
- Pinecrest signage (project), Done 7 Nov.

**Actions**
- [ ] A1 · Add the next step "Draft the talk outline" to Conference talk proposal (no next step since 30 Oct)
- [ ] A2 · Set Riverside fit-out On Hold (nothing done or mentioned for 40 days)
- [ ] A3 · Draft a Document on pricing tiers (in 4 meetings and sources, and no note has it)

**Focus first**
1. Send the Quarry estimate: the client meeting on Thursday depends on it.
2. Get the tiler's quote: it has waited on Sam since 20 Oct.

**Waiting for you:** 3 decisions wait in the session: say *what needs my decision* in Claude Code or Codex.

## Clean-up
**Already cleaned**
- [ ] U1 · Merged the decision "Use the Pinecrest tiler" into its exact duplicate · tick to undo
- [ ] U2 · Archived the draft "Old vendor shortlist" (never reviewed, no link to it, 74 days old) · tick to undo

**For you to tick**
- [ ] C1 · Merge "Acme Corp" into "Acme" · recommended: yes · [Show the change](../_proposals/2026-11-09-merge-acme-corp-into-acme.md)
- [ ] C2 · Move Quarry website to Clients · recommended: yes · [Show the change](../_proposals/2026-11-09-quarry-website-area.md)
- [ ] C3 · Set María López's role to "former PM at Acme (left in June 2026)" · recommended: yes · [Show the change](../_proposals/2026-11-09-maria-lopez-role.md)
- [ ] C4 · Add to Acme website: "Every release needs legal's sign-off (Acme sync, 3 Nov 2026)." · recommended: yes · [Show the change](../_proposals/2026-11-09-acme-website-legal-sign-off.md)
```

### 3.1 The header (two lines)
Rendered by `brain weekly record` from `plan`'s and `select`'s data, never by the skill.
- Line 1: `Week of <D Mon YYYY of the Monday> · changes since <D a Mon HH:MM local of window.from>` (on a first run, `· first review, last 7 days`), then `· Notion read live` or `· Notion unreachable: brain only`.
- Line 2: the coverage statement (§4.3), then, when any apply, `<n> more items wait from earlier weeks.` (the queued remainder, §5.3) and `Partial: <what was left> (§10).`

### 3.2 `## Your week` (0110 §2)
- **In short:** one or two sentences on the week, written by the skill from Highlights and Done this week, citing nothing new. Always present; a week with nothing new says so (`Nothing new in your notes this week.`).
- **Highlights:** the window's consequential changes (§4), at most **6 bullets**, each starting with one of the bold labels `Decided:`, `Changed:`, `Open:`, `Answered:` or `Next:`, in that order, and within a label newest first. Each bullet cites the note it rests on and its date: the freshness (0075 §1). The skill writes the words; the CLI checks that every bullet has a link to a note in `generated_from` or to a Notion task, and that it carries a date. With nothing at all, `- Nothing new this week.`
- **Done this week:** the tasks and projects finished in the window, from the snapshot (a task whose status entered the done group, a project set `Done`, by `last_edited` in the window), at most **6 lines**, newest first, then `<n> more done.`; rendered by `record`, never by the skill. Left out with nothing done, or with the Tasks module off and no project done.
- **Actions:** at most **5** to-dos (§5, §6.1), each `- [ ] A<n> · <what the brain will do on your tick> (<why, from the evidence>)`, rendered by `record` from the selection, never by the skill. `<what>` is the whole change: a new task's words in quotes, the status it sets, the Document it drafts.
- **Focus first:** a short order of attention, **1 to 3** numbered lines `<subject>: <reason>`, from the assistant's rank (assistant.md §3.5) over the open work problems (`Overdue:`, `Stalled:`, `Blocked:`, `No next step:` of 0.15.0's Task analysis). The skill writes each reason from evidence the run read: a due date, a meeting that depends on it, a decision. It doesn't estimate capacity (0075 §1). A reason it can't support is left out, and the line keeps only the subject and its evidence text. A task's own date, status or Won't Do is set on the task in Notion (0093 §2), so a line names the task and links it. With no open work problem, `- No overdue, stalled or blocked work.`. Nothing here changes a priority, date or status (0075 §1).
- **Waiting for you:** one line, always present, rendered by `record`: `**Waiting for you:** <n> decisions wait in the session: say *what needs my decision* in Claude Code or Codex.` (`1 decision waits`), or `**Waiting for you:** nothing waits in the session.`; `<n>` is `brain proposal list --waiting`'s `total` when `record` runs (cli.md §5.6), which counts the decisions that stay in the session: contradictions, correction groups, an ingest's questions and every other pending proposal outside a weekly row (§15.6), never the row's own items. A correction group adds `(<k> of <size> shown)` after `in the session` (§8.4), and the lines `<n> correction matches need clarification: say "weekly review corrections".` (§8.4) and a partial run's line (§10) follow it when they apply.

### 3.3 `## Clean-up` (0110 §2, §3)
- **Already cleaned:** each mechanical item this run applied alone (§15.2), one to-do per item, `- [ ] U<n> · <what was done> (<why>) · tick to undo`, in the order applied. A tick, then Ready, undoes it (§15.4); unticked, it stays done. Left out when the run applied nothing.
- **For you to tick:** at most **10** doubtful items (§5, §6.1), each `- [ ] C<n> · <the change> · recommended: <yes|no, with its reason> · [Show the change](<the proposal file>)`. Each is a pending proposal in `_proposals/` (0110 §2). In Git the link is the proposal file; in Notion `sync render` writes, under the to-do, a toggle **Show the change** holding the before and after (§15.5) and a line **Your note:**, empty.
- With neither part, `- Nothing to clean up this week.`

**A Notion change in words** (a `notion_change`, CC-373). An Action's `<what>` and a doubtful item's `<the change>` say it by its property (cli.md §5.6), `<page>` being the proposal's `page_title`:
- `status`: `Set <page> <status>` (`Set Pinecrest signage On Hold`);
- `due`: `Set the due date of <page> to <D Mon YYYY>`, or `Clear the due date of <page>`;
- `project`, `area`: `Set the project of <page> to <pages>` (`the area of`), or `Clear the project of <page>` for an empty list;
- `archived`: `Archive <page>`, or `Unarchive <page>`.

A related page is named by its title: the title of the note whose `notion` is that page, the way the CLI maps relations (cli.md §5.14.1); several are joined with `, `. A page no note has is `a page not in the brain` (`<n> pages not in the brain` for several), never its id. Show the change (§15.5) names values the same way.

**Labels.** `A<n>`, `C<n>` and `U<n>` number each part from 1 in this week's row and are how a catch-up maps a tick to its item (§15.4): the CLI keeps each label's proposal in `_weekly/state.json` (§9.5). A rerun in the same week keeps the label of an item still offered and numbers new items after the highest label used this week, so a tick never moves to another item. Actions have a **Your note:** line too, so the words of a new task can be changed before the tick is applied (§15.4).

**Shape check** (`record`, `INPUT_INVALID`): the header has two lines; there are exactly the two `##` sections, in order, with their parts in order; the caps hold (6 Highlights, 6 Done lines, 5 Actions, 3 Focus lines, 10 doubtful items); every label is unique; every link resolves (a relative link to a note or a proposal file, or a Notion page URL for a task); and **Your week** is at most 450 words, counting neither the header, the to-dos' text nor link targets. Over 450 words, `record` refuses (`WEEKLY_TOO_LONG`), and the skill shortens its own prose (In short, Highlights, Focus first), never an item. Clean-up has no word cap: each of its lines is at most 200 characters, link targets not counted.

## 4. The change window and coverage

### 4.1 The window
- **Clusters in the window.** `plan` passes the reflection clusters whose members were `updated`, or whose inputs are dated, between `window.from` and `window.to` (§12, the trials), compared as UTC dates, both ends included. Other clusters are not this week's: they are not omitted, and the attended brain-reflect still sees them. `plan` passes at most `settings.weekly.max_judged` of them, carried ones first (§10); the window's clusters beyond that are listed in `clusters_left`, and a run omits and carries them (§10) as it does the ones it had no budget to judge.
- `window.from` is `covered_to` of the **last successful report of an earlier week** in `_weekly/state.json` (§9.5). With none (a first run), it is `as_of` minus 7 days (0075 §1). A rerun in the same week keeps this week's `from`.
- **The boundary day.** Changes are dated (§4.2), and `from` is a timestamp. A change is in the window when its date is after the UTC date of `from`, or on it and not covered by the report that ended there: that report's state lists the keys it covered dated on that day (`covered_on_to`, kept for a rerun as `window_skip`, §9.5). On a first run, a change dated on `from`'s date is in. So a change made on Monday after the run is next week's, and one the run covered is not repeated.
- `window.to` is `as_of`.
- What changed is never cut by the budget: it is deterministic, and every change in the window is covered, as a bullet or by count (§4.3). `covered_to` is therefore always `window.to` of a report that was written. A partial run omits **judgments** only (clusters and correction targets, §10), and those are carried forward explicitly, so nothing omitted is silently marked as handled (0075 §1).

### 4.2 What counts as a change (deterministic, `weekly plan`)
Each candidate has a `kind`, a `ref` (a note id or a Notion task page id), a `date`, and a `weight` used for ordering:

| Kind (label) | A change in the window | Weight |
|---|---|---|
| `decided` (Decided:) | a decision note whose `created` or `date` is in the window, or one superseded in it (its `supersede` proposal applied in the window) | 4 |
| `changed` (Changed:) | a timeline entry with `assessment: accepted` and `learned` in the window, on a field whose earlier accepted value differed: a fact that changed, not a first value | 3 |
| `open` (Open:) | a question note created in the window | 2 |
| `answered` (Answered:) | a question whose `answer` was set in the window (its `answer` proposal applied) | 2 |
| `next` (Next:) | an open task created in the window, or due within 7 days of `as_of` (live only) | 1 |

Meetings and sources are not changes of their own. They are where changes come from, and line 2 counts them. Excluded evidence follows `brain query`'s rule (cli.md §5.13): a restricted note or entry is no candidate.

### 4.3 Coverage
- **Normal:** with 6 or fewer changes (8 before 0.17.0, when What changed had no cap of 6; Highlights has, §3.2), every change is a bullet. With more, the 6 with the highest weight are bullets (newest first among equal weights), and the rest are **covered by count**: line 2 says `Covered: <n> changes from <m> meetings and <s> sources.` and, when some aren't bullets, `<k> not shown: <counts by label>.`
- **A long window** (longer than 14 days): the same 6 by weight, and line 2 begins `<n> days since the last review.` (0075 §1). Quiet runs write no state (§9.1), so a long window may span quiet weeks as well as missed ones. The line states only the length of the window, never that a run was missed.
- Counted is not omitted: a change is covered when it was a bullet or counted in line 2. Only a partial run omits (§10).

## 5. The limits

0075 §2 as amended by 0110 ("§2's five decisions become at most 5 Actions and at most 10 doubtful clean-up items; the five-target limit stays for correction groups"), per **week**, across both streams:
- **A:** at most **5 Actions** in the row;
- **C:** at most **10 doubtful items** in the row's Clean-up (For you to tick);
- **T:** at most **5 targets** in this week's new session items: the admitted targets of correction groups (§8.4) and one per new contradiction.

These are separate counts, and all three hold. Already cleaned has no cap of its own: the clean-up applies at most 20 items a run (§15.2). The limits are not catch-up's `max_inputs`, reflection's page of 10, the assistant's page of 10, or 0074's limits. 0.15.0's D (5 decision items) and I (5 new pending proposals) are retired with the three sections.

### 5.1 Counting
| Item (§6.1) | A | C | T |
|---|---|---|---|
| an Action: a new next-step task, a project status, a theme's Document | 1 | 0 | 0 |
| a doubtful item: a reflection `merge`, `update_fact` or `add_to_note`, an assistant structure change, a mechanical item while `settings.cleanup.auto` is off | 0 | 1 | 0 |
| a new correction group of *k* admitted targets (§8.4) | 0 | 0 | *k* |
| a new `contradiction` | 0 | 0 | 1 |
| an item carried from an earlier week (§15.6), or an earlier finding shown again (§7) | 1 or 0 | 0 or 1 | 0 |

- **A theme's target** in `select`'s input is still the newest input of its evidence (the one its `review_notes` will take as `source`).
- **The week counts, not the run.** A rerun in the same week starts from the counts `_weekly/state.json` holds for this week (§9.5). The items it already made are kept, with their labels (same key, `DUPLICATE_PENDING`), and are not counted twice, so a rerun can't add 5 more Actions or 10 more doubtful items (0075 §2).
- An item the user has decided since (applied, declined or closed) stays counted for its week.

### 5.2 Priority and fill (deterministic)
`select` fills three lists, each walked once in its own order:
1. **Session items (T):** correction groups (§8), oldest correction first, then reflection contradictions (cli.md §6.2 rank). A **correction group** is admitted **in part** when at least one of its targets fits: its first targets by note id fill the T left, and the rest stay queued with the group (§8.4). Anything else that doesn't fit is skipped and queued.
2. **Actions (A):** the carried Actions first (§15.6), in their earlier order; then the work stream's `project_stalled`, `project_no_next_step` and `project_done_but_open` in the assistant's rank (assistant.md §3.5); then reflection's themes, by their cluster's rank.
3. **Doubtful items (C):** the carried items first, in their earlier order; then reflection's stale facts, promotions and duplicates (0052's order of severity, then cluster rank); then the assistant's structure signals with a value (`project_misplaced`, `project_duplicate`, `task_no_project`, `area_no_domain`, `area_empty`, in its rank); then, while `settings.cleanup.auto` is off, the mechanical items of §15.2 in that section's order.

A list stops when it is full; ties keep the order above, then the stream's own rank, then the key. Findings the clean-up's merges or archives retired in this run (§15.2) are dropped first: `select` reads the brain.

### 5.3 The queued remainder
Everything eligible and not admitted is **queued**. It is counted in `counts.queued` and in header line 2's `<n> more items wait from earlier weeks.` from the next week, and listed in the state (§9.5). Nothing queued is lost: next week's `plan` finds it again, because the signals still hold, the queue cursor hasn't passed it (§8), a partial run left it (§10), or it is a pending item of a row (§15.6). "More" is on request: in an attended session, `weekly review more` shows the queued candidates as a report-first list, the way the assistant's "more" works (assistant.md §3.5). Each item there is answered **in that chat** by the skill that owns it (ultimate-assistant or brain-reflect), so it is not a row item and the weekly limits don't apply to it (0075 §2: "offer more on request").

## 6. The items and the proposals they write

### 6.1 Where each item is decided (0110 §2, §4 and "Decided where they were before")
A **tick is a yes to a change shown in full**; a decision that needs a value chosen or words written stays in the session. So every candidate goes to exactly one place:

| Candidate | Where | The proposal (all `pending`, never applied by this run) | What the tick does (§15.4) |
|---|---|---|---|
| `project_no_next_step` | **Action** "Add the next step "<words>" to <project>", when the skill can write the next step's words from the project's own notes and inputs (each cited in `why`); otherwise **Focus first** only | `new_task` (schema §11): the project, the task's words, `why` | creates the task in Notion (Tasks module on; off, an Inbox capture instead, assistant.md §7) |
| `project_stalled` | **Action** "Set <project> On Hold" | `notion_change` (`set_project_status` `On Hold`, assistant.md §6.3) | sets the status |
| `project_done_but_open` | **Action** "Set <project> Done" | `notion_change` (`set_project_status` `Done`) | sets the status |
| reflection theme | **Action** "Draft a Document on <term>" | `new_item` holding the draft learned Document, with the theme's `fingerprint` (cli.md §6.2: what a theme's skip writes) | writes the Document as a `draft` and its `review_notes`, pending, which the session asks as any new note (0076 §4) |
| reflection stale fact | **doubtful** | `update_fact` | applies it |
| reflection promotion | **doubtful** (the whole text it adds is shown, 0076 §1) | `add_to_note` | applies it |
| reflection near duplicate | **doubtful** | `merge` | applies it |
| `project_misplaced`, `area_no_domain` with a value, `task_no_project` with a value, `project_duplicate`, `area_empty` | **doubtful** | `set_field` or `notion_change`, as assistant.md §6.3 writes the first recommendation with a value | applies it |
| a mechanical item while `settings.cleanup.auto` is off (§15.2) | **doubtful** | `merge`, `archive_draft` or `fix_structure` (§15.2) | applies it |
| a mechanical item while `settings.cleanup.auto` is on | **Already cleaned** | the same, applied alone by the run (`decided_by: cleanup`) | undoes it (§15.3) |
| a correction group (§8) | **session**, counted in Waiting for you | `review_notes` per claim (§8.4) | none: decided with "what needs my decision" (capture-and-review §7.5) |
| reflection contradiction | **session**, counted in Waiting for you | `contradiction` (keep both claims, never a chosen value: an unattended run never picks one, 0051) | none |
| `task_overdue`, `task_stalled`, a blocked task, a finding with no recommendation a proposal can carry | **Focus first** only | none | none: the task is set in Notion (0093 §2) |

An ingest's questions are the session's already (capture-and-review §7.5) and are counted in Waiting for you. An `add_task` with the user's words still can't be an item (assistant.md §6.3): the Action's `new_task` carries words the brain wrote from evidence and shows them in full, and an item whose words the user wants changed takes a **Your note:** (§15.4).

### 6.2 The proposals
- **Work stream:** the finding's recommendation, as assistant.md §6.3 writes it: `finding` = the key, `source` = `agent:brain-weekly-review/<as_of compact>`, `why` = the evidence text, and `area` per cli.md §5.31.
- **Knowledge stream:** what a "later" writes in cli.md §6.2, with `fingerprint` and `evidence` (schema §11.4).
- **Corrections:** one `review_notes` group per corrected claim (§8.4).
- **Row items** (Actions and doubtful items) also carry `weekly` = the week of the row that offers them (schema §11), so `proposal list --waiting` leaves them out of the session's questions (§15.6).
- `DUPLICATE_PENDING` from `proposal new` means that item already exists: the item links the existing proposal, which is how §5.1's rerun rule is kept.

## 7. Repetition, dismissals and postponements

0075 §3. `_weekly/state.json` `shown` remembers, per **finding key** (the assistant key, the reflection fingerprint, or `correction:<claim key>`), the last week it was a decision item, its category, and an `evidence_hash`: the sha256 of the finding's evidence object without the counters `days_late` and `days_idle` (they grow every day; rule 3 below weighs them), or of the judged finding's `evidence` ids, sorted. A finding a report listed only in Task analysis (it has no recommendation a proposal or a task can carry) is recorded the same way, so it doesn't keep a later week from being quiet (§9.1).

A finding shown before is a decision item again **only when one of these holds**:
1. **Its evidence changed:** the `evidence_hash` differs (a new input, a new date).
2. **It became newly overdue:** its category is now `overdue` and wasn't then.
3. **Its urgency rose materially:** a `task_overdue` whose `days_late` has crossed a step since it was shown (7, 14, 28, then every 28), or a stalled finding whose `days_idle` has doubled.
4. **It is an unresolved critical knowledge problem:** a contradiction on a `reviewed` note, or a correction group with targets still queued. These stay visible every week while unresolved (0075 §3). A pending `contradiction` proposal on a `reviewed` note is such an item even in a week whose window holds no cluster that finds it again: `select` takes it from `plan.pending`, linking its proposal (kind Contradiction, subject the proposal's title), and `plan` doesn't call that week quiet.

Otherwise it is not an item. When its proposal is pending in the session it is in Waiting for you's count (§3.2), and is otherwise just not shown. "A decision item" in this section means any item of §6.1 from 0.17.0.

**Dismissals and postponements stand across weeks** (0075 §3); a new week doesn't reset them:
- the assistant's dismissal store and its 30-day rejected-Suggestion rule (assistant.md §3.5, §8);
- reflection's holds: waiting and skipped fingerprints (schema §11.4);
- a proposal the user left for later, or an item deferred by "all except …": a deferred item keeps its id in its new pending proposal (schema §11), so it is "pending", and not new;
- a `notion_change` or `set_field` the user rejected in the session: its `finding` is held for 30 days, as an assistant Suggestion is (assistant.md §8 item 4);
- **an item declined in a Ready row** (unticked, no note, §15.4; 0.17.0): its proposal is rejected, so the hold of its kind applies as for a rejection in the session (the 30 days above for a work item, schema §11.4 for a reflection finding), and a mechanical item offered while `settings.cleanup.auto` is off is not offered again while its fingerprint is unchanged (§15.2).

## 8. The correction queue (0075 §4)

### 8.1 What queues a check
A **meaning change** that is new to the cursor (§9.5), read from the Git record by `weekly plan`. Nothing is written when the correction is applied, so `apply` and `sync apply` are unchanged:
- a timeline entry with `assessment: accepted`, new to the cursor, on a field whose previous accepted value differed. This covers an applied `update_fact`, a `contradiction` resolved to one value, an accepted or corrected proposal item that changed a fact, and a correction made in Notion that `sync apply` wrote to `facts` (dates and owners are facts too);
- a decision superseded (a `supersede` proposal applied after the cursor);
- a **title** that changed (a Name correction from Notion, or an applied rename): its old title, and each alias it drops, is the old value. The trials found a renamed Area still named the old way in a project's body. A title keeps no history in its note, so `plan` reads it from Git: for each knowledge note committed since the cursor's date (`git log --since`), the frontmatter before the first such commit against the current one; the claim's date is the newest such commit's date (`%cs`). A brain that is no Git repository has no title claims;
- an `add_to_note` that the user approved from a reflection **promotion** (a lasting rule), when it replaces nothing. It queues only the check for other notes that contradict the rule; §8.2 judges whether any do.

**The cursor is a date with the claims done on it** (`corrections` `{ checked_on, done_on_date }`, §9.5), because `learned` and a proposal's applied `updated` are dates. A meaning change is **new** when its date is after `checked_on`, or on `checked_on` with a claim key not in `done_on_date`. When a run finishes claims, `checked_on` becomes the run's local date: `done_on_date` lists the claims finished that day, and it is emptied when the date moves on. So a correction applied on the day of a run is neither missed nor checked twice. With no cursor yet (`checked_on` null, a first run), the meaning changes dated in the window (§4.1, from `window.from`'s UTC date) are new. A rerun in the same week reads the cursor as the week's first report found it (`weeks.<week>.corrections_from`, §9.5), so it lists the same claims and an unchanged rerun stays quiet (§9.1).

**A claim's date** is the date of its newest meaning change: an accepted entry's `learned`, an applied `supersede`'s or `add_to_note`'s `updated`, or a title's commit date. Its **old values** (`old`, a list): for a fact, each earlier value an accepted entry new to the cursor replaced; for a supersede, the older decision's title; for a title, the old title and each dropped alias; for a rule, none. Its **new value** (`new`): the fact's current value, the newer decision's title, the current title, or the rule's text. Its **source** and **why** are the meaning change's own: the accepted entry's `source`, else the applied proposal's `source` and `why` (a title's source is `notion-edit`); `passages` (§8.3) is `[source]`.

Not queued: formatting-only and body changes with no fact or rule (`update_body`, a link), Notion-owned live statuses (`notion_change`), and `merge` (its references are already rewritten by apply).

**The claim key** is `<target>:<field>` for a fact, `<decision id>` for a supersede, and `<target>:rule:<proposal id>` for a rule. Several meaning changes to one claim since the cursor are one check, against the latest value: an old value is any earlier accepted value superseded in the window.

**The on-demand path:** `weekly review corrections` (attended) runs §8.2 for the queued claims at once, report first. It shows 10 at a time and the user answers yes, later or skip, as reflection does (cli.md §6.2). It is outside the weekly limits (0075 §4: "other normal runs retain their own boundaries"), and it advances the cursor for the claims it finished. Its CLI is `brain weekly corrections` (cli.md §5.34): `list` gives the queued claims with their candidate targets, the same as `plan`'s, without a snapshot, the window's other candidates or any limit; `done` records the claims it finished, writing only `corrections` in `_weekly/state.json` by the rule of §8.4. A yes writes the claim's group with `proposal new` (one `review_notes` per claim, §8.4) and leaves it pending; a skip finishes the target with no proposal; a later keeps it queued.

### 8.2 Finding the affected restatements (deterministic first, then judged)
`weekly plan` lists, per claim, the **candidate targets**: current knowledge notes that reference the claim's note (cli.md §5.32 "references", either direction) **and** hold an old value as text, either an equal `facts.<field>` value (the claim's own field) or a body line whose prose holds the old value's tokens as a run (cli.md §5.32 "Tokens", "Prose of a line"). A rule claim has no old value: its candidate lines are the body lines of the referencing notes whose prose holds 3 or more of the rule's distinct words (cli.md §5.13 step 1), for the skill to judge whether they contradict it. "Current" excludes archived notes and `archive/`.

**One target per note.** Each candidate is `{ note, title, field, line, line_after, before_hash, pending }`: the fact (`field`, `line` null) when it equals an old value and no body line holds one, else the first body line that holds one. `line_after` is that line with the old value's text replaced by the new value's text, when the old value occurs in the line exactly once as written; `null` otherwise: a token match that is not the written value, a rule, a note with more than one line holding an old value (or a fact and a line), or a line that would not change. `before_hash` is the note's body hash (schema §4) for a line, `null` for a fact. `pending` is the id of the waiting group (`pending`, `approved` or `edited` `review_notes` with this `correction`) that already holds a change to this note, else `null`. Candidates are sorted by note id.

These are **never targets**, so the record is preserved (0075 §4): sources (immutable), meetings (historical records), decisions (the record of what was decided: a superseded one keeps its text), views (regenerated), timelines (history), a `reference` whose `origin` is `promoted` (the user's text) or `whole`/`part`/`workflow` (whole texts), memories, and any note or line restricted by the exclusion rule.

The skill then reads each candidate line in its note and judges it as one of:
- **restatement:** the line asserts the old claim as current, and nothing else in the note supports it. **Proposed.**
- **independent:** the line has its own cited support (a source marker or a link to a source or meeting other than the corrected one), or it is about another thing. **Left as it is.**
- **historical:** the line reports the past ("in January we planned…"). **Left as it is.**
- **uncertain:** a consequential match the skill can't settle. **Not drafted.** It is named in the group's row and in the report as `needs clarification` (0075 §4), and it counts in the group's size but takes no item.

Only well-supported fixes are proposed: a restatement gets a fix only when the new value replaces the old one in that line with nothing else changed, which is `line_after` (or, for a fact, `update_fact` from the old value to the new). A target whose `line_after` is `null` and that holds no fact can't be judged `restatement` (`select`: `INPUT_INVALID`, judge it `uncertain`). Anything more is `uncertain`. A target with `pending` set is not judged again: it already waits for a decision in the session.

### 8.3 The change kinds a correction uses
- `update_fact` (schema §11.2) for a `facts.<field>` that equals the old value.
- **`replace_line`** (new, schema §11): `{ kind: replace_line, target, line_before, line_after, before_hash, passages }`. It replaces the one line of the target's body equal to `line_before`, and **is stale** when the body hash differs from `before_hash`, or when `line_before` isn't there exactly once. `passages` are the corrected claim's own (its accepted entry's source and passages). It is allowed on the targets of §8.2 only (a current knowledge note that is no meeting, decision, memory or whole-text or promoted `reference`), standalone or as a `review_notes` change. `line_before` and `line_after` are single non-empty lines, and differ.

### 8.4 The claim group
- One **`review_notes`** proposal per claim, with `correction` = the claim key (schema §11) and `title` = `Correction: <note title> <field>: <old> → <new> (<size> notes)` (`<field>` is `title` for a title, `decision` for a supersede, `rule` for a rule; cut to 120 characters). `source` is the corrected claim's source, and `why` is the correction's own why. Its `changes` are the admitted restatements, one item per target (update_fact or replace_line), each with before/after visible. Its uncertain matches are listed in its `needs_clarification` (schema §11), with no items, and the session's question names them. The user selects each change, item by item (0075 §2), in the session's question for the group (capture-and-review §7.5): "all except …" excludes the others.
- **The input `select` hands over.** A correction item with `write: true` carries `proposal_input`, the exact `proposal new` input for its group: the `review_notes` (`notes: []`, `correction`, `title`, `why`, `source`, `needs_clarification` when any) and one change per admitted target (`update_fact` or `replace_line`, each with the same `correction`, `source` and `passages`). The skill passes it as it is. A change with `correction` folds into the `review_notes` with the same `correction` in that input (cli.md §5.6), never into an ingest's row.
- **Size** is the number of restatements plus uncertain matches. A group larger than the targets left this week shows its first targets by note id and says `(<k> of <size> shown)`. Its remaining targets stay **queued under the same claim key**: next week's run proposes them as a new group for the same claim (a deeper path, on request: `weekly review corrections`). Every uncertain match a run judged is counted in the report, after the items, as `<n> correction matches need clarification: say "weekly review corrections".`, and is finished; a claim with uncertain matches and no restatement writes no group.
- **Retries and stale bases.** Before proposing, `plan` re-reads each target. A target whose line or fact no longer holds the old value is dropped (already fixed). A target already in a waiting group for the claim has `pending` (§8.2) and is not proposed again: a rerun's item links that group (`write: false`), so the group is reused, never duplicated, and `proposal new` answers `DUPLICATE_PENDING` for a group whose every change is already waiting in one. A target whose change the user rejected is never proposed again for that claim (`item_decisions` reject, or a rejected group). A deferred change keeps its `correction` in the deferred proposal. A target changed after the proposal was written is caught at apply by the stale rules (schema §11.3).
- **Selection** (`select`, §5.2): one candidate per claim with restatements not yet proposed, in group 1, oldest claim date first, then claim key; its key is `correction:<claim>`, its subject `<note title> <field> <old> → <new>` and its decide `<size> notes restate <old>` (`1 note restates`), its evidence hash the sha256 of its drafted targets' `{note, line}`, sorted, and a claim still in `corrections.open` is §7 rule 4's critical problem. A claim whose targets are all in a waiting group of this week's items is linked again on a rerun at no cost (§5.1).
- **The cursor** (§8.1) advances past a claim when every candidate target is proposed (or already pending), rejected, judged independent or historical, or uncertain and named. A claim with queued targets (not admitted, or not judged within the budget, §10) stays in `corrections.open` with those targets and its `old`, `new`, `date` and `source`, and next week's `plan` lists it with only those targets, whatever the cursor. `record` sets `checked_on` to the plan's local date: `done_on_date` is the finished claims dated that day (with the earlier ones when `checked_on` was already that day), and `open` the claims left.

## 9. What a run writes

### 9.1 Quiet runs write nothing
A run is **quiet** when, after repetition (§7) and dismissals, there is: no change in the window (§4.2); no eligible item (§6.1); no queued correction target; no work problem for Focus first new since the last report (by `shown`); from 0.17.0 no mechanical item (§15.2), no item to carry (§15.6) and nothing done in the window for Done this week; and no failure. Then the run writes nothing (step 4): no report, no commit, no Notion write, no log line, and no state or attempt marker. A quiet week gets no empty page (0075 §5).

**A rerun in the same week** is quiet when nothing differs from this week's report: `plan` computes `input_hash`, the sha256 of its deterministic candidates (the changes, the findings with their evidence, the clusters, the correction targets) and the snapshot's task values they read, and `weeks.<week>.input_hash` (§9.5) holds the one the report was written from. Equal, and no failure: the rerun is quiet and writes nothing. A rerun that only re-covers changes this week's report already covered is quiet too: the window's `from` stays the same, but the inputs are unchanged.

A run that is **not** quiet because of a failure alone (Notion unreachable with nothing else to say) writes no report and no state: `brain weekly record` is not called. The skill writes the `weekly` line itself with `brain log` (cli.md §5.11), with `coverage=none`, every count `0`, `published=no` and its `failed` and `failures`, and commits only the month's log file, so the failure is surfaced (§9.4) and `brain status` reads it (cli.md §5.34).

### 9.2 Files
- the report (§2), `_weekly/state.json`, the new proposals (a theme is a pending `new_item` from 0.17.0, its Document written only on its tick, §6.1; before, a draft learned Document, an addition as 0051 allows), and from 0.17.0 each mechanical item's own commit (§15.2);
- the log line (`published` is whether the run publishes the report, as `record`'s input says, §9.3): `weekly - mode=<attended|unattended> week=<YYYY-Www> coverage=<complete|partial|none> actions=<n> doubtful=<n> cleaned=<n> targets=<n> queued=<n> changes=<n> failed=<n>[ failures="<reason>; …"] published=<yes|no> notes_read=<n> seconds=<s>` (cli.md §3.9; before 0.17.0 `decisions=<n> new_items=<n>` in place of `actions`, `doubtful` and `cleaned`, still read by `brain status`).

### 9.3 Delivery and publishing (0075 §5, 0096 §7)
| `settings.publish` | The report |
|---|---|
| `auto` | published as the week's Inbox row (Kind Weekly, §2), and the same row is updated on rerun |
| `ask` | unattended: published at the next attended publish; attended: asked once |

`brain weekly record` holds the rule for an unattended run: its input's `publish: true` is refused while `settings.publish` isn't `auto` (cli.md §5.34). A weekly review published as a Documents row in 0.15.x is history and is never published again, not even by a same-week rerun (cli.md §5.34, `HISTORY`).

The Inbox is a core database, so the row needs neither the Documents nor the Reports module, and Reports' state changes nothing here. Its proposals are never published as rows: a session item waits in `_proposals/` for the session (capture-and-review §7.4), and a row item is shown in the row's own body (§3.3, §15.5). **Every publish of the row keeps your ticks and notes** (§15.7): the skill reads the row's to-dos through the MCP just before it publishes and passes them to `sync render` (cli.md §5.34, `--row-state`).

- **The next attended session** (any skill that opens with `brain status`: catch-up, the assistant, this skill) shows `brain status`'s `unattended.weekly` (cli.md §5.2) in one line: `This week's review is ready: <a> actions and <c> clean-up items to tick, <n> cleaned (reports/2026-11-09-weekly-review.md).` (from 0.17.0; parts at 0 left out), plus `Last weekly run failed: <reason>.` or `Last weekly run did not finish (started <D Mon HH:MM>).` when they apply.
- **A Notion outage** is surfaced where it can be: the log line, the scheduler's log (cli.md §5.21), and that opening line. A run never says it wrote to Notion when it didn't. The report's header says `Notion unreachable: brain only`, and its Inbox row waits for a run that reaches Notion.

### 9.4 Failures
A failed step is logged in `failures`, and the run goes on with the next step, as unattended catch-up does (cli.md §6.1). A lint error in a file the run wrote stops it before the commit; it is a failure. A failure is never quiet.

### 9.5 `_weekly/state.json` and the attempt marker
The state is written only by `brain weekly record`, and its `corrections` also by `brain weekly corrections done` (§8.1; atomic; 2-space JSON, keys in the order shown):

```json
{
  "version": 1,
  "last_success": { "week": "2026-W46", "report": "vw-7d2k9m4q", "covered_to": "2026-11-09T07:04:12Z", "covered_on_to": [], "coverage": "complete" },
  "weeks": { "2026-W46": { "report": "vw-7d2k9m4q", "path": "reports/2026-11-09-weekly-review.md", "window_from": "2026-11-02T07:03:55Z", "window_skip": [], "input_hash": "sha256:…", "counts": { "actions": 3, "doubtful": 4, "cleaned": 2, "targets": 5, "queued": 5 }, "items": ["correction:knw-…:budget", "project_no_next_step:prj-…"],
                            "row": { "A1": { "proposal": "prp-…", "base": [ { "path": "projects/…/project.md", "hash": "sha256:…" } ] }, "C1": { "proposal": "prp-…", "base": [ … ] }, "U1": { "proposal": "prp-…", "base": [] } }, "carried_to": null } },
  "shown": [ { "key": "task_overdue:notion:2b8c…", "week": "2026-W46", "category": "overdue", "evidence_hash": "sha256:…", "days_late": 8 } ],
  "queued": [ { "key": "area_empty:area-…", "week": "2026-W46" } ],
  "carry": { "clusters": ["overtaken:per-…"] },
  "corrections": { "checked_on": "2026-11-09", "done_on_date": ["prj-…:launch_date"], "open": [ { "claim": "prj-…:budget", "targets": ["per-…"], "old": ["12k"], "new": "18k", "date": "2026-11-05", "source": "mtg-…" } ] }
}
```

- **The row** (0.17.0): `weeks.<week>.row` maps each label of the week's row (§3.3) to its proposal and its **base**, the `{ path, hash }` of each Git file the change would write, read when `record` writes the row (a Notion item's base is its proposal's `value_before`, checked at `proposal settle`). `cleanup ticks` reads it to map a tick and run the stale check (§15.4). `carried_to` is the week its items moved to (§15.6), else `null`. A rerun keeps the labels it has and adds new ones after the highest (§3.3). `counts` before 0.17.0 had `decisions` and `new_items` in place of `actions`, `doubtful` and `cleaned`; such an entry stays valid.
- Each `weeks.<week>` entry also keeps `corrections_from`, the `corrections` object as it was before the week's first report, so a rerun lists the same claims (§8.1); `record` builds `corrections` from it, never from the week's own earlier write.
- `weeks` keeps the last 8 weeks, and `shown` keeps entries from the last 26 weeks; older ones are dropped at each write. Lint checks the file (`weekly-state`: schema, unique keys). The shape is `$defs/state` of `spec/schemas/weekly.schema.json`; `covered_on_to` and `window_skip` are the boundary day's keys (§4.1).
- A missing file means a first run. A damaged file fails `plan` with `WEEKLY_STATE_UNREADABLE`, rather than repeat every finding.
- **`_weekly/attempt.json`**, gitignored (the brain template's `.gitignore` and `brain upgrade`), is `{ "week", "started", "mode" }`. The skill writes it at step 5 and removes it after step 10. `brain status` reports a marker older than 2 hours as `unattended.weekly.unfinished`. A killed run (a budget ceiling, a closed laptop) is therefore seen.

## 10. Budgets and partial runs (0075 §7)

- **Bounded reads first.** `plan` selects deterministically. The skill reads only what a cluster or a target needs (the members and the cited lines, `brain query --read`). It doesn't open notes for What changed beyond each bullet's note, and it never runs an open-ended search or another agent.
- **The soft budget** (the skill): `settings.weekly.minutes` of wall time from step 2, and `settings.weekly.max_judged`, the number of clusters plus correction targets judged. Both are checked before each judgment. When either is reached, the run stops judging, and everything not judged is **omitted**.
- **The hard ceiling** (the schedule): `claude -p … --max-budget-usd <settings.weekly.max_usd>` (cli.md §5.21). With Codex there is none (`codex exec` documents no spend limit; `install` warns `NO_SPEND_CEILING`, cli.md §5.21): the soft budget above is the run's only limit, and the skill's schedule offer says so. A run stopped there writes no report. Its attempt marker surfaces it (§9.5), and nothing it hadn't committed is half-written, because every write is a CLI write that is checked and committed at step 9.
- **A partial report** has `coverage: partial` and `omitted` `{ clusters, correction_targets }`. Header line 2 ends `Partial: <n> checks not done (budget); they come first next week.`, and Waiting for you is followed by the same line (§3.2). Omitted correction targets stay in `corrections.open`. Omitted cluster keys go to the state's `carry` (§9.5), and next week's `plan` passes them first, before the window's own clusters, even when they fall outside the new window, until they are judged or no longer returned by `reflect --candidates`. `covered_to` is `window.to` (§4.1).
- **No silent increase:** the run never raises a budget or a limit, and never calls partial coverage complete (0075 §7). Under a tight budget, A, C and T are unchanged.
- These budgets are separate from 0074's 800-token opening budget, and from catch-up's `max_inputs`.

## 11. The schedule (0075 §6, 0093 §4, 0110 §7 to §9)

- **Job `weekly-review`** in `brain schedule install` (cli.md §5.21): its prompt is `weekly review unattended`, it needs `brain-weekly-review`, and its slot is `settings.schedule.weekly_review` (schema §12), **Monday 08:00** local by default when asked (0075 §6, 0110 §8). It is a separate entry from `catch-up`, never chained to it, and neither runs the other. It runs with the brain's agent, Claude Code (`claude -p`) or Codex (`codex exec`), pinning `settings.schedule.model`, on macOS (launchd) and Windows (Task Scheduler), and as a cron line elsewhere.
- **From 0.17.0 the slots are asked by setup** (setup.md §7 item 12: the weekly review and the daily catch-up, each kept, changed or declined) and kept in `brain.json`, so the skill's "Run on a schedule" section ("review my week every Monday") is for a brain whose setup is finished: it asks what is missing once, the time if not 08:00, and, when `settings.schedule` has none, the agent and the model. It offers **Sonnet by default** with Claude Code (0093 §4; `claude-sonnet-<current>` as a full id), the user's current Codex model with Codex, and the user may pick another. It then offers, once each:
  - **`settings.publish: auto`**, when `ask`, as catch-up's offer does.
  - **The tools it may use**, with Claude Code, as catch-up's offer does: `Bash(brain:*)`, `Bash(git:*)`, `Read`, `Edit`, `Write` and the Notion tools, plus `Read(~/.ultimate-brain/weekly/**)` and `Edit(~/.ultimate-brain/weekly/**)` for the snapshot file and the skill's input files, which it keeps in the same folder (cli.md §5.34), and `Bash(date:*)` and `Bash(jq:*)`: the run reads the clock for the snapshot's `as_of`, the attempt marker and the log line's `seconds`, and reads saved Notion results with `jq` (§1 step 2). No other Notion write than the publish of §9.3. (0093 §3's Reports offer is retired by 0096: the Inbox row needs no module.) (CC-255: the list first had neither `date` nor `jq`, so a scheduled run could do neither.) With Codex the run's permissions are the command's sandbox (cli.md §5.21), and there is no list to offer.

  It then installs with `brain schedule install weekly-review` (with `--max-budget-usd` from §12 under Claude Code), which writes `settings.schedule` itself. **`settings.weekly.schedule` is written no more** from 0.17.0: a brain that has it keeps it, read only while `settings.schedule` isn't an object (schema §12).
- **Folder trust** (cli.md §5.21): with Claude Code the brain folder must be trusted: `claude -p` ignores the allow rules of a folder's `.claude/settings.json` until Claude Code has been opened there interactively once and its trust dialog accepted (found by CC-253's `claude -p` test, and stated in Claude Code's permissions page). `brain schedule install weekly-review` says so every time (warning `FOLDER_TRUST`), and the skill's schedule section passes it on: open Claude Code in the brain folder once and accept the trust dialog before the first scheduled run. With Codex, trust changes nothing for the run, since the brain has no `.codex/` layer.
- This contract installs no schedule in any brain (0075 §6).

### 11.1 macOS and Windows (0110 §9, 0104 §7)

The same outcome on both: the brain's two jobs run at the user's slots, with the brain's agent and pinned model, while the user is logged on, and a slot missed while the computer slept runs when it wakes. cli.md §5.21's table records each platform's behaviour as the vendors document it (checked on 2026-11-20). The differences, and how each is closed:

| Difference | macOS (launchd) | Windows (Task Scheduler) | Closed by, or why it isn't a capability gap |
|---|---|---|---|
| Asleep at the slot | runs when the Mac wakes (missed slots coalesced into one run) | the computer is woken to run (`WakeToRun`) | Not a gap: the run happens on both, at the slot on Windows and at wake on macOS. Both jobs are idempotent (a catch-up with nothing waiting writes nothing, cli.md §6.1; a same-week weekly rerun with the same inputs is quiet, §9.1), so a late run loses nothing |
| Off at the slot | skipped until the next slot (Apple: "the job does not execute until the next designated time occurs") | runs when the computer is next on (`StartWhenAvailable`) | **Named and deferred past 0.17.0** for macOS (the author's answer of 2026-11-20), and recorded: the daily catch-up's next slot is at most a day later, and the next attended catch-up takes everything that waits, so nothing is lost; a weekly review missed because the Mac was off waits for next Monday, or for "weekly review" asked by hand. Setup says so on macOS, in one line (setup.md §7, item 12, step 3: "a run missed while it was off waits for the next one"). Closing it needs a run at login that knows a slot was missed, which 0110 §9 doesn't decide (the entry runs the agent directly); it joins the parity epic's audit (docs/v2-ideas.md) |
| Logged out at the slot | not run (a user agent runs only while its user is logged in) | not run (`InteractiveToken`); whether it then starts at the next logon (`StartWhenAvailable`) is not stated by Microsoft | Not a gap: 0110 §9 chose "only when the user is logged on" on Windows, the behaviour launchd has for a user agent, so neither runs as a logged-out user and neither stores a password. U-43 records what Windows does at the next logon |
| On battery | runs | runs: `DisallowStartIfOnBatteries` and `StopIfGoingOnBatteries` set false (their defaults are true) | Closed by the task's settings (cli.md §5.21) |
| Who may install | the user, in `~/Library/LaunchAgents` | a standard user may register a task as themselves with the interactive logon type (Microsoft's security-contexts page), though schtasks's page says only administrators can; the CLI uses `Register-ScheduledTask` | Closed by the registration path chosen; U-43 runs `install` on a standard Windows account to confirm |
| Spend ceiling | `--max-budget-usd` with Claude Code on both; none with Codex on both | same | An agent difference, not a platform one: §10 |
| Where the run's last line goes | `~/Library/Logs/ultimate-brain/<label>.log` | `%LOCALAPPDATA%\ultimate-brain\logs\<label>.log` (through `cmd.exe`'s redirection) | Closed: both keep it (cli.md §5.21) |

## 12. Resource budgets and the model default (from the trials)

**The trials** (0075 §7, 0093 §4, §6) ran on 2026-11-13. Each was the weekly flow as a prototype prompt, read-only, in the author's brain, through `claude -p --output-format stream-json`. The tool allowlist permitted no writes and no Notion writes, the brain's `git status` and HEAD were unchanged after every run, and each run was capped at 10 USD. The brain held about 180 knowledge notes, 91 sources, 84 tasks, 13 projects and 10 Areas, and `reflect --candidates` gave 360 clusters in its 30-day window. Each run judged at most 30 clusters or 20 minutes. Only numbers are recorded here. The runs, their prompt and their reports stay outside the repo (0093 §6), so these numbers are the author's runs and can't be reproduced from the repo; that the brain was unchanged is the author's check (`git status --porcelain` and HEAD compared before and after each run), not something a reviewer can re-run. CC-253's synthetic tests and U-29 measure again on the built feature.

| Run | Model | Cost (USD) | Wall time (s) | Turns | Input / cache read / cache write / output tokens | Notion calls | Notes read | Clusters judged | Findings (knowledge / work / structure / corrections) | Decision items · targets | Words (first three sections) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sonnet-1 | Sonnet | 0.58 | 136 | 37 | 30 / 1,028,559 / 73,935 / 17,610 | 6 | 3 | 30 | 1 / 11 / 8 / 1 | 3 · 5 | 492 |
| sonnet-2 | Sonnet | 0.75 | 201 | 45 | 42 / 1,616,389 / 78,273 / 27,248 | 6 | 4 | 6 | 4 / 15 / 5 / 2 | 5 · 5 | 526 |
| opus-1 | Opus | 2.14 | 283 | 44 | 54 / 2,500,746 / 118,921 / 34,248 | 7 | 19 | 30 | 1 / 11 / 11 / 1 | 5 · 5 | 468 |

**What the trials showed:**
- **The cost is mostly re-reading cached context.** Cache reads are about 95% of the input, and they grow with turns. Fewer turns save more than shorter notes do. That is the reason for a deterministic `plan` and `select` (§1).
- **Notion reads are large.** Tasks, Projects and Areas came to about 265,000 characters of raw MCP results for 107 rows. Claude Code kept them out of the context only because the results were saved to files and read with `jq`. The skill must do the same, and `weekly plan` must take the snapshot as a file (cli.md §5.34), not inline.
- **The judging varied.** Sonnet judged 30 clusters in one run and 6 in the other, and read 3 to 4 notes. Opus read 19 and gave the most specific reasons in Task analysis. The deterministic half removes most of that variation.
- **Clusters must be limited to the window.** 360 clusters against a cap of 30 would make nearly every week partial. `plan` therefore passes only the clusters whose members were `updated`, or whose inputs are dated, within the window (§4.1), and omission (§10) counts among those alone.
- **Every run drafted more than 450 words** (468 to 526). The word cap stays (§3.4 before 0.17.0, §3.3 after, on Your week): `record` refuses, and the skill shortens.
- **The snapshot hand-off:** the prototype passed the snapshot to `brain assistant findings` through a stdin heredoc, which the read-only allowlist refused, so each run worked out its task findings from the same rows by hand, and the cost of that CLI call (no model tokens) is not in the table. The skill therefore writes the snapshot to a file outside the brain and `plan` reads it by path (§1 step 2, cli.md §5.34), under the allow rules of §11. CC-253's `claude -p` test found the same limit downstream: a large brain's plan is far above the 30k Bash output limit, whose saved output the allow list can't read, and embedding the plan in `select`'s and `record`'s inputs would have the model write it back twice. So the CLI keeps its own hand-off files beside the snapshot, and the model reads the plan from one and names it by `input_hash` (§1 steps 3, 7, 9).

**The defaults** (schema §12 `settings.weekly`):

| Setting | Default | Why |
|---|---|---|
| `minutes` | 10 | the slowest Sonnet run, 201 s, × 3 for a heavier week, rounded |
| `max_judged` | 30 | clusters plus correction targets; Sonnet judged up to 30 within the time above |
| `max_usd` | 3 | the dearest Sonnet run, 0.75, × 4. On Opus, the skill's schedule offer sets 8 (opus-1, 2.14, × 4) |
| the default model | **Sonnet, confirmed** | it covered every section within the limits at about a third of Opus's cost (0.58 to 0.75 against 2.14 a week). Opus read more and reasoned more specifically, which the attended trial (§14) checks; the user can pin Opus when turning on the schedule (0093 §4) |

## 13. Weekly review in Notion (0093 §2, 0096 §7)

The user asks Brain Assistant for it by name, "Run Weekly review". Since CC-260, a Custom Agent doesn't run a skill typed as a `/` command, so 0093 §2's `/Weekly review` means this skill asked for by name.

Brain Assistant's Weekly review skill (notion/brain-assistant.md) is the way to read this week's review in Notion. **It decides nothing** (0096 §7): decisions are made in the Claude Code or Codex session. The new text, which a Notion migration ships (0022, CC-299):
- **Find this week's review:** the Inbox row of Kind Weekly whose Name is this week's `Week of <D Mon YYYY>`; else the newest Weekly row, saying its week.
- **None this week:** it says so and how to get one: say `weekly review` to Claude Code or Codex in the brain, or wait for the Monday schedule when it is on.
- **With one** (a row with What needs your decision, as 0.16.x writes it; a row with Your week and Clean-up, from 0.17.0, is the paragraph after this list): it summarises What changed and Task analysis in a few lines, then reads What needs your decision with the user, item by item, answering questions about each from the row and the related Notion pages:
  - **a proposal item:** it says what the item would change and that it is decided in Claude Code or Codex, with "what needs my decision". It asks nothing to decide about it;
  - **a task item:** it says what the row suggests setting and links the task. **From 0.17.0** (0101 §3, CC-325) it then asks about the task items in rounds of at most five, each numbered with lettered options carrying their values (the row's suggestion first, "leave it" last), and the user answers "1a, 2d". That answer is the yes the Instructions ask for: Brain Assistant sets exactly the picked values (a task's Status or Due, nothing else), reads each back, and sets nothing before the answer or for "leave it". Before 0.17.0 it only said what to set, and the user set it.
- **A row already Done** says so in one line: nothing of it is waiting.
- It writes nothing else: not the row, not any other page or property. A task it sets is an operational field, read by the brain as a pointer (docs/notion-space-design.md §2); a task tracking an open question that it sets Done is asked about in the next attended session (0101 §6).

**From 0.17.0 (0110 §2, §4; the text is CC-372's, shipped by 0.17.0's one Notion migration):** with this week's row, it summarises **Your week** (In short, the Highlights, Done this week, Focus first) in a few lines, then reads the **Actions** and the **Clean-up** with the user, item by item: what each would do, its recommendation, what Show the change holds, and answers to questions from the row and the related Notion pages. It **still decides nothing**: it never ticks or unticks a to-do, never writes on a Your note line and never sets Brain Status (the ticks, the notes and Ready are the user's, §15.7). It ends by saying: tick what you agree with, write on an item's Your note line to change it (that item then waits for a session in Claude Code or Codex), then set the row's Brain Status to **Ready**: the next catch-up applies it. **Waiting for you** is decided in Claude Code or Codex with "what needs my decision". A task's own date or status is still set on the task (with CC-325, Brain Assistant may set it after the user's yes, 0101 §3). The Instructions' line on Weekly rows says the same: the user's ticks and notes are left as they are.

## 14. Acceptance (0075 §8)

**Synthetic scenarios.** These are automated tests in CC-253 (busy, quiet, missed week, partial, repeated finding, same-week rerun) and CC-254 (correction), run on synthetic brains with a failing `gh` stub and a Notion stand-in, never a real brain. They are not trials: 0093 §6 moved 0075 §8's synthetic scenarios here.

| Scenario | Setup | Pass |
|---|---|---|
| busy | first run; knowledge and work problems in both streams, more than 5 candidates | one report, three sections, ≤ 450 words; D, I, T ≤ 5; priority order of §5.2; every What changed bullet cited and dated; a task order with supported reasons; zero proposals applied; the rest counted as queued |
| quiet | nothing new since the last report, every finding already shown | no file, commit, Notion call or log line (Git and the stand-in's call log unchanged) |
| missed-week | last success 4 weeks ago | `28 days since the last review.`, the 8 most consequential changes, the rest counted |
| partial | a budget too small for the clusters | `coverage: partial`, honest omitted counts, the queue intact, limits unchanged; next week's run covers the omitted first |
| repeated-finding | last week's report showed the same findings with the same evidence | they are counted, not items; one with new evidence and one newly overdue are items again; a dismissed and a rejected one stay out |
| correction | an applied fact change restated in 3 current notes, plus one independent line, one historical meeting and one uncertain match | one claim group, 3 selectable items with before/after; the independent, historical and immutable texts untouched; the uncertain match named and not drafted; a rerun reuses the group; a rejected item is not proposed again |

Plus the following cases:
- **Same-week rerun:** one file and one Inbox row per week, both updated in place; no duplicate proposal; the counts kept.
- **Modules and publishing:** each row of §9.3's table, with Documents and Reports off and on; the Inbox row turns Done once its proposals are terminal, and a week of task items only is Done at its first publish.
- **Notion unreachable:** brain only, a failure surfaced in the log and the opening line, and no claim of a Notion write.
- **Separation from catch-up:** no input ingested and no approved proposal applied by a weekly run; catch-up's behaviour unchanged.
- **Budget exhaustion** at each step boundary.
- **"Run Weekly review"** on a test space with a Weekly row and with none: it reads and decides nothing for the user; it writes nothing but, from 0.17.0, the task values the user picked (a round answered "1a" sets that task's Due after the answer and not before; CC-325).

The reading and deciding targets (two minutes to read, five to decide) are checked by the word cap and by the attended trial.

**From 0.17.0** (0110; CC-370's tests, CC-371's evals, on synthetic brains): the scenarios above are run against the two parts (A ≤ 5, C ≤ 10, T ≤ 5 in place of D, I and T; Your week ≤ 450 words; the missed week's 6 Highlights in place of 8 bullets), and these are added:

| Scenario | Setup | Pass |
|---|---|---|
| busy week with clean-up | `settings.cleanup.auto` on; one exact duplicate, one pair half, one never-reviewed unlinked draft 61 days old; four doubtful findings (a near duplicate, a stale fact, a promotion, a misplaced project); a project with no next step | three mechanical items applied, each its own commit with a `Cleanup:` trailer, listed under Already cleaned as `U1`–`U3`; four `C` items, each a pending proposal with `weekly` set and Show the change; one `A` item; no other proposal applied |
| a Ready row read by a scheduled catch-up | a row with two plain ticks, one tick with a note, one stale item (its note changed since the row), one unticked item | the two plain ticks applied (`decided_by: tick`), the noted item left pending and named under Needs you, the stale one closed `stale` and named, the unticked one left pending (`open`: the noted item still waits); the row stays Ready; the user ticks the unticked one before the attended catch-up, which applies it as a plain tick and the noted item after the user's answer, then runs `ticks` again on the same read (§15.4), where an item still unticked is declined; the publish that follows sets the row Done |
| a row never set Ready | week 1's row still New at week 2's run, with 2 `C` items unticked | week 2's row holds them first, once; week 1's report and row say `Moved to Week of …`, and week 1's row is Done |
| `settings.cleanup.auto` off | the busy week's mechanical items | nothing applied alone; the three offered as `C` items |
| an undo | `U1` ticked, row Ready; then a second undo of an item whose file changed since | the first restored (`git diff` against the item's parent empty for its files), its proposal `closed` `undone`, not applied alone again; the second refused `UNDO_STALE`, nothing written |
| a same-week rerun | a row with one tick and one note, then new input and a rerun | one row, updated; the tick and the note kept on the same labels; new items numbered after the highest label |

**One attended trial in the user's private brain** (U-29, 0075 §8). It runs one scheduled week and one rerun, then "what needs my decision" in a session and "Run Weekly review" in Notion, and is judged on usefulness: meaningful selection, task recommendations, and the reading and deciding times. Personal evidence stays outside the product repo, and only non-personal summaries of outcomes and timing come back. U-21's weekly step joins it (0076 §9): reflection findings respect excluded material.

## 15. The clean-up and the ticks (0.17.0, decision 0110 §2 to §6)

### 15.1 What the clean-up is
The weekly run's **Clean-up** has two kinds of items: **mechanical** items, which the run applies alone, and **doubtful** items, which wait for your tick. Nothing else is applied without you (0110 §3). The command surface is `brain cleanup` (cli.md §5.38); a weekly run, a catch-up and an attended "undo clean-up …" call it. It is not 0055's exclusion cleanup (a `review_notes` with `cleanup`, capture-and-review §5.2), which is unrelated and unchanged. Its lifecycle (0104 §2): found deterministically by `plan` (no model judgment) → applied alone, each item in its own commit with its undo (`settings.cleanup.auto` on), or offered as a doubtful item (off) → listed in the row → undone by a tick or in the session, or left done.

**No lessons or preferences file** (0110 §6): the clean-up and the ticks learn nothing from your answers beyond what proposals, dismissals and skips already record (§7, schema §11.4). No file of lessons, rules or preferences is written or read, and a Your note line is never kept beyond the decision it explains (its text is the decision's `note`).

### 15.2 The mechanical items: a closed list
These five kinds, and no other, are mechanical. Each is found by `brain cleanup plan` and `brain weekly plan` with the rules below and nothing else; a rule that doesn't hold exactly makes the case no item (it may still be a reflection or assistant finding, offered as a doubtful item). **Never a target:** a source, a meeting (except its own side of a `pair_half` and a repeated value in its `decisions` or `questions`, which the table names), a memory, a view, a `reference` whose `origin` is `whole`, `part`, `workflow` or `promoted` (whole texts and the user's text, 0091, 0049), and any note or line the exclusion rule restricts (capture-and-review §5.1).

| Kind (the proposal's `tidy`) | Found when | Applied as | What its undo restores |
|---|---|---|---|
| `pair_half` (a structural fix) | a pair the brain keeps on both sides has one side, and the other side is **empty** for that pair: a decision's `decided_in` names meeting M and M's `decisions` lacks it, or M's `decisions` names it and its `decided_in` is absent; the same for a question's `raised_in` and M's `questions`; a `supersedes` or `superseded_by` relation on one note with no relation of that pair on the other (lint's `meeting-backref` and `supersession-pair`, schema §15). The note the side names exists | `fix_structure` with `fix: pair_half`: the missing side written | the side removed |
| `moved_link` (a structural fix) | a relative Markdown link, in a note the brain writes, to a file that doesn't exist (lint's `broken-link`), where Git records that path renamed, through one or more renames (`git log --diff-filter=R --name-status` on the working branch), to **exactly one** file that exists now | `fix_structure` with `fix: moved_link`: the link's target replaced by the new relative path, its text kept | the old target |
| `repeated_value` (a structural fix) | a frontmatter list of scalars (`aliases`, `tags`, `projects`, `sources`, a meeting's `decisions` or `questions`, …) holding the same value more than once | `fix_structure` with `fix: repeated_value`: each later repeat removed, the first kept | the list as it was |
| `exact_duplicate` | two current notes (not archived) of the same `type` among `project`, `decision`, `question` and a `reference` with `origin: learned`, whose titles are equal after NFC, case folding and collapsing whitespace, whose bodies are equal after collapsing whitespace and **not empty**, whose `facts` hold no key with two different values, and of which **neither has a Notion page**, so a merge alone archives no Notion row and its undo restores everything it changed. **People and orgs are never mechanical:** two people or orgs with one name may be two of them, so they stay reflection's duplicates, offered as doubtful items; so do a pair with a Notion page (`project_duplicate` for two project rows) | `merge`, the survivor by reflection's rule (the `reviewed` note over a `draft`, then the one more knowledge notes reference, then the older `created`, then the lower id, cli.md §6.2), as schema §11.2 applies it | X, Y and every note whose references the merge rewrote, as they were |
| `stale_draft` | a knowledge note with `lifecycle: draft` (never reviewed) and no Notion page, `created` **60 days or more** before the run's local date, with **no link to it**: no frontmatter reference to its id and no relative link to its file in any note other than itself, a proposal or a view (views are regenerated from it), and named by no waiting proposal (`pending`, `approved` or `edited`: its question is still the session's) other than its own `archive_draft` | `archive_draft` (schema §11): `lifecycle: archived`, with no successor; nothing is deleted | `lifecycle: draft` |

- **Order and budget.** `plan` lists the items in the table's order, then by note id, then by field or path. One run applies **at most 20**; the rest are found again next week (`left` in `cleanup apply`'s output). A note one item changed is not changed by a later item of the same run: that item waits for next week, so every item's undo stays exact.
- **Each item is its own commit** (0110 §3): one journaled operation (cli.md §5.24, capture-and-review §7.11) that writes the proposal (with its `tidy` kind and `fingerprint`), already `applied` with `decision: { action: approve, decided_by: cleanup }`, its write set and the `tidy` log line (cli.md §3.9), and commits them with the subject `Clean-up: <the item's title>` and the trailers `Op: <op-id>` and `Cleanup: <proposal id>`. The tree must be clean first (`DIRTY_TREE`). A failed item is rolled back alone, logged in the run's `failures`, and the run goes on with the next.
- **`settings.cleanup.auto` off:** nothing is applied alone. The same items are written as pending proposals and offered under For you to tick, within C (§5).
- **Once undone, never alone again.** An item whose proposal is `closed` with `closed_reason: undone` (§15.3), or `rejected` (a doubtful offer declined), is not found again by `plan` while its fingerprint (schema §11.4: `tidy:<kind>:<subject>`, `merge:<a>+<b>` for an exact duplicate) is unchanged.

### 15.3 The undo
Every Already cleaned line has an undo, two ways: tick its `U` to-do and set the row Ready (§15.4), or say "undo clean-up U2" (or name it) in a session. The session runs `brain cleanup undo <proposal>` (cli.md §5.38); a tick runs the same undo inside `brain cleanup ticks`, with the read's other writes, which the skill commits after them (cli.md §5.38). It finds the item's commit by its `Cleanup:` trailer and checks that every file the commit wrote, the proposal and the log aside, is **unchanged since**: its content now equals its content in that commit. Then it restores each to its content before that commit, sets the proposal `closed` with `closed_reason: undone`, and commits that (subject `Undo clean-up: <title>`, trailers `Op:` and `Cleanup-undo: <proposal id>`), as one journaled operation. A file changed since (a later edit, another item) → `UNDO_STALE` naming it, and nothing is written: the skill says what changed and offers to fix it by hand in the session. `git diff <item's parent>..HEAD` over the restored files is empty after an undo whose files no other commit touched.

### 15.4 Your ticks: tick, then set the row Ready (0110 §4)
- **You decide by ticking**, then setting the row's Brain Status to **Ready**. A tick on an `A` or `C` item is your yes to the change it shows; a tick on a `U` item asks for its undo. Ready is the go: nothing is read from a row that isn't Ready.
- **Any catch-up reads a Ready Weekly row** (attended or scheduled; cli.md §6.1): in its read-only pass the skill reads each Ready row of Kind Weekly through the MCP, its to-dos (label, ticked) and each item's **Your note:** text, and passes them to `brain cleanup ticks` (cli.md §5.38). A Weekly row is still never taken in as an input (§2): it is a request, not counted in the budget.
- **A plain tick** (ticked, no note) is applied after the **stale check**: the item's base, recorded when the row was written (§9.5: the hash of each Git file the change would write, or, for a Notion item, the value it read), must be unchanged (0077: every change is checked again before apply). The proposal is then applied with `decided_by: tick` by its kind's rule (schema §11.2), with the excluded-evidence rule of cli.md §5.7. **A stale item** is not applied: its proposal is closed with `closed_reason: stale`, and the catch-up's report names it ("C3 not applied: María López changed since the review"); next week's run may find it again.
- **An item with a note** (any text after `Your note:`) waits for an **attended** catch-up, since an unattended run interprets nothing you wrote (0051): the scheduled run leaves it pending and names it under Needs you. The attended catch-up shows the item and the note with its reading of it, and the user's answer is applied as any session decision (`decided_by: chat`, `note` = the Your note text and the answer, capture-and-review §7.6). Once every `ask` item is answered, the attended catch-up runs `brain cleanup ticks` again with the same input: the items now decided are `already`, and an item still unticked is declined, so the row can turn Done in that session.
- **An item left unticked, with no note,** is **declined for now**, but only by a read that leaves nothing else in the row waiting (no item with a note, no Notion write held back): its proposal is then rejected (`decided_by: tick`, `note: "unticked when the row was set Ready"`), and it comes back only as 0075 §3 allows (§7: new evidence, newly overdue, urgency, a critical problem). While something in the row still waits, an unticked item stays pending (`open`), so a tick you add before the row is Done is applied by the next catch-up; the read that finds nothing else waiting declines the unticked ones and the row turns Done. An unticked `U` item is no decision: the clean-up stays.
- **A Notion write** (a `notion_change`, a `new_task`) is made by the run through the MCP and settled with `proposal settle`, as the session does. An unattended run with `settings.publish: ask` writes nothing to Notion (0051), so such a tick waits, pending, for a run that may write; it is named under Needs you.
- **The row is Done once nothing in it waits** (0110 §4): every `A` and `C` item applied, declined, closed or moved (§15.6), none left `open` (unticked while something else waited), and no item with a note left. `U` items and Waiting for you don't hold it open. The publish that finds it so sets Brain Status `Done`; until then it stays Ready, and the next catch-up reads it again, where every item already decided is a no-op (`already`, cli.md §5.38).
- **Retries and failures.** Reading the same Ready row twice applies nothing twice. A tick on a label the row's state doesn't hold (`UNKNOWN_LABEL`: a to-do the user added or retyped) is skipped and named. A failed apply is a failure of the run (cli.md §6.1), and the item stays pending for the next catch-up.

### 15.5 Show the change
Under each doubtful item, the Notion row holds a toggle **Show the change** with the before and after, rendered by `sync render` from the pending proposal (in Git, the item links the proposal file):
- `update_fact`: `<field>: <before> → <after>`, and the input it rests on with its date;
- `add_to_note`: the whole text it adds, and where;
- `merge`: `<duplicate> will be merged into <survivor>`, the facts and aliases it brings, and the number of notes whose links move;
- `set_field`: `<field>: <before> → <after>`;
- `notion_change`: `<Property>: <before> → <after>`, the property by its Notion name (`Status`, `Due`, `Project`, `Area`, `Archived`) and each value in words (§3.3): a page by its title, a date as `D Mon YYYY`, `yes` or `no`, and `none` for an empty value (`Project: none → Half marathon training`);
- `archive_draft`: the draft's title, its age and that nothing links to it;
- `fix_structure`: the field or line before and after.

### 15.6 One open clean-up, and the carry-over (0110 §5)
- A row item lives in one row at a time: its proposal's `weekly` names that row's week, and `brain proposal list --waiting` leaves such proposals out of the session's questions (cli.md §5.6), counting them under `in_weekly_row`.
- **A row never set Ready** (its Brain Status still `New` in the snapshot of the next run, or a row never published, which nobody could tick) carries its pending `A` and `C` items into next week's row: `select` takes them first (§5.2), without duplicating an item (one proposal, its `weekly` moved to the new week; a finding found again this week is the same proposal, `DUPLICATE_PENDING`). Carried items beyond the caps stay pending with `weekly` cleared and are queued (§5.3), offered first again the week after. Actions carry too, as their findings would otherwise be held by §7's repetition rule.
- **The earlier row says where its items went:** `record` rewrites that week's report once, replacing its moved items with the line `Moved to Week of <D Mon YYYY>: <n> actions and <n> clean-up items.`, and its row is published with it and set `Done`. This is the only change made to an earlier week's report (§2).
- A row set Ready whose items with a note still wait is not carried: it stays Ready for an attended catch-up, and the new row doesn't repeat its items.

### 15.7 Ownership in the row (0110 §4, 0101)
The row's body is the brain's (docs/notion-space-design.md §2), except **the ticks and the text after `Your note:`, which are yours**, and Brain Status's Ready. The brain never ticks or unticks a to-do and never writes a Your note line's text: a rerun in the same week, and every publish of the row, keeps each item's tick and note as you left them (cli.md §5.34, `--row-state`), and an item no longer offered loses its line with them. What you write anywhere else in the row's body is overwritten by the next publish, as for any brain-written body.
