# 0110 — The weekly row with its clean-up, scheduling on Mac and Windows, and 0.16.x folded into 0.17.0

**Status:** Accepted
**Date:** 2026-11-20
**Release:** 0.17.0
**Amends:** [0051](0051-unattended-catch-up-and-schedules.md) (Schedules: where a schedule is kept, which runners and agents run it, Windows; what an unattended catch-up applies: a ticked weekly item); [0075](0075-weekly-review-and-targeted-corrections.md) §1, §2, §5 and §6 (the weekly row's layout, its limits, a carried clean-up, and the scheduled weekly run applying safe clean-up alone); [0076](0076-reflection-chat-first.md) §1 and §4 (an exact duplicate is merged without a yes; a theme's draft is offered as a tickable weekly action); [0096](0096-one-place-to-decide.md) §4 and §7 (ticks in the weekly row decide its actions and clean-up items; a catch-up reads a Ready Weekly row for its ticks); [0097](0097-easy-setup-on-windows-and-mac-and-markitdown-required.md) §4 (Windows gets Task Scheduler); [0104](0104-product-design-principles.md) §5 (scheduling parity is delivered in 0.17.0, not post-1.0); [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §1 and §4 (no more 0.16.x patches; 0.17.0 grows)
**Amended by:** [0112](0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) (2026-11-22; 0.18.0): §2's Your week gains Loose ends and a goal line, outside the 5 Actions and the 10 doubtful items; §7's `brain status` also names a scheduled job's last run and its missed slots
**Keeps:** Markdown and Git canonical, Notion as the human interface; [0003](0003-proposal-review-flow.md) as amended by 0051 and 0096 (a change to existing knowledge needs your yes; a tick is that yes); [0048](0048-modules-and-simpler-rows.md) (the Inbox's Kinds and Brain Status; Quick capture still sets Ready, issue #466); 0051's budget, no-op rule and "an unattended run interprets no text you wrote"; 0075 §3, §4, §7 and §8; [0077](0077-trust-repair-in-0-13-0.md) (every change names its passages, checked at creation and before apply); [0101](0101-where-notion-ai-and-the-brain-each-write.md)'s ownership; 0106 §1's exception (a trust or data-loss fix ships at once), §2, §3 and §5 to §13; the release scripts and the native smoke run per release (0082)

## Context

The weekly review is one Inbox row per week since 0.16.0 (0096 §7). It has three sections, What changed, Task analysis and What needs your decision, and every decision it raises is made in the Claude Code or Codex session. In the author's use the row is read in Notion, and acting on it means switching to a session for small, mechanical things: an exact duplicate, a draft nobody linked in months, a broken link. The author wants the routine part done without them and the rest acted on from Notion.

Scheduling runs only on macOS: `brain schedule` writes a launchd agent and prints a cron line elsewhere (0051), and 0097 §4 left Windows to a weekly review run by hand. The first beta tester uses Windows and cannot schedule anything. 0104 §7 makes identical macOS and Windows capabilities the target and names scheduling the first known gap, with no release assigned.

0106 §1 put the beta on 0.16.x patches. 0.16.2 is released and the beta runs on it; 0.16.3's rows (CC-362 to CC-365) and 0.16.4's (CC-366) are merged or open, none released.

On 2026-11-20 the author ran a scope grill on these three subjects with the coordinator and confirmed the summary the same day. This decision records the answers.

## Decision

### A. The weekly row and its clean-up

1. **One Inbox row per week, Kind Weekly, as today.** No new Kind, no new property, no new database (0104 §3). A rerun in the same week updates that row and keeps your ticks and notes in it.
2. **The row has two parts.** *Your week*, in this order:
   - **In short:** one or two sentences on the week.
   - **Highlights:** at most 6, each with a label (as What changed's `Decided:`, `Changed:`, `Open:`, `Answered:`, `Next:`), citing what it rests on.
   - **Done this week:** the tasks and projects finished in the week.
   - **Actions:** at most 5, each an unticked to-do with what the brain will do on your tick: among them a new next-step task for a project that has none, and a draft note for a recurring theme (0076 §4).
   - **Focus first:** a short order of attention with reasons (0075 §1's Task analysis, kept to its reasons).
   - **Waiting for you:** a count of the decisions that wait in the session, with "say *what needs my decision* in Claude Code or Codex".

   Then *Clean-up*:
   - **Already cleaned:** what the run applied alone (item 3), each with how to undo it.
   - **At most 10 doubtful items,** each an unticked to-do with the brain's recommendation, a **Show the change** toggle holding the before and after (the item is a pending proposal in `_proposals/`), and a **Your note:** line.
3. **The scheduled run applies alone only mechanical, reversible items:** structural fixes, merges of exact duplicates, and archiving drafts that were never reviewed, have no link to them and are 60 days old or more. The contract names the closed list of kinds; nothing else is applied without you. Each item is its own commit with its undo, and is listed under Already cleaned. `settings.cleanup.auto` is **on** by default; with it off, these items are offered as doubtful items instead.
4. **You decide by ticking, then setting the row Ready.** When the row's Brain Status is Ready, any catch-up, attended or scheduled, reads the row and applies each plain tick after a stale check (the item's base is unchanged since the row was written, 0077); a stale item is not applied and is named in the catch-up's report. An item with text on its Your note line waits for an attended catch-up, since an unattended run interprets nothing you wrote (0051). An item left unticked when you set Ready is declined for now and comes back only as 0075 §3 allows. The row is Done once nothing in it waits.
5. **One open clean-up at a time.** A row never set Ready carries its unanswered clean-up into next week's row, without duplicating an item; the earlier row says where its items went.
6. **No lessons or preferences file.** The run learns nothing from your answers beyond what proposals, dismissals and skips already record (0075 §3, 0076 §3). Considered and rejected by the author.

**Decided where they were before:** a contradiction, a correction group (0075 §4) and an ingest's questions stay decisions in the session and are counted under Waiting for you; a task's own date, status or Won't Do is still set on the task in Notion (0093 §2). A tick is a yes to a change shown in full; a decision that needs a value chosen or words written stays in the session.

### B. Scheduling on Mac and Windows

7. **The schedule lives in `brain.json`.** `settings.schedule` holds the slots, the runner and the agent, and `brain schedule` installs the machine's entry from them, so a reinstall or another machine gets the same schedule. The `on`/`off` value a brain has today is read as before.
8. **Onboarding asks the two slots:** the weekly review (default Monday 08:00, 0075 §6) and the daily catch-up (default 07:30). The user can keep, change or decline each.
9. **`settings.schedule.runner` is `system`, the only runner for now:** launchd on macOS; on Windows a Task Scheduler task set to run only when the user is logged on, to wake the computer to run, and to run as soon as possible after a missed start. The entry runs `claude -p` or `codex exec`, the agent the brain is set up with, pinning a full model id as 0051 requires. The contract checks each platform's behaviour (asleep, off, logged out) against the vendor's documents and records any difference between them in its acceptance (0104 §7). Cron lines elsewhere stay as 0051 has them.
10. **Later, not in 0.17.0:** app runners (the Claude Desktop and Codex apps' schedules) and Hermes (0060, post-1.0).

### C. 0.16.x folds into 0.17.0

11. **No more 0.16.x patches.** Everything pending ships in 0.17.0: 0.16.3's merged rows (CC-362 to CC-365) and 0.16.4's CC-366, with their Release set to 0.17.0. The beta stays on v0.16.2 until 0.17.0.
12. **Kept exception:** a trust or data-loss fix still ships at once as a patch (0106 §1), by docs/releasing.md's routes for a partial `main`.

### What changes in each amended decision

- **0051, Schedules:** "the skill's Run on a schedule section writes the settings" becomes: onboarding asks the slots and `brain.json` keeps them (§7, §8); "Supported first: local `claude -p`" becomes `claude -p` or `codex exec` under the `system` runner, with Windows Task Scheduler beside launchd (§9); "a schedule pins a Claude model" becomes "pins a model of its agent". **What an unattended catch-up applies:** it also applies the plain ticks of a Ready Weekly row (§4): a tick is your explicit decision, word for word, as 0051 requires. The budget, the no-op rule and "interprets nothing" are unchanged.
- **0075:** §1's three sections become §2's two parts (What changed → In short and Highlights; Task analysis → Done this week and Focus first; What needs your decision → Actions, Waiting for you and Clean-up). §2's five decisions become at most 5 Actions and at most 10 doubtful clean-up items; the five-target limit stays for correction groups. §5: one row per week and the no-op rule stay; a clean-up never set Ready carries to next week (§5 here). §6's "applies nothing" becomes: the scheduled weekly run applies the mechanical items of §3 alone, each with an undo, and still applies no proposal, runs no catch-up and asks nothing.
- **0076:** §1's "Merge? … yes" stays for every duplicate but an exact one, which the clean-up merges alone (§3, undo kept); §4's theme draft is also offered as a weekly Action, created on its tick.
- **0096:** §4's "the weekly review, reflection and correction checks write proposals and nothing else" becomes: they write proposals, and the weekly run also applies §3's mechanical items. §7: the row's What needs your decision lines become §2's layout; its Actions and Clean-up are decided by ticks in Notion, applied by a catch-up once the row is Ready; "never taken in as an input" stays for its text, but a catch-up reads a Ready Weekly row for its ticks; the row is Done once nothing in it waits. Other decisions stay in the session.
- **0097 §4:** "`brain schedule` stays launchd-only; on Windows the weekly review is run by asking the agent" becomes: Windows gets a Task Scheduler entry for both jobs, and setup's schedule item is offered on Windows too.
- **0104 §5:** the parity epic's scheduling part is delivered in 0.17.0; the audit of every other difference stays post-1.0 with no release.
- **0106 §1:** "the beta runs on 0.16.x patches" ends at 0.16.2; §1's exception stays (§12). **§4:** 0.17.0 also holds A and B and the folded rows. It still has one Notion migration, owned by the path without Notion AI, and the weekly row's Notion steps join it (Brain Assistant's Weekly review skill and the Instructions' line on Weekly rows); no Notion property or option changes for the row. The skills releases 1.11.2 and 1.11.3, already vendored by CC-364 and CC-365, ship in it, and the rest of the fork work (CC-325, CC-328, CC-352 and the weekly and scheduling skills) shares one more skills release.

## Consequences

- **Tasks (0.17.0 section):** CC-368 writes the contracts first (the schedule in `brain.json`, the Weekly row's layout, the clean-up's item kinds, automatic against ticked, the stale check, the undo, the carry-over); then CC-369 (scheduling in the CLI: launchd and Windows Task Scheduler, `claude -p` and `codex exec`), CC-370 (the clean-up in the CLI), CC-371 (the skills, through one fork PR) and CC-372 (guides, Notion design and template text); U-43 is the author's test on Mac, on Windows and of one weekly row end to end. CC-367 records this decision and folds the 0.16.3 and 0.16.4 rows into 0.17.0.
- **Issue #466** (Quick capture New or Ready): 0048 is unchanged; Quick capture keeps setting Ready, and the question is reopened only with the beta testers' Quick capture use (CC-367's row).
- **Pointers:** an "Amended by 0110" line in 0051, 0075, 0076, 0096, 0097, 0104 and 0106; the release sequence, the cutoff paragraph and a status line in build/TASKS.md; docs/vision.md's roadmap and docs/v2-ideas.md's parity epic.
- **Trust:** nothing changes knowledge without a yes except §3's closed list, each with a commit and an undo; a tick is checked for staleness before it is applied; notes wait for a person.

## Evidence

- The author's scope grill of 2026-11-20 with the coordinator, confirmed the same day and relayed to CC-367: the weekly row and its clean-up (one Weekly row, Your week then Clean-up, safe items applied alone with an undo, tick then Ready, notes wait for an attended catch-up, one open clean-up, no lessons file), scheduling (the schedule in `brain.json`, onboarding's two slots, the `system` runner on launchd and Windows Task Scheduler with `claude -p` or `codex exec`, app runners and Hermes later), and no more 0.16.x patches with the trust exception kept. A third-party memory skill was read in the same session; nothing of it was taken as code, only two ideas (tick then go, Show the change).
- The first beta tester on Windows cannot schedule a catch-up or the weekly review (0097 §4; docs/v2-ideas.md's parity epic).
- Facts checked before writing: spec/cli.md §5.21 (`brain schedule`: launchd, cron lines elsewhere, the machine's entry and nothing in the brain), spec/weekly-review.md §1 to §3 and §11, spec/schema.md §12 (`settings.schedule` `on`/`off`, `settings.weekly`), notion/brain-assistant.md (Weekly review, the Instructions' line on Weekly rows), build/TASKS.md's 0.16.3 and 0.16.4 sections.
