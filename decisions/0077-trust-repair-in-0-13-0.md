# 0077 — Trust repair in 0.13.0: one operational eligibility rule for answers, proposals and upgrades

**Status:** Accepted
**Date:** 2026-11-10
**Release:** 0.13.0
**§6 release order amended by:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) (2026-11-10): onboarding in 0.14.0, the weekly review in 0.15.0 (still the cutoff); the trust repair stays 0.13.0 and first
**Out of scope amended by:** [0080](0080-english-retrieval-quality-in-0-13-0.md) (2026-11-11): English retrieval-quality work ships in 0.13.0 too, under this decision's eligibility rule
**Amends:** [0061](0061-roadmap-and-launch-boundary.md) and [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md) (release order and the feature cutoff); [0075](0075-weekly-review-and-targeted-corrections.md) (release placement only: 0.13.0 → 0.14.0)
**Refines:** [0003](0003-proposal-review-flow.md) (the evidence a proposal names), [0055](0055-domains-capture-and-review.md) (how exclusion reaches reads, derived content and proposals), [0074](0074-scoped-memory-handovers-and-bounded-recall.md) (superseded memories and the evaluation gate)
**Keeps:** [0009](0009-memory-scope-levels.md), [0063](0063-claude-sub-agent-reviews.md), 0055's authoritative, separately attributed user corrections, 0074 §6's gates and token accounting, 0075's weekly scope (unchanged, one release later), the session-opening scope gate and every architecture rule

## Context

An independent, read-only assessment of `v0.12.0` (2026-11-09 and 2026-11-10; records kept outside this repo) asked the 77 cases of `eval/memory-0.12` as final answers in native Claude Code and Codex sessions. Critical trust was 11 of 20 and 14 of 20 against 0074 §6's 100%: the CLI withheld forbidden memories and excluded statements, but the agents read them by opening and searching the brain's files, as the brain-query skill and the brain's `AGENTS.md` rule 2 told them to (finding F-0011). Further findings showed memory rows in `query` not following recall's rules (F-0017) and an approved proposal writing excluded wording into a note (F-0018).

Work started on unmerged branches as a 0.12.1 patch: CC-176 (#283, an eligible full read), CC-177 (#284, proposals resting only on excluded evidence) and the skills fork's PR #12 (CC-178, brain-query reads through the CLI). Their reviews found more gaps, written as CC-179 (proposals with no text, older Review rows) and CC-180 (ingest and reflection read note files). Each had a changes-requested review followed by author fixes, and none has a pass on its current head. Native runs reported on earlier revisions of those branches are evidence history, not acceptance of what will ship; the latest skill wording was not rerun. No fix has shipped.

On 2026-11-10 the user ran a scope grill on this repair, chose each option below, then accepted the complete implementation plan. Under 0061, a release change and a cutoff move need an explicit roadmap decision; this is that decision.

## Decision

The brain's approvals, reach (0009) and exclusions (0055) are **operational eligibility**: one rule decides what an agent may use, whether it searches, reads in full, summarises, cites or rests a proposal on evidence. Eligibility is enforced by the brain's commands and the skills that use them. It is not a filesystem access-control product and does not prove that a statement is semantically true.

### 1. Withhold the whole affected item when eligible support can't be established

- When eligible support for an affected report or proposal item cannot be established reliably, **withhold that whole item** until it is rebuilt or re-proposed from eligible evidence.
- An **item** is one indivisible change or one report: not the whole brain, and not every item on a Review page. Items supported independently stay available; source and history files are preserved.
- Accepted text is never silently stripped. A proposal whose wording changes needs **fresh exact acceptance** of the new wording.
- Ordinary approval never overrides a source exclusion.

### 2. Superseded memories only in an explicit historical read

- A superseded memory is reachable only for a question about the past, through an **explicit historical read mode**, and is labelled historical in the answer.
- Historical access still obeys approval, the caller's reach and source exclusion: old does not mean approved.
- A question about the present receives current eligible memories only.

### 3. Every proposed change names its supporting passages, checked twice

- Each proposed change identifies the specific passages that support it, including changes with no text (fact values, links, merges, supersessions and other structural changes). The passages are checked **when the proposal is created and immediately before it is applied**.
- A legacy proposal without adequate passage support is withheld and safely re-proposed, never applied on trust.
- A passage check establishes that the evidence is allowed; it does not by itself establish that the change is true.
- Authoritative, separately attributed user corrections are preserved under 0055. A generic Approve, or an incidental edit, does not launder an excluded claim that the change still carries.

### 4. One coordinated upgrade reaches the brain and every linked project

- One upgrade updates the brain's managed instructions and skills and each registered linked project's managed instructions and skill copies, preserving project-owned instructions.
- It verifies that both Claude Code and Codex receive the corrected definitions.
- An inaccessible project, duplicate or conflicting copies, or a missing or damaged managed block is **reported unfinished**, never counted as upgraded.
- The upgrade is tested on an actual synthetic old installation. After upgrading, fresh agent sessions are started so that instructions loaded before the upgrade do not persist.
- This records the intended upgrade scope; it does not authorise touching the user's real brain now.

### 5. One native evaluation run per agent on the final package

- **One complete native-agent evaluation run in Claude Code and one in Codex**, on the final packaged combination of CLI and skills snapshot; not three repetitions.
- Every critical trust case passes. 0074 §6's gate remains: at least 90% of answerable cases give a correct, sufficiently complete, cited answer; unknown answers are honest; the existing token accounting remains.
- The cases are the 77 baseline cases plus cases added for the gaps this decision closes.
- Session traces and the exact package and skills-snapshot or head identity are kept as evidence. No raw read of a brain file supplies an answer or a proposal's evidence.
- If a later fix invalidates results, the affected acceptance and the final applicable gate are rerun. Results from earlier branch revisions do not validate the final artifacts.

### 6. The repair is 0.13.0; weekly review and onboarding each move one release

- The trust repair is **0.13.0**: it adds a command option and changes skills and template rules, which the release rules make a minor release ([docs/releasing.md](../docs/releasing.md)).
- The weekly review and targeted corrections of 0075, including CC-111, move from 0.13.0 to **0.14.0**, with their scope unchanged.
- Repeatable onboarding moves from 0.14.0 to **0.15.0**, and **the feature cutoff moves to 0.15.0** with it.
- No feature expansion. Productisation, translation, funnel and launch remain 1.0.

### Implementation plan (accepted)

1. **Contracts first:** this decision, the roadmap and task plan, then one common eligibility contract covering supported searches, full reads, summaries, citations and the supporting evidence of proposals, before further code.
2. **The eligible read (CC-176):** a filtered full read and shared memory eligibility; the explicit historical mode; metadata (titles, summaries, aliases, frontmatter and custom fields, citation labels and paths) carries no restricted text. Safe administrative access stays distinct from answering: an administrative listing never becomes fallback answer evidence.
3. **Derived content:** direct and indirect dependencies do not launder approval, reach or exclusion; a stale report does not become eligible merely because its source was cleaned. Where provenance or freshness cannot establish safety, the whole item is withheld and independently supported canonical material is preserved. A "navigation only" label is not permission to show unsafe prose.
4. **Proposals (CC-177, CC-179):** on create and on apply; mixed text; changes with no text; old bundled Review rows; a proposal's why, value and metadata; exact re-approval of changed wording. A mixed item with excluded and live content is withheld whole, not applied whole.
5. **Skills (CC-178, CC-180), in the skills fork:** answering, report gathering and refresh, ingest context, reflection, delegated catch-up and other affected flows read existing brain content through the filtered commands, with no raw fallback. Initial authorised intake and administrative work stay distinct from retrieving existing knowledge. The skill release goes through the fork's process and is vendored; `.agents/skills/` is never edited by hand.
6. **The coordinated upgrade** of §4.
7. **Final acceptance:** synthetic unit, integration, package, skill and leak checks, then §5's native runs on the final packaged CLI and skills, covering old reports, metadata, historical memory, project and approval boundaries, an exclusion made between the first read or proposal creation and apply, legacy proposals and a linked project's upgrade. The deliverable is evidence, not a broad filesystem-security guarantee.

### Out of scope

A filesystem ACL or sandbox product; deleting anything from Git history or from original Notion sources; ranking or retrieval-quality changes not needed for eligibility; new features, engines or connectors; any operation on the user's private brain. New source links do not claim to prove semantic correctness mechanically. No new provenance platform: minimal contracts, and fail-closed handling wherever verification is unavailable.

## Consequences

- [build/TASKS.md](../build/TASKS.md)'s 0.13.0 section holds the task plan: CC-176 to CC-180 keep their identities and move from the branches' 0.12.1 section to 0.13.0; new rows cover the contracts, derived content, the coordinated upgrade, the added evaluation cases and the final native acceptance. Claude Code builds them in task worktrees; each is reviewed independently and merged by the user.
- 0.12.1 is not released. A task row that still says 0.12.1 moves to 0.13.0 when its branch is reconciled with `main`.
- 0061, 0064, 0075, 0003, 0055 and 0074 get header pointers to this decision; their bodies stay as recorded. The vision, the backlog, `AGENTS.md` and the task plan state the new order and the 0.15.0 cutoff. Spec lines that name 0.13.0 or 0.14.0 for the moved work are corrected by the contracts task.
- This is a planning record: no CLI, schema, spec or skill change, no brain operation, and no implementation starts with it.

## Evidence

- The user's scope grill and acceptance, 2026-11-10: whole-item withholding with independent items preserved and fresh exact acceptance; superseded memories only in an explicit, labelled historical mode; passages named and checked at creation and before apply, legacy proposals withheld and re-proposed, 0055 corrections preserved; one coordinated upgrade of the brain and every linked project, unfinished cases reported, tested on a synthetic old installation; one native run per agent on the final package with every critical trust case passing and 0074 §6's gates; the repair as 0.13.0, weekly review to 0.14.0, onboarding and the cutoff to 0.15.0. The user then accepted the complete implementation plan above.
- The assessment of `v0.12.0` (findings F-0011, F-0017, F-0018; records outside this repo), PRs #283 and #284 and the skills fork's PR #12 with their reviews, and the rows CC-176 to CC-180 on those branches.
- [Roadmap](0061-roadmap-and-launch-boundary.md), [memory and its gates](0074-scoped-memory-handovers-and-bounded-recall.md), [exclusions and corrections](0055-domains-capture-and-review.md), [weekly review](0075-weekly-review-and-targeted-corrections.md), [release rules](../docs/releasing.md).
