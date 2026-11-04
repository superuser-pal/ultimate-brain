# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex (until decision 0044; since 0063 the `pr-reviewer` sub-agent reviews, Codex optionally) · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked` · `dropped` (won't ship; skipped by `release.mjs`).
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

## Agreed release sequence to launch (2026-10-31)

Decisions [0059](../decisions/0059-shared-skills-and-connected-workflows.md), [0060](../decisions/0060-hermes-operator-and-learning.md) and [0061](../decisions/0061-roadmap-and-launch-boundary.md), as amended by [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md) (2026-11-03), supersede older release-placement references below. 0.8.0 implementation continues unchanged. **Each human-led product development session for 0.9.0 onward starts with a grilling scope review and confirmed shared understanding before implementation.**

| Release | Committed scope |
|---|---|
| 0.8.0 | Existing buttons, Domains, selected evidence and editable Review |
| 0.8.1 | Review inside the building session (0063), release preflight, the Domains database in every space (0065) |
| 0.9.0 | Public shared-skills fork; standard/Notion-connected software and general workflows; setup/adoption; compatible pins and update awareness (0059); linked repos with the link kit (0066) |
| 0.9.2 | A simpler Notion: Concepts and Reports into Documents, reviewed-only knowledge in Notion, to-dos as tasks, Orgs · Employer (0071) |
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

### CC-96 · Domains database in every Notion space · `done` (#180)
**Release:** 0.8.1
**Changelog:** every Notion space gets the Domains database and the Areas · Domain relation, used or not, so turning Domains on is a switch; migration 0014 adds them to an existing space (decision 0065).
**Output:** decision 0065 (amends 0055; asked for in the 2026-11-03 scope review, accepted by the user the same day); notion/prompts/02 and 03 create the Domains database and Areas · Domain untagged, Domains · Org with `[Orgs]`; notion/migrations/0014 (the database through the REST API or Notion AI, the relations and the id by the agent, the 1-page limit by hand) and its README row; notion/modules/domains.md (turning on builds nothing) and its row in notion/modules/README.md; notion/CHECKLIST.md; docs/notion-space-design.md (modules table, Areas · Domain, Domains database); spec/schema.md §12 (one line); brain-connect-notion expects Domains in every space and names 0014 when it's missing, with its mirror. Prompts 06 and 07a keep `[Domains]`: what pages show still follows the module. No CLI change.
**Acceptance:** prompts 02 and 03 have no `[Domains]` tag and their Verify counts say 15 and 7 databases; migration 0014 lists who does each step and has a Verify list; the skill mirror check, `npm test`, typecheck, `test:package` and the leak check pass.

## 0.9.0 — Shared skills and connected workflows (decision 0059)

Scoped in the 2026-11-03 grill (CC-95, [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)). Follow [the detailed migration plan](../docs/skills-migration-plan.md). Order: inventory (CC-97) and contracts (CC-98, CC-99) first; then the CLI (CC-100, CC-102), the fork (CC-101) and Notion (CC-103) in parallel; then the skills (CC-104), the move of skill authorship (CC-105) and update awareness (CC-106); then acceptance (CC-107) and your switch (U-24). Each task owns its files; shared files (this one, spec/schema.md, spec/cli.md) are edited only in the task's own row or section.

### CC-97 · Inventory the installed skills and approve their mapping (decision 0059) · `done` (#181)
**Release:** 0.9.0
**Changelog:** development only: an inventory of the skills Claude Code and Codex load today, compared with the pinned upstream, and the approved keep/adapt/isolate/retire mapping for the shared-skills fork.
**Output:** steps 1–2 of docs/skills-migration-plan.md. docs/skills-inventory.md: every active skill by channel (user, project, plugin, account-synced, agent system) with its source, revision, precedence and duplicates, compared with upstream at `a496f551`, each classified as upstream as-is, reusable customisation, Sentina-specific, SEO pack, duplicate, local-only or unresolved; and the mapping the user approved, with the single future source of each retained behaviour. Sanitised: no personal paths, names, client text or credentials. A private rollback manifest (exact paths, hashes, which agent loads what) stays outside the repo. No installation changes; Sentina and SEO skills stay outside the fork (0.9.0 grill, 2026-11-03).
**Acceptance:** every skill in the private manifest appears in the inventory with a source or an explicit unresolved origin; each retained behaviour in the mapping has one future source and no Sentina assumption is copied wholesale; the mapping records the user's approval and date; the leak check passes; no file outside the repo changes except the private manifest.

### CC-98 · Contracts for pinned skill delivery · `done` (#182)
**Release:** 0.9.0
**Changelog:** the contract for pinned skill delivery: each brain records the skill snapshot it uses, both agents load the same version, and an incompatible or missing snapshot stops a command before it writes, with the upgrade to run.
**Output:** spec/skills-delivery.md (decision 0059; spec only, no CLI code): the snapshot format and its compatibility metadata (declared CLI range, upstream base, integrity hash); the brain's pin in `skills.lock.json`; how Claude Code and Codex resolve the same version; duplicate and competing copies; global general skills vs brain-pinned operational skills; the changes to init, link, upgrade, lint and the package check; stop-before-write messages; rollback; the transition that keeps today's delivery working; the fork's release, impact declaration and upstream sync; update awareness (tested vs assessed revision, daily, start-of-work and pre-release checks, one integration issue, credentials). spec/cli.md §5.28 (the pin guard, its error codes and messages, `status` `data.skills`). JSON Schemas `skills-snapshot`, `skills-lock` and `skills-integration` under spec/schemas, with valid and invalid examples in spec/examples/skills/ and tests/skills-delivery-schemas.test.ts.
**Acceptance:** a Sonnet sub-agent given only spec/skills-delivery.md, spec/cli.md §5.28 and the three schemas lists every question it would need answered to build CC-100 (pinned skill snapshots in the CLI) and CC-101 (the public skills fork); the spec answers each until the list is empty; tests: every valid example passes its schema and every invalid one fails, each schema has both, the valid snapshots carry the integrity §2.2 computes; existing tests pass.

### CC-99 · Contracts for connected workflows and linked repos · `done` (#183, #186)
**Release:** 0.9.0
**Changelog:** contracts for connected workflows, the adoption of existing projects, and linked repos with a link kit (decisions 0059, 0066).
**Output:** decisions/0066-linked-repos-and-the-link-kit.md (amends 0042; accepted by the user on 2026-11-03). spec/connected-workflows.md: standard and connected tracking, the opt-in record and the folder's pointer, Workflow settings on the Project and Area (property design only; the migration is CC-103), logging levels and per-task and per-artifact overrides, publication status kept apart from work status, durable records of scope, acceptance, destinations and progress, reconciliation, retries without duplicates, several writers, interruption and uncertain outcomes, the dated summary, completion for software and general work, adoption (inspect, preview, mappings, reruns without duplicates; Markdown plans, GitHub and GitLab issues, Notion tasks) and the `brain workflow` commands. spec/linked-repos.md and spec/cli.md §5.29: the link kit (`brain-kit.json`: knowledge patterns and never-read paths, task source and mode `connected`/`tracked-in-repo` with a status mapping, methodology summary, Area/Domain/Project placement), the one permitted write with the user's yes, the read-only task rollup, unlinking that keeps the knowledge, the health check, the generic starter, offering `brain link` the other way. spec/schema.md §12: the `repos` lines only. spec/schemas/link-kit.schema.json, spec/schemas/workflow.schema.json, `never_read`, `project` and `kit` in brain.schema.json `repos`, with examples in spec/examples/link-kit/, spec/examples/workflow/ and spec/examples/brain/.
**Acceptance:** a context-free Sonnet sub-agent that reads only these specs lists its questions for building CC-102, CC-103 and CC-104, and the round ends with none open; tests/link-kit-and-workflow-schemas.test.ts: every link kit and workflow example passes or fails as labelled, and the JSON examples written in the specs and the starter's default kit validate; the brain.json examples with kit-linked repos pass or fail as labelled (tests/lint.test.ts); the user accepts decision 0066.

### CC-95 · Plan 0.9.0 to 0.11.0 and the roadmap change · `done` (#184)
**Release:** 0.9.0
**Changelog:** decision 0064 puts a brain assistant in 0.10.0 and reflection in 0.11.0, moves Hermes after 1.0, and breaks 0.9.0 into tasks.
**Output:** decision 0064 (from the user's 2026-11-03 scope review, accepted by the user the same day; amends 0061 and 0060's release); this file: the release table, the 0.9.0 order and rows CC-100 to CC-107 and U-24, the 0.10.0 assistant rows CC-108 to CC-110 and U-25, CC-65 to CC-67 and U-21 moved to 0.11.0 with their identities, the Hermes section removed, CC-111 in 0.13.0; "Amended by" pointers on 0061 and 0060; docs/v2-ideas.md's disposition table. CC-96 (0065), CC-97, CC-98 and CC-99 (0066) recorded their own rows and decisions, so this PR leaves them alone. No code.
**Acceptance:** every 0.9.0 work package of 0059 and every multi-repo item agreed in the grill has a task; no existing task id or Changelog line is lost or renamed (pr-format passes); the leak check passes.

### CC-100 · Pinned skill snapshots in the CLI (decision 0059) · `done` (#187)
**Release:** 0.9.0
**Changelog:** each brain uses the exact skill snapshot it recorded: Claude Code and Codex load the same version, and a missing or incompatible snapshot stops a command before it writes, with the upgrade to run.
**Output:** per spec/skills-delivery.md and spec/cli.md §5.28 (CC-98): `skills.lock.json` written by init, link and upgrade; the pin guard and its error codes and messages; lint and `status` `data.skills`; detection of duplicate and competing copies; rollback to the previous snapshot; the package check; the transition that keeps today's delivery working for a brain with no lock. Built and tested against a local fixture snapshot, so it doesn't wait for the fork (CC-101). Owns `src/lib/skills-*` and its commands.
**Acceptance:** tests for each case the spec lists: a compatible pin runs; a missing, tampered (integrity mismatch) or incompatible snapshot stops before any write with the spec's message; both agents' locations resolve the same version and a duplicate copy is reported; upgrade moves the pin and rollback restores the previous one; a brain with no lock behaves as on 0.8.x; existing tests and `test:package` pass.

### CC-101 · The public skills fork ultimate-brain-skills (decision 0059) · `done` (#185)
**Release:** 0.9.0
**Changelog:** development only: the public ultimate-brain-skills fork holds the skills' source, with upstream attribution, compatibility metadata in every release and reviewable upstream updates.
**Output:** step 3 of docs/skills-migration-plan.md, per spec/skills-delivery.md: the fork, created only after the user's yes at that moment (public, upstream attribution and licence, the recorded upstream base, local additions distinguishable); a release workflow that produces immutable snapshots with the compatibility metadata and integrity hash; the impact declaration CI requires on every skills PR (no brain impact, compatible, or coordinated with links); upstream-change detection that opens reviewable update PRs and never merges. Uses the mapping approved in CC-97. Works in the fork; this repo gets the row and a link. No personal configuration in either. **Fork:** [ultimate-brain-skills](https://github.com/superuser-pal/ultimate-brain-skills), created 2026-11-03 after the user's yes: a standalone public repository with upstream's history (the account's one GitHub fork of upstream is taken), base `a496f551`, bootstrapped through a PR; spec §10 records these choices.
**Acceptance:** a released snapshot is reproduced from its tag and validates against `spec/schemas/skills-snapshot` with its integrity; a skills PR without an impact declaration fails CI, and a coordinated one without links fails; a simulated upstream change opens one update PR and merges nothing; no credential or personal path in the fork.

### CC-102 · Linked repos with the link kit in the CLI (decisions 0042, 0066) · `done` (#190)
**Release:** 0.9.0
**Changelog:** a linked repo carries a link kit saying what the brain may read, where its tasks live and how it works; the brain shows its tasks as a read-only rollup or leaves them to Notion, and can check, change or unlink it without losing knowledge; `brain workflow` keeps connected work's scope, progress and pending Notion writes as durable records in the brain.
**Output:** per spec/linked-repos.md and spec/cli.md §5.29 (CC-99): reading and validating the kit; the one permitted write of the kit, only after the user's yes; the task modes (connected, tracked in the repo) and the read-only rollup; changing patterns or mode; unlinking with the repo's knowledge kept; the health check (repo moved or missing, kit out of date, stale rollup); the `repos` changes in brain.json; the generic starter in `templates/`. Owns `src/commands/repo*`, its lib files and `templates/repo/`.
**Acceptance:** tests on synthetic repos: the kit's valid and invalid examples; a repo with no kit behaves as under 0042; the kit is written only with the confirmation the spec names, and never by a read; tracked-in-repo tasks produce the rollup and connected ones don't; unlinking keeps the repo's sources and notes; the health check reports each of its three cases; the starter passes its own kit validation; existing tests pass.
**Spec note (CC-99, #186):** on 2026-11-03 the user chose that CC-102 also builds the `brain workflow` commands of spec/connected-workflows.md §12, and its schema changes (§6.3): `src/commands/workflow*` and their tests, per that spec, are part of this task.
**Built:** `brain repo` kit check and write (confirmed by hash), add `--kit`, refresh, show, health, tasks, unlink and new (templates/repo/generic/, in the package); `brain workflow` new, find, show, set, resolve, item put and claim, artifact put, render, op state, reconcile, summary, adopt preview and apply, publish-history, journaled under `_workflows/`; `origin: workflow` Documents; lint's `workflow-record`. Tests: tests/repo-kit.test.ts, tests/workflow.test.ts, tests/workflow-reconcile.test.ts.

### CC-103 · Workflow settings in Notion and migration 0015 (decision 0059) · `done` (#188)
**Release:** 0.9.0
**Changelog:** Projects and Areas get Workflow settings in Notion (tracking, work type, logging level and logged artifacts), with one dated summary of progress, pending publication and decisions needed on the page; migration 0015 adds them.
**Output:** per spec/connected-workflows.md (CC-99): docs/notion-space-design.md, the build prompts and templates, notion/migrations/0015 (who does each step, a Verify list), brain-connect-notion where it must find them. Product files only; never the user's space. Built: docs/notion-space-design.md §2 (ownership and the Workflow, Work record and `Repo tasks · <repo>` toggles), §3.1, §3.4, §3.15, §3.19 and §4; Prompts 2, 5 and 6; notion/views-guide.md §9; notion/migrations/0015-workflow-settings-on-projects-and-areas.md and its README row; brain-connect-notion step 3; tests/notion-workflow-settings.test.ts holds the spec, design, prompts, layouts, migration and skill to the same names and options.
**Acceptance:** migration 0015 lists who does each step and has a Verify list; the prompts, templates and design agree on every property name and option; the skill mirror check and the leak check pass.

### CC-104 · Adoption, connected-workflow and repo-linking skills (decisions 0059, 0066) · `done` (#200)
**Release:** 0.9.0
**Changelog:** three new skills: adopt an existing project's plans and tasks, run work as standard or Notion-connected with the logging you chose, and link, check, unlink or start a repo from the brain.
**Output:** per spec/connected-workflows.md and spec/linked-repos.md, on CC-102's CLI: the three skills, authored in `skills/` until CC-105 moves authorship to the fork; templates/brain/AGENTS.md lists them; brain-howto and the user guide. Blind runs in eval/.
**Acceptance:** blind runs by fresh Sonnet sub-agents with no answer keys, on synthetic projects: adopting a Markdown plan shows one preview before applying and a rerun duplicates nothing; a failed publication of a connected task is kept and retried without a duplicate; linking writes the kit only after a yes and offers `brain link` the other way; standard tracking needs no brain or Notion; the skill mirror check passes.
**Spec questions (CC-104, for the user):**
1. A legacy link (`NO_KIT`) can get a kit file (`repo kit write`), but no command applies it to the existing entry: `repo refresh` refuses `NO_KIT` and `repo add --kit` refuses a taken name. brain-repos uses the defined path, `repo unlink` then `repo add --kit` after the user's yes, which resets `commit` so the next read lists the files again (already-ingested ones are skipped as duplicates). Should `repo refresh` adopt a kit for a legacy entry and keep its `commit`?
2. A moved repo (`PATH_MISSING`) has no command to change an entry's `path`. brain-repos offers unlink and link again (the same reset). Should `repo refresh` (or a new option) take a new path?
3. linked-repos.md §4 says each catch-up that reads a tracked-in-repo repo rebuilds its rollup, and brain-ingest still links with `repo add --pattern` ("link the repo at <path>"). Neither brain-catch-up nor brain-ingest is CC-104's to change beyond a hand-over line, so both still need their step: a hand-over to brain-repos in each.
**Answers (the user, 2026-11-04):** 1 and 2: unlink and link again stays the way in 0.9.0, and `repo refresh` options that keep `commit` come in CC-118 (0.10.0); 3: CC-117.

### CC-105 · Brain skills authored in the fork, a pinned snapshot in the package (decision 0059) · `todo`
**Release:** 0.9.0
**Changelog:** the brain skills are written in the ultimate-brain-skills fork, and the ultimate-brain package ships an exact, tested snapshot of them.
**Output:** step 4 of docs/skills-migration-plan.md, after CC-100, CC-101 and CC-104: canonical skill authorship moves to the fork; the product build consumes an exact released snapshot and never edits generated copies; AGENTS.md, templates/brain/AGENTS.md and the docs say where skills are written; brains on older versions keep working until they upgrade.
**Acceptance:** the package delivers a snapshot whose integrity matches the fork's release; editing a generated copy fails a check; a synthetic brain on 0.8.1 upgrades without both repos changing at the same moment; `test:package` and the skill checks pass.

### CC-106 · Update awareness in the product (decision 0059) · `done` (#189)
**Release:** 0.9.0
**Changelog:** development only: the product checks the skills fork daily, at the start of work and before a release, keeps one open integration issue for unassessed skill changes, and blocks a release on an incompatible one.
**Output:** per spec/skills-delivery.md §11: the scheduled check and its credentials; the tested and the assessed revision; the single integration issue and its classification (ready to upgrade, linked brain work required, reviewed with no action); `release.mjs` refusing while an incompatible change is unassessed; "status unknown" when a check fails.
**Acceptance:** tests or recorded dry runs against a compatible change, an incompatible change, an unreleased change and an unavailable source: at most one open issue, the release blocked only for the incompatible change, a failed check reported as status unknown; existing release-script tests pass.

### CC-107 · 0.9.0 acceptance (decisions 0059, 0066) · `todo`
**Release:** 0.9.0
**Changelog:** development only: end-to-end acceptance of 0.9.0 in isolated installations: four adoption scenarios, rollback, and both agents loading the same skills.
**Output:** steps 5 and 7 of docs/skills-migration-plan.md: isolated agent skill locations; the scenarios standard software, connected software with a PR, general work directly under an Area, and a hub with one connected and one tracked-in-repo linked repo; interruption, retry, conflict, version and update behaviours tested once; rollback exercised; brief Claude Code and Codex smoke checks; evidence in docs/acceptance-0.9.0.md.
**Acceptance:** each scenario passes with its evidence; rollback restores the previous package and installation manifest with knowledge and configuration intact; the effective skill source is identified in each agent; no real brain is the first integration test.

### CC-114 · Projects from the Notion template and Review bodies by markdown · `done` (#197)
**Release:** 0.9.0
**Changelog:** a new project is published from the space's Projects template through the API instead of being refused with `PROJECT_NOT_IN_NOTION`, and a new Review row's body is written once through Notion's markdown endpoint so its toggles stay real toggles.
**Output:** decision 0068 (retires the `PROJECT_NOT_IN_NOTION` rule of 0037's 2026-10-18 amendment and CX-26; sets the markdown-on-create rule for Review bodies); spec/cli.md §5.14.4 (a project `create` carries `template`; the Review body write) and spec/capture-and-review.md §9; `sync render` returns a `create` with `"template": { "type": "default" }` for a project without `notion`; brain-sync step 10, brain-ingest references/notion.md, sources.md and SKILL.md (create from the template, wait for its toggles, the New project fallback when the space has no default template; the Review body by markdown on create, the block API for every other section); dogfood #193 and #194; dogfood #196: `sync render` lists no `item_updates` for a proposal decided the 0045 way (applied or closed with no `item_decisions`), as spec/cli.md §5.14 already says, so such a row leaves `--changed` once published.
**Acceptance:** tests: a project without `notion` renders as a `create` with every property, `sections` and the template, and a project with `notion` still renders without one; a Review body as Notion's markdown returns it (toggle children indented) parses back to each item's `proposed_hash`; the old `PROJECT_NOT_IN_NOTION` test is replaced; a Review notes proposal with items, approved from chat (`decided_by: chat`) and applied, renders no `item_updates`, and once recorded `sync render --changed` no longer returns it (#196); `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.
### CC-112 · Quick follow-ups and scoped tasks in the minutes (decision 0067) · `done` (#198)
**Release:** 0.9.0
**Changelog:** meeting minutes split your actions into quick follow-ups, which stay in Notion as checkboxes, and tasks with an editable Scope (done when, due, project, notes) that the ingest carries into the Notion task; a long or reworded quote no longer blocks a whole meeting (#191).
**Output:** decision 0067 (amends 0055); spec/capture-and-review.md §3–§4 and §6 and spec/cli.md §5.22 (the Quick follow-ups and Tasks groups, the Scope toggle, which quote problems block and how the rest are reported); the parser in src/lib/selection.ts and the extract-plan output in src/lib/extract.ts, test-first; notion/minutes-format.md (prompt and "What you do with it"), a note in notion/ on pasting the new prompt; the brain-ingest references (selection, extraction, cli-inputs) and their mirror; a blind run of the new prompt on a synthetic transcript.
**Acceptance:** tests: quick follow-up checkboxes, with or without an id, are listed and never imported, never a Task and never a blocker, while a checkbox outside a Quick follow-ups group still blocks; a Scope toggle is read into Done when, Due, Project and Notes, and a Due that is not a date or a stray Scope is reported without blocking; a long exact quote and a reworded quote with a unique 6–12-word stretch are placed; an unplaceable quote of an included item is reported and the item not imported, while the same quote on an excluded item still blocks; the 0.8 minutes fixture gives the same plan as before; a fresh Sonnet agent given only a synthetic transcript and the new prompt writes minutes that extract-plan accepts; `npm test`, typecheck, `test:package`, the skill mirror check and the leak check pass.

### CC-113 · sync apply creates notes in relation order · `done` (#195)
**Release:** 0.9.0
**Changelog:** `sync apply` creates new notes in relation order, so an Area whose Domain (or a Project whose Area or Org) is new in the same plan is created in one run, whatever the plan's order; a cycle among creates is reported as `RELATION_CYCLE`.
**Output:** spec/cli.md §5.14.3 states that creates run in relation order (the referenced create first, otherwise plan order), that results stay in plan order, and what a cycle does; `applyPlan` in src/lib/sync.ts orders the creates accordingly; sync apply tests. From dogfood #192.
**Acceptance:**
- [ ] A plan with a new Area before its new Domain applies both in one `sync apply`, with no failure.
- [ ] The same for a new Project before its new Org (`client`) and a new Project before its new Area.
- [ ] Creates in a relation cycle fail `RELATION_CYCLE`, a create that depends on one fails `DEPENDENCY_FAILED`, the other creates and the rest of the plan are still applied, and the command ends (exit 1).
- [ ] `data.create` stays in the plan's order; every existing sync apply test passes unchanged.

### CC-115 · Restore CC-113's lost row and plan the own-row check · `done` (#199)
**Release:** 0.9.0
**Changelog:** development only: CC-113's task row, dropped by a merge of main into #195, is restored, and the own-row check is planned as CC-116 in 0.10.0.
**Output:** this file: the CC-113 row restored verbatim from 47a4743; the CC-116 row in 0.10.0.
**Acceptance:** the CC-113 row matches `git show 47a4743:build/TASKS.md`; CC-116 has Release 0.10.0, a Changelog, Output, Acceptance and status `todo`; no other row or Changelog line changes.

### CC-117 · Catch-up and ingest hand over to brain-repos · `done` (#201)
**Release:** 0.9.0
**Changelog:** each catch-up rebuilds the task rollup of a repo whose tasks are tracked in the repo, and "link the repo at <path>" in an ingest goes through brain-repos, so every new link gets a kit after your yes.
**Output:** CC-104's spec question 3 (answered 2026-11-04): brain-catch-up rebuilds the `Repo tasks · <name>` rollup of each tracked-in-repo linked repo per spec/linked-repos.md §4, with `brain repo tasks` through brain-repos "The rollup", written in the publish and counted in the short report; brain-ingest (SKILL.md and references/sources.md) hands repo linking to brain-repos instead of `repo add --pattern`; the skill mirror; a blind run in eval/handover-0.9.0; notion/migrations/0015 points to pasting the new minutes prompt (one line, the user's 2026-11-04 addition). This file: the answer line under CC-104's spec questions and the CC-118 row in 0.10.0.
**Acceptance:** a blind run by a fresh Sonnet sub-agent with no answer key, on a synthetic brain with one tracked-in-repo linked repo: the catch-up rebuilds the rollup on the target page; "link the repo at <path>" given to brain-ingest ends in brain-repos asking for a yes on the kit, with nothing written before it; no skill still tells the agent to link with `repo add --pattern`; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

## 0.9.1

### CC-120 · Type moves from Areas to Domains · `done` (#202)
**Release:** 0.9.1
**Changelog:** Type (Personal, Entrepreneurship, Professional) moves from Areas to Domains: sync reads it into the domain note and drops the old value from area notes (migration 0016).
**Output:** the user's 2026-11-04 change in their space, recorded in the product: Domains · Type (select: Personal, Entrepreneurship, Professional, yours) and no Areas · Type in docs/notion-space-design.md, spec/schema.md (§3 area and domain, §14), spec/cli.md §5.14, spec/capture-and-review.md §1, note.schema.json and the examples; `sync plan` maps Domains · Type to `notion_fields.type` and no longer reads Areas · Type, so an area note's old `type` is dropped at the next sync and is still valid until then; Prompt 2, Prompts 7b and 7h and the views guide; notion/modules/domains.md; notion/migrations/0016 for spaces built before 0.9.1.
**Acceptance:** a test shows `sync plan` taking Type from a Domains row into the domain note and dropping `type` from an area note that held one, with lint passing after apply; no product file still lists Areas · Type outside the history of migrations 0001–0015; `npm test`, `npm run typecheck` and the leak check pass.

### CC-121 · Lifecycle only where the brain creates the row · `done` (#203)
**Release:** 0.9.1
**Changelog:** Domains, Areas, Goals, Projects and Orgs no longer have Lifecycle: they come in as reviewed, you close them with Archived (Orgs gain it), and People and the knowledge databases keep Lifecycle for Review (decision 0070).
**Output:** decision 0070 (amends 0005; from the user's 2026-11-04 review, People keeps Lifecycle); `sync plan` reads no Lifecycle on the five and creates their rows as `reviewed`, `note new` writes them as `reviewed`, render sends no Lifecycle there and ticks Archived once on a note the brain retired; Orgs · Archived → `notion_fields.archived`; spec/schema.md §3, §4, §8, §14, spec/cli.md §5.5 and §5.14, spec/capture-and-review.md §1.4, note.schema.json; docs/notion-space-design.md, Prompt 2, Prompts 7f and 7h, the views guide, the Planning and Orgs modules, the brain-howto guide; notion/migrations/0017.
**Acceptance:** tests show rows of the five databases created as `reviewed` with no Lifecycle published while People stays `draft` and publishes it; a stale Lifecycle on Projects is ignored with no conflict; a retired project ticks Archived once and not again after you untick it; `note new` writes a project as `reviewed`; Orgs · Archived is pulled; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

## 0.9.2 — A simpler Notion (decision 0071)

Right after 0.9.1. Fewer databases and only reviewed knowledge in Notion; the brain in Git keeps everything. Each task writes its spec first.

### CC-122 · Plan 0.9.2: a simpler Notion · `review`
**Release:** 0.9.2
**Changelog:** development only: decision 0071 plans 0.9.2, a simpler Notion, and breaks it into CC-123 to CC-127.
**Output:** decision 0071 (from the user's 2026-11-04 scope review of Review, Inbox, Decisions, Questions, Concepts, Documents and Orgs; accepted the same day); this file: the 0.9.2 row of the release table and rows CC-123 to CC-127. No code.
**Acceptance:** every point of 0071 has a task; no other row or Changelog line changes; the leak check passes.

### CC-123 · Concepts become Documents (decision 0071) · `todo`
**Release:** 0.9.2
**Changelog:** concepts become Documents of their own kind, "learned": the Concepts database is retired and existing concepts move to Documents with their links.
**Output:** spec first: `origin: learned` on `reference` notes in spec/schema.md and note.schema.json, what replaces the `concept` type (a `brain upgrade` step that rewrites existing concept notes and every reference to them, or the type kept as an alias: the spec decides), ingest's extraction (an idea or method → a learned Document), query, Review sections and Promote (decisions only); then the CLI, the skills, the Notion design (no Concepts database, Documents views by origin, "What do we know?" with Decisions and Documents), the Knowledge and Documents modules, Prompts 2/4/6/7, and a migration that moves Concepts rows to Documents and retires the database after a yes.
**Acceptance:** a synthetic brain with concepts upgrades with no lint error and every former concept is a learned Document reachable from its project, area and source; a fresh ingest of an idea writes a learned Document; `brain query` finds it; the migration's verify list passes on the design; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

### CC-124 · Reports move to Documents (decision 0071) · `todo`
**Release:** 0.9.2
**Changelog:** reports live in Documents instead of the Inbox, still one per subject, refreshed from their page; an Ask stays in the Inbox and links to its report.
**Output:** spec first: a report as a `reference` note with `origin: report` (or the report shape moved under Documents: the spec decides), the Ask ↔ Report relation between Inbox and Documents, Refresh asked and What to fix on Documents, render and sync for them, 0057 kept (never ingested, not a proposal target); then the CLI, brain-query's report mode, the Refresh report button and Brain Assistant's skill, the Notion design and views ("Reports" on project and area pages read Documents), and a migration that moves existing Report rows.
**Acceptance:** a test publishes a new report to Documents and refreshes it in place; an Ask row links to it; existing Report rows have a migration path with a verify list; a report still never becomes a source or a proposal target; checks as CC-123.

### CC-125 · Notion shows reviewed knowledge (decision 0071) · `todo`
**Release:** 0.9.2
**Changelog:** decisions, questions and Documents appear in Notion once you approve them; until then they are in their Review row only.
**Output:** spec first (spec/cli.md §5.14): render publishes a decision, question or Document only when its lifecycle is `reviewed`, `disputed` or `archived` (a whole Document is reviewed from creation), and a person whatever its lifecycle; the relations that point at an unpublished note (Inbox Produced, Meeting Decisions and Questions, Supersedes) wait as pending relations; approving a Review Notes row publishes its notes in the same run; a rejected draft never gets a page; what happens to existing Draft pages (left until decided, or trashed after a yes); Briefs, reports and Review pages unchanged; then the CLI, brain-sync/catch-up wording, the Notion design and views (drop "Which concepts are drafts?" and other Draft views), and a migration.
**Acceptance:** tests: a draft decision gets no page and its meeting's Decisions relation fills in when it is approved; a rejected draft never renders; a draft person still renders; a disputed decision keeps its page; checks as CC-123.

### CC-126 · A to-do becomes a task, not a question (decision 0071) · `todo`
**Release:** 0.9.2
**Changelog:** the brain no longer files to-dos as questions: your own become tasks, other people's stay commitments you can track as Waiting On, and questions are kept for what something can answer later; a one-off tidy offers to turn existing to-do questions into tasks.
**Output:** spec first, in the contracts that hold the rule today: spec/capture-and-review.md §4.1 and §6 and spec/cli.md §5.14.5 (unchanged for other people's commitments: Waiting On only through `Track: Waiting On —`, decision 0055), then skills/brain-ingest/references/extraction.md, sources.md and selection.md (answerable later → question; the owner's explicit to-do → task; someone else's → a commitment in the text; ambiguous owner or tentative idea → no task and no question; risk → Kind Risk), the minutes format's Open Questions and Risks guidance (notion/minutes-format.md), and a tidy (in brain-tidy or a cleanup row: the spec decides) that lists existing questions that read as the owner's to-dos and converts each after a yes, dropping the question; then the skills and their mirror, and a blind run on synthetic minutes.
**Spec questions (from the review of PR #204):** 1. Old-format minutes (Open Questions as plain lines, no item ids): does the rule apply to them, and how is a converted line tied to its task without an item id? 2. Idempotence: a re-ingest must not create a second task for a line that was a question before; is `task_items` enough for an item that changes kind? 3. The tidy: does dropping a converted question archive it with a successor link to the task, or simply archive it?
**Acceptance:** a blind run by a fresh Sonnet sub-agent on synthetic minutes with one real question, one owner to-do, one to-do for someone else (unmarked, then marked `Track: Waiting On —`), one ambiguous-owner line and one risk produces one question, one task, no task then one Waiting On task, nothing for the ambiguous line, and one risk; with Tasks off the owner's to-do stays in the text and is not a question; a re-ingest creates no second task; the tidy converts a to-do question only after a yes; the skill mirror check and the leak check pass.

### CC-127 · Orgs · Relationship gains Employer (decision 0071) · `todo`
**Release:** 0.9.2
**Changelog:** an Org can be your Employer, besides Client, Prospect, Partner, Supplier and Other.
**Output:** the Employer option in spec/schema.md §4 (org `notion_fields.relationship`), note.schema.json, docs/notion-space-design.md §3.7, Prompt 2, the Orgs module, the Orgs views (unchanged filters: "Which clients do I have?" stays Client), and a migration step that adds the option (with the existing options' ids sent first).
**Acceptance:** an org note with `relationship: Employer` lints clean and syncs; the migration adds the option without dropping the others; `npm test` and the leak check pass.

## 0.10.0 — The brain assistant (decision 0064)

An assistant you ask, from the CLI, about the structure of your work: Areas, Domains, Projects and Tasks. It finds what's stalled, misplaced or missing, recommends, turns your thinking into captures, tasks and projects, and makes changes through Review rows, or directly after your yes in a live chat. On demand; the weekly scheduled run is CC-111 in 0.13.0. Starts after 0.9.0 is released, with its opening scope grill.

### CC-108 · Contracts for the brain assistant (decision 0064) · `todo`
**Release:** 0.10.0
**Changelog:** contracts for the brain assistant: what it checks in Areas, Domains, Projects and Tasks, how each finding becomes a Review row, and when it may change something directly.
**Output:** after the opening grill: a spec for the checks (signals and thresholds: stalled and overdue tasks, tasks without a project, active projects with no recent work or no next step, finished but open projects, misplaced or duplicate projects, empty Areas, Areas without a Domain), the proposal each finding makes (including how a Review row changes a Notion-owned field such as a project's Status), the direct-apply rule in a live chat, reading Notion live and linked repos' rollups, the report, the sub-agent file, any CLI helper (`brain` commands the skill needs).
**Acceptance:** a context-free Sonnet sub-agent reading only the contracts lists no question it would need answered to build CC-109; schema examples validate for each new proposal shape.

### CC-109 · The brain-assistant skill and its Claude sub-agent (decision 0064) · `todo`
**Release:** 0.10.0
**Changelog:** "review my projects" finds stalled tasks, finished projects still open, misplaced projects and missing next steps, recommends what to do, and turns what you say into captures, tasks and projects, changing nothing without your yes or a Review row.
**Output:** per CC-108: the skill (single source for Claude Code and Codex, delivered as 0.9.0 delivers skills), a thin `.claude/agents` sub-agent that loads it, any CLI helper with tests, templates/brain/AGENTS.md, brain-howto and the guide.
**Acceptance:** blind runs on a synthetic brain and a synthetic Notion snapshot with planted problems (a stalled project, a task with no project, a finished project still Active, a project under the wrong Area, an Area with no Domain while Domains is on): each is found; nothing is written without a Review row or an explicit yes; a ramble of mixed thoughts is split into the right captures, tasks and project changes; with Notion unreachable it says so and reviews the brain only; the skill mirror check passes.

### CC-110 · 0.10.0 acceptance (decision 0064) · `todo`
**Release:** 0.10.0
**Changelog:** development only: end-to-end acceptance of the brain assistant on a synthetic brain, attended, with Review rows and chat approvals.
**Output:** docs/acceptance-0.10.0.md: a scenario per finding kind, the Review-row path and the chat-yes path, a linked repo's rollup reviewed, Notion unreachable.
**Acceptance:** every scenario passes with its evidence; no change happens without a Review row or a yes; the Review workload of one run stays within the cap the contracts set.

### CC-116 · CI catches a PR that drops its own task row · `todo`
**Release:** 0.10.0
**Changelog:** development only: `pr-format` names a PR whose own task row is missing, instead of asking for a CHANGELOG.md line.
**Output:** found on #195: merging main into the branch dropped the task's own row, and `pr-format` failed with "PR must add its task line to CHANGELOG.md", because a task with no row falls to the 0.3.x path; `merge-ready` was red but the PR was merged, and CC-115 (#199) restored the row. scripts/pr-format.mjs fails first with "PR has no row for its task CC-N" when the head has no row for the branch's task; scripts tests; a line in docs/releasing.md or AGENTS.md on merging main into a branch (keep every row on both sides). Ask the user whether `main` should require `merge-ready` (branch protection is off today; decision 0040).
**Acceptance:** a scripts test: a PR head without its own task's row fails with the new message, and a 0.3.x task with no row-level Changelog still gets the old message; the user's answer on requiring `merge-ready` is recorded; `npm run test:scripts` and the leak check pass.

### CC-118 · `brain repo refresh` adopts a kit for a legacy link and takes a new path · `todo`
**Release:** 0.10.0
**Changelog:** a link made before kits takes its new kit, and a moved repo its new path, with `brain repo refresh`, without the brain listing the repo's files again.
**Output:** CC-104's spec questions 1 and 2 (answered 2026-11-04): spec/linked-repos.md and spec/cli.md §5.29 first (`repo refresh` applies a written kit to a legacy entry, and takes `--path` for a moved repo, both keeping `commit`; their checks and errors), then the CLI test-first in `src/commands/repo*`; brain-repos stops unlinking and linking again for these two cases, and its mirror.
**Acceptance:** tests on synthetic repos: a refresh of a legacy entry with a kit written applies the kit and keeps `commit`, and the next `repo changes` lists nothing again; a refresh with `--path` of a moved repo does the same; the existing repo tests pass; the skill mirror check passes.

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
| U-24 | 0.9.0 on your machine (migration plan step 6): see the installation diff and the rollback steps, install the global general skills and your brain's pinned snapshot, remove only the superseded copies the inventory names, check both agents load one definition per skill; then link one real repo with the link kit | After CC-107 passes |
| U-25 | 0.10.0 in your brain: "review my projects" once, decide its Review rows, and one live-chat change with your yes | After 0.10.0 is released |
