# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex (until decision 0044; since 0063 the `pr-reviewer` sub-agent reviews, Codex optionally) · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked` · `dropped` (won't ship; skipped by `release.mjs`).
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

## Agreed release sequence to launch (2026-10-31)

Decisions [0059](../decisions/0059-shared-skills-and-connected-workflows.md), [0060](../decisions/0060-hermes-operator-and-learning.md) and [0061](../decisions/0061-roadmap-and-launch-boundary.md) supersede older release-placement references below. 0.8.0 implementation continues unchanged. **Each human-led product development session for 0.9.0 onward starts with a grilling scope review and confirmed shared understanding before implementation.**

| Release | Committed scope |
|---|---|
| 0.8.0 | Existing buttons, Domains, selected evidence and editable Review |
| 0.9.0 | Public shared-skills fork; standard/Notion-connected software and general workflows; setup/adoption; compatible pins and update awareness (0059) |
| 0.10.0 | Reflection (0052); CC-65 to CC-67 and U-21 retain their identities |
| 0.11.0 | Native Hermes operator/coordinator, private Telegram, scoped learning, prepared handoffs and recoverable schedules (0060) |
| 0.12.0 | Cross-agent memory continuity and reliable cited retrieval |
| 0.13.0 | Weekly digest/review and targeted correction propagation |
| 0.14.0 | Repeatable onboarding, diagnostics, selected import/seeding and minimal per-area tracking preferences |
| 1.0.0 | Productisation, translation, funnel and launch readiness |

**0.14.0 is the feature cutoff.** Prefer 1.0 release candidates for preparation; an extra preparation version needs an explicit bounded scope. Dogfood/issues still produce triaged fixes in the relevant release or a patch; new features stay post-1.0 unless the user explicitly changes the plan. No connector release at 0.15.0 is committed.

Future implementation tasks are decomposed by Claude Code after their opening scope grill and contracts, using the work packages in 0059/0060/0061; this table does not start them. Preserve existing task/changelog identities. Recovery, integrity and visibility needed by a release are prerequisites for that release, not a reason to expand feature scope indefinitely.

---

> **2026-10-28 — Status: 0.5.0 is released and in the user's brain. U-18 is closed: the re-read and the report refresh passed, Keep failed and Fix wasn't tried. Its findings, decided in a grill on 2026-10-28, are decisions 0048 (modules, simpler rows, buttons), 0049 (Documents) and 0050 (area homes), planned as 0.6.0 (CC-55 to CC-59) with one Notion migration, 0010. The agency brain moves in after 0.6.0.**
> - **2026-10-29, CC-60 (planning):** two third-party vault skills reviewed (reviews/08) and grilled with the user: decisions 0051 (unattended catch-up and schedules) and 0052 (reflection), Accepted 2026-10-29 (#147). Plan: 0.6.1 skills audit (CC-61), 0.7.0 the brain runs itself (CC-62 to CC-64, U-20, after U-19), 0.8.0 the brain tidies itself (CC-65 to CC-67, U-21, after the agency brain moves in). Order before them unchanged: release 0.6.0, `brain upgrade` and migration 0010, U-19.
> - **2026-10-29, U tasks deferred:** the user runs U-19 to U-22 at the end, after 0.8.0 is built; building goes on in the planned order (CC-61, then 0.7.0, 0.7.1 and 0.8.0).
> - **2026-11-03, CC-91:** decision [0063](../decisions/0063-claude-sub-agent-reviews.md): the `pr-reviewer` sub-agent (Sonnet) reviews every PR and posts `Review (Claude reviewer): pass at <sha>`, which `merge-ready` accepts; Claude Code builds on Opus; Codex reviews only when the user asks.
> - **Claude Code builds, Codex reviews (decision 0044, CC-39):** from 2026-10-21 every task is Claude Code's; the open Codex tasks became CX-39 → CC-40, CX-33 → CC-41, CX-37 → CC-42, CX-38 → CC-43.
> - **Merging (decision 0040):** the user merges on the GitHub PR page, with the PR's `merge-ready` status in view; `merge.mjs` is optional; agents never merge. `main-guard` fails only on a commit that came from no PR.
> - **0.4.0 (released 2026-10-21):** theme (CC-35): the brain gives back (decisions 0041–0043). Its Notion checks (the 5-minute bar, the Full text box, Ask → Report) are closed in U-15.
> - **Review order (CC-27):** the done commit comes before the verdict; the reviewer posts `Review (<agent>): pass at <sha>` last.
> - **2026-10-29, CC-69 (planning):** decision 0054 (buttons that run Brain Assistant: Tidy capture, Write up, Refresh report), accepted by the user in a grill with Codex, plans 0.7.1 (CC-70 to CC-73, U-22).
> - **2026-10-31, CC-86 (planning):** decision [0056](../decisions/0056-buttons-move-into-0-8-0.md) moves the Brain Assistant buttons (CC-70 to CC-73, U-22) from 0.7.1 into 0.8.0; 0.7.1 becomes CC-83 to CC-85.
> - **2026-10-30, CC-74 (planning):** decision [0055](../decisions/0055-domains-capture-and-review.md), accepted in the user's grill, assigns optional Domains, Won't Do, voice capture, subject selection and editable Review to **0.8.0** (CC-74 to CC-82, U-23). Reflection (CC-65 to CC-67, U-21) moves to **0.9.0**; 0.7.0 and 0.7.1 keep their scope (decision [0056](../decisions/0056-buttons-move-into-0-8-0.md), 2026-10-31, later moved the buttons into 0.8.0 and left 0.7.1 as CC-83 to CC-85). This supersedes the earlier release order above; user acceptance runs remain deferred until the builds are ready. The user explicitly asked Codex to record CC-74 while Claude Code was busy; implementation ownership otherwise stays with Claude Code, and CC-74 needs independent review.
> - **Untriaged `dogfood` issues:** 0 (#143–#146 → CC-68, 2026-10-29; #137 → CC-59).
> - **Earlier:** v1 waves 1–4 and dogfood findings 1–24 (the Wave 4 table) are in [HISTORY.md](HISTORY.md).

## Why this split

**Now (decisions 0044, 2026-10-21, and 0063, 2026-11-03):** Claude Code builds every task: the contracts, skills, prompts and Notion design, and the TypeScript CLI with its tests and fixtures. The `pr-reviewer` sub-agent reviews every PR against its acceptance, its decisions and `spec/`, and builds nothing; Codex reviews when the user asks. Contracts still come first.

**Waves 1–4 and 0.2–0.3 (history):**
- **Claude Code** had the full design context from the research and grilling sessions, so it owned the things that encode judgment: the schema and CLI contracts, the agent skills and prompts (ingest, apply, sync, query), the Notion design, and the evaluation of meeting extraction.
- **Codex** got well-specified, testable engineering: the TypeScript CLI that does the deterministic work (IDs, frontmatter, index, lint, proposals, apply, views, link, init), its tests and fixtures.
- **Contracts came first** (wave 1) so both could work in parallel without guessing.
- Every task was reviewed by the other agent.

**Done releases (v1 to 0.8.0)** are in [HISTORY.md](HISTORY.md): read it only when a task or decision points there.

## 0.8.1 — Review inside the building session (decision 0063)

### CC-91 · A Claude sub-agent reviews in place of Codex · `done` (#176)
**Release:** 0.8.1
**Changelog:** development only: a Claude reviewer sub-agent reviews each PR and its pass turns `merge-ready` green, so PRs no longer wait for Codex (decision 0063).
**Output:** decision 0063 (accepted by the user, 2026-11-03); `.claude/agents/pr-reviewer.md` (Sonnet, read-only, fixed method, posts its findings and verdict); `"model": "opus"` in `.claude/settings.json`; `merge-ready` and `merge.mjs` accept `Review (Claude reviewer): pass at <sha>` on `claude/` PRs (`reviewersFor` in scripts/common.mjs); AGENTS.md, the PR template, README and this file say who reviews; 0044 gets an "Amended by" pointer. No CLI change.
**Acceptance:** on a `claude/` PR a pass from `Claude reviewer` or `Codex` naming the head is accepted and one from `Claude Code` is refused; on a `codex/` PR only `Claude Code` passes; existing release-script tests pass; this PR is itself reviewed by the `pr-reviewer` agent and merges with `merge-ready` green, without `--reviewed-by-user`.

### CC-92 · task.mjs starts new tasks and cleans merged worktrees · `done` (#177)
**Release:** 0.8.1
**Changelog:** development only: `task.mjs start --new` starts a task that has no row yet, and `task.mjs clean` removes every merged task worktree.
**Output:** `scripts/task.mjs`: `start <id> --new "<title>" --release <x.y.z>` refuses an id that exists on the base and writes the row (`in progress`, empty Changelog, Output and Acceptance) at the end of its `## <release>` section, creating that section in version order; `clean` fetches, then removes each task worktree whose branch is merged into origin/main (reachable, not on its first-parent line) and keeps one with uncommitted changes; a merged branch goes with `-D` (local `main` may lag `origin/main`) and a failure keeps that worktree and goes on with the next. `--new` refuses a title with `·`, a backtick or a line break, and an id used by a remote task branch; a prerelease section sorts before its release. `worktree remove` also deletes the worktree's gitignored files (`node_modules`), as `done` always did. AGENTS.md says when to use them. CC-90 and CC-91 were started by hand because their rows were on no branch; five merged worktrees were found left over on 2026-11-03.
**Acceptance:** tests cover the row's place in an existing and a missing section (before a later release and after the last), refusal of an existing id and of incomplete or repeated flags, and `clean` removing a merged worktree while keeping an open, a fresh (no commits) and a dirty one; existing task tests pass.

### CC-93 · Release preflight and exact-version upgrade · `done` (#178)
**Release:** 0.8.1
**Changelog:** `release.mjs` checks the npm login before it commits and tags, waits for CI on the release commit, and says how to finish after a failed publish; the upgrade steps install the exact version.
**Output:** `scripts/release.mjs`: refuses unless `npm whoami` names an owner from `npm owner ls` (a never-published package passes); waits up to 10 minutes for a queued, running or not-yet-created CI run on HEAD unless another check already refuses (`ciWorkflowState` in scripts/common.mjs); a failed `npm publish` leaves the commit and tag local, pushes nothing and prints the recovery command; a version already tagged here or on origin, or already on npm, is refused first; a failed commit or tag says nothing was published and how to undo, a failed push after the publish says how to push; a failed CI read is retried. docs/releasing.md (the checks, the recovery, `npm install -g ultimate-brain@<version>` then `brain --version` before `brain upgrade`) and README (`brain --version` check). The 0.8.0 release hit all three: a refusal while CI ran, an E404 publish from a non-owner account after the commit and tag, and `@latest` serving 0.7.1 so `brain upgrade` changed nothing.
**Acceptance:** tests: refusal with no npm login and with a non-owner, before any file changes; a never-published package passes; a running CI run is waited for and then passes; the wait gives up after its polls; no wait when another check already refuses; a failed publish keeps the tag local, pushes nothing and prints the recovery; an existing tag (here, on origin) or npm version is refused with no change; a failed push after the publish prints how to push, no stack trace; a failed CI read is retried; `ciWorkflowState` cases. Existing release tests pass.

### CC-94 · Move done releases out of TASKS.md · `done` (#179)
**Release:** 0.8.1
**Changelog:** development only: done releases move from build/TASKS.md to build/HISTORY.md, so a session reads about 24 KB of open work instead of 166 KB.
**Output:** "Waves at a glance" through the 0.8.0 section moved verbatim to build/HISTORY.md; the obsolete "How to start Codex on a task" section removed; `taskEntries` reads both files (`taskFiles`), so `release.mjs`, `task.mjs` and `merge-ready` see moved rows; `pr-format.mjs` compares base and head rows over both files (`optionalContentAt`: a missing HISTORY.md is empty, any other read error fails); `readinessProblems` (merge-ready, merge.mjs) reads the PR's row from both files; only a GitHub `(HTTP 404)` counts as a missing HISTORY.md; `task.mjs start --new` refuses an id used in HISTORY.md and a release whose section is there, and fails if HISTORY.md can't be read for another reason. AGENTS.md: read HISTORY.md only when pointed there, and move a release's section after it ships.
**Acceptance:** no row is lost or changed by the move (every base row's id, status, suffix, release and Changelog line are in TASKS.md or HISTORY.md on the head) and the moved text is byte-identical; tests: pr-format accepts a row moved to HISTORY.md and rejects one dropped from both or one that lost its Changelog line, and fails on an unreadable HISTORY.md; release, merge-ready and `task.mjs --new` read HISTORY.md rows; an error that merely contains "404" is not taken as a missing file; existing tests pass.

## 0.9.0 — Shared skills and connected workflows (decision 0059)

After 0.8.0. Work packages: contracts and cross-repository ownership; fork/customisation inventory; pinned packaging/install/upgrade/lint and rollback; setup/adoption; connected task/document execution and Notion settings; upstream/cross-repository update automation; three lean acceptance scenarios. Follow [the detailed migration plan](../docs/skills-migration-plan.md). Scope/decompose before starting; no current implementation is authorised by this entry.

## 0.10.0 — The brain tidies itself (decisions 0052, 0061)

Reflection across notes: contradictions, stale facts, duplicates, promotions and recurring themes as Review rows, never edits. Starts after the agency brain has moved in and 0.8.0's Review and evidence-selection contracts are in place. Candidates must respect 0055's excluded-evidence rules.

### CC-65 · Contracts for reflection (decision 0052) · `todo`
**Release:** 0.10.0
**Changelog:** contracts for reflection: candidates, the proposal fingerprint, and three new lint warnings.
**Output:** spec/cli.md: `brain reflect --candidates` (its four signals, the window, which lifecycles each signal reads, the cluster JSON, how fingerprints already on rejected or pending proposals are left out); the `orphan`, `note-size` and `near-duplicate` warnings in §5.10, with the name-matching rule; §6's reflection sequence: each finding's proposal kind, the cap of 10 rows and its order, a theme's draft and its Review notes row, the report, unattended. spec/schema.md: `fingerprint` on proposals and how it is formed.
**Acceptance:** Codex's review finds CC-66 and CC-67 buildable from the contracts with no spec question; schema examples validate for a `merge` and a `contradiction` proposal carrying a fingerprint.

### CC-66 · `brain reflect --candidates`, fingerprints and the new lint warnings (decision 0052) · `todo`
**Release:** 0.10.0
**Changelog:** `brain reflect --candidates` finds likely duplicates, overtaken notes, notes that may disagree and recurring terms; proposals carry a fingerprint; lint warns on orphans, oversized notes and near-duplicate names.
**Output:** per CC-65: the command, `fingerprint` in `brain proposal new` and its validation, the three lint warnings, the code and tests.
**Acceptance:** tests on the fixture brain: two people "María López" and "M. Lopez" give a near-duplicate candidate and a `near-duplicate` warning; once a `merge` with their fingerprint is rejected, `--candidates` no longer gives the pair; a reviewed person note older than two meetings naming her gives an overtaken candidate; a term in three sources with no note gives a recurring-term candidate, and in two it doesn't; a 12 KB concept gives `note-size`, a 12 KB source doesn't; a concept nothing references and with no project or area gives `orphan`.

### CC-67 · The brain-reflect skill (decision 0052) · `todo`
**Release:** 0.10.0
**Changelog:** "tidy the brain" finds contradictions, stale facts, duplicates, promotions and recurring themes, and puts at most 10 of them in Review as proposals; it can run weekly on a schedule.
**Output:** skills/brain-reflect: the candidates, the judgment per finding kind (reviews/08 §1: contradiction or evolution, merge or cross-link, stale or still valid, theme or chatter, promote or keep), the proposals and drafts per CC-65, the cap and its order, the report, unattended per 0051 and its "Run on a schedule" section; templates/brain/AGENTS.md lists the skill; brain-howto and the user guide.
**Acceptance:** blind runs on a synthetic brain built with CC-41 with planted problems: a duplicate person gives one Conflict row; a launch date that a later decision moved gives a contradiction or stale-fact row; a theme in four meetings gives a draft concept in a Review notes row, and one in two meetings gives nothing; 15 planted problems give 10 rows, contradictions first, and the report counts 5 more; a second run after the user rejects the duplicate doesn't propose it again; with nothing found, nothing is written; the skill mirror check passes.


---

## 0.11.0 — Hermes operates the brain (decision 0060)

After 0.10.0. Work packages: contracts and native Notion/headless/learning feasibility; dedicated runtime onboarding and compatible pins; operator/coordinator skills and permission checks; scoped learning bridge/private procedure improvement; Telegram capture/query/exact approvals; schedule transfer, coordinated writers and recovery; controls, Notion visibility and three compact acceptance scenarios. External worker launch/execution, extra channels/users/hosts and Notion webhooks stay post-1.0.

## 0.12.0 — Remember and retrieve reliably (decision 0061)

Work packages: contracts and representative retrieval/answer evaluation; shared Claude Code/Codex memory capture and promotion reusing Hermes's boundary; evidence-led query reformulation/ranking improvements; cross-agent continuity and current/scoped/cited answer acceptance. No external search infrastructure is promised. Scope/decompose at the opening grill.

## 0.13.0 — Knowledge pays back (decision 0061)

Work packages: digest/review and correction-sweep contracts; reviewable propagation to affected restatements; cited weekly digest and concise review flow using existing module/output rules; acceptance of usefulness and Review workload. Existing-knowledge changes remain proposals. Scope/decompose at the opening grill.

## 0.14.0 — Repeatable onboarding and adoption (decision 0061)

Work packages: onboarding/diagnostic/preference contracts; probe-first setup and selected seeding reusing project adoption/runtime setup; common-failure recovery guidance; minimal per-area tracking preferences; fresh-user first capture, review and cited answer. Rich profiles and specialised types remain deferred. This is the last feature milestone.

## 1.0.0 — Productisation, translation, funnel and launch (decision 0061)

After the feature cutoff, scope packaging/install/upgrade guidance, consistent Notion templates/terminology, user-facing translations, positioning/demo/landing-page and acquisition/onboarding funnel, release candidates and launch acceptance. Confirm languages, offer and publication choices during the opening grill. Allow launch-blocking fixes, not unapproved features. The release gate includes a fresh user's end-to-end path and common-failure recovery; publishing/releasing follows existing user approval and release-script rules.

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
| U-21 | 0.10.0 in your brain, after the agency brain has moved in: "tidy the brain" once attended, decide its Review rows, then a weekly schedule; verify excluded material supplies no evidence | After 0.10.0 is released and the agency brain has moved in |
| U-22 | 0.8.0 buttons in your brain: `brain upgrade`, Notion migration 0012, then use Tidy capture, Write up (twice, accepting once) and Refresh report on real pages, run a catch-up, and note the Notion AI credits each click used | After 0.8.0 is released, with U-23 |
| U-23 | 0.8.0 in your brain: upgrade and migration 0013; try Domains off and on, a Won't Do task, a voice capture, a multi-subject meeting with one item and one subject kept in meeting only, an exact edited partial Review acceptance and a revision request; exclude previously ingested material and check reconciliation, source attribution and independently supported knowledge | After 0.8.0 is released and U-22 is closed; run the acceptance checks after the planned builds |
