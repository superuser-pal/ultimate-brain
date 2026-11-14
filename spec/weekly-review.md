# The weekly review (contract, decisions 0075 and 0093)

**Status:** contract for release 0.15.0 (CC-111). Written by Claude Code. It is built by CC-253 (the CLI), CC-254 (correction checks), CC-255 (the skill and the schedule offer) and CC-256 (Weekly review in Notion), and tried in the author's brain by U-29. The numbers in §12 come from the resource-budget trials, run read-only in the author's brain (0075 §7, 0093 §4, §6).

How this file fits: it holds the whole weekly review. That covers what a run reads, the report and its identity, the three sections, the change window and coverage, the two shared limits, repetition and dismissals, the correction queue and its claim groups, budgets and partial runs, delivery, the schedule, Brain Assistant's Weekly review skill and the acceptance scenarios. It reuses what exists. Ultimate Assistant's findings ([assistant.md](assistant.md) §3, cli.md §5.31) are the work stream. `brain reflect --candidates` (cli.md §5.32, §6.2) is the knowledge stream, the only scheduled reflection (0076 §5). Proposals and Review rows (schema §11, cli.md §5.6, §5.14.4), the report destination (schema §4 view, §16) and `brain schedule` (cli.md §5.21) are used as they are. The command surface (`brain weekly`) is cli.md §5.34; the fields are in schema §2, §4 view, §11 and §12.

**Decisions:** [0075](../decisions/0075-weekly-review-and-targeted-corrections.md) (binding, all of it), [0093](../decisions/0093-the-0-15-0-scope-grill.md) (the Weekly review entry point, the Reports offer, Sonnet by default, the trials in the author's brain), [0051](../decisions/0051-unattended-catch-up-and-schedules.md) (unattended runs, the no-op rule, a schedule pins a model), [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) and [0072](../decisions/0072-ultimate-assistant.md) (the assistant's findings, dismissals, Review rows only when no one is there), [0076](../decisions/0076-reflection-chat-first.md) (reflection's skips and holds), [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) (its 800-token budget is separate), [0048](../decisions/0048-modules-and-simpler-rows.md) (modules), [0090](../decisions/0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) (the grill style and where Notion AI may write).

**Calls taken in this contract that the user may veto** (each the simplest reading of 0075 and 0093; none contradicts their rules, and item 8 departs only from 0093 §2's wording):
1. **One new skill, `brain-weekly-review`** (written in the fork, delivered in the pinned snapshot). It runs the assistant's and reflection's deterministic halves itself, so neither skill gains an unattended mode (§1).
2. **A week is the ISO week of the run's local date.** The Monday 08:00 run opens the new week's report, and its What changed covers the week before (§2).
3. **The report is a new view kind, `weekly_review`,** in `reports/`, published as a Documents row with Origin Report, the existing report destination (§2). It is not a `report`, because it doesn't have the six sections of schema §16.4.
4. **Run state lives in `_weekly/state.json`.** It is JSON, not a note, like `_assistant/dismissals.json`. It holds coverage, what earlier reports showed, and the correction queue's cursor (§4, §7, §8). The queue itself is read from the Git record, so `brain apply` and `sync apply` gain no new step.
5. **A body-line correction is a new change kind, `replace_line`.** It replaces one exact line of a brain-owned body and is stale when that line changed. No existing kind can change a restatement in a project's or a person's prose (§8.3).
6. **A decision item is a Review row or a task** (0093 §2: "decided where it lives"). An overdue or stalled task that has no recommendation with a value is a task item: the user sets it in Notion, and no Review row is written (§6.1).
7. **The normal brief is at most 450 words**, links and the header excluded. That is the two-minute reading target at about 200 words a minute (0075 §1), and it is checked in the acceptance (§14).
8. **"Run Weekly review", not `/Weekly review`** (a deviation from 0093 §2's words, not its rule): since CC-260 a Notion Custom Agent doesn't run a skill typed as a `/` command, so the way in is asking Brain Assistant for the Weekly review skill by name (§13). The behaviour 0093 §2 decides is unchanged.

---

## 1. A run

Two prompts start the skill `brain-weekly-review`:
- **`weekly review`**: attended. The user asks for it, or a schedule isn't set. The report comes first in the chat. The run then writes it as §9 says and ends. Deciding happens in Review or through Weekly review in Notion (§13), never in this chat: a weekly run decides nothing, attended or not (0075 §6). An attended run that the user follows with "yes 2" is told where item 2 lives.
- **`weekly review unattended`**: the schedule's prompt (§11). It asks no questions.

Both modes run the same steps and write the same things. The one difference is that an attended run shows the report in the chat and may ask "publish now?" under `settings.publish: ask`, as attended catch-up does.

**Steps** (normative order):
1. **Preconditions.** `brain status --json`. Off the working branch, the run stops as unattended catch-up does (cli.md §6.1, 0086 §2): it writes nothing, and its last line is `Not run: off-working-branch. …`.
2. **Read Notion live** into the assistant snapshot (assistant.md §2.1), saving the MCP results to files and reading them with `jq` rather than into the context (§12), and write the snapshot with the file-writing tool to the `weekly_snapshot` path of `brain status` (cli.md §5.34: outside the brain, one per brain, overwritten each run). Notion unreachable means brain only (assistant.md §2.3), and that is a **failure** for this run (§9.4). It is not a reason to stop.
3. **Candidates** (deterministic, no model judgment): `brain weekly plan --snapshot <file>` (cli.md §5.34). It saves the plan as a hand-off file next to the snapshot and prints a short summary (`week`, `quiet`, `input_hash`, the file's path and counts); the skill reads the file in parts with its file-reading tool, never as command output (a large brain's plan is far above the 30k Bash output limit, and a scheduled run's allow list can't read Claude Code's saved outputs back). The plan holds the week, the window, the What changed candidates (§4), the assistant findings (`brain assistant findings`' rules, every finding, not a page of 10), the reflection clusters (`brain reflect --candidates`' rules), the correction queue (§8), the repetition state of each candidate (§7), the pending proposals it already has, and `quiet`.
4. **Quiet?** When `quiet` is true and step 2 didn't fail, the run stops: **no report, no commit, no Notion call after the reads, no log line, no state write** (0075 §5, 0051). §9.1 defines quiet.
5. **Attempt marker.** The run writes `_weekly/attempt.json` (§9.5), which is gitignored. It marks the first write that isn't a no-op, so a run killed after this point can be seen.
6. **Judge** (the model's work, within the budget of §12): the reflection clusters in rank order, as cli.md §6.2 step 2 judges them, and the correction targets of the queue (§8.2). The deadline is checked before each cluster or target. When the budget runs out, the run stops judging and goes on to step 7 with what it has; the run is then **partial** (§10).
7. **Select** (deterministic): `brain weekly select --input <judged>`, the input naming the plan by its `input_hash` (no copy of the plan), applies the limits (§5), repetition and dismissals (§7), and the priority order. It returns the decision items, the queued remainder and the counts, and saves them as a second hand-off file.
8. **Write the proposals** for new decision items (§6.2): `brain proposal new`, all `pending`, nothing applied.
9. **Write the report**: the skill writes the What changed and Task analysis prose from step 3's candidates (§3). `brain weekly record --input`, naming the plan by its `input_hash` and carrying only the proposals and the prose, reads the two hand-off files, renders What needs your decision from step 7, checks the shape (§3.4), writes the report (§2), updates `_weekly/state.json`, logs, and removes the hand-off files. Then `brain index`, `brain views`, `brain lint`, and a commit of exactly the paths written.
10. **Publish** (§9.3), then `brain sync record`, commit, push per `settings.push`, and remove the attempt marker.

**It never:** applies a proposal, including one the user already approved (that is catch-up's job, 0075 §6); runs catch-up or ingests an input; writes a Notion-owned field; asks a question unattended; or starts a research agent or a sub-agent (0075 §7).

## 2. Identity: one report per week

- **The week** is the ISO 8601 week (`2026-W46`) of the run's **local date**: the date in the machine's time zone when step 2 starts (`as_of` stays UTC, as everywhere). The schedule runs on Monday at 08:00 local (§11), so a scheduled run always opens a new week.
- **The file** is `reports/<Monday of the week, YYYY-MM-DD>-weekly-review.md`, for example `reports/2026-11-09-weekly-review.md`. A `view` with `view_kind: weekly_review` (schema §4 view): its `title` is `Weekly review · <D Mon>–<D Mon YYYY>` (the Monday and Sunday of the week; `Weekly review · 9–15 Nov 2026`, or `30 Nov–6 Dec 2026` across a month).
- **A rerun in the same week updates that file in place**, as a report refresh does (schema §16.4, "Refreshing"). It gets new sections, `generated_at`, `generated_from`, `window.to` and coverage. The path, id, `week`, `window.from` and `notion` stay the same. Git keeps each version. A new week gets a new file, so past reviews stay browsable (0075 §5). There is one file per week, never one living file for every week.
- **Frontmatter** (schema §4 view, the `weekly_review` rows): `week`, `window` `{ from, to }` (timestamps, §4), `coverage` (`complete` or `partial`), `omitted` `{ clusters, correction_targets }` (§10), `counts` `{ decisions, new_items, targets, queued }`, `generated_from`, `generated_at`, `notion`, `last_synced`, `notion_published`.
- **What a weekly review is not:** it is never evidence (lint rejects a note that cites it), never a proposal target, and never reviewed. It has no Lifecycle, as a report has none (schema §4 view). It has no Refresh asked and no What to fix: on its Documents row these are ignored (`NOT_A_REPORT`, cli.md §5.14.2), and a rerun is the refresh.

## 3. The body: three sections

The body is the two-line header of §3.1, then exactly these three `##` sections, in this order, with nothing between the header and the first. Links are relative to the report file. A line that rests on a `draft` note ends ` *(not reviewed)*`, as in every report.

```markdown
Week of 9 Nov 2026 · changes since Mon 2 Nov 08:04 · Notion read live
Covered: 14 changes from 6 meetings and 3 sources. 2 more decisions wait in Review from earlier weeks.

## What changed
- **Decided:** launch the Harbor app in March, not January ([Launch Harbor app in March](../knowledge/decisions/2026-11-04-launch-harbor-app-in-march.md), 4 Nov).
- **Changed:** Quarry website's budget is 18k, was 12k ([Quarry kickoff](../knowledge/meetings/2026-11-05-quarry-kickoff.md), 5 Nov) *(not reviewed)*.
- **Open:** who signs off the Harbor security review? ([question](../knowledge/questions/harbor-security-sign-off.md), raised 6 Nov).
- **Next:** send the Quarry estimate by Friday (task, due 13 Nov).

## Task analysis
- **Overdue:** "Send the logo proposals" (Harbor app), 8 days late.
- **Stalled:** Pinecrest signage (project): nothing done or mentioned for 40 days.
- **Blocked:** "Get the tiler's quote" has waited on Sam since 20 Oct.
- **No next step:** Conference talk proposal.

Order of attention:
1. Send the logo proposals: the client meeting on Thursday depends on them.
2. Decide on Pinecrest signage: 40 days without movement holds up the Health area.
3. Add a next step to Conference talk proposal: the call for papers closes on 30 Nov.

## What needs your decision
1. Correction · Quarry budget 12k → 18k · 3 notes restate 12k → [Review](../_proposals/2026-11-09-correction-quarry-website-budget.md) (2 of 3 shown)
2. Overdue · "Send the logo proposals" · new date, Done or Won't Do → [the task](<task page URL>)
3. Contradiction · Harbor app launch date: 2027-01 here, March in the 4 Nov decision → [Review](../_proposals/2026-11-09-harbor-app-launch-date.md)
4. Stalled · Pinecrest signage · set On Hold? → [Review](../_proposals/2026-11-09-pinecrest-signage-on-hold.md)

5 more findings wait for next week. Say "weekly review more" in a session for the rest.
```

The example's counts (§5.1): D = 4 items; I = 2 (the group's two admitted targets) + 1 + 1 = 4 new Review items; T = 2 + 1 (the task) + 1 + 1 = 5 targets. T is full, so §5.2 admits the group in part (2 of its 3 targets; the third stays queued under its claim) and queues the next candidate, a structure finding that needs a target, with the rest.

### 3.1 The header (two lines)
Rendered by `brain weekly record` from `plan`'s and `select`'s data, never by the skill.
- Line 1: `Week of <D Mon YYYY of the Monday> · changes since <D a Mon HH:MM local of window.from>` (on a first run, `· first review, last 7 days`), then `· Notion read live` or `· Notion unreachable: brain only`.
- Line 2: the coverage statement (§4.3), then, when any apply, `<n> more decisions wait in Review from earlier weeks.` (§7) and `Partial: <what was left> (§10).`

### 3.2 `## What changed`
The window's consequential changes (§4). There are at most **8 bullets**, each starting with one of the bold labels `Decided:`, `Changed:`, `Open:`, `Answered:` or `Next:`, in that order, and within a label newest first. Each bullet cites the note it rests on and its date: the freshness (0075 §1). A label with nothing is left out. With nothing at all, the section is `- Nothing new this week.` (possible when the run is not quiet because of task analysis or decisions). The skill writes the words. The CLI checks that every bullet has a link to a note in `generated_from` or to a Notion task, and that it carries a date.

### 3.3 `## Task analysis`
The current outstanding work, older tasks included (0075 §1):
- Up to **4 bullets**, one per category, each listing up to 3 subjects: `Overdue:` (`task_overdue`), `Stalled:` (`task_stalled`, `project_stalled`), `Blocked:` (open tasks whose status is the waiting status, oldest `last_edited` first: the "recorded blockers"), `No next step:` (`project_no_next_step`, `project_done_but_open`). The CLI's candidates give the subjects. A category with nothing is left out.
- `Order of attention:`, then **1 to 3** numbered lines `<subject>: <reason>`. The candidates come from the CLI in the assistant's rank (assistant.md §3.5). The skill writes each reason from evidence the run read: a due date, a meeting that depends on it, a decision. It doesn't estimate capacity (0075 §1). A reason it can't support is left out, and the line keeps only the subject and its evidence text.
- With no open work problem: `- No overdue, stalled or blocked work.`
- Nothing here changes a priority, date or status (0075 §1).

### 3.4 `## What needs your decision`
Rendered by `brain weekly record`, never by the skill. There are at most **5 numbered items** (§5). Each is one line, `<n>. <Kind> · <subject> · <what to decide> → <link>`. **The link in Git** never needs Notion: for a Review row, it is a relative link to the proposal file (`../_proposals/…`), which exists when `record` runs (step 8 is before step 9); for a task, it is the task's page URL from the snapshot, or, brain only, the task's title with no link. **In Notion**, `sync render` turns a proposal link into a link to that proposal's Review row when the proposal has `notion`, and into the plain text `Review row (after the next publish)` when it has none. The Git report is never rewritten after a publish, and the render of the same report is updated at the next publish once its rows exist. A correction item adds `(<k> of <size> shown)` (§8.4). After the items come only the lines that apply:
- `<n> more findings wait for next week.` (the queued remainder, §5.3);
- `<n> earlier findings are still open in Review.` (§7);
- `<n> correction matches need clarification: say "weekly review corrections".` (§8.4);
- a partial run's line (§10).

With no item, the section is `- Nothing needs your decision this week.`.

**Shape check** (`record`, `INPUT_INVALID`): the header has two lines; there are exactly the three `##` sections, in order; the bullet and item caps hold; every link resolves (a relative link to a note or a proposal file, or a Notion page URL for a task); and the body is at most 450 words, counting neither the header nor link targets. Over 450 words, `record` refuses (`WEEKLY_TOO_LONG`), and the skill shortens its own prose (the What changed and Task analysis bullets), never the decision items.

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
- **Normal:** with 8 or fewer changes, every change is a bullet. With more, the 8 with the highest weight are bullets (newest first among equal weights), and the rest are **covered by count**: line 2 says `Covered: <n> changes from <m> meetings and <s> sources.` and, when some aren't bullets, `<k> not shown: <counts by label>.`
- **A long window** (longer than 14 days): the same 8 by weight, and line 2 begins `<n> days since the last review.` (0075 §1). Quiet runs write no state (§9.1), so a long window may span quiet weeks as well as missed ones. The line states only the length of the window, never that a run was missed.
- Counted is not omitted: a change is covered when it was a bullet or counted in line 2. Only a partial run omits (§10).

## 5. The two shared limits

0075 §2, per **week**, across both streams:
- **D:** at most **5 decision items** in What needs your decision;
- **I:** at most **5 new Review items** created by this week's runs;
- **T:** at most **5 affected targets** in this week's decision items.

These are separate counts, and all three hold. They are not catch-up's `max_inputs`, reflection's page of 10, the assistant's page of 10, or 0074's limits.

### 5.1 Counting
| Decision item | D | I (new items) | T (targets) |
|---|---|---|---|
| a new `notion_change` or `set_field` proposal (one Review row) | 1 | 1 | 1 (the row or note it changes) |
| a new reflection proposal: `update_fact`, `contradiction`, `add_to_note` | 1 | 1 | 1 |
| a new reflection `merge` | 1 | 1 | 2 (the duplicate and the survivor) |
| a new theme (a draft learned Document and its `review_notes`) | 1 | 1 | 1 |
| a new correction group of *k* targets (§8.4) | 1 | *k* (one item per target) | *k* |
| a task item (§6.1) | 1 | 0 | 1 |
| an earlier finding shown again (§7), linking its pending row | 1 | 0 | its targets |

- **The week counts, not the run.** A rerun in the same week starts from the counts `_weekly/state.json` holds for this week (§9.5). The items it already made are kept as items (same key, `DUPLICATE_PENDING`) and are not counted twice, so a rerun can't add 5 more (0075 §2).
- An item the user has decided since (applied or closed) stays counted for its week.

### 5.2 Priority and fill (deterministic)
Candidates go in this order (0075 §1):
1. **Consequential knowledge corrections:** correction groups (§8), oldest correction first; then reflection contradictions, then stale facts (cli.md §6.2 rank).
2. **Overdue and stalled work:** `task_overdue`, `project_stalled`, `task_stalled`, `project_no_next_step`, `project_done_but_open`, in the assistant's rank (assistant.md §3.5).
3. **Structural cleanup:** the assistant's structure signals (`project_misplaced`, `project_duplicate`, `task_no_project`, `area_no_domain`, `area_empty`), then reflection duplicates, promotions and themes.

`select` walks the list once. A candidate is admitted when D, I and T all stay within 5 after it. When it doesn't fit:
- **A correction group** is admitted **in part** when at least one of its targets fits: its first targets by note id fill the T and I left, and the rest stay queued with the group (§8.4).
- **Anything else** is skipped, and the walk goes on, so a smaller later candidate can still use the slots. Skipped candidates are queued (§5.3).

The walk stops when D is 5. Ties keep the order above, then the stream's own rank, then the key.

### 5.3 The queued remainder
Everything eligible and not admitted is **queued**. It is counted in `counts.queued` and in the `<n> more findings wait for next week.` line, and listed in the state (§9.5). Nothing queued is lost: next week's `plan` finds it again, because the signals still hold, the queue cursor hasn't passed it (§8), or a partial run left it (§10). "More" is on request: in an attended session, `weekly review more` shows the queued candidates as a report-first list, the way the assistant's "more" works (assistant.md §3.5). Each item there is answered **in that chat** by the skill that owns it (ultimate-assistant or brain-reflect), so it is not a weekly decision item and the weekly limits don't apply to it (0075 §2: "offer more on request").

## 6. Decision items and the proposals they write

### 6.1 What an item is
Every decision item is **decided where it lives** (0093 §2):
- **A Review row**, new or existing, whose Your call the user sets (or decides with Weekly review's grill, §13).
- **A task** in Notion, for a task finding whose recommendations all need the user's value (`task_overdue`, `task_stalled`: a new due date, or Done or Won't Do). No proposal is written. The user changes the task in Notion, and the next run sees the new values. A task item is still an item: it counts for D and T (§5.1).

An `add_task` recommendation can't be an item: it needs the user's words (assistant.md §6.3). Its finding appears in Task analysis only.

### 6.2 The proposals (all `pending`, never applied by this run)
- **Work stream:** the finding's first recommendation **with a value** that is a Review-row action, as assistant.md §6.3 writes it: `finding` = the key, `source` = `agent:brain-weekly-review/<as_of compact>`, `why` = the evidence text, and `area` per cli.md §5.31. A finding with no such recommendation is a task item (above) if it is a task; otherwise it appears in Task analysis only.
- **Knowledge stream:** what a "later" writes in cli.md §6.2, with `fingerprint` and `evidence` (schema §11.4). A contradiction is proposed as the `contradiction` kind (keep both claims), never with a chosen value: an unattended run never picks one (0051).
- **Corrections:** one `review_notes` group per corrected claim (§8.4).
- `DUPLICATE_PENDING` from `proposal new` means that item already exists: the item links the existing row, which is how §5.1's rerun rule is kept.

## 7. Repetition, dismissals and postponements

0075 §3. `_weekly/state.json` `shown` remembers, per **finding key** (the assistant key, the reflection fingerprint, or `correction:<claim key>`), the last week it was a decision item, its category, and an `evidence_hash`: the sha256 of the finding's evidence object without the counters `days_late` and `days_idle` (they grow every day; rule 3 below weighs them), or of the judged finding's `evidence` ids, sorted. A finding a report listed only in Task analysis (it has no recommendation a Review row or a task can carry) is recorded the same way, so it doesn't keep a later week from being quiet (§9.1).

A finding shown before is a decision item again **only when one of these holds**:
1. **Its evidence changed:** the `evidence_hash` differs (a new input, a new date).
2. **It became newly overdue:** its category is now `overdue` and wasn't then.
3. **Its urgency rose materially:** a `task_overdue` whose `days_late` has crossed a step since it was shown (7, 14, 28, then every 28), or a stalled finding whose `days_idle` has doubled.
4. **It is an unresolved critical knowledge problem:** a contradiction on a `reviewed` note, or a correction group with targets still queued. These stay visible every week while unresolved (0075 §3). A pending `contradiction` proposal on a `reviewed` note is such an item even in a week whose window holds no cluster that finds it again: `select` takes it from `plan.pending`, linking its row (kind Contradiction, subject the proposal's title), and `plan` doesn't call that week quiet.

Otherwise it is not an item. It is counted in `<n> earlier findings are still open in Review.` when its proposal is pending, and is otherwise just not shown.

**Dismissals and postponements stand across weeks** (0075 §3); a new week doesn't reset them:
- the assistant's dismissal store and its 30-day rejected-Suggestion rule (assistant.md §3.5, §8);
- reflection's holds: waiting and skipped fingerprints (schema §11.4);
- a Review row the user deferred: a deferred item keeps its id in its new pending proposal (schema §11), so it is "pending", and not new;
- a `notion_change` or `set_field` the user rejected in Review: its `finding` is held for 30 days, as an assistant Suggestion is (assistant.md §8 item 4).

## 8. The correction queue (0075 §4)

### 8.1 What queues a check
A **meaning change** that is new to the cursor (§9.5), read from the Git record by `weekly plan`. Nothing is written when the correction is applied, so `apply` and `sync apply` are unchanged:
- a timeline entry with `assessment: accepted`, new to the cursor, on a field whose previous accepted value differed. This covers an applied `update_fact`, a `contradiction` resolved to one value, an accepted or edited Review item that changed a fact, and a correction made in Notion that `sync apply` wrote to `facts` (dates and owners are facts too);
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

Only well-supported fixes are proposed: a restatement gets a fix only when the new value replaces the old one in that line with nothing else changed, which is `line_after` (or, for a fact, `update_fact` from the old value to the new). A target whose `line_after` is `null` and that holds no fact can't be judged `restatement` (`select`: `INPUT_INVALID`, judge it `uncertain`). Anything more is `uncertain`. A target with `pending` set is not judged again: it is already in Review.

### 8.3 The change kinds a correction uses
- `update_fact` (schema §11.2) for a `facts.<field>` that equals the old value.
- **`replace_line`** (new, schema §11): `{ kind: replace_line, target, line_before, line_after, before_hash, passages }`. It replaces the one line of the target's body equal to `line_before`, and **is stale** when the body hash differs from `before_hash`, or when `line_before` isn't there exactly once. `passages` are the corrected claim's own (its accepted entry's source and passages). It is allowed on the targets of §8.2 only (a current knowledge note that is no meeting, decision, memory or whole-text or promoted `reference`), standalone or as a `review_notes` change. `line_before` and `line_after` are single non-empty lines, and differ.

### 8.4 The claim group
- One **`review_notes`** proposal per claim, with `correction` = the claim key (schema §11) and `title` = `Correction: <note title> <field>: <old> → <new> (<size> notes)` (`<field>` is `title` for a title, `decision` for a supersede, `rule` for a rule; cut to 120 characters). `source` is the corrected claim's source, and `why` is the correction's own why. Its `changes` are the admitted restatements, one item per target (update_fact or replace_line), each with before/after visible. Its uncertain matches are listed in its `needs_clarification` (schema §11) and on its Review page under `Needs clarification`, with no items. The user selects each change, item by item (0075 §2), in the existing Review page (cli.md §5.14.4).
- **The input `select` hands over.** A correction item with `write: true` carries `proposal_input`, the exact `proposal new` input for its group: the `review_notes` (`notes: []`, `correction`, `title`, `why`, `source`, `needs_clarification` when any) and one change per admitted target (`update_fact` or `replace_line`, each with the same `correction`, `source` and `passages`). The skill passes it as it is. A change with `correction` folds into the `review_notes` with the same `correction` in that input (cli.md §5.6), never into an ingest's row.
- **Size** is the number of restatements plus uncertain matches. A group larger than the targets left this week shows its first targets by note id and says `(<k> of <size> shown)`. Its remaining targets stay **queued under the same claim key**: next week's run proposes them as a new group for the same claim (a deeper path, on request: `weekly review corrections`). Every uncertain match a run judged is counted in the report, after the items, as `<n> correction matches need clarification: say "weekly review corrections".`, and is finished; a claim with uncertain matches and no restatement writes no group.
- **Retries and stale bases.** Before proposing, `plan` re-reads each target. A target whose line or fact no longer holds the old value is dropped (already fixed). A target already in a waiting group for the claim has `pending` (§8.2) and is not proposed again: a rerun's item links that group (`write: false`), so the group is reused, never duplicated, and `proposal new` answers `DUPLICATE_PENDING` for a group whose every change is already waiting in one. A target whose change the user rejected is never proposed again for that claim (`item_decisions` reject, or a rejected group). A deferred change keeps its `correction` in the deferred row. A target changed after the proposal was written is caught at apply by the stale rules (schema §11.3).
- **Selection** (`select`, §5.2): one candidate per claim with restatements not yet in Review, in group 1, oldest claim date first, then claim key; its key is `correction:<claim>`, its subject `<note title> <field> <old> → <new>` and its decide `<size> notes restate <old>` (`1 note restates`), its evidence hash the sha256 of its drafted targets' `{note, line}`, sorted, and a claim still in `corrections.open` is §7 rule 4's critical problem. A claim whose targets are all in a waiting group of this week's items is linked again on a rerun at no cost (§5.1).
- **The cursor** (§8.1) advances past a claim when every candidate target is proposed (or already in Review), rejected, judged independent or historical, or uncertain and named. A claim with queued targets (not admitted, or not judged within the budget, §10) stays in `corrections.open` with those targets and its `old`, `new`, `date` and `source`, and next week's `plan` lists it with only those targets, whatever the cursor. `record` sets `checked_on` to the plan's local date: `done_on_date` is the finished claims dated that day (with the earlier ones when `checked_on` was already that day), and `open` the claims left.

## 9. What a run writes

### 9.1 Quiet runs write nothing
A run is **quiet** when, after repetition (§7) and dismissals, there is: no change in the window (§4.2); no eligible decision candidate; no queued correction target; no Task analysis problem new since the last report (by `shown`); and no failure. Then the run writes nothing (step 4): no report, no commit, no Notion write, no log line, and no state or attempt marker. A quiet week gets no empty page (0075 §5).

**A rerun in the same week** is quiet when nothing differs from this week's report: `plan` computes `input_hash`, the sha256 of its deterministic candidates (the changes, the findings with their evidence, the clusters, the correction targets) and the snapshot's task values they read, and `weeks.<week>.input_hash` (§9.5) holds the one the report was written from. Equal, and no failure: the rerun is quiet and writes nothing. A rerun that only re-covers changes this week's report already covered is quiet too: the window's `from` stays the same, but the inputs are unchanged.

A run that is **not** quiet because of a failure alone (Notion unreachable with nothing else to say) writes no report and no state: `brain weekly record` is not called. The skill writes the `weekly` line itself with `brain log` (cli.md §5.11), with `coverage=none`, every count `0`, `published=no` and its `failed` and `failures`, and commits only the month's log file, so the failure is surfaced (§9.4) and `brain status` reads it (cli.md §5.34).

### 9.2 Files
- the report (§2), `_weekly/state.json`, the new proposals, and a draft learned Document for a theme (an addition, as 0051 allows);
- the log line (`published` is whether the run publishes the report, as `record`'s input says; it is refused with Reports off, §9.3): `weekly - mode=<attended|unattended> week=<YYYY-Www> coverage=<complete|partial|none> decisions=<n> new_items=<n> targets=<n> queued=<n> changes=<n> failed=<n>[ failures="<reason>; …"] published=<yes|no> notes_read=<n> seconds=<s>` (cli.md §3.9).

### 9.3 Delivery and publishing (0075 §5, 0093 §3)
| Reports | `settings.publish` | The report | Review rows |
|---|---|---|---|
| on | `auto` | published to Documents (Origin Report), and the same row is updated on rerun | published |
| on | `ask` | unattended: published at the next attended publish; attended: asked once | as the report |
| off | either | **a file in the brain, never published** (0093 §3); summary at the next attended session (below) | per `publish`, as for any proposal |

- **The next attended session** (any skill that opens with `brain status`: catch-up, the assistant, this skill) shows `brain status`'s `unattended.weekly` (cli.md §5.2) in one line: `This week's review is ready: <n> decisions (reports/2026-11-09-weekly-review.md).`, plus `Last weekly run failed: <reason>.` or `Last weekly run did not finish (started <D Mon HH:MM>).` when they apply.
- **A Notion outage** is surfaced where it can be: the log line, the scheduler's log (cli.md §5.21), and that opening line. A run never says it wrote to Notion when it didn't. The report's header says `Notion unreachable: brain only`, and its Review rows wait for a run that reaches Notion.

### 9.4 Failures
A failed step is logged in `failures`, and the run goes on with the next step, as unattended catch-up does (cli.md §6.1). A lint error in a file the run wrote stops it before the commit; it is a failure. A failure is never quiet.

### 9.5 `_weekly/state.json` and the attempt marker
The state is written only by `brain weekly record`, and its `corrections` also by `brain weekly corrections done` (§8.1; atomic; 2-space JSON, keys in the order shown):

```json
{
  "version": 1,
  "last_success": { "week": "2026-W46", "report": "vw-7d2k9m4q", "covered_to": "2026-11-09T07:04:12Z", "covered_on_to": [], "coverage": "complete" },
  "weeks": { "2026-W46": { "report": "vw-7d2k9m4q", "path": "reports/2026-11-09-weekly-review.md", "window_from": "2026-11-02T07:03:55Z", "window_skip": [], "input_hash": "sha256:…", "counts": { "decisions": 4, "new_items": 4, "targets": 5, "queued": 5 }, "items": ["correction:knw-…:budget", "task_overdue:notion:…"] } },
  "shown": [ { "key": "task_overdue:notion:2b8c…", "week": "2026-W46", "category": "overdue", "evidence_hash": "sha256:…", "days_late": 8 } ],
  "queued": [ { "key": "area_empty:area-…", "week": "2026-W46" } ],
  "carry": { "clusters": ["overtaken:per-…"] },
  "corrections": { "checked_on": "2026-11-09", "done_on_date": ["prj-…:launch_date"], "open": [ { "claim": "prj-…:budget", "targets": ["per-…"], "old": ["12k"], "new": "18k", "date": "2026-11-05", "source": "mtg-…" } ] }
}
```

- Each `weeks.<week>` entry also keeps `corrections_from`, the `corrections` object as it was before the week's first report, so a rerun lists the same claims (§8.1); `record` builds `corrections` from it, never from the week's own earlier write.
- `weeks` keeps the last 8 weeks, and `shown` keeps entries from the last 26 weeks; older ones are dropped at each write. Lint checks the file (`weekly-state`: schema, unique keys). The shape is `$defs/state` of `spec/schemas/weekly.schema.json`; `covered_on_to` and `window_skip` are the boundary day's keys (§4.1).
- A missing file means a first run. A damaged file fails `plan` with `WEEKLY_STATE_UNREADABLE`, rather than repeat every finding.
- **`_weekly/attempt.json`**, gitignored (the brain template's `.gitignore` and `brain upgrade`), is `{ "week", "started", "mode" }`. The skill writes it at step 5 and removes it after step 10. `brain status` reports a marker older than 2 hours as `unattended.weekly.unfinished`. A killed run (a budget ceiling, a closed laptop) is therefore seen.

## 10. Budgets and partial runs (0075 §7)

- **Bounded reads first.** `plan` selects deterministically. The skill reads only what a cluster or a target needs (the members and the cited lines, `brain query --read`). It doesn't open notes for What changed beyond each bullet's note, and it never runs an open-ended search or another agent.
- **The soft budget** (the skill): `settings.weekly.minutes` of wall time from step 2, and `settings.weekly.max_judged`, the number of clusters plus correction targets judged. Both are checked before each judgment. When either is reached, the run stops judging, and everything not judged is **omitted**.
- **The hard ceiling** (the schedule): `claude -p … --max-budget-usd <settings.weekly.max_usd>` (cli.md §5.21). A run stopped there writes no report. Its attempt marker surfaces it (§9.5), and nothing it hadn't committed is half-written, because every write is a CLI write that is checked and committed at step 9.
- **A partial report** has `coverage: partial` and `omitted` `{ clusters, correction_targets }`. Header line 2 ends `Partial: <n> checks not done (budget); they come first next week.`, and What needs your decision ends with the same line. Omitted correction targets stay in `corrections.open`. Omitted cluster keys go to the state's `carry` (§9.5), and next week's `plan` passes them first, before the window's own clusters, even when they fall outside the new window, until they are judged or no longer returned by `reflect --candidates`. `covered_to` is `window.to` (§4.1).
- **No silent increase:** the run never raises a budget or a limit, and never calls partial coverage complete (0075 §7). Under a tight budget, D, I and T are unchanged.
- These budgets are separate from 0074's 800-token opening budget, and from catch-up's `max_inputs`.

## 11. The schedule (0075 §6, 0093 §3, §4)

- **Job `weekly-review`** in `brain schedule install` (cli.md §5.21): its prompt is `weekly review unattended`, it needs `brain-weekly-review`, and its default is `--at 08:00 --days mon`, local time. It is a separate entry from `catch-up`, never chained to it, and neither runs the other.
- **The skill's "Run on a schedule" section** ("review my week every Monday") asks what is missing once: the time if not 08:00, and the model. It offers **Sonnet by default** (0093 §4; `claude-sonnet-<current>` as a full id), and the user may pick another. It then offers, once each:
  - **Reports**, when off: `Turn on Reports so each week's review appears in Notion?` On a yes, the module is turned on with notion/modules/reports.md. On a no, it says the review stays a file in the brain, with a summary at the next session (0093 §3).
  - **`settings.publish: auto`**, when `ask`, as catch-up's offer does.
  - **The tools it may use**, as catch-up's offer does: `Bash(brain:*)`, `Bash(git:*)`, `Read`, `Edit`, `Write` and the Notion read tools, plus `Read(~/.ultimate-brain/weekly/**)` and `Edit(~/.ultimate-brain/weekly/**)` for the snapshot file (cli.md §5.34). No other Notion write than the publish of §9.3.

  It then installs with `--max-budget-usd` from §12, and writes `settings.weekly.schedule: on`.
- **The brain folder must be trusted in Claude Code**: `claude -p` ignores the allow rules of a folder's `.claude/settings.json` until Claude Code has been opened there interactively once and its trust dialog accepted (found by CC-253's `claude -p` test). `brain schedule install weekly-review` says so every time (warning `FOLDER_TRUST`, cli.md §5.21), and the skill's schedule section passes it on: open Claude Code in the brain folder once and accept the trust dialog before the first scheduled run.
- This contract installs no schedule in any brain (0075 §6).

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
- **Every run drafted more than 450 words** (468 to 526). The word cap stays (§3.4): `record` refuses, and the skill shortens.
- **The snapshot hand-off:** the prototype passed the snapshot to `brain assistant findings` through a stdin heredoc, which the read-only allowlist refused, so each run worked out its task findings from the same rows by hand, and the cost of that CLI call (no model tokens) is not in the table. The skill therefore writes the snapshot to a file outside the brain and `plan` reads it by path (§1 step 2, cli.md §5.34), under the allow rules of §11. CC-253's `claude -p` test found the same limit downstream: a large brain's plan is far above the 30k Bash output limit, whose saved output the allow list can't read, and embedding the plan in `select`'s and `record`'s inputs would have the model write it back twice. So the CLI keeps its own hand-off files beside the snapshot, and the model reads the plan from one and names it by `input_hash` (§1 steps 3, 7, 9).

**The defaults** (schema §12 `settings.weekly`):

| Setting | Default | Why |
|---|---|---|
| `minutes` | 10 | the slowest Sonnet run, 201 s, × 3 for a heavier week, rounded |
| `max_judged` | 30 | clusters plus correction targets; Sonnet judged up to 30 within the time above |
| `max_usd` | 3 | the dearest Sonnet run, 0.75, × 4. On Opus, the skill's schedule offer sets 8 (opus-1, 2.14, × 4) |
| the default model | **Sonnet, confirmed** | it covered every section within the limits at about a third of Opus's cost (0.58 to 0.75 against 2.14 a week). Opus read more and reasoned more specifically, which the attended trial (§14) checks; the user can pin Opus when turning on the schedule (0093 §4) |

## 13. Weekly review in Notion (0093 §2)

The user asks Brain Assistant for it by name, "Run Weekly review". Since CC-260, a Custom Agent doesn't run a skill typed as a `/` command, so 0093 §2's `/Weekly review` means this skill asked for by name.

Brain Assistant's Weekly review skill (notion/brain-assistant.md) becomes the way into this week's report. It no longer builds its own six-section digest. The new text, which a Notion migration ships (0022):
- **Find this week's report:** the Documents row with Origin Report whose Name begins `Weekly review ·` and whose week holds today; else the newest one, saying its week.
- **None this week:** it says so and how to get one: say `weekly review` to Claude Code or Codex in the brain, or wait for the Monday schedule when it is on. With Reports off, it says the review is a file in the brain, and that turning on Reports brings it to Notion.
- **With one:** it summarises What changed and Task analysis in a few lines, then walks What needs your decision in the 0090 grill style. That means rounds of 3 to 5 questions, each with lettered options and the recommended one marked with a one-line reason. Each item is decided where it lives:
  - a **Review row**: the grill of 0090, writing only in the zones 0090 allows, never Your call (the user sets it);
  - a **task**: it says what to set and links the task. Brain Assistant never edits a property (its Instructions), so the user sets it.
- It writes nothing anywhere else, as before.

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
- **Same-week rerun:** one file per week, updated in place; no duplicate Review item; the counts kept.
- **Modules and publishing:** each row of §9.3's table.
- **Notion unreachable:** brain only, a failure surfaced in the log and the opening line, and no claim of a Notion write.
- **Separation from catch-up:** no input ingested and no approved proposal applied by a weekly run; catch-up's behaviour unchanged.
- **Budget exhaustion** at each step boundary.
- **"Run Weekly review"** on a test space with a report and with none.
- **The Reports offer**, asked once, with the yes and no paths.

The reading and deciding targets (two minutes to read, five to decide) are checked by the word cap and by the attended trial.

**One attended trial in the user's private brain** (U-29, 0075 §8). It runs one scheduled week and one rerun, then "Run Weekly review", and is judged on usefulness: meaningful selection, task recommendations, and the reading and deciding times. Personal evidence stays outside the product repo, and only non-personal summaries of outcomes and timing come back. U-21's weekly step joins it (0076 §9): reflection findings respect excluded material.
