# 0104 — Product design principles throughout development

**Status:** Accepted
**Date:** 2026-11-17
**Release:** 1.0.0 (documentation and process; applies to work from adoption)
**Amends:** [0061](0061-roadmap-and-launch-boundary.md)'s opening scope review with explicit design-principle checks; [0097](0097-easy-setup-on-windows-and-mac-and-markitdown-required.md) §4's platform direction with identical capabilities as the target, retaining its current limitation until the parity epic delivers; [0101](0101-where-notion-ai-and-the-brain-each-write.md)'s operator emphasis with the development agent as the preferred brain-management path
**Keeps:** the feature cutoff and accepted release scope; Markdown and Git as canonical; Notion ownership and permitted crossings; existing approval, eligibility, automated and native smoke rules; 0101's complete path without Notion AI in 1.0.0; current Claude Code/Codex support and product development roles
**Amended by:** [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) (2026-11-20; 0.17.0): §5: the parity epic's scheduling part is delivered in 0.17.0; the audit of every other difference stays post-1.0

## Context

The user asked for principles governing every feature from ideation to release: lean choices, governed information flow, few Notion databases, minimal user effort, a small toolset, development-agent-first operation and macOS/Windows support. The planning discussion settled the database review, future provider scope, identical platform capabilities and non-blocking manual Windows testing. The user then approved the proposed document and lifecycle integration.

## Decision

1. [docs/design-principles.md](../docs/design-principles.md) is the canonical statement of the seven principles. The vision and product agent instructions link to it.
2. The existing planning session evaluates database reuse: the agent compares the use case with existing databases before proposing a new one. Essential additions need reasons why none fits. This introduces no separate database-approval ceremony. Additional tools receive a similar necessity review within feature planning.
3. Task outputs and acceptance criteria carry applicable design evidence. Existing lifecycle, eligibility and Notion ownership specs keep the detailed contracts. PR authors describe the evidence and independent reviewers check it.
4. Claude Code or Codex is the preferred brain operator. Notion AI remains an optional convenience in its existing Notion scope. The accepted rollout of 0101 remains unchanged; Gemini and other providers remain future work.
5. Identical macOS and Windows capabilities are the target, including automation. The parity epic recorded by CC-339 covers scheduling and an audit of every other difference, with implementation post-1.0 and no assigned release. This records a direction and backlog commitment; current commands and platform limitations change only through scoped contracts and implementation tasks.
6. When a release needs manual Windows acceptance, create or update one release-specific task in the existing Notion Tasks database with test requirements, version, prerequisites, steps, expected outcomes and results. Outstanding testing is a visible warning, not a publication blocker. Keep the follow-up open until resolved. Existing automated, native smoke and other release rules stay in force.

## Delivery

CC-340 records this decision, the principles document, links from the vision and agent instructions, task-planning guidance, lifecycle and Notion-design pointers, review instructions and the Windows acceptance procedure. CC-339 records the parity epic separately. This work changes documentation and development process; it writes no personal knowledge, live Notion data, runtime code, vendored skills or CHANGELOG.

## Evidence

The user's principles discussion of 2026-11-17; Q1 (database reuse evaluated in feature planning), Q2 (additional-provider support remains future scope), Q3 (identical capabilities and a parity backlog epic), Q4 (manual Windows testing is a warning, not a blocker); approval of the proposed document and SDLC locations in the following session message.
