# 0072 — Ultimate Coach: how the 0.10.0 assistant works

**Status:** Accepted
**Date:** 2026-11-05
**Release:** 0.10.0 (CC-108 to CC-110)
**Amends:** [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md) (the assistant's name, and Review rows as its default)
**Keeps:** 0064's scope (Areas, Domains, Projects and Tasks; on demand; reads Notion live and the brain; one skill plus a thin Claude Code sub-agent; the scheduled run in 0.13.0; onboarding in 0.14.0; knowledge tidying in 0.11.0), 0003, 0061's feature cutoff

## Context
Decision 0064 placed a project-management assistant in 0.10.0 and left its opening grill to refine it. The grill ran on 2026-11-05, while 0.9.2 was being built. It settled six questions that the contracts (CC-108) need answered.

## Decision
1. **Name: Ultimate Coach.** The CLI assistant is called Ultimate Coach. The Notion custom agent keeps the name Brain Assistant and stays a reader inside Notion. The skill, the sub-agent and the guide use "Ultimate Coach"; "brain assistant" in older text means this feature.
2. **A review session is report first, and the user picks.** It shows its findings, each with a recommendation. What the user says yes to in the chat is applied directly. A Review row is written only when the user asks for one ("propose it", "later"), or by the scheduled run in 0.13.0, when no one is there to say yes. This replaces 0064's "by default it writes Review rows" for a live chat; it still never changes anything silently.
3. **Fixed thresholds in the spec.** The signals use defaults written in the contracts, the same for every brain, with no setting in 0.10.0. The starting values: a task with no edit in 14 days is stalled; a task 3 or more days past its due date is overdue; an Active project with no task done and no mention in the brain for 21 days is stalled; an Active project with no open task has no next step. Per-area preferences stay in 0.14.0.
4. **What the user says lands straight in its place.** After the user's yes, a task goes to Tasks in Notion (with Project and Due date when given), a project is created from the Notion template with its brain note, and an idea becomes an Inbox capture for the normal ingest. The yes is the review.
5. **Whole brain, top 10.** Without a scope, it reviews everything and shows the 10 most important findings, worst first (overdue, then stalled, then no next step, then structure), and says how many more there are. The user can say "more" or name an Area, Domain or Project to narrow it.
6. **A dismissal becomes a status where one fits; otherwise it is remembered for 30 days.** When the user skips a finding and a Notion status says why (a task set to Waiting, a project to On hold), it offers that status, and the item is no longer flagged. A finding with no status to set (an Area with no Domain) is remembered as skipped for 30 days, in the brain in Git, with the user's reason.

## Consequences
- CC-108's contracts specify: the signals and their thresholds (3), the ranking and the cap of 10 (5), the direct-apply path after a yes and the Review row only when asked (2), where each kind of ramble lands (4), the status offers and the 30-day dismissal store, its format and location (6), and the name (1).
- CC-109 names the skill and the sub-agent after Ultimate Coach. CC-110 and U-25 test the report-first path, with Review rows only when asked.
- The 0.13.0 scheduled run (CC-111) is the one place where findings become Review rows without being asked, as 0064 already says.

## Evidence
The user's answers in the 0.10.0 opening grill, 2026-11-05 (CC-137), each choosing the recommended option except the name, which the user chose: Q1 name, Q2 report first, Q3 fixed defaults, Q4 straight to its place, Q5 whole brain top 10, Q6 status or a 30-day memory. Decision [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md).
