# 0075 — One weekly review, bounded decisions and targeted corrections in 0.13.0

**Status:** Accepted
**Date:** 2026-11-07
**Release:** 0.13.0
**Release moved by:** [0077](0077-trust-repair-in-0-13-0.md) (2026-11-10): this scope ships in 0.14.0, unchanged
**Refines:** [0061](0061-roadmap-and-launch-boundary.md) and [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md) (weekly knowledge payback, correction propagation and CC-111)
**Keeps:** [0003](0003-proposal-review-flow.md), [0051](0051-unattended-catch-up-and-schedules.md), [0055](0055-domains-capture-and-review.md), [0072](0072-ultimate-assistant.md), [0074](0074-scoped-memory-handovers-and-bounded-recall.md), existing module/publishing rules and the 0.14.0 feature cutoff

## Context

The roadmap commits 0.13.0 to a cited weekly digest, targeted correction propagation and Ultimate Assistant's scheduled weekly review. The opening grill settled how those become one useful experience without another task system, an expanding Review backlog or unpredictable model work. The user wants a short brief, task analysis and a small set of decisions, with past weekly reports directly browsable in Notion.

## Decision

### 1. One weekly experience with three sections

The weekly report has **What changed**, **Task analysis** and **What needs your decision**. Combine knowledge and work-state analysis, share evidence reads and deduplicate findings rather than producing separate digests. Cite material claims and show their freshness; derived reports do not become evidence.

- **What changed:** consequential decisions, changed facts, open questions and useful next actions since the last successful weekly brief. The first run uses seven days. Carry forward uncovered work after partial runs; do not silently mark omitted changes handled. A large gap gets the most consequential changes plus an explicit coverage statement.
- **Task analysis:** examine current outstanding work, including older tasks. Highlight overdue or stalled tasks, recorded blockers and projects without a next step, then recommend a short order of attention with reasons. Reuse the assistant's existing checks and evidence, not invented capacity estimates. Recommendations do not change priorities, dates or statuses without approval.
- **What needs your decision:** prioritise consequential knowledge corrections, then overdue/stalled work, then structural cleanup, within the shared limits below. Link to actionable Review items and their evidence rather than repeating the full underlying material in the brief.

Design the normal experience for **roughly two minutes to read and five minutes to decide**. Provide deeper evidence on request instead of turning the brief into an activity log.

### 2. Two shared limits, including grouped corrections

- At most **five actionable decisions across the whole brief** and **five new weekly Review items in total**; the knowledge and assistant streams do not each receive five.
- At most **five affected targets per weekly run**. A correction affecting three notes consumes three target slots; a proposed task change consumes one. Grouping must not hide fifty edits behind five decision headings. Count additional findings/affected targets and leave them queued; offer more on request.
- Group related correction proposals **by the corrected claim**, with affected notes and before/after statements visible and individual changes selectable. Show the size of the group. Large groups need a bounded preview and a deeper review path.
- Reuse pending proposals and respect prior decisions on retry; updating a weekly report must not duplicate Review items or recreate rejected changes. Contracts define counting, deduplication and continuation within both limits.

These are weekly-run limits, not replacements for catch-up's input cap, reflection's cap, the assistant's interactive pagination or 0074's closing-memory limit. Targets and decisions are separate counts; both limits hold.

### 3. Repeat only what deserves renewed attention

Repeat a finding when its evidence changes, it becomes newly overdue or urgency materially increases. Keep unresolved critical knowledge problems visible. Otherwise show a count and link to existing pending items instead of filling each week's action slots with the same routine findings. Respect existing dismissals and postponements; a new report week does not reset them.

### 4. Automatically queue a targeted check after a meaningful correction

An approved correction that changes meaning queues a targeted check for the **next normal run**, with an on-demand path available. Qualifying changes include facts, dates, owners, decisions and lasting rules. Skip formatting-only edits and routine live-status changes already owned by Notion.

Follow the corrected claim and its related records rather than rescanning the whole brain. Propose changes to affected current restatements through existing review flows. Preserve independently supported statements, historical records and immutable sources; no blind replacement. Propose only well-supported fixes. Mention consequential uncertain matches as needing clarification, without drafting speculative replacements.

Queuing this work does not create an always-running process or an autonomous rewrite loop. The correction itself follows its existing approval/apply flow; additional changes remain proposals. Contracts specify durable queueing, stale-base checks, retry/deduplication and the proposal/group mapping before implementation. The weekly run uses the shared limits when processing such checks; other normal runs retain their own boundaries.

### 5. Weekly history, with existing delivery rules

Create **one report per week**, so past reviews remain directly browsable in Notion when Reports and publishing are enabled. A rerun updates that week's report, not another page; this is distinct from keeping one living report for all weeks. Keep the date range, coverage and partial status visible. Git preserves revisions as usual.

Use the existing report/Notion destination and module rules; do not add another knowledge store, database or reporting module. Reports off means no Notion Report row, and unattended publishing still requires `settings.publish: auto`; use the existing local/next-attended reporting behaviour otherwise. A Notion outage must be surfaced through a channel that is actually available, not by claiming a Notion write succeeded.

Keep the existing **no-op rule**: a quiet run with no new changes or eligible findings creates no report, commit, Notion write or log line. A quiet week does not get an empty archive page. Failures or incomplete coverage still need to be surfaced.

### 6. Scheduled review stays separate from catch-up

When scheduling is enabled, default to **Monday at 08:00 in the user's local timezone**, using the existing scheduler. The same review is available on demand. This decision chooses a product default; it installs no schedule in any brain.

The weekly run reads canonical knowledge and live Notion work state, prepares its report and proposals, and flags unprocessed inputs or unavailable data. It asks no questions unattended and **applies nothing**, including previously approved changes. Do not invoke catch-up first to ingest material or apply approvals; catch-up remains a separate operation under 0051. Queued correction checks may run within the weekly limits. Existing catch-up behaviour is unchanged.

### 7. Bound work and publish honest partial coverage

Select candidates deterministically, read supporting evidence selectively, and avoid open-ended analysis or extra research agents. At the configured token/time budget, stop and publish a useful **partial review** with what was covered, omissions and queued work. Never silently increase spending or describe partial coverage as complete.

Establish numeric resource defaults through representative trials and record them in the contracts **before production implementation is committed**. This record invents no token/time values. Reserve a reliable way to surface partial/failure state, and measure actual token/read/runtime costs rather than treating source-byte counts as billed tokens. These weekly budgets are separate from 0074's 800-token opening-memory budget.

### 8. Acceptance checks usefulness, attention and trust

Use representative synthetic **busy, quiet, missed-week, partial-run, repeated-finding and correction** scenarios, followed by **one attended trial in the user's private brain**. A synthetic-only pass does not establish daily usefulness. Keep personal evidence outside the product repo; product evidence uses synthetic cases and non-personal summaries of outcomes/timing.

Check the two-minute reading/five-minute decision targets, meaningful selection and task recommendations, citations/freshness, both shared caps, grouped selective approval, preservation of independent/historical evidence, uncertain matches, queue continuation, retries/deduplication, existing dismissals and zero unapproved changes. Verify one page per week with same-week refresh, no writes for quiet runs, module/publishing behaviour, unavailable Notion and the separation from catch-up. Test partial coverage and budget exhaustion without losing queued work or relaxing limits.

## Consequences

- CC-111 retains its identity and release; its scheduled assistant review joins the one weekly experience under this decision. Existing assistant findings are reused, while the weekly attention limits are shared across work and knowledge.
- Claude Code writes the contracts, prepares the representative resource-budget trials, decomposes the smallest implementation tasks and builds them in task worktrees. This is a planning record only: no CLI/schema/skill change, new proposal implementation, brain operation or schedule installation.
- Contracts must define the weekly report shape and identity, three-section rendering alongside the existing generic report contract, change-window/coverage bookkeeping, correction queue/proposal grouping, target/decision counting, budget enforcement and acceptance evidence. They implement these choices without creating a second tracker, approval queue or knowledge store.
- 0.11.0 reflection, 0.12.0 memory/retrieval, 0.14.0 onboarding and the launch cutoff keep their scope and placement.

## Evidence

- The user's 2026-11-07 opening grill: one combined weekly brief with task analysis; two minutes to read/five to decide; targeted checks after meaningful approved corrections; task problems plus recommended order; changes since the last successful brief; five decisions; selective repetition; catch-up kept separate; claim-grouped selective review; Monday 08:00 local scheduling; five affected targets; one report per week with Notion history; partial reviews at budget; well-supported fixes only; quiet weeks silent; representative scenarios plus an attended private-brain trial. The user confirmed the final scope summary.
- [Roadmap and payback scope](0061-roadmap-and-launch-boundary.md), [assistant's scheduled review](0064-brain-assistant-before-reflection-hermes-after-1-0.md), [unattended/module/no-op rules](0051-unattended-catch-up-and-schedules.md), [assistant checks and dismissals](0072-ultimate-assistant.md), [memory boundaries](0074-scoped-memory-handovers-and-bounded-recall.md), [CLI/report contracts](../spec/cli.md) and [schema](../spec/schema.md).
