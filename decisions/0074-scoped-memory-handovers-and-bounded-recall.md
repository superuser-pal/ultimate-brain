# 0074 — Scoped memory, work handovers and bounded recall in 0.12.0

**Status:** Accepted
**Date:** 2026-11-06
**Release:** 0.12.0
**Refines:** [0061](0061-roadmap-and-launch-boundary.md) and [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md) (0.12.0 scope and acceptance)
**Refined by:** [0077](0077-trust-repair-in-0-13-0.md) (superseded memories only in an explicit historical read; one eligibility rule for every read; one native run per agent on the final package); [0080](0080-english-retrieval-quality-in-0-13-0.md) (§5 and §6 for English retrieval in 0.13.0: the first search, eighty added cases, latency and output-token caps)
**Keeps:** [0003](0003-proposal-review-flow.md), [0008](0008-agent-memory-store.md), [0009](0009-memory-scope-levels.md), [0016](0016-typescript-on-node.md), [0055](0055-domains-capture-and-review.md), the existing workflow boundaries and the feature cutoff at 0.14.0

## Context

The 0.12.0 roadmap promises useful context across Claude Code and Codex sessions and reliable cited retrieval. Its opening grill distinguished remembering lasting lessons, handing unfinished work to another session, and selecting a small amount of context for the next task. The user prioritised low complexity, preserving the existing architecture and controlling token use.

The session also compared existing memory systems instead of assuming a new engine was needed. The final preference is selective TypeScript adaptation of small deterministic retrieval components from claude-obsidian, with agent-memory and obsidian-second-brain as additional references. This chooses a source to evaluate, not a replacement memory runtime or a claim of measured retrieval superiority.

## Decision

### 1. Deliver memory continuity, not only better search

| Layer | Purpose | Authoritative home |
|---|---|---|
| Durable memory | Reusable preferences, constraints, lessons and reasons behind choices | Existing atomic Markdown memories under `memories/YYYY/MM/`, with 0008's provenance, confidence and supersession |
| Work handover | Where work stopped, what was tried, unresolved questions and the next action | The existing repo/task/session records; the brain helps the next agent find them without copying a changing task list into durable memory |
| Hot context | A small, relevant opening selection of approved memories and recorded work context | Generated from those records; never a second canonical store or evidence source |

Both Claude Code and Codex use the same contracts. Continuity covers switching agents in either direction, as well as a later session of the same agent. An interrupted session resumes from the last recorded state; unrecorded work is not invented. Repo-specific governed conventions remain in the repo's own instructions.

### 2. Capture through one closing review and explicit requests

- Offer one closing memory review by default. The user can say **"remember this"** at any time. An immediate suggestion is appropriate when forgetting it would materially affect the current work; avoid repeated unsolicited interruptions.
- Show **at most five suggested memories** at closing, prioritising reusable constraints, decisions and costly lessons. Say when further candidates exist. Explicit remember requests must be accounted for even if they exceed five.
- The agent may propose a lesson the user did not explicitly state, but it must label the inference and show supporting examples. A one-off event stays in the work record unless it supports a reusable lesson.
- Inferred candidates become reusable guidance only after the user's approval. Approval does not turn an inferred claim into a verified fact. Preserve the existing provenance/confidence distinction and review mechanisms; do not introduce a parallel approval queue.
- Show the proposed reach beside each candidate. Use the **narrowest scope supported by the user's words**: a project instruction does not become general merely because it could be useful elsewhere. Explicit global wording can support a general memory.
- Memories themselves remain unpublished to Notion under 0008. Existing chat/Review mechanisms remain the approval interface. Promotion of a memory into lasting project or domain knowledge is a later reviewed step, linked back to the memory.
- Closing capture uses supported session boundaries where available and an explicit closing-command fallback where they are not. Contracts must describe the capability differences rather than promising unsupported automatic capture.

### 3. Recall a small scoped pack, then retrieve selectively

- At the start of substantive work, select relevant approved memories and recorded work context within the caller's authorised scope. Honour 0009's default-deny reach, 0055's excluded evidence, current approval and supersession state, and the folder's existing workflow rules.
- The **initial opening-recall budget is 800 tokens**, including the delivered pack's framing. It is a starting budget to validate, not a proven optimum. Contracts define token accounting, selection and safe truncation; byte or word counts alone are not evidence of the token result.
- Use compact search results and selective reads when a later decision needs additional context. No automatic full-note expansion. State missing or conflicting evidence instead of silently treating an incomplete pack as a complete account.
- Explain remembered context briefly when it materially shapes the approach, with its origin. Do not require a memory recital at every session start.
- Hot context is a generated selection, not another knowledge base. Any index/cache is derived and rebuildable from eligible canonical records. Changes to approval, scope, exclusions, corrections and supersession must be respected before cached context can reach the agent.
- Do not install global recall hooks that silently grant brain access in standard workflows. Contracts must specify the explicit recall opt-in and how it coexists with repo links and connected-workflow boundaries.

### 4. Keep memory current without automatic expiry or rewrites

- **No blanket expiry.** Reconsider a memory when newer evidence challenges it or its context changes. Preserve superseded records and their history, and surface uncertainty when validity is in doubt.
- A conflicting instruction applies to the **current task as an exception** by default. It does not silently replace lasting guidance. At closing, ask whether a future-facing change is intended when the distinction matters. Explicit wording such as "from now on" supports proposing a permanent replacement through the existing review flow.
- No autonomous memory rewriting, background distillation or dream/model work is introduced by 0.12.0. This does not change existing catch-up or reflection schedules governed by their own decisions.

### 5. Adapt small components into the existing TypeScript system

- Prefer a small TypeScript adaptation of claude-obsidian's deterministic BM25/tokenisation, chunking, synthetic-prefix, compact-snippet and content-freshness mechanisms where they improve representative cases. Feed the existing brain parser's eligible records into retrieval; preserve IDs, nested metadata, multilingual behaviour and source attribution.
- Evaluate agent-memory as a comparison/reference for progressive recall, provenance and supersession. Consider obsidian-second-brain's bounded recall/abstention and per-session read-receipt patterns where useful. Its Crew feed and global-rule promotion are not the handover contract.
- Do not adopt an entire upstream store, parser/schema, wiki layout, lifecycle, transcript archive, task system or approval queue. Do not add a Python sidecar, always-on memory service, required vector database or Obsidian dependency for this work. Keep adaptations and attribution small and reviewable.
- The source choice is conditional on a bounded compatibility and token comparison. If reuse requires a broad port, permanent vendor fork, schema migration, bidirectional synchronisation or a competing authority, reconsider it rather than expanding the integration. Existing Markdown + Git, Notion flows and brain-owned approval/scope/exclusion rules remain authoritative.

### 6. Acceptance measures trust, useful answers and token use

Before implementation, the contracts define a fixed representative synthetic test set and its expected evidence/answers. Evaluate retrieval candidates and the final answers separately. Include both agent-switch directions, same-agent later sessions, paraphrases, current versus superseded guidance, corrections, contested evidence, approved inference, unapproved candidates, scope boundaries, exclusions and genuinely unknown answers.

- **100% of critical trust cases pass:** approval eligibility, default-deny scopes, excluded evidence and supersession hold; unsupported claims are not stated as facts and inference stays labelled.
- **At least 90% of answerable cases produce a correct, sufficiently complete, cited answer.** Missing an available answer counts as failure. Unknown-answer cases must remain honest and are tested separately from answerable-case coverage.
- Measure the delivered opening context against the **800-token budget** and report later retrieval/read costs separately. Report any extra model calls, runtime/dependency burden and adaptation surface. No background model work is an accepted cost-saving shortcut.
- Compare proposed retrieval changes with the existing applicable query baseline before selecting them. Source inspection, stars and advertised benchmark results are not acceptance evidence for this product. Do not weaken the gates or silently raise the budget to make a candidate pass.

## Consequences

- The six capabilities are explicit: hot opening context, cross-session handover, durable capture, targeted recall, scoped/correctable memory and reviewed promotion. Retrieval code alone does not deliver the release.
- The 0.12.0 work packages now have an agreed scope. Claude Code writes contracts, chooses the smallest build slices after those contracts and implements them in task worktrees. This planning record starts no implementation and changes no CLI/schema/skill or deployed brain.
- Contracts must settle command/API shapes, candidate persistence and recall eligibility, work-record/checkpoint mappings, token accounting, opt-in/capability behaviour, cache invalidation and evaluation scoring within these boundaries. These are implementation contracts, not permission to reopen accepted product choices or add another memory system.
- 0.11.0 reflection, 0.13.0 weekly payback/correction propagation, 0.14.0 onboarding and the launch boundary retain their placement.

## Evidence

- The user's 2026-11-06 opening grill for 0.12.0: durable lessons plus work handovers with separate lifetimes; one closing review and explicit remember; scoped opening recall and targeted search; approval of labelled inferred candidates; narrow scope; task exceptions; brief material explanations; no blanket expiry; five closing suggestions; the trust/answer gates; small TypeScript adaptation; and the initial 800-token budget. The user accepted the clarified six-capability plan and asked to lock it.
- [Existing memory design](0008-agent-memory-store.md), [reach rules](0009-memory-scope-levels.md), [roadmap](0061-roadmap-and-launch-boundary.md), [both-agent scope](0064-brain-assistant-before-reflection-hermes-after-1-0.md), and the earlier source reviews [01](../reviews/01-claude-obsidian.md), [03](../reviews/03-obsidian-mind.md), [04](../reviews/04-obsidian-second-brain.md) and [07](../reviews/07-hermes-and-search.md).
- Current source comparison, read-only on 2026-11-06: claude-obsidian at `2e545563` ([BM25](https://github.com/AgriciDaniel/claude-obsidian/blob/2e545563172f97f02ecaaaab376ceea1246a0583/scripts/bm25-index.py), [chunking/prefix](https://github.com/AgriciDaniel/claude-obsidian/blob/2e545563172f97f02ecaaaab376ceea1246a0583/scripts/contextual-prefix.py), [freshness/snippets](https://github.com/AgriciDaniel/claude-obsidian/blob/2e545563172f97f02ecaaaab376ceea1246a0583/scripts/retrieve.py)); agent-memory at `1282495` ([indexer](https://github.com/tigerless-labs/agent-memory/blob/12824950a6311343595213ea714a7eb879a55d3e/packages/core/src/agent_memory/core/indexer.py), [configuration](https://github.com/tigerless-labs/agent-memory/blob/12824950a6311343595213ea714a7eb879a55d3e/packages/core/src/agent_memory/core/config.py)); obsidian-second-brain at `deff215` ([bounded recall](https://github.com/eugeniughelbur/obsidian-second-brain/blob/deff215377f0ecae68deed1074046f883425388e/hooks/obsidian-recall.py), [Crew](https://github.com/eugeniughelbur/obsidian-second-brain/blob/deff215377f0ecae68deed1074046f883425388e/scripts/crew.py)). These source reads establish mechanisms to consider, not runtime or token-cost results.
