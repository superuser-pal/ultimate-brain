# 0061 — Feature work ends at 0.14.0, followed by launch preparation and 1.0

**Status:** Accepted
**Date:** 2026-10-31
**Amends:** 0052, 0055, 0056 (reflection release placement); 0008 (memory loop delivery); 0030 (minimal onboarding preferences delivery)
**Keeps:** 0038, 0039, 0040, 0044, 0046 and the permanent architecture rules

## Context

The user accepted the skills separation and Hermes plans, then prioritised reliable cross-agent memory/retrieval, daily knowledge payback and repeatable adoption. The user explicitly set a feature cutoff: after 0.14.0, focus on productisation, translation and the funnel to launch 1.0. Issues and dogfood may require fixes, but do not reopen the feature backlog implicitly.

## Decision

### Committed order

| Release | Scope | Completion evidence |
|---|---|---|
| 0.8.0 | Existing buttons, Domains, selected evidence and editable Review | Existing task acceptance; preserve current implementation scope |
| 0.9.0 | Shared skills source, standard/connected software and general workflows, setup/adoption, compatibility and update coordination ([0059](0059-shared-skills-and-connected-workflows.md)) | Three small adoption scenarios plus shared recovery/version tests and both-agent smoke checks |
| 0.10.0 | Reflection under 0052, subject to 0055 | Useful findings, rejected-finding dedup and manageable Review workload |
| 0.11.0 | Native Hermes operator/coordinator, Telegram, learning bridge and recoverable scheduling ([0060](0060-hermes-operator-and-learning.md)) | Three compact scenarios and an attended host trial |
| 0.12.0 | Cross-agent memory continuity and reliable cited retrieval | Useful context survives changing Claude Code/Codex/Hermes; current, scoped and cited answers on representative cases |
| 0.13.0 | Weekly digest/review and targeted correction propagation | Actionable weekly output and reviewable correction of affected restatements |
| 0.14.0 | Repeatable onboarding, diagnostics, import/seeding and minimal per-area tracking preferences | A fresh user reaches useful capture, review and cited retrieval without developer intervention |
| 1.0.0 | Productisation, translation, acquisition/onboarding funnel and public launch | Published guidance supports understanding the offer, installation, Notion connection, capture/review, cited retrieval and common-failure recovery |

- CC-65 to CC-67 and U-21 move to **0.10.0** with their identities and purpose intact. Original historical release wording remains historical. 0.8.0 implementation continues undisturbed.
- Version themes are commitments, not permission to implement all of them now. Each release's contracts/specs and detailed acceptance precede its implementation.
- Record future work as `todo`; only an explicitly started task becomes active. Claude Code remains implementation owner; Codex reviews. The user's explicit request to record this agreement permits this planning-only Codex authorship, following the CC-74 precedent; it requires independent review and no self-issued pass.

### Session-opening scope gate from 0.9.0 onward

- Begin **each human-led product development session** for 0.9.0 or later with a grilling session. Read the current decisions, release/task scope, prior accepted agreements and new issue/dogfood evidence first.
- Present the current scope, exclusions, prerequisites and intended result. Grill through the decisions relevant to that session, including changed assumptions and unresolved scope, until the user confirms shared understanding before implementation begins.
- Reuse recorded answers as the baseline; do not silently treat a roadmap heading as fresh agreement or repeat the entire product interview. This is a real scope checkpoint, not a ceremonial automatic approval.
- A new version goal, feature addition or launch-boundary change requires explicit agreement and an updated decision/roadmap before implementation. This gate governs product development, not scheduled operation of a deployed brain, whose unattended rules remain unchanged.

### 0.12.0: remember and retrieve

- Extend the capture/proposal/promotion loop to Claude Code and Codex, reusing Hermes's shared knowledge contract rather than creating a third memory store. Honour 0009's default-deny scopes and 0055's exclusions. Include session-end capture where supported; capability-specific fallbacks are explicit.
- Evaluate both retrieval candidates and final cited answers: current versus superseded facts, paraphrases, corrected facts, unknown answers, exclusions, permissions and cross-session continuity. Use representative synthetic cases and keep personal evidence private.
- Improve query reformulation/ranking when misses demonstrate need. The existing search evaluation supplies a baseline; a vector store, graph index or external retrieval database is not promised. Any index is rebuildable from canonical material.

### 0.13.0: knowledge payback

- Produce a concise weekly digest/review covering decisions, changed facts, open questions and useful next actions, with citations and freshness. Reuse Reports/module-off contracts; outputs do not become evidence.
- A targeted correction sweep identifies affected restatements and proposes changes. Preserve independent evidence and require review for existing knowledge; no blind global replacement.
- Measure usefulness and Review effort, not note count. Improve selection/filtering if the queue grows; do not solve it by weakening acceptance or increasing capture blindly.

### 0.14.0: repeatable adoption

- A guided flow probes existing installation/connections, asks only gaps, establishes identities and destinations, imports selected material and demonstrates first capture/review/query. Reuse 0.9 project adoption and 0.11 runtime setup.
- Diagnostics extend existing health/status mechanisms. Document recovery/reauthorisation and distinguish committed knowledge, attachments, pending Notion edits and runtime state; Git alone is not proof all of them are recoverable.
- Support minimal per-area tracking preferences within the stable schema. Rich domain-specific types, arbitrary persona systems and specialised professional workflows remain post-1.0.
- Validate with a fresh-user acceptance flow; use sanitised/synthetic evidence in the product repository. Complete applicable earlier acceptance runs rather than carrying unverified capability claims into launch.

### Feature cutoff and launch preparation

- **0.14.0 is the feature cutoff.** After it, focus on packaging, installation/upgrades, consistent templates/terminology/guidance, translation, positioning, demonstrations, the landing page and acquisition/onboarding funnel.
- Prefer 1.0 release candidates. An additional preparation version is permitted if useful, with an explicitly recorded scope limited to launch readiness; no preparation version is allocated automatically.
- Confirm launch audience, languages, channels, offer and publication details during launch planning. Recording this decision does not select a commercial model, publish a site or authorise outbound messages.
- Launch-blocking fixes, documentation corrections and bounded productisation are permitted. New product features require the user's explicit change to this decision; calling them polish or dogfood does not bypass the cutoff.
- New connected email/chat sources (the previously suggested 0.15 connector milestone is withdrawn), rich fact/relationship modelling, advanced retrieval infrastructure, broad sensitivity tiers, external worker execution/supervision, extra hosts/channels/agents, multi-user/hosting and other expansion remain post-1.0 without promised versions.

### Issues, dogfood and pulling work

- Continue normal issue/dogfood triage: reproduce/classify, then assign a released fix task or close with a reason. Fixes to committed behaviour may ship in the relevant milestone or a patch; urgent trust/data-loss/recovery defects take precedence.
- Keep the release themes and launch destination intact. A feature request stays post-1.0 unless explicitly reprioritised by the user. If a blocker changes an acceptance criterion or the agreed experience, resolve that in the opening grill and record the decision; do not quietly lower the bar.
- Pull needed recovery, integrity and visibility work into the release that depends on it. Do not defer essentials behind a separate future reliability release. Basic retention/removal/consent questions must be settled before a new integration depends on them; advanced privacy work is not silently added to this roadmap.
- Use small representative end-to-end scenarios and shared failure tests once. Before pulling the next milestone, review prior acceptance evidence and actual daily friction. Later release details can be refined in their opening grills within these agreed themes.

## Consequences

[build/TASKS.md](../build/TASKS.md) holds released task work and status; this decision holds scope and the cutoff. [The backlog](../docs/v2-ideas.md) distinguishes committed work from post-1.0 candidates. It is not permission to implement parked ideas. Historical decisions are amended by this record rather than rewritten as though the original order never existed.

## Evidence

- Accepted grilling for 0.9.0 and 0.11.0; explicit acceptance of 0.12, 0.13 and 0.14 followed by launch preparation and 1.0; explicit request to record the plan despite future issue/dogfood feedback; session-opening grilling instruction, 2026-10-31.
- [Vision](../docs/vision.md), [backlog](../docs/v2-ideas.md), [search evaluation](../reviews/07-hermes-and-search.md), [0008](0008-agent-memory-store.md), [0009](0009-memory-scope-levels.md), [0030](0030-capability-based-onboarding-profiles.md), [0052](0052-reflection.md).
