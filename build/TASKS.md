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
| 0.11.0 | Reflection (0052, amended by 0076); CC-65 to CC-67 and U-21 retain their identities; the assessment's fixes (CC-152 to CC-156) |
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
> - **2026-11-08, CC-157 (planning):** the 0.11.0 opening grill: decision [0076](../decisions/0076-reflection-chat-first.md) makes reflection report first in the chat like Ultimate Assistant, on demand only (its weekly run is CC-111's in 0.13.0), with skips by kind and themes as learned Documents; U-21 no longer waits for the agency brain, which moves in after 1.0 (the user's priority is 1.0 and its early testers). Issue #250 joins CC-155.
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

## 0.12.0 — Remember and retrieve reliably (decisions 0061, 0074)

The opening grill ran on 2026-11-06 and is locked in [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md). Deliver six capabilities for Claude Code and Codex: hot opening context, cross-session work handovers, durable memory capture, targeted recall, scoped/correctable memories and reviewed promotion. Durable lessons stay in the existing brain memories; temporary progress stays in repo/task/session records; hot context is a generated selection of those records.

Work packages: contracts and a fixed representative synthetic retrieval/answer evaluation, starting from the existing baseline (`eval/search-0.5`, made runnable at the branch point with a `brain.json` in its generated brain and its recall/MRR numbers committed before any retrieval change; assessment proposal C2); closing capture (at most five suggestions plus explicit remember requests), approval and promotion through existing flows; work-record handovers and scoped opening recall with an initial 800-token budget; small deterministic retrieval adaptations, preferring claude-obsidian components over a new runtime and using agent-memory/obsidian-second-brain as references; both-agent acceptance. No blanket expiry, automatic full-note expansion or background memory model work. Gates: 100% of critical trust cases pass, at least 90% of answerable cases return correct, sufficiently complete cited answers, and opening/later retrieval costs are reported separately. Existing architecture, source restrictions, workflow boundaries and the 0.14.0 cutoff remain. Claude Code decomposes implementation after contracts; this scope record starts none.

### CC-146 · Record the 0.12.0 memory and retrieval scope · `done` (#238)
**Release:** 0.12.0
**Changelog:** development only: the 0.12.0 opening grill is recorded, covering scoped memory, work handovers, an initial 800-token hot-context budget and surgical TypeScript retrieval reuse.
**Output:** decision 0074 from the user's accepted 2026-11-06 grill and final six-capability clarification; this release's intro and work packages, the roadmap/backlog pointers, and a refinement pointer on 0064. Planning only: no implementation, CLI/schema/skill change, upstream code import or brain operation. The user's instruction to lock the agreement authorises recording this planning agreement, following the CC-74/CC-95 precedent; implementation remains Claude Code's and independent review is required.
**Acceptance:** 0074 records the six capabilities and every accepted capture, scope, conflict, retention, review-volume and token choice; it records the preferred small TypeScript component reuse and its boundaries; the synthetic 100% critical-trust / at least 90% answerable-case gates and separate cost accounting are explicit; the roadmap/backlog point to the decision without changing other release scope or task rows; only planning Markdown changes; the leak check and PR format check pass.

### CC-162 · Move the done 0.10.2, 0.11.0 and 0.11.1 sections to HISTORY.md · `done` (#268)
**Release:** 0.12.0
**Changelog:** development only: the done 0.10.2, 0.11.0 and 0.11.1 sections move to build/HISTORY.md.
**Output:** the three sections moved verbatim from build/TASKS.md to the end of build/HISTORY.md (the done releases, CC-94); no other line changes.
**Acceptance:** each moved section is byte-identical in HISTORY.md to its text in TASKS.md on `main`; every task row in them is `done`; no other task row is lost or changed; the leak and PR format checks pass.

### CC-163 · Plan 0.12.0's first tasks: baseline, evaluation set, contracts, component comparison · `done` (#269)
**Release:** 0.12.0
**Changelog:** development only: 0.12.0's first four tasks are planned, each owning separate paths so they can be built in parallel.
**Output:** the rows CC-164 to CC-167 and the ownership table below. Planning only.
**Acceptance:** each new row has a release, a Changelog line, an Output and an Acceptance; no two tasks own the same path; no other row changes; the leak and PR format checks pass.

**Parallel work (CC-163, 2026-11-08).** The main session coordinates; each task is built in its own worktree and may edit only the paths it owns, plus its own row in this file. No task edits `src/`, `tests/`, `.agents/` or `notion/` before CC-166's contracts are merged. One `pr-reviewer` runs at a time; a builder asks the main session for a review slot. Each PR changes only its own row's lines here, which git merges cleanly; if a conflict still appears, the later branch merges `main` and keeps every row from both sides (AGENTS.md), before its review.

| Task | Owns | Starts | Built by |
|---|---|---|---|
| CC-164 | `eval/search-0.5/` | now | a worker session |
| CC-165 | `eval/memory-0.12/` | now | a worker session |
| CC-166 | `spec/`, `decisions/` | now, with the user's answers on handover records, the closing trigger and the recall opt-in | the main session |
| CC-167 | `eval/retrieval-0.12/` | after CC-164 is merged | a worker session |

### CC-164 · The search baseline runs on today's brain and its numbers are committed (0074 §6, assessment C2) · `done` (#271)
**Release:** 0.12.0
**Changelog:** development only: the 0.5 search evaluation runs again on the current brain format, and its recall and MRR are committed as 0.12.0's retrieval baseline.
**Output:** `eval/search-0.5/` made runnable at the current `main`: its generated brain has a valid `brain.json` and passes `brain lint` with no errors, `run.mjs` runs `brain query --candidates` and the BM25 comparison on it (GBrain stays optional), and a committed `results-baseline-0.12.txt` records recall@1/5/10, MRR and timing per question kind, with the commit and the command that produced it, plus a short README section on how to rerun it. No change outside `eval/search-0.5/` and this row; a CLI defect found on the way is reported to the main session, not fixed here.
**Acceptance:** a fresh clone at the PR head regenerates the brain and reproduces the committed numbers with the README's commands (timing aside); the brain lints with no errors; the 50 questions are unchanged; the leak and PR format checks pass.

### CC-165 · The 0.12.0 evaluation set: trust, answerable and unknown cases on a synthetic brain (0074 §6) · `todo`
**Release:** 0.12.0
**Changelog:** development only: a fixed synthetic test set for memory and recall, written before any 0.12.0 code, with its scoring rules.
**Output:** `eval/memory-0.12/`: a generator for a synthetic brain (memories under `memories/YYYY/MM/` per schema "memory" with provenance, confidence, scopes and supersession; approved and unapproved inferred candidates; excluded sources per 0055; projects and decisions with evidence; recorded work state for handovers), and a cases file with three kinds: **critical trust** (approval eligibility, default-deny scope, excluded evidence, supersession, unsupported claims not stated as facts, inference labelled), **answerable** (paraphrases, current versus superseded guidance, corrections, contested evidence, both agent-switch directions and a later session of the same agent) and **unknown** (no answer in the brain). Each case names its expected evidence ids and the facts a correct answer must contain. A scorer computes the 0074 §6 gates (100% of trust cases, at least 90% of answerable cases, unknown cases scored separately) from a retriever's or answerer's output through a small adapter, independent of the command shapes CC-166 defines; the adapter for the current `brain query --candidates` is included as the first one. A README states the scoring rules. Fixtures are synthetic; no change outside `eval/memory-0.12/` and this row.
**Acceptance:** the generator is deterministic (two runs, identical bytes) and its brain lints with no errors; at least 15 trust, 40 answerable and 8 unknown cases, every kind of 0074 §6 covered; the scorer runs end to end with the `query --candidates` adapter and prints the gate results (passing them is not required: this is the baseline); the leak and PR format checks pass.

### CC-166 · Contracts for 0.12.0: opening context, closing capture, handovers, recall opt-in (decision 0074) · `done` (#270)
**Release:** 0.12.0
**Changelog:** development only: the 0.12.0 contracts define the opening context pack, the closing memory review, how a session finds where work stopped, and the recall opt-in.
**Output:** spec/memory.md (new), cli.md §5.12 (recall paragraph) and §5.33 (`brain recall`), schema "memory" (eligibility) and §12 (`settings.recall`), brain.schema.json; changes that settle 0074's "Consequences" list: command shapes and JSON for the opening pack and targeted recall; the 800-token accounting, selection order and safe truncation; candidate persistence and approval through the existing flows (no new queue); the work records a handover points to; the closing trigger and its fallback for each agent; the explicit recall opt-in and how it meets repo links and connected workflows; cache invalidation on approval, scope, exclusion, correction and supersession; and how CC-165's adapter maps to the new commands. The build tasks after it are split from these contracts.
**Acceptance:** every item in 0074's "Consequences" contract list has a section; each rule cites its decision; the user has answered the open questions recorded under this row; the leak and PR format checks pass.
**Questions answered (the user, 2026-11-08):** 1. Yes: a handover reads the records that already exist (task rows, open PRs), no new file type; where work stopped is one `**Stopped:**` line under the task row (memory.md §4). 2. Yes: the closing review starts with "wrap up" in both agents; Claude Code's offer is only a convenience (memory.md §3.1). 3. Yes: opening recall is `settings.recall`, `off` by default, asked once at setup (memory.md §7).

### CC-167 · Compare small TypeScript ports of claude-obsidian's retrieval pieces with the baseline (0074 §5) · `todo`
**Release:** 0.12.0
**Changelog:** development only: a bounded comparison of small TypeScript adaptations of claude-obsidian's BM25, chunking, prefix, snippet and freshness pieces against the 0.12.0 baseline.
**Output:** `eval/retrieval-0.12/`: TypeScript adaptations written from reading claude-obsidian at `2e545563` (its code is never run: `sources/` is untrusted), each behind the same retriever interface as CC-164's runner, run on CC-164's questions and on CC-165's answerable cases when those are merged; `RESULTS.md` gives recall@k, MRR, the tokens a result page costs, the lines each adaptation needs and its attribution, and a recommendation per piece (adopt, adapt or drop) under 0074 §5's conditions. No change outside `eval/retrieval-0.12/` and this row.
**Acceptance:** each piece's numbers sit beside the baseline's on the same questions; the token cost uses one stated tokenizer; no piece needs a new runtime dependency, Python, a vector database or a schema change, or the report says it is dropped for that; the leak and PR format checks pass.

### CC-168 · Split 0.12.0's build tasks from the contracts · `done` (#272)
**Release:** 0.12.0
**Changelog:** development only: 0.12.0's build tasks are split from the merged contracts, each owning separate files.
**Output:** the rows CC-169 to CC-173, U-26 and the ownership table below. Planning only.
**Acceptance:** each new row has a release, a Changelog line, an Output and an Acceptance; no two tasks that run at the same time own the same file; no other row changes; the leak and PR format checks pass.

**Build work (CC-168, 2026-11-08).** The contracts are spec/memory.md and cli.md §5.12 and §5.33 (CC-166, #270). The CC-163 rules hold: a task edits only what it owns plus its own row, one `pr-reviewer` at a time, and a spec question goes to the main session, which owns `spec/` and fixes the spec first (AGENTS.md "Specs are contracts").

| Task | Owns | Starts | Built by |
|---|---|---|---|
| CC-169 | `src/commands/recall.ts`, `src/lib/recall.ts`, `tests/recall.test.ts`, `tests/fixtures/recall/`, and one registration line in `src/cli.ts` | now | a worker session |
| CC-170 | `src/commands/link.ts`, `src/commands/config.ts` (only if `config set` needs a change), `tests/link-recall.test.ts` | now | a worker session |
| CC-171 | the fork's `brain/brain-query/`; `.agents/skills/` through `scripts/vendor-skills.mjs` only | after CC-169 and CC-170 are merged | the main session (the fork tag needs the user's yes) |
| CC-172 | `eval/memory-0.12/adapters/` | after CC-165 and CC-169 are merged | a worker session |
| CC-173 | the files RESULTS.md names, decided when the row is detailed | after CC-167 and CC-169 are merged (it may change `src/lib/recall.ts`) | decided then |

### CC-169 · `brain recall --pack` and `--search` (cli.md §5.33, memory.md §2, §5, §6.1) · `todo`
**Release:** 0.12.0
**Changelog:** `brain recall --pack` gives an agent a small opening context of your approved lessons for the repo it works in and where its work stopped, within 800 tokens, and `brain recall --search` finds the rest.
**Output:** the command as cli.md §5.33 and memory.md define it: the caller from `--repo` or the current folder and its `.brain` (the shared reader, CC-152); eligibility (memory.md §2: reviewed, not superseded, in reach by 0009, not left out by the restricted-evidence rule, sources all left out); the pack's selection, work section from a `tracked-in-repo` markdown kit with stopped lines, ⌈bytes ÷ 3⌉ budget, whole items only, `omitted`, `work_unread`, `text` and the JSON of §5.3; `--search` ranked as `query --candidates`, `--include-superseded`; the `USAGE` cases. No cache. Synthetic fixtures only.
**Acceptance:** tests on synthetic brains and linked folders cover: each eligibility rule (a draft, a superseded, an out-of-reach for each scope, an excluded-source and a restricted memory left out; general reaching a folder without `.brain`); 0009's ranking and `--task` relevance; the budget (a large item left out whole while a later small one fits; `tokens` ≤ budget; `--budget` bounds); the work section (active rows only, the stopped line, an invalid kit giving `work_unread`); `--search` with and without `--include-superseded`; every `USAGE` case of §5.33; a second call after a supersession or a lifecycle change sees it (no cache). `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-170 · `brain link` writes the recall paragraph when `settings.recall` is `opening` (cli.md §5.12) · `done` (#274)
**Release:** 0.12.0
**Changelog:** with opening recall turned on, `brain link` tells a linked repo's agents to load your lessons and where work stopped at the start of a session, and to run the closing review when you say "wrap up".
**Output:** `brain link` adds cli.md §5.12's recall paragraph, byte for byte, after the `How:` paragraph when `settings.recall` is `opening`, and removes it when it is `off` or absent; idempotent; the rest of the block unchanged. `brain config set settings.recall` accepts `"off"` and `"opening"` and refuses anything else (brain.schema.json, already in the spec).
**Acceptance:** tests in `tests/link-recall.test.ts`: the paragraph with `opening`, its exact bytes and place, with the workflow lines both present and absent; none with `off` or absent; a second run changes no bytes; turning it off and linking again removes it; `config set` accepts both values and refuses `"on"`. `npm test`, `npm run typecheck` and the leak check pass.

### CC-171 · The closing review, "remember this" and opening recall in the brain-query skill (memory.md §3, §4, §5.5, §6.2) · `todo`
**Release:** 0.12.0
**Changelog:** say "wrap up" at the end of a session and the agent offers at most five lessons to remember, each with its reach, and records where the work stopped; say "remember this" at any time.
**Output:** in the skills fork (skills-delivery.md §9.5), a section of `brain-query`: the closing review (at most five candidates, the order, reach, labelled inference with examples, superseding candidates, yes and edit through `proposal new` + `apply` decided in chat, no or later writing nothing), "remember this", the `**Stopped:**` line, the task exception and "from now on", reading the pack silently and mentioning a memory only when it shapes the approach. Released as a fork tag with the user's yes, vendored here with `scripts/vendor-skills.mjs`, classified in the skills-integration issue.
**Acceptance:** the vendored snapshot passes `vendor-skills.mjs --check`; each rule of memory.md §3, §4, §5.5 and §6.2 has its sentence in the skill; a blind run in a synthetic brain records one approved memory, one declined one (nothing written) and one stopped line; the skills-integration check reports 0 unclassified.

### CC-172 · The evaluation set's `brain recall` adapter, and 0.12.0's gate results (memory.md §8) · `todo`
**Release:** 0.12.0
**Changelog:** development only: the 0.12.0 evaluation set scores `brain recall` against the trust and answer gates.
**Output:** an adapter in `eval/memory-0.12/adapters/` mapping the cases to `brain recall --pack` and `--search` as memory.md §8 says, and a results file with the gate figures (trust cases, answerable cases, unknown cases) and the measured tokens of every pack beside its estimate.
**Acceptance:** the scorer runs end to end with the new adapter; 100% of trust cases pass, and every failure in the other kinds is listed with its cause; every pack's measured tokens are within its budget; the leak and PR format checks pass.

### CC-173 · Retrieval changes chosen from CC-167's comparison (0074 §5) · `todo`
**Release:** 0.12.0
**Changelog:** `brain query` and `brain recall --search` find the right note more often, using small ports of the retrieval pieces that won the 0.12.0 comparison.
**Output:** detailed after CC-167's RESULTS.md is merged: the pieces it recommends adopting or adapting, ported into `src/`, with their attribution; nothing it drops.
**Acceptance:** on CC-164's questions and CC-165's answerable cases, recall@10 and MRR are at least the baseline's and the comparison's for those pieces; trust cases still pass 100%; no new runtime dependency; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

## 0.13.0 — Knowledge pays back (decisions 0061, 0064, 0075)

The opening grill ran on 2026-11-07 and is locked in [0075](../decisions/0075-weekly-review-and-targeted-corrections.md). One weekly report has What changed, Task analysis and What needs your decision, with roughly two minutes to read and five minutes to decide. Analyse meaningful changes since the last successful brief and current outstanding work; recommend an order of attention with reasons. Keep one report per week for browsable Notion history, updating that week's report on rerun under existing module/publishing rules.

Work packages: contracts and representative resource-budget trials; shared digest/assistant selection with at most five actionable decisions and five affected targets per run, selective repetition and existing dismissals; targeted checks queued after approved corrections that change meaning, with well-supported claim-grouped/selectable proposals preserving independent and historical evidence; bounded work with honest partial coverage and queued remainder; one on-demand/scheduled weekly flow, default Monday 08:00 local when enabled, separate from catch-up and applying nothing; synthetic busy/quiet/missed-week/partial/repeated/correction scenarios plus one attended private-brain trial. Quiet runs write nothing; failures and incomplete coverage are surfaced. Numeric token/time defaults come from trials before production implementation is committed. CC-111 retains its identity; Claude Code decomposes implementation after contracts. This scope record starts none.

### CC-111 · The brain assistant's scheduled weekly review (decisions 0064, 0051) · `todo`
**Release:** 0.13.0
**Changelog:** the brain assistant can review your projects every week on a schedule, leaving a report and Review rows and changing nothing directly.
**Output:** the assistant's unattended mode per 0051 (its schedule, the report, Review rows only, no direct changes, no questions), shared with the weekly digest where they overlap; detailed at 0.13.0's opening grill. Its knowledge stream comes from `brain reflect --candidates` within 0075's shared limits, the only scheduled reflection (0076).
**Acceptance:** a scheduled run on a synthetic brain writes one report and at most the capped Review rows, applies nothing, and a run with nothing found writes nothing; U-21's weekly step (a scheduled run in the user's brain whose reflection findings respect excluded material) joins 0.13.0's attended trial (0076).

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
| U-21 | 0.11.0 in your brain as it is: "tidy the brain" once, answer its findings (one yes, one later, one skip if there are three), and verify excluded material supplies no evidence; "nothing found" passes for the signals that need more meetings. The weekly step is CC-111's (0076) | After 0.11.0 is released |
| U-22 | 0.8.0 buttons in your brain: `brain upgrade`, Notion migration 0012, then use Tidy capture, Write up (twice, accepting once) and Refresh report on real pages, run a catch-up, and note the Notion AI credits each click used | After 0.8.0 is released, with U-23 |
| U-23 | 0.8.0 in your brain: upgrade and migration 0013; try Domains off and on, a Won't Do task, a voice capture, a multi-subject meeting with one item and one subject kept in meeting only, an exact edited partial Review acceptance and a revision request; exclude previously ingested material and check reconciliation, source attribution and independently supported knowledge | After 0.8.0 is released and U-22 is closed; run the acceptance checks after the planned builds |
| U-24 | 0.9.0 on your machine (migration plan step 6): see the installation diff and the rollback steps, install the global general skills and your brain's pinned snapshot, remove only the superseded copies the inventory names, check both agents load one definition per skill; then link one real repo with the link kit | Done on 2026-11-04: 0.9.0 installed in your brain and Notion migrations 0015 to 0017 applied; the global skills switch moved to CC-105 (0.9.2) |
| U-25 | 0.10.0 in your brain: "review my projects" once, decide its Review rows, and one live-chat change with your yes | After 0.10.0 is released |
| U-26 | 0.12.0 in your brain: turn on opening recall, link one real repo again, then work in it with Claude Code, say "wrap up" and approve one lesson, switch to Codex in the same repo and check it starts from where Claude Code stopped and uses the lesson, then back the other way; and a later session of the same agent | After 0.12.0 is released |
