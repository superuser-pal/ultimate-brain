# 0060 — Hermes operates the shared brain with scoped learning

**Status:** Accepted
**Date:** 2026-10-31
**Release:** 0.11.0
**Amends:** 0008 (Hermes operational learning boundary), 0051 (additional native scheduler)
**Refines:** 0059 (third runtime compatibility and reconciliation)
**Keeps:** 0003, 0009, 0015, 0022, 0044, 0048, 0054, 0055, 0057, 0058

## Context

After skills separation and reflection, Hermes supplies an always-on operator and remote access. It must reuse shared skills and knowledge contracts while retaining its useful native learning. [Review 07](../reviews/07-hermes-and-search.md) verified skill discovery but did not run a real model-driven scheduled Notion round trip; its missing-unattended-mode finding predates 0.7.0.

## Decision

### MVP and ownership

- One always-on Mac mini host; native Hermes brain operations, not a Claude process for every question/capture. Use the same compatible, pinned shared skills and CLI contracts. Record/test the Hermes version and model configuration as well.
- One private owner-only Telegram chat. Notion remains the main frontend for tasks, documents, settings, review and progress. Chat provides selected capture, cited answers, requests, exact-item approvals and exception notifications with links back.
- **Operator** permits capture, query, catch-up, reflection and authorised publication. **Coordinator** adds maintaining approved plans, identifying ready work and preparing durable handoffs. Check permissions when operations execute, not only through prompt wording. Establish an extension boundary for future roles without implementing arbitrary custom roles or executor powers now.
- A handoff preserves scope, acceptance, task identity, destination, logging policy, dependencies and approval state. It does not launch a worker. Hermes does not build the product under 0044.
- Ultimate Brain owns contracts and integration-specific adapter code/deterministic support. The skills fork owns instructions; Hermes owns gateway, scheduling and model execution. Keep runtime state, configuration, credentials and learned private material outside public repositories.

### Capture, answers and approvals

- Text, links and attachments reuse existing conversion/ingestion paths. Voice is optional with a configured, verified transcription path; transcripts obey 0055's inclusion rules.
- Explicit captures enter Inbox at their selected destination. Ordinary questions/conversation remain session history. Useful shared learning becomes a brain candidate, not accepted knowledge. Confirm what a remember/capture request actually saved and where, or that it is pending.
- Reuse saved destination mappings; ask only when ambiguous. Avoid repeating setup questions for each message.
- Telegram approvals identify an exact item and current proposed change, respect authorisation/current-base rules and become durable shared decisions visible in Notion. An ambiguous reply or changed proposal needs clarification. Reuse 0058's accepted limitations for Notion-origin wording; do not claim stronger acceptance than the source provides.

### Scoped memory and self-improvement

- Retain autonomous native memory for operational lessons, environment/tool behaviour and continuity. Shared project facts, commitments, decisions and general user preferences follow the brain's existing source, draft/proposal and scope rules. Memory may hold pointers/cached context but cannot silently override newer canonical knowledge.
- Permit automatic private Hermes procedure creation/revision with history and rollback, within the role's existing permissions. Prevent private skills from overriding shared names or modifying the shared snapshot. Improvements to shared skills become reviewable work in the fork; permissions, approval rules and canonical contracts require review.
- A workflow being Hermes-only does not hide its shared knowledge from the brain. Failed transfers remain durably pending and visible.
- Include a learning bridge in scope. Native Hermes separates memory by profile, not by factual category; built-in post-write callbacks alone do not enforce routing. A focused feasibility check must identify actual write paths, including background reviews, and test stale/conflicting recall and shared-skill protection. Choose the smallest validated integration; do not claim a configuration switch enforces semantic separation.

### Scheduling, failures and controls

- Start runs through schedules or explicit Telegram requests. Notion edits are picked up during runs. Notion-triggered webhooks, continuous sync, additional channels/users/hosts and external worker launch/supervision are post-1.0.
- Offer transfer of existing catch-up/reflection schedules, verify the replacement and keep one owner per job. Coordinate writes with attended agents. Retain recoverable pending operations through interruption; unknown outcomes are reconciled before retry.
- Reuse 0051's budgets, no-op behaviour, explicit-decision limits, module settings and publication choices. Apply 0.8.0's evidence exclusion, pending-edit preservation and acceptance contracts unchanged. Available local folders/repos are identified; unavailable inputs remain visibly pending.
- Successful routine runs are quiet. Failures and decisions needed produce concise deduplicated Telegram notifications, with shared Notion status updated when reachable. If Notion is down, retain state and report through Telegram; if delivery also fails, retain the undelivered notification and local diagnostics. Never present stale frontend state as a fresh success.
- **Pause background work** stops admitting scheduled jobs while queries/captures remain available. **Resume** checks connections/versions and continues pending work. **Stop this run** stops at a safe boundary and preserves completed work. Expose controls/status in Notion; Telegram controls continue to function during a Notion outage.
- Pin a tested initial model; interactive and scheduled model choices are configurable. Changing models requires a focused compatibility smoke check. Establish operating limits from trial evidence during setup rather than inventing usage/cost claims.

## Delivery and acceptance

First prove one native scheduled Notion read/write, canonical write, publication and Git push on synthetic data, with headless auth checked. Validate learning routing before dependent implementation. Define safe failure if an integration cannot meet the agreed boundary; material scope changes return to the user.

Use three compact scenarios: background maintenance and a quiet no-op rerun; phone capture/query/exact approval visible in Notion; private learning/shared-fact routing/current correction/handoff continuity. Test shared authentication, interruption, duplicate delivery, conflict, unavailable-input and version failures once. Voice is tested only when configured. Finish with an attended host trial and brief cross-agent compatibility checks, not a duplicated full matrix.

## Evidence

- The user's accepted Hermes grilling and explicit agreement to the milestone, 2026-10-31.
- [Hermes v0.22.5 skills](https://github.com/NousResearch/hermes-agent/blob/v0.22.5/website/docs/user-guide/features/skills.md), [memory](https://github.com/NousResearch/hermes-agent/blob/v0.22.5/website/docs/user-guide/features/memory.md), [memory provider API](https://github.com/NousResearch/hermes-agent/blob/v0.22.5/website/docs/developer-guide/memory-provider-plugin.md), [cron](https://github.com/NousResearch/hermes-agent/blob/v0.22.5/website/docs/user-guide/features/cron.md). These are reviewed capabilities, not evidence of this product's live integration.
