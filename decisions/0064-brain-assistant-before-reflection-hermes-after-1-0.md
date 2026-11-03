# 0064 — A brain assistant in 0.10.0, reflection in 0.11.0, Hermes after 1.0

**Status:** Accepted
**Date:** 2026-11-03
**Amends:** 0061 (release order, 0.12.0 and 0.14.0 dependencies on Hermes); 0060 (release placement only)
**Keeps:** 0059 (0.9.0 scope, refined by 0066), 0052 (reflection's scope), 0061's feature cutoff at 0.14.0, the session-opening scope gate and every architecture rule

## Context
In the 0.9.0 scope review of 2026-11-03 the user changed the roadmap twice. They took Hermes (0060, planned for 0.11.0) out of the pre-launch scope. And they asked for a new release right after 0.9.0: an assistant they can ask, from the CLI, to review their Areas, Domains, Projects and Tasks and catch project-management problems, such as stalled tasks, projects open for too long, projects in the wrong place, missing next steps and needed reorganisation; to recommend changes; to turn their thinking into what to capture, organise or create; and to make the changes with them. 0061 requires an explicit roadmap change for a new feature; this is that change. The same review kept 0.9.0 as one release, added linked repos with a link kit to it (decision 0066), and asked that every Notion space get the Domains database (decision 0065, 0.8.1).

## Decision

### New order

| Release | Scope | Completion evidence |
|---|---|---|
| 0.9.0 | 0059 as decided, plus linked repos with the link kit and per-repo task modes (0066) | 0059's three adoption scenarios plus a fourth: a hub with one connected and one tracked-in-repo linked repo |
| **0.10.0** | **The brain assistant** (below) | On the user's real brain: useful findings on Areas, Domains, Projects and Tasks; changes applied only through Review rows or a yes in chat |
| 0.11.0 | Reflection under 0052, subject to 0055 (CC-65 to CC-67 and U-21 keep their identities) | As 0061 states for reflection |
| 0.12.0 | Cross-agent memory continuity and reliable cited retrieval, for Claude Code and Codex | Useful context survives switching between Claude Code and Codex; current, scoped and cited answers on representative cases |
| 0.13.0 | Weekly digest/review and targeted correction propagation, plus the assistant's scheduled weekly review | As 0061, and a weekly assistant run that leaves only a report and Review rows |
| 0.14.0 | Repeatable onboarding, diagnostics, import/seeding and minimal per-area tracking preferences; the assistant guides a new user | As 0061 |
| 1.0.0 | Productisation, translation, funnel and launch | As 0061 |

**0.14.0 stays the feature cutoff.** The number of releases before it is unchanged: the assistant takes the slot Hermes leaves.

### The brain assistant (0.10.0)
- **What it does.** On request it reviews Areas, Domains, Projects and Tasks: tasks stalled or overdue, tasks without a project, projects active with no recent work or no next step, projects whose tasks are all done but still open, projects that look misplaced or duplicated, Areas with nothing active, Areas without a Domain when Domains is on. It recommends what to close, merge, move or create. It turns what the user says into what should be captured, organised or created. And it answers questions about the state of the user's work.
- **How it changes things.** By default it writes Review rows: one proposal per change, which the user accepts, edits or rejects, as for any other change to existing knowledge (0003). In a live chat it may apply a change directly after the user's explicit yes to that change. It never changes anything silently.
- **What it reads.** Notion live (Tasks exist only there), with the brain's Markdown for context: decisions, meetings, when a project was last mentioned. With Notion unreachable it says so and reviews only what the brain holds. Linked repos tracked in the repo contribute their read-only task rollups (0066).
- **Form.** One skill (a single source for Claude Code and Codex, per 0059) plus a thin Claude Code sub-agent that loads it, so the user can keep a conversation with it.
- **When.** On demand only in 0.10.0. The scheduled weekly review moves to 0.13.0, where it runs unattended under 0051 and writes only a report and Review rows.
- **Boundary with other releases.** Onboarding a new user stays in 0.14.0, where the assistant becomes its guide. Knowledge-level tidying (contradictions, duplicate notes, stale facts) stays reflection's job in 0.11.0. The assistant works on the structure of the user's work, not on the content of their notes.

### Hermes after 1.0
- 0060 stays Accepted as the design for a future Hermes operator; its release placement (0.11.0) is withdrawn. Hermes, Telegram, the learning bridge and native scheduling join the post-1.0 list in 0061, without a promised version.
- 0.12.0 no longer reuses "Hermes's shared knowledge contract": it defines the capture/proposal/promotion boundary for Claude Code and Codex itself, within 0008 and 0009, so a later Hermes can reuse it.
- 0.14.0 no longer reuses "0.11 runtime setup": it reuses 0.9.0's project adoption and setup and the 0.10.0 assistant.

## Consequences
- build/TASKS.md: the 0.10.0 section becomes the assistant (CC-108 to CC-110, U-25); CC-65 to CC-67 and U-21 move to 0.11.0 with their identities; the 0.11.0 Hermes section is removed and noted as post-1.0; 0.13.0 gains CC-111 for the scheduled review; 0.9.0 is broken into CC-100 to CC-107 and U-24.
- 0061, 0060 and 0052 get pointers to this decision; their bodies stay as recorded, and where 0061's table and its 0.12.0 and 0.14.0 sections name Hermes or 0.11.0, this decision's table and "Hermes after 1.0" govern. docs/vision.md and docs/v2-ideas.md follow.
- The assistant's contracts (CC-108) come after 0.9.0's, and its opening grill refines these lines within the agreed boundary.

## Evidence
- The user's scope review, 2026-11-03: Hermes out of scope; the project-manager assistant after 0.9.0, changes by Review rows plus a yes in chat, reading Notion live, a skill plus a Claude sub-agent, on demand with scheduling later, onboarding staying in 0.14.0.
- Decisions [0059](0059-shared-skills-and-connected-workflows.md), [0060](0060-hermes-operator-and-learning.md), [0061](0061-roadmap-and-launch-boundary.md), [0052](0052-reflection.md), [0003](0003-proposal-review-flow.md), [0051](0051-unattended-catch-up-and-schedules.md).
