# 0111 — Post-launch candidates from the LifeOS study

**Status:** Accepted
**Date:** 2026-11-21
**Release:** post-1.0, none assigned (recorded by CC-374 in 1.0.0's section; nothing is built)
**Amends:** [0051](0051-unattended-catch-up-and-schedules.md)'s rule that an unattended run interprets no text you wrote: a rule the user stated and approved in a session, kept in "My rules", is applied as written by a scheduled run (§2); it takes effect only when candidate 1 is built
**Keeps:** the feature cutoff and the release sequence ([0061](0061-roadmap-and-launch-boundary.md), [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md), [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md)); [0008](0008-agent-memory-store.md) (memories never reach Notion); [0009](0009-memory-scope-levels.md) and [0074](0074-scoped-memory-handovers-and-bounded-recall.md) (reach, approval, the closing review); [0015](0015-notion-access-via-mcp.md) (only the agent reads Notion); [0060](0060-hermes-operator-and-learning.md) and [0030](0030-capability-based-onboarding-profiles.md) as they are; [0104](0104-product-design-principles.md)

## Context

On 2026-11-17 Codex studied the open-source LifeOS project and proposed fifteen post-launch candidates (L01 to L15). Claude Code reviewed that report the same day, found three defects (fixed by CC-345 in 0.16.1) and wrote a revised backlog with split candidates and three new ones (N01 to N03). Both documents are kept outside this repo.

On 2026-11-21 the author asked for an independent evaluation of both against the repository as it is now, and then answered the three questions that could change the selection. This decision records the selection and those answers. It assigns no release and creates no implementation task: each candidate still needs its opening scope review (0061), the design-principle checks (0104), a task and a contract.

What the evaluation found in the code and contracts of that day:
- Only brain-query reads memories: no other skill calls `brain recall`. The response style and the user's "My rules" are in the brain's `AGENTS.md`.
- `brain recall` takes exactly one of `--pack` and `--search`: nothing lists what reaches a caller.
- `brain status` reports, per scheduled job, only whether its entry is installed and matches the schedule in `brain.json`.
- A report is withheld when a note it cites is excluded; nothing happens when a cited decision is superseded.
- Report mode is written for a project or an area. Prep, in Notion and from the session, reads Notion and cites nothing.
- All 23 `dogfood` issues are closed and concern setup, sync, migrations and structure; one concerns the quality of what the brain produces.

## Decision

### 1. Five post-launch candidates

1. **A rule you state once takes effect in the brain's skills.** Today "remember this" writes a memory, and ingest, catch-up, the weekly review and the assistant never read memories. Shape: §2.
2. **"What do you use about me here?", answered in chat.** One sourced list for the folder the session is in: the response style, "My rules", the memories that reach it and each Area's What to track, each line correctable through the existing proposal. Never stored as a view, a report or a Document and never published to Notion: a view can't rest on a memory (CC-345), and reach depends on the caller.
3. **The brain says when a scheduled run didn't happen.** The slots in `brain.json` are compared with the runs the log records; the next session and the weekly row name a run that was due and left no record, with its fix. A run that found nothing reads differently from a missing one. On macOS and Windows alike (0104 §7).
4. **A report says when what it rests on has changed.** A report that cites a decision since superseded, or a fact since changed, shows a stale label and offers a refresh. It is not withheld: this is not an eligibility failure. No receipt, judge or "verified" label: a check can show that a cited note is eligible and current, not that it supports the claim.
5. **Reports about a person or an organisation.** Report mode takes a person or an org as its subject, cited and refreshable, as a Document with Origin Report. No new database (0104 §3), and no scoring of people.

### 2. How candidate 1 works (the author's answers)

- **A rule about brain work is saved in "My rules".** When the user says "remember this" about how the brain should work (minutes, ingest, reports), the closing review writes it, after the user's yes, into "My rules" in the brain's `AGENTS.md` instead of a memory. The skills are not changed to load memories. A lesson for a linked repo stays a memory with its reach, as today.
- **Only a rule the user stated steers a scheduled run.** A rule the agent inferred from the user's behaviour is not written to "My rules"; it is offered as today and applies only once the user states it. This amends 0051's "interprets no text you wrote" with one exception: a rule the user stated and approved in a session is their instruction, applied as written.
- **To check before it is built:** that a scheduled run and the assistant's sub-agent load "My rules" in both agents. The evaluation did not verify it.

### 3. The brain's program still never reads Notion

0015 stays. A check that skips a scheduled run when "nothing changed" is not built: what waits (a Ready meeting, an Inbox row, a ticked weekly item) is in Notion, where the program can't look, so it would skip exactly when work waits. Reopen only if testers report the cost of scheduled runs **and** the logs show most runs find nothing; a skip would then require every source read, and any unread source means run.

### 4. What the evidence orders

The beta's first independent reports decide the order. If they stay about setup and keeping the brain running, candidate 3 comes first and the others wait. Reports such as "I told it this already" or "what did we agree with this client?" move candidates 1, 2 and 5 up.

### 5. Not selected

| Candidate | Disposition |
|---|---|
| Meeting preparation (L03); a phone operator (L15); long-open questions (L11) | Already covered: Prep in Notion and from the session (0.17.0); 0060; a tracked question is a task, which the assistant's stalled signal appears to read (to confirm if it is raised again) |
| Evidence-led context check-ins (L02); goal-aware advice and capture relevance (L06, L12); personal recipes (L07); research dossiers with web research (L08); capability profiles (L09); context-size checks (L14); calendar-triggered prep | Deferred, each until its own evidence appears |
| A feedback-classification loop (L04) | Rejected as machinery: capture exists, and 0110 §6 rejected a lessons file |
| A kind field on memories; memories loaded by every skill (the revised L04-kind, L04a) | Replaced by §2 |
| Dismissals keyed by inputs (L06a) | Rejected: the 30-day skip is 0072 §6's rule, with no complaint |
| Retired skill folders moved instead of deleted (N01) | Rejected: Git keeps every tracked file; an uninstall guide is deferred |
| A phrase check for instruction-shaped text (N02) | Rejected: a user's own rule reads like an instruction; who stated a rule is the usable signal (§2) |
| A wake gate for scheduled runs (N03) | Deferred by §3 |
| A held-out variant per prompt-level fix (L04b) | A release practice to consider with the complete native acceptance, not a feature |

## Consequences

- `docs/v2-ideas.md` lists the five candidates as post-1.0, evidence-gated, with the answers of §2 and §3.
- An "Amended by 0111" line in 0051.
- No spec, CLI, skill, template, Notion or CHANGELOG change. The feature cutoff and 0.17.0's, 0.18.0's and 1.0.0's scope stay as agreed.
- Promoting a candidate is an explicit roadmap change, made in its own scope review.

## Evidence

- The author's request of 2026-11-21 for the evaluation, and the three answers given in that session: "ok, this works" to rules stated by the user steering scheduled runs; "let's go with this" to saving a rule in "My rules"; and keeping 0015 after the question of a Notion change the program would miss. The author then chose to record the selection as backlog.
- Read on 2026-11-21: `.agents/skills/` (only brain-query names `brain recall`), `src/commands/recall.ts`, `src/lib/schedule.ts` (`scheduleStatus`), `src/lib/lint.ts` (`view-stale`, `report-source-excluded`), `src/lib/suppressions.ts` and `src/commands/report.ts` (CC-345), `.agents/skills/brain-query/references/report.md`, `.agents/skills/ultimate-assistant/references/brain-assistant-skills.md`, `spec/memory.md`, `spec/assistant.md` §3, `templates/brain/AGENTS.md`, and the `dogfood` issues.
- LifeOS at its commit of 2026-11-05, read statically and never run. Its correction read-back exists because captured corrections had no reader; its receipts go stale only when the artifact changes; its wake gate skips when a source can't be read; it makes identity and operational-rule edits always wait for approval, after a security advisory.
