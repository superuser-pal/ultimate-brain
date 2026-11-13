# 0093 — The 0.15.0 scope grill: the weekly review runs beside the Review page, is the one weekly experience, offers Reports, and runs on Sonnet

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.15.0
**Refines:** [0075](0075-weekly-review-and-targeted-corrections.md) (the weekly review's surfaces and default model, and where §7's trials run (§6 here); its scope and limits are unchanged); [0051](0051-unattended-catch-up-and-schedules.md) (a schedule pins a model)
**Keeps:** 0075 in full; [0088](0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md) §2 and [0090](0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md) (the Review page and the review by grill, CC-240 and CC-241); [0092](0092-move-a-note-to-another-area.md) (CC-251); 0.15.0 as the feature cutoff ([0061](0061-roadmap-and-launch-boundary.md))

## Context

0.15.0 opens with its scope grill (0061). By 2026-11-13, most of it was already decided:
- the weekly review's scope (0075, grilled on 2026-11-07);
- the Review page you can read (0088 §2);
- the review by grill (0090);
- moving a note to another Area (0092, from dogfood #345, in CC-249's triage the same day).

The grill asked only what was still open: the order of the work, how the weekly report meets what Notion already has, how a report reaches a user whose Reports are off, the scheduled run's model, and whether #345 brings more work.

What the repositories show:
- **Brain Assistant already has a `/Weekly review` skill** (notion/brain-assistant.md). It reads the Notion databases and writes six sections: done, decided, goals, projects, waiting on, next week. Read only. CC-111's report would be a second weekly digest beside it.
- **Reports are off by default** (0048). Under 0075 §5, a scheduled weekly report then gets no Notion page, only a file in the brain.
- **A schedule pins one Claude model** (0051), and 0075 §7 asks for numeric budgets from representative trials before implementation.

## Decision

The author chose the recommended option in each question.

1. **Order: CC-111 runs beside the Review-page stack.**
   - CC-240 starts now, and CC-241 stacks on it.
   - CC-111's contracts and its resource-budget trials (0075 §7) start at the same time, in their own worktree. They don't touch the Review page's files.
   - CC-251 takes the first free slot.

   CC-111's implementation tasks are split out after its contracts, as 0075 says.
2. **One weekly experience.** Brain Assistant's `/Weekly review` opens this week's report and walks the user through its What needs your decision items in the 0090 grill style:
   - rounds of three to five questions, options with the recommended one;
   - each item decided where it lives: its Review row, or a task.

   With no report this week, it says so and says how to run one (on demand, or the Monday schedule). It no longer builds its own digest. Its other rules stay: it reads, and it writes only where the grill may write (0090).
3. **Turning on the weekly schedule offers Reports once:** "Turn on Reports so each week's review appears in Notion?", as 0051 does for catch-up.
   - On a yes, Reports are turned on with the existing module steps.
   - On a no, 0075 §5 holds: a file in the brain and a summary at the next attended session.

   The weekly report never publishes with Reports off.
4. **The scheduled weekly run uses Sonnet by default.** The resource-budget trials (§6) measure Sonnet and Opus. The contract records the numbers and confirms the default, or changes it with the reason. The user can pick another model when turning the schedule on (0051).
5. **#345 brings no more work into 0.15.0.** CC-251 keeps 0092's scope. Anything else found while building it is filed as an issue and triaged as usual.

6. **The resource-budget trials run in the author's real brain, not on synthetic brains.** The author chose this in a second round of the same day, for fidelity, after hearing the plan for six synthetic scenarios. It refines 0075 §7 and §8: the trials come before production code, as 0075 says, but on the real brain.
   - **Runs:** two on Sonnet and one on Opus, each capped at 10 USD.
   - **What a run does:** it runs the weekly flow as a prototype in the brain. It reads the brain and the live Notion work state. It writes its output only outside the brain's files and outside this repo, and it changes nothing: no note, no proposal, no Review row, no commit, no apply. The brain's `git status` is the same before and after each run.
   - **No synthetic trial runs.** The edge cases 0075 §8 names (quiet, missed week, partial, repeated finding, correction) are covered by the automated tests of the implementation tasks, on synthetic brains, and by the attended trial after the build.
   - **One report page in Notion Documents** (Reports on). It holds the weekly report as 0075 §1 shapes it, at most five items under What needs your decision, then an **Everything found** section listing every finding beyond the caps: knowledge to fix, stalled or overdue tasks, structural cleanup. It applies nothing and makes no Review rows. It is written only after the author's yes on the finished page. If Reports are off, turning them on is a separate yes.
   - **What reaches this repo:** only numbers (tokens, reads, run time, cost, counts of findings) and the model default. The report's text and the raw outputs stay outside the repo (the author's brain folder or `~/Documents`).

## Consequences

- CC-111's Output and Acceptance gain the `/Weekly review` change, the Reports offer and the model default. The skill's text changes in `notion/brain-assistant.md` and reaches existing spaces through a Notion migration (0022).
- 0.15.0 is four lines of work: CC-240 → CC-241, CC-111 (contracts and trials first), and CC-251. No new feature joins it.
- Work: recorded by CC-252. CC-240 and CC-111 start after this record.

## Evidence

The author's answers of 2026-11-13 (this session); notion/brain-assistant.md (`/Weekly review`); 0048 and 0051 (Reports off by default, the offer, a pinned model); 0075 §5 and §7.
