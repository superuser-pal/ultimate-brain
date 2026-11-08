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
| 0.11.0 | Reflection (0052); CC-65 to CC-67 and U-21 retain their identities; the assessment's fixes (CC-152 to CC-156) |
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
> - **2026-11-07, CC-151 (planning):** an independent, read-only assessment of `1eedf6c` (stages 01–07, records kept outside this repo) found ten things; the user's triage: F-0008 (queries fail in repos linked since 0.9.0) is CC-152, and F-0005, F-0009, F-0001/F-0002 and the first-hour fixes are CC-153 to CC-156, all in 0.11.0 (0.10.0 was already published); F-0007 joins CC-65, C2 the 0.12.0 packages, F-0010 the 1.0.0 note; a drifted pinned skill keeps reporting without blocking (no task); F-0003, F-0004 and F-0006 stay evidence gaps covered by the U tasks.
> - **Untriaged `dogfood` issues:** 0 (#220 → CC-136, #221 → CC-135, 2026-11-05; #143–#146 → CC-68, 2026-10-29; #137 → CC-59).
> - **Earlier:** v1 waves 1–4 and dogfood findings 1–24 (the Wave 4 table) are in [HISTORY.md](HISTORY.md).

## Why this split

**Now (decisions 0044, 2026-10-21, and 0063, 2026-11-03):** Claude Code builds every task: the contracts, skills, prompts and Notion design, and the TypeScript CLI with its tests and fixtures. The `pr-reviewer` sub-agent reviews every PR against its acceptance, its decisions and `spec/`, and builds nothing; Codex reviews when the user asks. Contracts still come first.

**Waves 1–4 and 0.2–0.3 (history):**
- **Claude Code** had the full design context from the research and grilling sessions, so it owned the things that encode judgment: the schema and CLI contracts, the agent skills and prompts (ingest, apply, sync, query), the Notion design, and the evaluation of meeting extraction.
- **Codex** got well-specified, testable engineering: the TypeScript CLI that does the deterministic work (IDs, frontmatter, index, lint, proposals, apply, views, link, init), its tests and fixtures.
- **Contracts came first** (wave 1) so both could work in parallel without guessing.
- Every task was reviewed by the other agent.

**Done releases (v1 to 0.10.0)** are in [HISTORY.md](HISTORY.md): read it only when a task or decision points there.

## 0.10.2

### CC-150 · Skills 1.2.1: the CC-110 wording fixes, vendored · `done` (#246)
**Release:** 0.10.2
**Changelog:** Ultimate Assistant's skill wording follows its contracts more closely (ultimate-brain-skills 1.2.1): a ramble keeps the session open, a delegated run carries out waiting Notion writes, and the log line and the summary count the same things.
**Output:** the skill findings of CC-110's blind runs (eval/acceptance-0.10.0/RESULTS.md §4: 2, 3, 4, 7, 8, 10) fixed in the fork (ultimate-brain-skills PR, `compatible`), released as brain-v1.2.1 after the user's yes, and vendored in `.agents/skills/` (spec/skills-delivery.md §9.5); `.agents/skills/` is not edited by hand. Also: the 0.10.0 section moves verbatim to build/HISTORY.md, and `src/cli.ts` lists `proposalReviseCommand` once in COMMANDS.
**Acceptance:** the vendored snapshot is ultimate-brain-skills 1.2.1 and passes the snapshot check; the six findings each have their fix in the vendored text; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass; the skills-integration check reports 0 unclassified.
**Spec decided (CC-150 review, 2026-11-07):** skills-delivery §9.5 step 2 contradicted §10.4 (a vendored fork PR was always `coordinated`); the user chose §10.4's rule: `coordinated` only when the skill needs the product PR's change, otherwise `compatible`, with a `Product:` line either way. Fork PR #6 (`compatible`, no `Product:` line) predates the fix; §10.4 ignores the line for `compatible`.

## 0.11.0 — The brain tidies itself (decisions 0052, 0061, 0064)

Reflection across notes: contradictions, stale facts, duplicates, promotions and recurring themes as Review rows, never edits. Starts after the agency brain has moved in and 0.8.0's Review and evidence-selection contracts are in place. Candidates must respect 0055's excluded-evidence rules.

### CC-65 · Contracts for reflection (decision 0052) · `todo`
**Release:** 0.11.0
**Changelog:** contracts for reflection: candidates, the proposal fingerprint, and three new lint warnings.
**Output:** spec/cli.md: `brain reflect --candidates` (its four signals, the window, which lifecycles each signal reads, the cluster JSON, how fingerprints already on rejected or pending proposals are left out); the `orphan`, `note-size` and `near-duplicate` warnings in §5.10, with the name-matching rule; §6's reflection sequence: each finding's proposal kind, the cap of 10 rows and its order, a theme's draft and its Review notes row, the report, unattended. spec/schema.md: `fingerprint` on proposals and how it is formed. The unattended table of cli.md §6.1 becomes the one authority for what an unattended run may do: capture-and-review §8's selected-input rows move into it (§8 keeps a pointer), the reflection run's rows join it, and the skills' tables are renderings of it (assessment finding F-0007).
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

### CC-149 · Record tool-agnostic coordination as a future backlog idea · `done` (#245)
**Release:** 0.11.0
**Changelog:** development only: an optional, tool-agnostic coordination profile for the shared skills is recorded as a deferred post-1.0 idea in the backlog.
**Output:** docs/v2-ideas.md: a self-contained entry under "Automation and platform", next to the Hermes operator idea, with the goal, the portability requirement (no dependence on Orca or any one tool), scope, the working preferences from the user's 2026-11-07 discussion, guardrails, what to measure and the inspiration links; a pointer in the post-1.0 disposition row. Documentation only, on the user's instruction to save the idea for the future: 0.11.0 is this recording task's bookkeeping release and schedules nothing; no implementation, decision, spec, config, skill or CHANGELOG change, and the profile's file name and keys stay undecided.
**Acceptance:** the entry reads on its own (no links to temporary files) and says it is deferred, post-1.0, with no promised release and revisited only on an explicit request; it keeps tool independence (Orca optional, missing capabilities surfaced, portability evidence from more than one environment including one without Orca) and every working preference and guardrail from the discussion, framed as a sketch to revalidate rather than a binding contract; no task, release or roadmap commitment changes and no file other than docs/v2-ideas.md and this row changes (`git diff --stat main`); the leak check and PR format check pass.

### CC-151 · Plan the assessment fixes as 0.11.0 tasks · `done` (#247)
**Release:** 0.11.0
**Changelog:** development only: the 2026-11-07 assessment's findings become tasks: all in 0.11.0: the linked-repo query fix (CC-152), one Inbox row per source after an interrupted publish (CC-153), the Notion build files in the package (CC-154), the release rule for a partial `main` (CC-155) and the first-hour guidance (CC-156).
**Output:** the user's decisions of 2026-11-07 on the independent assessment of `1eedf6c` (its run records live outside this repo): F-0008 ships in 0.11.0 (0.10.0 was published on 2026-11-07 before this plan; the user chose 0.11.0 over a 0.10.1 patch); the Notion files ship in the npm package; the partial-`main` rule is enforced in `release.mjs`; a drifted pinned skill keeps reporting without blocking (no task). This file only: the five rows, one sentence in CC-65's Output (the unattended table's one authority), one sentence in the 0.12.0 work packages (the retrieval baseline), one sentence in the 1.0.0 note (Clean email on Ready rows), the release table and a status line.
**Acceptance:** CC-152 to CC-156 each have a Release, Changelog, Output and Acceptance line; CC-152 to CC-156 sit under 0.11.0; no other task's row changes except CC-65's Output sentence; `pr-format` and the leak check pass.

### CC-152 · `brain query` reads the `.brain` marker `brain link` writes (one reader for both) · `done` (#249)
**Release:** 0.11.0
**Changelog:** `brain query --candidates` works again in a repo linked since 0.9.0: the `skills` entry `brain link` records in `.brain` no longer makes the query refuse with "invalid format".
**Output:** assessment finding F-0008 (P1): `link` writes `skills` into `.brain` (skills-delivery §6.2) and `query`'s own validator (`src/lib/query.ts`) rejects any key but `repo`, `project`, `area`, `stacks`, so every repo `brain link` wrote since 0.9.0 answers `USAGE` to its first query. One `.brain` reader in `src/lib/` (the validation `link` has today) used by `link`, `query` and `repo-health`; spec/cli.md §5.13 says `query` reads the marker as §5.12 defines it and ignores nothing it doesn't know about silently: an unknown key is still `USAGE`; the brain-query skill's "Where the brain is" names what to do on exit 2 (a fork PR, vendored by CC-150 or the next skills release). Test-first.
**Acceptance:** a test links the fixture brain to a temp repo with `brain link` (plain, and with `--project`) and runs `query --candidates` from that repo and with `--repo`: candidates return, with the project's +3 boost in the second case; a `.brain` with an unknown key is still refused; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-153 · One Inbox row per source after an interrupted publish (cli.md §5.14.1, §5.14.2) · `done` (#251)
**Release:** 0.11.0
**Changelog:** a run that stopped between writing an Inbox row and recording it no longer creates the row a second time: the next pull recognises the row by its Brain ID, and the ingest looks a row up before creating it.
**Output:** assessment finding F-0005 (P2), both layers: spec first (cli.md §5.14.1: the sync skill passes every Inbox row's `page_id` and Brain ID, ids only; §5.14.2: a row whose Brain ID names a source with no `notion` sets it in `updates`, as Review rows and knowledge databases do today), then `src/lib/sync.ts` test-first; in the fork, brain-sync "Pull" step 2 passes those rows and brain-ingest references/notion.md "Publish" looks an Inbox row up by Brain ID before a `create` and rewords "If Notion fails partway" to match; one fork release, vendored here.
**Acceptance:** tests: `sync plan` with an `inbox` row carrying a source's Brain ID and no `notion` on the source returns an `updates` entry, and `sync apply` sets `notion`, so the next `render --changed` no longer creates it; a `capture` source is unaffected; the skill checks pass in the fork; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-154 · The Notion build files ship in the package · `done` (#252)
**Release:** 0.11.0
**Changelog:** the Notion checklist, build prompts, module steps and migrations install with the CLI, and every message that sends you to them names the folder on your machine.
**Output:** assessment finding F-0009 (P2): the npm tarball has no `notion/` and no `docs/notion-space-design.md`, yet brain-connect-notion, brain-notion-change, the brain's AGENTS.md and the `upgrade` warning `DOCUMENTS_TURNED_ON` point at them. `package.json` `files` gains `notion/` and the design doc; `brain status --json` reports the installed package root (`data.product.path`, spec/cli.md §5.2) so skills and warnings can name `<root>/notion/…`; README "Install" says where the files are; the skill wording in the fork (brain-connect-notion, brain-notion-change, brain-howto's guide) names the path through `brain status`, one fork release; `scripts/test-package.mjs` checks the files are in the tarball.
**Acceptance:** `npm pack` lists `notion/CHECKLIST.md`, every `notion/prompts/*.md`, `notion/modules/*.md`, `notion/migrations/*.md` and `docs/notion-space-design.md`; `brain status --json` has `data.product.path` and `test-package.mjs` asserts the files exist under it; the `DOCUMENTS_TURNED_ON` warning names a path that exists in the packed install; the leak check passes.

### CC-155 · `release.mjs` refuses a version below the work already on `main`; the docs say what is current · `todo`
**Release:** 0.11.0
**Changelog:** development only: a release is refused when `main` already holds done tasks of a later release (unless `--allow-partial` with a reason), and docs/vision.md and synthesis/synthesis.md say which parts are history.
**Output:** assessment findings F-0001 and F-0002, as the user decided on 2026-11-07: rule 10 in docs/releasing.md and `scripts/release.mjs` ("the version is not lower than the highest `**Release:**` of a `done` task on `main` that is not yet in CHANGELOG.md; `--allow-partial "<reason>"` overrides and is written into the release commit message"), test-first in `tests/release-scripts.test.mjs`; docs/releasing.md says where a patch branches from when `main` is partial (the last release tag, in a worktree, merged forward); docs/vision.md "Planned in 0.8.0" becomes "Since 0.8.0"; synthesis/synthesis.md gets a top line pointing to spec/schema.md §2 for the current layout.
**Acceptance:** `release.mjs 0.9.3 --dry-run` on a tree whose TASKS.md holds a `done` 0.10.0 task is refused naming that task, and passes with `--allow-partial "<reason>"`; the existing release-script tests still pass; the two docs read as described; the leak check passes.

### CC-156 · The first hour: the next step after `brain init`, and two error messages · `todo`
**Release:** 0.11.0
**Changelog:** `brain init` and the README say what to do next (build the Notion space from the checklist, then connect), `brain query` without `--candidates` points to the brain-query skill as the contract says, and `brain modules list` is accepted.
**Output:** the assessment's fresh-user walk (stage 05): after `init` nothing names notion/CHECKLIST.md or "connect the brain to Notion"; `brain query "<q>"` answers "Unexpected argument" where spec/cli.md §5.13 promises a usage error that points to the skill; `brain modules list` is a natural guess the contract doesn't take. `init`'s human output and README "Install" gain the two next steps (naming CC-154's installed path once it exists, else the repo folder); `query` without `--candidates` prints the §5.13 message; `modules list` becomes an accepted alias of `brain modules` (cli.md §5.20). Test-first; no new command.
**Acceptance:** tests for the three behaviours; `init`'s human output names the checklist and the connect step; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

## 0.12.0 — Remember and retrieve reliably (decisions 0061, 0074)

The opening grill ran on 2026-11-06 and is locked in [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md). Deliver six capabilities for Claude Code and Codex: hot opening context, cross-session work handovers, durable memory capture, targeted recall, scoped/correctable memories and reviewed promotion. Durable lessons stay in the existing brain memories; temporary progress stays in repo/task/session records; hot context is a generated selection of those records.

Work packages: contracts and a fixed representative synthetic retrieval/answer evaluation, starting from the existing baseline (`eval/search-0.5`, made runnable at the branch point with a `brain.json` in its generated brain and its recall/MRR numbers committed before any retrieval change; assessment proposal C2); closing capture (at most five suggestions plus explicit remember requests), approval and promotion through existing flows; work-record handovers and scoped opening recall with an initial 800-token budget; small deterministic retrieval adaptations, preferring claude-obsidian components over a new runtime and using agent-memory/obsidian-second-brain as references; both-agent acceptance. No blanket expiry, automatic full-note expansion or background memory model work. Gates: 100% of critical trust cases pass, at least 90% of answerable cases return correct, sufficiently complete cited answers, and opening/later retrieval costs are reported separately. Existing architecture, source restrictions, workflow boundaries and the 0.14.0 cutoff remain. Claude Code decomposes implementation after contracts; this scope record starts none.

### CC-146 · Record the 0.12.0 memory and retrieval scope · `done` (#238)
**Release:** 0.12.0
**Changelog:** development only: the 0.12.0 opening grill is recorded, covering scoped memory, work handovers, an initial 800-token hot-context budget and surgical TypeScript retrieval reuse.
**Output:** decision 0074 from the user's accepted 2026-11-06 grill and final six-capability clarification; this release's intro and work packages, the roadmap/backlog pointers, and a refinement pointer on 0064. Planning only: no implementation, CLI/schema/skill change, upstream code import or brain operation. The user's instruction to lock the agreement authorises recording this planning agreement, following the CC-74/CC-95 precedent; implementation remains Claude Code's and independent review is required.
**Acceptance:** 0074 records the six capabilities and every accepted capture, scope, conflict, retention, review-volume and token choice; it records the preferred small TypeScript component reuse and its boundaries; the synthetic 100% critical-trust / at least 90% answerable-case gates and separate cost accounting are explicit; the roadmap/backlog point to the decision without changing other release scope or task rows; only planning Markdown changes; the leak check and PR format check pass.

## 0.13.0 — Knowledge pays back (decisions 0061, 0064, 0075)

The opening grill ran on 2026-11-07 and is locked in [0075](../decisions/0075-weekly-review-and-targeted-corrections.md). One weekly report has What changed, Task analysis and What needs your decision, with roughly two minutes to read and five minutes to decide. Analyse meaningful changes since the last successful brief and current outstanding work; recommend an order of attention with reasons. Keep one report per week for browsable Notion history, updating that week's report on rerun under existing module/publishing rules.

Work packages: contracts and representative resource-budget trials; shared digest/assistant selection with at most five actionable decisions and five affected targets per run, selective repetition and existing dismissals; targeted checks queued after approved corrections that change meaning, with well-supported claim-grouped/selectable proposals preserving independent and historical evidence; bounded work with honest partial coverage and queued remainder; one on-demand/scheduled weekly flow, default Monday 08:00 local when enabled, separate from catch-up and applying nothing; synthetic busy/quiet/missed-week/partial/repeated/correction scenarios plus one attended private-brain trial. Quiet runs write nothing; failures and incomplete coverage are surfaced. Numeric token/time defaults come from trials before production implementation is committed. CC-111 retains its identity; Claude Code decomposes implementation after contracts. This scope record starts none.

### CC-111 · The brain assistant's scheduled weekly review (decisions 0064, 0051) · `todo`
**Release:** 0.13.0
**Changelog:** the brain assistant can review your projects every week on a schedule, leaving a report and Review rows and changing nothing directly.
**Output:** the assistant's unattended mode per 0051 (its schedule, the report, Review rows only, no direct changes, no questions), shared with the weekly digest where they overlap; detailed at 0.13.0's opening grill.
**Acceptance:** a scheduled run on a synthetic brain writes one report and at most the capped Review rows, applies nothing, and a run with nothing found writes nothing.

### CC-147 · Record the 0.13.0 weekly review and correction scope · `done` (#241)
**Release:** 0.13.0
**Changelog:** development only: the 0.13.0 opening grill is recorded, covering weekly report history, task analysis, shared five-decision/five-target limits and targeted correction checks.
**Output:** decision 0075 from the user's accepted 2026-11-07 grill; this release's intro/work packages, the roadmap/backlog pointers and a refinement pointer on 0064. Planning only: no implementation, CLI/schema/skill change, brain operation or schedule installation. The user's confirmation authorises recording this planning agreement, following CC-146's precedent; implementation remains Claude Code's and independent review is required.
**Acceptance:** 0075 records the three-section brief, time targets, meaningful-change window and current task analysis; both shared caps, grouped/selectable corrections, selective reminders and preservation/uncertainty rules are explicit; weekly history, scheduling, separate no-apply operation, quiet no-op behaviour and budgeted partial coverage are explicit; resource defaults remain trial-derived and acceptance includes representative synthetic scenarios plus one attended private-brain trial; roadmap/backlog pointers change no other release scope or existing task row; only planning Markdown changes; the leak and PR format checks pass.

## 0.14.0 — Repeatable onboarding and adoption (decision 0061)

Work packages: onboarding/diagnostic/preference contracts; probe-first setup and selected seeding reusing 0.9.0 project adoption and the 0.10.0 assistant as the guide (0064); common-failure recovery guidance; minimal per-area tracking preferences; fresh-user first capture, review and cited answer. Rich profiles and specialised types remain deferred. This is the last feature milestone.

## 1.0.0 — Productisation, translation, funnel and launch (decision 0061)

After the feature cutoff, scope packaging/install/upgrade guidance, consistent Notion templates/terminology, user-facing translations, positioning/demo/landing-page and acquisition/onboarding funnel, release candidates and launch acceptance. Confirm languages, offer and publication choices during the opening grill. Allow launch-blocking fixes, not unapproved features. The release gate includes a fresh user's end-to-end path and common-failure recovery; publishing/releasing follows existing user approval and release-script rules.

**Noted for 1.0.0 (decision 0072, 2026-11-05):** rename the Notion custom agent Brain Assistant to **Notion Brain Assistant**, so it isn't confused with the CLI's Ultimate Assistant: notion/brain-assistant.md, the button messages, the guide, the views guide and a Notion migration for the rename by hand. Not a task yet. With it: Clean email acts only on captures with Brain Status New, as Tidy capture does, since a Ready row may be mid-ingest (assessment finding F-0010).

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
