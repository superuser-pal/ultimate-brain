# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex (until decision 0044; since 0063 the `pr-reviewer` sub-agent reviews, Codex optionally) · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked` · `dropped` (won't ship; skipped by `release.mjs`).
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

## Agreed release sequence to launch (2026-10-31)

Decisions [0059](../decisions/0059-shared-skills-and-connected-workflows.md), [0060](../decisions/0060-hermes-operator-and-learning.md) and [0061](../decisions/0061-roadmap-and-launch-boundary.md), as amended by [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) (2026-11-03) and [0069](../decisions/0069-skills-from-the-fork-in-0-9-2.md) (2026-11-04), supersede older release-placement references below. 0.8.0 implementation continues unchanged. **Each human-led product development session for 0.9.0 onward starts with a grilling scope review and confirmed shared understanding before implementation.**

| Release | Committed scope |
|---|---|
| 0.8.0 | Existing buttons, Domains, selected evidence and editable Review |
| 0.8.1 | Review inside the building session (0063), release preflight, the Domains database in every space (0065) |
| 0.9.0 | Public shared-skills fork; standard/Notion-connected software and general workflows; setup/adoption; compatible pins and update awareness (0059); linked repos with the link kit (0066); skills built from the product's `skills/` (phase A); Type on Domains and Lifecycle only where the brain creates the row (0070) |
| 0.9.1 | A simpler Notion: Concepts and Reports into Documents, reviewed-only knowledge in Notion, to-dos as tasks, Orgs · Employer (0071) |
| 0.9.2 | The package ships the fork's released skill snapshot, and skills are written in the fork (phase B, CC-105; 0069); the 0.9.1 dogfood fixes and CC-116, CC-118 (CC-133) |
| 0.10.0 | The brain assistant: reviews Areas, Domains, Projects and Tasks, recommends, and changes through Review rows or a yes in chat (0064) |
| 0.11.0 | Reflection (0052); CC-65 to CC-67 and U-21 retain their identities |
| 0.12.0 | Cross-agent memory continuity and reliable cited retrieval, for Claude Code and Codex |
| 0.13.0 | Weekly digest/review and targeted correction propagation; the assistant's scheduled weekly review |
| 0.14.0 | Repeatable onboarding, diagnostics, selected import/seeding and minimal per-area tracking preferences |
| 1.0.0 | Productisation, translation, funnel and launch readiness |

**0.14.0 is the feature cutoff.** Prefer 1.0 release candidates for preparation; an extra preparation version needs an explicit bounded scope. Dogfood/issues still produce triaged fixes in the relevant release or a patch; new features stay post-1.0 unless the user explicitly changes the plan. No connector release at 0.15.0 is committed. Hermes (0060) is post-1.0 (0064).

Future implementation tasks are decomposed by Claude Code after their opening scope grill and contracts, using the work packages in 0059/0060/0061; this table does not start them. Preserve existing task/changelog identities. Recovery, integrity and visibility needed by a release are prerequisites for that release, not a reason to expand feature scope indefinitely.

---

> **2026-10-28 — Status: 0.5.0 is released and in the user's brain. U-18 is closed: the re-read and the report refresh passed, Keep failed and Fix wasn't tried. Its findings, decided in a grill on 2026-10-28, are decisions 0048 (modules, simpler rows, buttons), 0049 (Documents) and 0050 (area homes), planned as 0.6.0 (CC-55 to CC-59) with one Notion migration, 0010. The agency brain moves in after 0.6.0.**
> - **2026-10-29, CC-60 (planning):** two third-party vault skills reviewed (reviews/08) and grilled with the user: decisions 0051 (unattended catch-up and schedules) and 0052 (reflection), Accepted 2026-10-29 (#147). Plan: 0.6.1 skills audit (CC-61), 0.7.0 the brain runs itself (CC-62 to CC-64, U-20, after U-19), 0.8.0 the brain tidies itself (CC-65 to CC-67, U-21, after the agency brain moves in). Order before them unchanged: release 0.6.0, `brain upgrade` and migration 0010, U-19.
> - **2026-10-29, U tasks deferred:** the user runs U-19 to U-22 at the end, after 0.8.0 is built; building goes on in the planned order (CC-61, then 0.7.0, 0.7.1 and 0.8.0).
> - **2026-11-03, CC-95 (planning):** the 0.9.0 scope review: decision [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) (the brain assistant in 0.10.0, reflection in 0.11.0, Hermes after 1.0, the assistant's weekly run in 0.13.0); 0.9.0 stays one release and adds linked repos with the link kit (decision 0066, CC-99); decision 0065 (Domains database in every space) shipped in 0.8.1. 0.9.0 is broken into CC-97 to CC-107 and U-24, built in parallel worktrees.
> - **2026-11-03, CC-91:** decision [0063](../decisions/0063-claude-sub-agent-reviews.md): the `pr-reviewer` sub-agent (Sonnet) reviews every PR and posts `Review (Claude reviewer): pass at <sha>`, which `merge-ready` accepts; Claude Code builds on Opus; Codex reviews only when the user asks.
> - **Claude Code builds, Codex reviews (decision 0044, CC-39):** from 2026-10-21 every task is Claude Code's; the open Codex tasks became CX-39 → CC-40, CX-33 → CC-41, CX-37 → CC-42, CX-38 → CC-43.
> - **Merging (decision 0040):** the user merges on the GitHub PR page, with the PR's `merge-ready` status in view; `merge.mjs` is optional; agents never merge. `main-guard` fails only on a commit that came from no PR.
> - **0.4.0 (released 2026-10-21):** theme (CC-35): the brain gives back (decisions 0041–0043). Its Notion checks (the 5-minute bar, the Full text box, Ask → Report) are closed in U-15.
> - **Review order (CC-27):** the done commit comes before the verdict; the reviewer posts `Review (<agent>): pass at <sha>` last.
> - **2026-10-29, CC-69 (planning):** decision 0054 (buttons that run Brain Assistant: Tidy capture, Write up, Refresh report), accepted by the user in a grill with Codex, plans 0.7.1 (CC-70 to CC-73, U-22).
> - **2026-10-31, CC-86 (planning):** decision [0056](../decisions/0056-buttons-move-into-0-8-0.md) moves the Brain Assistant buttons (CC-70 to CC-73, U-22) from 0.7.1 into 0.8.0; 0.7.1 becomes CC-83 to CC-85.
> - **2026-10-30, CC-74 (planning):** decision [0055](../decisions/0055-domains-capture-and-review.md), accepted in the user's grill, assigns optional Domains, Won't Do, voice capture, subject selection and editable Review to **0.8.0** (CC-74 to CC-82, U-23). Reflection (CC-65 to CC-67, U-21) moves to **0.9.0**; 0.7.0 and 0.7.1 keep their scope (decision [0056](../decisions/0056-buttons-move-into-0-8-0.md), 2026-10-31, later moved the buttons into 0.8.0 and left 0.7.1 as CC-83 to CC-85). This supersedes the earlier release order above; user acceptance runs remain deferred until the builds are ready. The user explicitly asked Codex to record CC-74 while Claude Code was busy; implementation ownership otherwise stays with Claude Code, and CC-74 needs independent review.
> - **2026-11-05, CC-133 (planning):** the 0.9.2 scope check: one 0.9.2 shipped with CC-105 (0069 kept), its spec split out as CC-134; dogfood #221 → CC-135, #220 → CC-136; CC-116 and CC-118 move from 0.10.0 to 0.9.2; the 0.10.0 opening grill runs while 0.9.2 is built.
> - **Untriaged `dogfood` issues:** 0 (#220 → CC-136, #221 → CC-135, 2026-11-05; #143–#146 → CC-68, 2026-10-29; #137 → CC-59).
> - **Earlier:** v1 waves 1–4 and dogfood findings 1–24 (the Wave 4 table) are in [HISTORY.md](HISTORY.md).

## Why this split

**Now (decisions 0044, 2026-10-21, and 0063, 2026-11-03):** Claude Code builds every task: the contracts, skills, prompts and Notion design, and the TypeScript CLI with its tests and fixtures. The `pr-reviewer` sub-agent reviews every PR against its acceptance, its decisions and `spec/`, and builds nothing; Codex reviews when the user asks. Contracts still come first.

**Waves 1–4 and 0.2–0.3 (history):**
- **Claude Code** had the full design context from the research and grilling sessions, so it owned the things that encode judgment: the schema and CLI contracts, the agent skills and prompts (ingest, apply, sync, query), the Notion design, and the evaluation of meeting extraction.
- **Codex** got well-specified, testable engineering: the TypeScript CLI that does the deterministic work (IDs, frontmatter, index, lint, proposals, apply, views, link, init), its tests and fixtures.
- **Contracts came first** (wave 1) so both could work in parallel without guessing.
- Every task was reviewed by the other agent.

**Done releases (v1 to 0.9.2)** are in [HISTORY.md](HISTORY.md): read it only when a task or decision points there.

## 0.10.0 — The brain assistant (decision 0064)

An assistant you ask, from the CLI, about the structure of your work: Areas, Domains, Projects and Tasks. It finds what's stalled, misplaced or missing, recommends, turns your thinking into captures, tasks and projects, and makes changes through Review rows, or directly after your yes in a live chat. On demand; the weekly scheduled run is CC-111 in 0.13.0. Starts after 0.9.0 is released, with its opening scope grill. The grill ran on 2026-11-05 (CC-137): decision [0072](../decisions/0072-ultimate-assistant.md) names it **Ultimate Assistant**, shows a report first and applies what you say yes to, with Review rows only when you ask.

**Plan (2026-11-06, CC-139):** the main session writes CC-108; beside it, build agents take CC-140 (fixtures), CC-141 (history move) and CC-138 (`main` requires `merge-ready`). Once CC-108 is on `main`, CC-109 is split into slices along its contracts and built in parallel; CC-110 runs on CC-140's fixtures.

### CC-108 · Contracts for the brain assistant (decision 0064) · `done` (#234)
**Release:** 0.10.0
**Changelog:** contracts for the brain assistant: what it checks in Areas, Domains, Projects and Tasks, how each finding becomes a Review row, and when it may change something directly.
**Output:** per decision 0072's six answers (the opening grill, 2026-11-05): a spec for the checks (signals and thresholds: stalled and overdue tasks, tasks without a project, active projects with no recent work or no next step, finished but open projects, misplaced or duplicate projects, empty Areas, Areas without a Domain), the proposal each finding makes (including how a Review row changes a Notion-owned field such as a project's Status), the direct-apply rule in a live chat, reading Notion live and linked repos' rollups, the report, the sub-agent file, any CLI helper (`brain` commands the skill needs).
**Acceptance:** a context-free Sonnet sub-agent reading only the contracts lists no question it would need answered to build CC-109; schema examples validate for each new proposal shape.

### CC-142 · Split CC-109 into four parallel tasks along spec/assistant.md §12 · `done` (#235)
**Release:** 0.10.0
**Changelog:** development only: CC-109's build is split into CC-143 (findings and skips in the CLI), CC-144 (Notion-owned changes and field moves as proposals), CC-145 (the sub-agent, templates and the Review migration), with CC-109 keeping the skill, its fork release and the blind run.
**Output:** spec/assistant.md §12 (merged in CC-108, #234) split along its seams, so four agents can build at once: CC-143, CC-144 and CC-145 start from `main` in parallel; CC-109 writes the skill in the fork alongside them and vendors and blind-runs it once the three are on `main`. This file only: the four rows.
**Acceptance:** every item of spec/assistant.md §12 belongs to exactly one of CC-109, CC-143, CC-144, CC-145; each new row has a Release, Changelog, Output and Acceptance line; CC-109 changes only its Output and Acceptance; no other task's row changes; `pr-format` and the leak check pass.

### CC-143 · `brain assistant findings` and `brain assistant dismiss` (spec/assistant.md §3, §8) · `todo`
**Release:** 0.10.0
**Changelog:** `brain assistant findings` computes Ultimate Assistant's findings from your brain and a Notion snapshot (stalled and overdue tasks, finished or stalled projects, misplaced or duplicate projects, Areas with nothing active or no Domain), ranked, top 10 first, with your skips left out; `brain assistant dismiss` remembers a skip for 30 days.
**Output:** per spec/assistant.md §3 (terms, thresholds, signals, recommendations, scope, ranking and the cap), §8 (skips) and spec/cli.md §5.31: `brain assistant findings` and `brain assistant dismiss` (add and remove), the dismissal store `_assistant/dismissals.json` and the lint rule `assistant-dismissals`, test-first in `src/commands/assistant*` with synthetic fixtures; the test that validates `spec/examples/assistant/` against assistant.schema.json. No skill, no proposal kind, no template. A spec gap goes into the spec first, in the same PR.
**Acceptance:** tests per signal (fires at its threshold, not one day before), ranking and the cap with `--number-from`, scope filters, dismissals (active, expired, removed) and the rejected-Suggestion skip; `brain assistant findings` on a sandbox from `eval/acceptance-0.10.0` returns exactly planted.json's `planted` and none of `not_flagged`; the examples test passes; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-144 · Notion-owned changes and field moves as proposals (spec/assistant.md §6) · `todo`
**Release:** 0.10.0
**Changelog:** a Review row can propose a change to a Notion-owned field, such as a task's Status or a project's Status, or a move of a project to another Area, and the brain applies it after your yes.
**Output:** per spec/assistant.md §6 and §7 and the schema §11, §14 and spec/cli.md sections it names: the proposal kinds `notion_change` and `set_field` in `proposal new`, `apply` (with `data.notion_writes`), `sync apply` and `sync render` (the Suggestion row: Kind `Notion Change` or `Set Field`); `brain proposal settle`; `sync tasks --direct` for a task created from a chat; test-first, synthetic fixtures. No skill text, no template, no Notion migration. A spec gap goes into the spec first, in the same PR.
**Acceptance:** tests: each `notion_change` property (task status, due, project, area; project status; area archived) proposed, applied to `notion_writes` and settled `applied`, `stale` and left `approved` on a failed write; `set_field` for a project's `area` (its open tasks follow, as §6.1 says) and an Area's `domain`, then rendered; a decided Suggestion row read by `sync plan` and applied by `sync apply`; `DUPLICATE_PENDING`; `sync tasks --direct` renders a task with no meeting or source; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-145 · The ultimate-assistant sub-agent, the brain templates and the Review migration (spec/assistant.md §10) · `in progress`
**Release:** 0.10.0
**Changelog:** a brain gets the `ultimate-assistant` Claude Code sub-agent (`claude --agent ultimate-assistant`), and the Review database gains the Suggestion rows Ultimate Assistant writes when you ask it to propose a change.
**Output:** per spec/assistant.md §10 and §12: `templates/brain/.claude/agents/ultimate-assistant.md`; `brain init` and `brain upgrade` write it, and its `product-file` check; `templates/brain/AGENTS.md`'s operations row (with the `report only` hand-off); the next Notion migration (`notion/migrations/0022-…`): Review · Kind gains `Notion Change` and `Set Field`, the Type formula gains **Suggestion** (docs/notion-space-design.md §3.10), with the agent and by-hand split and a Verify list as earlier migrations have; docs/notion-space-design.md and notion/prompts as they follow. No CLI proposal logic, no skill text.
**Acceptance:** tests: `init` writes the sub-agent file, `upgrade` writes and updates it, and the `product-file` check flags an edited copy; the migration says which steps the agent does through the API and which you do by hand, and its Verify list names the Kind options and the formula result; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-109 · The brain-assistant skill and its Claude sub-agent (decision 0064) · `todo`
**Release:** 0.10.0
**Changelog:** "review my projects" finds stalled tasks, finished projects still open, misplaced projects and missing next steps, recommends what to do, and turns what you say into captures, tasks and projects, changing nothing without your yes or a Review row.
**Output:** per spec/assistant.md §1 to §9 and §12 (CC-142 split the CLI, templates and migration into CC-143, CC-144 and CC-145): the skill `ultimate-assistant` in the fork, with the `notion_writes` step in brain-apply, brain-sync and brain-catch-up, brain-howto and the guide, in one fork PR and the release ultimate-brain-skills 1.2.0 (`cli` `>=0.10.0-0 <0.11.0`); the skill is written in the fork beside CC-143 to CC-145, and the product PR vendors the release once those three are on `main` (skills-delivery §9.5). Ask the user before creating the fork release.
**Acceptance:** CC-109's blind run passes as spec/assistant.md §12 defines it, in a sandbox from eval/acceptance-0.10.0 with the fork branch's skill installed: the report's findings over the first page and "more" are exactly planted.json's `planted` and none of `not_flagged`; a yes on a Notion-owned change, a brain-owned move and a merge, a "propose N", a skip with a status offer and one without, and a ramble with a task, a project and a capture each land as §6 to §8 say; a write changed first in notion-sim settles `stale`; an injected failed write stays `approved` and is carried out first next session; a `report only` run writes nothing; `brain lint` is clean; the vendored snapshot's integrity matches the fork release; the skill checks and the leak check pass.

### CC-138 · `main` requires `merge-ready` · `done` (#231)
**Release:** 0.10.0
**Changelog:** development only: a ruleset on `main` requires the `merge-ready` status, so a PR can't merge without its format, its ticked boxes, its `done` (#N) and a reviewer's pass at its head.
**Output:** the user's answer on CC-116 (2026-11-05): a decision amending 0040's "it informs, it doesn't block" now that the repo is public (a free ruleset can require a status); the ruleset requiring the `merge-ready` commit status on `main`, with the repo admin as bypass actor so `release.mjs` can still push its release commit; what the user does when no reviewer can run; AGENTS.md and docs/releasing.md. The user turns the ruleset on; agents don't change repo settings.
**Acceptance:** the decision names the bypass and the case of an unavailable reviewer; on a test PR the Merge button stays disabled while `merge-ready` is red and enables once it is green; the next `release.mjs` push to `main` goes through the bypass; the leak check passes.

### CC-110 · 0.10.0 acceptance (decision 0064) · `todo`
**Release:** 0.10.0
**Changelog:** development only: end-to-end acceptance of the brain assistant on a synthetic brain, attended, with Review rows and chat approvals.
**Output:** docs/acceptance-0.10.0.md: a scenario per finding kind, the Review-row path and the chat-yes path, a linked repo's rollup reviewed, Notion unreachable.
**Acceptance:** every scenario passes with its evidence; no change happens without a Review row or a yes; the Review workload of one run stays within the cap the contracts set.

### CC-137 · Record the 0.10.0 opening grill: Ultimate Assistant (decision 0072) · `done` (#223)
**Release:** 0.10.0
**Changelog:** development only: the 0.10.0 opening grill is recorded as decision 0072, which names the assistant Ultimate Assistant and settles how a review session goes.
**Output:** decision 0072 from the user's answers of 2026-11-05 (name, report first, fixed thresholds, where a ramble lands, whole brain top 10, dismissals); an "Amended by" pointer on 0064; this file: the 0.10.0 intro and CC-108's Output point to 0072, and the 1.0.0 section notes the Notion agent's rename. No code, no spec.
**Acceptance:** 0072 records each of the six answers as the user gave them; 0064 points to it; no other task's row changes except CC-108's Output; the 1.0.0 section notes the Notion agent's rename; the leak check passes.

### CC-139 · Plan 0.10.0: acceptance fixtures and the history move beside the contracts · `done` (#230)
**Release:** 0.10.0
**Changelog:** development only: 0.10.0 gains CC-140 (the acceptance fixtures) and CC-141 (finished releases move to HISTORY.md), built beside CC-108's contracts with CC-138.
**Output:** the user's plan of 2026-11-06 for 0.10.0: CC-108 written by the main session; in parallel, CC-140, CC-141 and CC-138 by build agents; CC-109 split into slices once CC-108 is on `main`; CC-110 runs on CC-140's fixtures. This file only: the 0.10.0 intro and the two new rows.
**Acceptance:** CC-140 and CC-141 each have a Release, Changelog, Output and Acceptance line; no other task's row changes; `pr-format` and the leak check pass.

### CC-140 · Acceptance fixtures for Ultimate Assistant (decision 0072) · `done` (#233)
**Release:** 0.10.0
**Changelog:** development only: a synthetic brain and a synthetic Notion space with planted project-management problems, for testing Ultimate Assistant.
**Output:** eval/acceptance-0.10.0/harness/, reusing the 0.9.0 harness (eval/acceptance-0.9.0/harness: install.sh, make-sandbox.sh, the notion-sim stand-in; copy or call, don't change 0.9.0's files): a fixture brain (synthetic names only, every module on, Domains on) and a notion-sim state with Areas, Domains, Projects and Tasks holding, each findable: a task with no edit for 20 days; a task 5 days overdue; a task with no project; an Active project with no task done and no brain mention for 30 days; an Active project with no open task; an Active project whose tasks are all done; a project under the wrong Area (its notes and meetings all belong to another Area); two projects that look like duplicates; an Area with nothing active; an Area without a Domain; a task already Waiting (not to be flagged); plus enough healthy rows that the planted ones aren't all there is, and more than 10 findings in total so the top-10 cap and "more" can be tested. A manifest (eval/acceptance-0.10.0/planted.json) lists each planted problem with its page ids and the signal that should find it; dates are relative to a fixed `as_of`, so the fixtures don't age. A README says how to make a sandbox. No CLI or skill change: signal names follow decision 0072 and the task text above; CC-108 may rename them, and a later commit follows.
**Acceptance:** `make-sandbox.sh` builds a sandbox whose `brain lint` is clean and whose notion-sim state loads; a check script confirms that every row in planted.json exists in the state with the dates and relations that make it a finding at `as_of`, and that the healthy rows trip none of 0072's thresholds; the leak check passes.

### CC-141 · Move the finished 0.9.x releases to HISTORY.md · `done` (#232)
**Release:** 0.10.0
**Changelog:** development only: the 0.8.1, 0.9.0, 0.9.1 and 0.9.2 sections move from TASKS.md to HISTORY.md, as AGENTS.md asks after each release.
**Output:** the 0.8.1, 0.9.0, 0.9.1 and 0.9.2 sections of build/TASKS.md moved verbatim to the end of build/HISTORY.md, in release order (0.8.1 added at the user's answer of 2026-11-06, so HISTORY.md stays in release order); the "v1 to 0.8.0" lines in both files say 0.9.2; TASKS.md keeps the release table, the status notes and the open releases; any link in docs or decisions that points at those sections still resolves; release.mjs and pr-format still find every done task (they read both files).
**Acceptance:** `git diff` shows the sections removed from TASKS.md and added to HISTORY.md with identical text; `npm run test:scripts` passes; `node scripts/release.mjs 0.10.0 --dry-run` lists no 0.9.x task; the leak check passes.

## 0.11.0 — The brain tidies itself (decisions 0052, 0061, 0064)

Reflection across notes: contradictions, stale facts, duplicates, promotions and recurring themes as Review rows, never edits. Starts after the agency brain has moved in and 0.8.0's Review and evidence-selection contracts are in place. Candidates must respect 0055's excluded-evidence rules.

### CC-65 · Contracts for reflection (decision 0052) · `todo`
**Release:** 0.11.0
**Changelog:** contracts for reflection: candidates, the proposal fingerprint, and three new lint warnings.
**Output:** spec/cli.md: `brain reflect --candidates` (its four signals, the window, which lifecycles each signal reads, the cluster JSON, how fingerprints already on rejected or pending proposals are left out); the `orphan`, `note-size` and `near-duplicate` warnings in §5.10, with the name-matching rule; §6's reflection sequence: each finding's proposal kind, the cap of 10 rows and its order, a theme's draft and its Review notes row, the report, unattended. spec/schema.md: `fingerprint` on proposals and how it is formed.
**Acceptance:** Codex's review finds CC-66 and CC-67 buildable from the contracts with no spec question; schema examples validate for a `merge` and a `contradiction` proposal carrying a fingerprint.

### CC-66 · `brain reflect --candidates`, fingerprints and the new lint warnings (decision 0052) · `todo`
**Release:** 0.11.0
**Changelog:** `brain reflect --candidates` finds likely duplicates, overtaken notes, notes that may disagree and recurring terms; proposals carry a fingerprint; lint warns on orphans, oversized notes and near-duplicate names.
**Output:** per CC-65: the command, `fingerprint` in `brain proposal new` and its validation, the three lint warnings, the code and tests.
**Acceptance:** tests on the fixture brain: two people "María López" and "M. Lopez" give a near-duplicate candidate and a `near-duplicate` warning; once a `merge` with their fingerprint is rejected, `--candidates` no longer gives the pair; a reviewed person note older than two meetings naming her gives an overtaken candidate; a term in three sources with no note gives a recurring-term candidate, and in two it doesn't; a 12 KB concept gives `note-size`, a 12 KB source doesn't; a concept nothing references and with no project or area gives `orphan`.

### CC-67 · The brain-reflect skill (decision 0052) · `todo`
**Release:** 0.11.0
**Changelog:** "tidy the brain" finds contradictions, stale facts, duplicates, promotions and recurring themes, and puts at most 10 of them in Review as proposals; it can run weekly on a schedule.
**Output:** skills/brain-reflect: the candidates, the judgment per finding kind (reviews/08 §1: contradiction or evolution, merge or cross-link, stale or still valid, theme or chatter, promote or keep), the proposals and drafts per CC-65, the cap and its order, the report, unattended per 0051 and its "Run on a schedule" section; templates/brain/AGENTS.md lists the skill; brain-howto and the user guide.
**Acceptance:** blind runs on a synthetic brain built with CC-41 with planted problems: a duplicate person gives one Conflict row; a launch date that a later decision moved gives a contradiction or stale-fact row; a theme in four meetings gives a draft concept in a Review notes row, and one in two meetings gives nothing; 15 planted problems give 10 rows, contradictions first, and the report counts 5 more; a second run after the user rejects the duplicate doesn't propose it again; with nothing found, nothing is written; the skill mirror check passes.

## 0.12.0 — Remember and retrieve reliably (decision 0061)

Work packages: contracts and representative retrieval/answer evaluation; shared Claude Code/Codex memory capture and promotion, defining the boundary a later Hermes can reuse (0064); evidence-led query reformulation/ranking improvements; cross-agent continuity and current/scoped/cited answer acceptance. No external search infrastructure is promised. Scope/decompose at the opening grill.

## 0.13.0 — Knowledge pays back (decisions 0061, 0064)

Work packages: digest/review and correction-sweep contracts; reviewable propagation to affected restatements; cited weekly digest and concise review flow using existing module/output rules; acceptance of usefulness and Review workload. Existing-knowledge changes remain proposals. Scope/decompose at the opening grill.

### CC-111 · The brain assistant's scheduled weekly review (decisions 0064, 0051) · `todo`
**Release:** 0.13.0
**Changelog:** the brain assistant can review your projects every week on a schedule, leaving a report and Review rows and changing nothing directly.
**Output:** the assistant's unattended mode per 0051 (its schedule, the report, Review rows only, no direct changes, no questions), shared with the weekly digest where they overlap; detailed at 0.13.0's opening grill.
**Acceptance:** a scheduled run on a synthetic brain writes one report and at most the capped Review rows, applies nothing, and a run with nothing found writes nothing.

## 0.14.0 — Repeatable onboarding and adoption (decision 0061)

Work packages: onboarding/diagnostic/preference contracts; probe-first setup and selected seeding reusing 0.9.0 project adoption and the 0.10.0 assistant as the guide (0064); common-failure recovery guidance; minimal per-area tracking preferences; fresh-user first capture, review and cited answer. Rich profiles and specialised types remain deferred. This is the last feature milestone.

## 1.0.0 — Productisation, translation, funnel and launch (decision 0061)

After the feature cutoff, scope packaging/install/upgrade guidance, consistent Notion templates/terminology, user-facing translations, positioning/demo/landing-page and acquisition/onboarding funnel, release candidates and launch acceptance. Confirm languages, offer and publication choices during the opening grill. Allow launch-blocking fixes, not unapproved features. The release gate includes a fresh user's end-to-end path and common-failure recovery; publishing/releasing follows existing user approval and release-script rules.

**Noted for 1.0.0 (decision 0072, 2026-11-05):** rename the Notion custom agent Brain Assistant to **Notion Brain Assistant**, so it isn't confused with the CLI's Ultimate Assistant: notion/brain-assistant.md, the button messages, the guide, the views guide and a Notion migration for the rename by hand. Not a task yet.

## Your tasks

| Id | Task | When |
|---|---|---|
| U-00 | Approve the baseline commit and create a private GitHub repo for the product (needed for branches, reviews and Codex cloud) | Now |
| U-01 | Build the Notion space with the prompts (CC-04) | Wave 1 |
| U-02 | Move the last 1–2 months of meeting pages into Meetings, mark the ones you trust as Reviewed | Wave 1 |
| U-03 | Pick 3–5 reviewed minutes for the dry run | Wave 2 |
| U-04 | Review dry-run output and give feedback | Wave 3 |
| U-05 | Two weeks of daily use | Wave 4 |
| U-06 | Put 5–10 real documents in one folder for the bake-off: a long PDF with tables, a deck, a Word file, a scan if you have one | Before CC-15 |
| U-07 | Connect the Easlo template to the Notion integration (read-only use) | Before CC-17 |
| U-08 | Publish 0.2.0 (`npm version minor`, `npm publish`, push tags; docs/releasing.md) | Now: agreed 2026-10-15 to release before CC-15, so the acceptance run uses the released version |
| U-09 | Publish 0.2.1 (`npm version patch`, `npm publish`, push tags; docs/releasing.md), then `brain upgrade` in your brain | When CC-21, CX-23 and CX-25 are merged |
| U-10 | Publish 0.2.2 the same way, then `brain upgrade` in your brain | When CC-23 and CX-26 are merged |
| U-11 | Setup for 0.2.3: from CX-27 on, merge only with `node scripts/merge.mjs <PR>`. GitHub Pro is deferred (decision 0038). Done by Claude on 2026-10-18: the `dogfood` label and the denylist. `/plugin update` found no match in the brain, so its Claude Code keeps the 2026-10-12 skills until 0.2.3 or a manual copy | Now |
| U-12 | Publish 0.2.3 with `node scripts/release.mjs 0.2.3` from the main checkout, then `brain upgrade` in your brain, then `npm deprecate ultimate-brain@0.2.2 "Superseded. Install the latest version."` (0.2.2 still has a real name in a skill example) | When CC-24, CC-25, CX-27 and CX-29 are done |
| U-13 | 0.3.0 in your brain, one session with Claude: migrate your Notion space with brain-notion-change (your yes at each step), `brain upgrade`, then one real "catch up" as the acceptance run. Ran 2026-10-20; findings → decision 0043 (CC-38) and #113 (CX-39). **Closed 2026-10-21**; notion/templates.md pulled again | Done |
| U-14 | Publish 0.2.4 with `node scripts/release.mjs 0.2.4` from the main checkout, then `brain upgrade` in your brain | When CC-27, CX-28 and CX-30 are merged |
| U-15 | 0.4.0 in your brain, one session with Claude: `brain upgrade`, Notion migration 0006, approve the backlog's Review notes rows and check the Briefs, link the product repo as the "Ultimate Brain" area and run its first ingest; then a catch-up over real meetings within the 5-minute bar, one document kept in full, one report asked from an Ask row (decision 0043). These also close CC-37's Notion checks: the 5-minute bar over two meetings and one capture, a ticked Full text box written and cleared once (and a second tick cleared with no second body), an Ask row answered by a linked Report row and set to Processed; and re-publish the guide to the "How it works" page; then two weeks against the habit bar in CC-35. **Feedback 2026-10-22** (Review rows, corrections, reports, documents, emails) → decision 0045 (CC-44); the run continues on 0.4.0, and anything new is logged as feedback | After 0.4.0 is released and U-13 is closed |
| U-16 | After 0.3.2: in your brain, `brain upgrade`, then ask Claude to "connect Notion" again (brain-connect-notion sets `notion.tasks.status_type` to `status` for the default Tasks database), or run `brain config set notion.tasks.status_type '"status"'` yourself (CC-40, #113). **Closed 2026-10-21**: set by hand after 0.3.2 | Done |
| U-17 | 0.4.1 in your brain: `brain upgrade`, Notion migration 0007 with Claude (your yes at each step), and add `/Clean email` to Brain Assistant (or save the plain prompt). Then paste one real email thread into a capture and clean it. Then the new Clean email text and the Instructions rule line by hand (migration 0008's steps, decision 0047). | After 0.4.1 is released |
| U-18 | 0.5.0 in your brain: `brain upgrade`, Notion migration 0009, then one catch-up with a document given a Keep, a meeting fixed and set back to Reviewed, a Fix on a Review row, and a report refreshed. **Closed 2026-10-28:** the re-read and the refresh passed; Keep failed (an attachment with an empty Keep wrote no `reference` and nothing readable in Notion) and Fix wasn't tried. Findings → decisions 0048–0050 (CC-55); retested in U-19 | Done |
| U-19 | 0.6.0 in your brain: `brain upgrade`, Notion migration 0010 (buttons and page layouts by hand), then one catch-up with a file kept as a document (whole, then one with Only keep), a decision promoted to a document, a Fix "a: …" on a Review row, and a look at two area homes | After 0.6.0 is released; deferred on 2026-10-29: the U tasks run at the end, after the builds |
| U-20 | 0.7.0 in your brain: `brain upgrade`, "run catch-up every morning", then a week of unattended runs: check the Report rows (or, with Reports off, the summary that opens your next catch-up), the skipped inputs waiting for an attended catch-up, and that no-op runs leave nothing | After 0.7.0 is released and U-19 is closed |
| U-21 | 0.11.0 in your brain, after the agency brain has moved in: "tidy the brain" once attended, decide its Review rows, then a weekly schedule; verify excluded material supplies no evidence | After 0.11.0 is released and the agency brain has moved in |
| U-22 | 0.8.0 buttons in your brain: `brain upgrade`, Notion migration 0012, then use Tidy capture, Write up (twice, accepting once) and Refresh report on real pages, run a catch-up, and note the Notion AI credits each click used | After 0.8.0 is released, with U-23 |
| U-23 | 0.8.0 in your brain: upgrade and migration 0013; try Domains off and on, a Won't Do task, a voice capture, a multi-subject meeting with one item and one subject kept in meeting only, an exact edited partial Review acceptance and a revision request; exclude previously ingested material and check reconciliation, source attribution and independently supported knowledge | After 0.8.0 is released and U-22 is closed; run the acceptance checks after the planned builds |
| U-24 | 0.9.0 on your machine (migration plan step 6): see the installation diff and the rollback steps, install the global general skills and your brain's pinned snapshot, remove only the superseded copies the inventory names, check both agents load one definition per skill; then link one real repo with the link kit | Done on 2026-11-04: 0.9.0 installed in your brain and Notion migrations 0015 to 0017 applied; the global skills switch moved to CC-105 (0.9.2) |
| U-25 | 0.10.0 in your brain: "review my projects" once, decide its Review rows, and one live-chat change with your yes | After 0.10.0 is released |
