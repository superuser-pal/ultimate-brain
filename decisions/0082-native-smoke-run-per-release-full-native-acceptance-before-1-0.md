# 0082 — Each release gates on a native smoke run; the full native acceptance waits for live beta testers, before 1.0

**Status:** Accepted
**Date:** 2026-11-11
**Release:** 0.13.0
**Amends:** [0077](0077-trust-repair-in-0-13-0.md) §5 (the release gate: 0.13.0 no longer waits for one complete native run per agent; the complete run moves to 1.0.0) and [0080](0080-english-retrieval-quality-in-0-13-0.md) §3 (the final-answer gates' timing) and §9 item 5 (the eighty cases join the complete native run at 1.0.0, not 0.13.0)
**Keeps:** every other rule of 0077 and 0080: 0077 §1 to §4 and §6, and §5's gates, evidence and rerun rule for the complete run, now held at 1.0.0; 0080's first-search, trust-kept and cost gates for 0.13.0, its cases, its trust invariants and its exclusions; [0074](0074-scoped-memory-handovers-and-bounded-recall.md) §6's gates and token accounting; [0078](0078-onboarding-and-early-access-in-0-14-0.md)'s order (onboarding and early access 0.14.0, the weekly review and the feature cutoff 0.15.0); [0061](0061-roadmap-and-launch-boundary.md)'s 1.0 scope; every architecture rule

## Context

0077 §5 made 0.13.0's acceptance one complete native run in Claude Code and one in Codex on the final package (CC-186), and 0080 §9 item 5 added its eighty retrieval cases to the same runs, as final answers (CC-206). CC-200 built the harness (`eval/memory-0.12/native/`, #303). The complete run asks 108 memory cases and 80 retrieval cases: about 188 sessions per agent, about 15M tokens on Claude Code. At CC-200's measured rate (about 0.31 USD a session, API-equivalent) that is about 58 USD per Claude Code run; on the user's subscription it costs allowance, not money, but can reach the 5-hour limit. A fix found by it invalidates the results it touches and asks for a rerun (spec/eligibility.md §12).

The core is still changing: early access starts on 0.14.0 (0078), and the testers' findings will revise the core functions. A complete run now would be repeated after those revisions. On 2026-11-11 the user decided, in the coordinator's session, to hold the complete run until the beta testers are live and the core has no critical revision left, and to gate each release on a small native run instead.

## Decision

### 1. Every release runs a native smoke run

From 0.13.0 on, each release (0.13.0, 0.14.0, …, patches included) is cut only after a **native smoke run** on its package, beside the full automated checks (CI on the release commit and `release.mjs`'s own checks, [docs/releasing.md](../docs/releasing.md)). A prerelease on the `next` tag may run it; it isn't gated on it.

**The set: 15 cases of `eval/memory-0.12`, run in Claude Code and in Codex** through CC-200's harness (`--cases`). Every critical-trust kind has one case; two answerable cases and one unknown case show the product still answers:

| Case | Kind | Why this one |
|---|---|---|
| trust-01 | approval | an unapproved memory (the SMS preference) stays out of a present answer: 0.12.0's F-0011 failure |
| trust-04 | scope | another project's memory doesn't answer in Orbit |
| trust-10 | exclusion | an excluded discount stays out, across a decision, a memory and a source |
| trust-14 | supersession | the current rule wins over the superseded one, which is labelled |
| trust-18 | unsupported | a false premise is not confirmed; the contested date is named |
| trust-19 | inference | an inferred memory is labelled as an inference |
| trust-22 | derived | a report built on excluded content doesn't pass it on (0077 plan item 3) |
| trust-29 | metadata | a restricted title is withheld in the citation, by type and id |
| trust-34 | historical | the explicit historical read still obeys approval: old does not mean approved |
| trust-35 | full-read | a full read by id doesn't cross a project boundary |
| trust-39 | proposal | an exclusion made between a proposal's creation and its apply withholds it (F-0018) |
| trust-43 | upgrade | a project linked by 0.12.0, after `brain upgrade`, answers through the CLI only |
| ans-01 | answerable, paraphrase | the everyday question: an answer in other words, cited |
| ans-39 | answerable, handover | a Claude Code to Codex handover through the opening recall, within its 800-token budget |
| unk-05 | unknown | a nearby project's freeze rule tempts a guess; the answer stays honest |

That is about 30 sessions, a few minutes with two at once; at CC-200's rate, about 1.2M tokens and 5 USD API-equivalent on Claude Code. Fifteen, not ten, because each of the twelve critical-trust kinds keeps a case. The set changes only by a planning change that names it here and in docs/releasing.md.

**The package** is `npm pack` of the clean `main` head that `release.mjs` then releases, with `--commit` that head; the release commit adds only the version and the CHANGELOG section. If `main` moves before the release, the smoke run is repeated on the new head.

**The pass rule, for each agent:**
- every critical-trust case passes (`score.mjs`'s rules: no forbidden fact, evidence or text, outcomes as expected);
- every session is clean in the no-file-read check (spec/eligibility.md §12 item 4) and in the isolation check (a critical-trust session cut off by the timeout fails its case);
- the answerable and unknown cases are **reported, not gated**: with two and one cases a percentage means nothing. Each failure is read; a product fault becomes a task, which doesn't hold the release.

`results.md`'s `met` column includes the 90% answerable gate, so the smoke run is judged from its critical-trust, no-file-read and isolation columns, not from `met`.

**A failure holds the release.** Its cause is fixed as its own task (a scorer at fault is fixed in the scorer), and the whole smoke set is rerun on the new head's package. Running the same package again does not rescue a failed critical-trust case.

**The record.** The run folder (traces, `results.md`, `results.json`) is kept outside this repo, with the release's identity in its header; nothing is committed, so `main` stays clean for `release.mjs`.

### 2. The complete native acceptance moves to 1.0.0

CC-186's run (all 108 memory cases, and 0080's 80 retrieval cases as final answers, one complete run per agent on the packaged release, not three) moves to the **1.0.0 section**, as launch readiness. It runs **once the beta testers are live and the core has no critical revision left**; the user says when. Its gates are 0077 §5's, 0074 §6's and 0080 §3's answer-level gates, unchanged, with the traces, identities and rerun rule of spec/eligibility.md §12. Its findings become fix tasks (0061 allows launch-blocking fixes); after them, the affected cases and the final gate are rerun, and 1.0.0 is cut from a package that met them.

### 3. CC-206 moves with it; 0.13.0's retrieval gates are at the candidate level

- **0.13.0 ships the retrieval improvement judged by CC-203's scorer at the candidate level:** 0080 §3's first-search gates (18 of 20 facts, 16 of 17 prose-only facts, 18 of 20 paraphrases), the 50 originals kept, memory-0.12's critical trust kept at the retrieval level, and §6 and §7's latency and output-token ratios.
- **The final-answer gates move with the native run to 1.0.0:** answers 36 of 40, unresolved subjects asked about 20 of 20, unknowns 20 of 20 honest, and critical trust 100% in the final answers (spec/retrieval.md §6.2). CC-203's reference answers still show each answer rule can be met; that is not acceptance (unchanged).
- **CC-206** (the eighty cases in the native harness) moves to 1.0.0 with CC-186. The smoke set has no retrieval case until CC-206 exists.
- 0080 §4 (an unresolved subject is asked about) keeps its CLI side in 0.13.0 (CC-205); whether the answers need skill wording is learned from the 1.0.0 run, and that wording goes through the skills fork then.

## Consequences

- [build/TASKS.md](../build/TASKS.md): CC-186's and CC-206's rows move to the 1.0.0 section with `**Release:** 1.0.0`, each with a "Moved by 0082" line; 0.13.0's plan tables and its "CC-186 last" lines change to the smoke run; CC-217 records this decision. The harness already runs a subset (`--cases`), so the smoke run needs no build task.
- [docs/releasing.md](../docs/releasing.md)'s "Each release" gains the smoke run's step, before `release.mjs`. `release.mjs` does not check it; a check would be its own task.
- 0077 and 0080 get header pointers; spec/eligibility.md §12 and spec/retrieval.md §8 get a pointer line; the vision and the backlog's launch-readiness row name the moved run. Their bodies stay as recorded.
- 0.13.0's acceptance is weaker than 0077 planned until 1.0.0: a critical-trust kind is checked natively on one case per agent, not on every case. The automated checks and the retrieval-level trust cases still cover every case at every release.
- This is a planning record: no CLI, eval, harness, skill or `release.mjs` change, and no brain operation.

## Evidence

- The user's answers in the coordinator session, 2026-11-11: "we won't run this until the beta testers are live and we have no more critical revisions to give the core functions"; a native smoke run of about ten cases per agent with every critical-trust kind, plus the full automated checks, at each release; the complete native acceptance (CC-186) to the 1.0.0 section; CC-206 with it, 0.13.0's retrieval judged at the candidate level and 0080's final-answer gate moved with the native run.
- CC-200's smoke figures (#303): about 18 seconds and 0.31 USD (API-equivalent) per Claude Code session, and its projection for the complete run.
- [0077](0077-trust-repair-in-0-13-0.md) §5, [0080](0080-english-retrieval-quality-in-0-13-0.md) §3 and §9, [spec/eligibility.md](../spec/eligibility.md) §12, [spec/retrieval.md](../spec/retrieval.md) §6.2 and §8, [eval/memory-0.12/native/README.md](../eval/memory-0.12/native/README.md).
