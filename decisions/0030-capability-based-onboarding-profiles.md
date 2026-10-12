# 0030 — Capability-based onboarding profiles preserve the core schema

**Status:** Accepted
**Date:** 2026-10-11

## Context

The v1 folder layout and note types are intentionally small and optimized for the first user's meeting-centered workflow. Future users may work in different domains, such as consulting, research, writing, learning, or personal planning. Their agents may benefit from tailored vocabulary, extraction behavior, views, and optional domain-specific records.

Making each persona use a different canonical layout would weaken interoperability, migrations, validation, querying, and agent skills. A single persona label would also be too restrictive because one person can have several kinds of work and life activity at the same time.

## Decision

- Keep the v1 schema and Markdown layout as the stable core. Folders are a storage convention for agents and tools, not the primary navigation interface.
- Explore tailored onboarding after v1 through composable **capability profiles**, not mutually exclusive persona labels. Possible capabilities include client work, meeting-heavy work, research, writing, learning, and personal planning.
- A capability profile may tailor onboarding examples, prompts, extraction rules, Notion views, agent behavior, and optional domain-specific note types.
- Profiles should first express domain needs through the core types, tags, relationships, and flexible facts. Promote a domain concept to a dedicated note type only when it requires distinct validation, lifecycle, ownership, or generated outputs.
- Profiles are additive configuration, not permanent user identities. Enabling a capability adds behavior; disabling it must not delete or invalidate existing knowledge.
- Do not allow profiles to arbitrarily replace the canonical folder structure or core schema.
- This decision records a post-v1 direction only. It does not expand the v1 implementation scope or success criterion.

## Consequences

- Agents retain a predictable base structure across users while gaining domain-specific behavior where evidence supports it.
- Users can combine several capabilities without choosing a single identity such as "consultant" or "researcher."
- Optional types and workflows require explicit compatibility, migration, and validation rules before introduction.
- The product must collect classification failures and recurring domain needs during dogfooding before designing the first capability profiles.
- Markdown remains primarily agent-operated but human-inspectable, preserving the product's trust, ownership, and portability goals.

## Evidence

- [Product vision](../docs/vision.md): the v1 target is a solo knowledge worker spanning personal and professional life.
- [Research synthesis](../synthesis/synthesis.md): stable IDs, typed relationships, generated navigation, and a minimal v1 schema.
- [Brain schema specification](../spec/schema.md): the current closed set of v1 note types and canonical folder layout.
- Design grilling with the first user on 2026-10-11.
