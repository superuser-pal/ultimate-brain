# 0059 — Shared skills source and explicitly connected workflows

**Status:** Accepted
**Date:** 2026-10-31
**Release:** 0.9.0
**Amends:** 0014, 0024, 0029, 0038 (skill source and delivery); 0018 (optional workflow coordination)
**Keeps:** 0003, 0009, 0015, 0022, 0048, 0049 as amended by 0054 and 0058, 0055

## Context

The user wants one independently maintained skills collection based on [the upstream skills repository](https://github.com/mattpocock/skills), including the brain's skills and an optional Notion-connected workflow. Separating source must preserve 0038's protection against incompatible or duplicate skill installations. A general-work process must also work beyond software development.

## Decision

### Source, compatibility and installation

- Create the public fork **ultimate-brain-skills**, retaining upstream attribution and licence. It owns all editable skill source. Ultimate Brain owns the CLI, schemas, data and Notion contracts.
- General skills release independently. Each brain uses an immutable, tested skill snapshot with declared CLI compatibility until deliberately upgraded. Generated snapshots in the CLI distribution are distribution artifacts, not another editable source.
- General skills may install globally; operational brain skills resolve to the relevant brain's compatible snapshot. Claude Code and Codex must resolve the same version. Installation detects competing copies; a global update cannot replace a brain's pin silently. Preserve the read-only linked-repo boundary unless a workflow is explicitly connected and authorised.
- Cross-repository contract changes have linked tasks/PRs and an integration check. Each brain release records the exact skill revision it tested. Missing/incompatible skills stop the affected operation and explain the upgrade; they do not select another tracker.
- Keep the current delivery path working during migration. Contracts define changes to init, link, upgrade, lint and package checks before implementation.

### One discipline, selected connections

- Work type selects the steps: software retains engineering checks; general work follows clarify, plan, execute, verify and approve. Tracking/publication is a separate explicit choice.
- **Standard:** preserve upstream GitHub, GitLab and local-file workflows without requiring a brain or Notion. **Connected:** Notion Tasks/Documents through a configured brain. Notion without a brain is post-1.0.
- Default to standard tracking. Remember explicit opt-in per project/workspace; credentials and brain discovery do not enable it. Store approved scope, acceptance, destinations and progress durably before relying on them in execution.
- Setup identifies the working folder (a software repo is optional), brain, existing Project **or** Area, and supported additional relations. Create a new destination only on request. Structural Notion changes follow 0022, not implicit setup.
- Notion owns user-facing **Workflow settings** on the Project/Area; local configuration holds connection details and a saved execution copy. Ask only for gaps. Explain and offer any required module enablement once; never silently enable it.

### Logging, documents and completion

| Logging level | Published material |
|---|---|
| Tasks only | Tasks and links to externally stored deliverables |
| Tasks + final outputs | Tasks and approved final deliverables; suggested setup choice |
| Full durable record | Tasks, approved briefs, plans, specifications, decisions and final deliverables |
| Custom | Selected artifact categories |

- Allow per-artifact inclusion/exclusion and per-task logging overrides. A policy change affects future work; historical publication is a separate request. Temporary drafts and logs stay local unless requested.
- Required text artifacts are readable in Documents; binaries have attachments or accessible links. Link documents to tasks and their destinations. Preserve authored Notion drafts; accepted wording returns through the brain's existing acceptance rules, including 0058's known limits. Retained-source documents retain their separate preservation rules.
- One authoritative tracker per project. Notion owns connected task status, priority and assignment; GitHub owns branches, PRs and checks. Per-task overrides never change identity or tracker. Transfer is explicit, with the original linked and marked as transferred where supported.
- Software: checks complete means ready for review; merge and required acceptance mean done. General work: acceptance criteria satisfied means ready for approval; user acceptance means done. Map meanings onto existing statuses without silently adding options.

### Lightweight reconciliation

- Read current Notion information before publication. Track stable task/artifact identities, pending operations and meaningful execution progress; these records are operational state, not a second editable task tracker.
- Preserve failed publication operations and retry without duplicates. Report work complete/publication pending distinctly. Intentionally local artifacts carry a location and reason. Never claim a chat-only agreement was saved.
- Reconcile the selected scope and its pending operations at run start, publication and completion. Handle routine unambiguous updates automatically. Preserve pending edits and surface only conflicting content, unclear destinations or changed scope through existing Review/Needs you surfaces.
- Coordinate simultaneous writers; a read-before-write alone is not a concurrency guarantee. Define recoverable interruption and uncertain-outcome handling in the contracts.
- Show one dated summary on the Project/Area with progress, pending publication and decisions needed. When Notion is unavailable, report in the active session and retain work locally; its frontend remains at its last confirmed state.
- Keep task work status separate from publication status. The connected workflow cannot report full completion while required records remain unpublished. No new reconciliation database, continuous sync or routine approval checkpoint in this release.

### Existing-project adoption

- Add a dedicated adoption skill alongside new-project setup. Inspect instructions, methodology, plans, tasks, statuses, dependencies, documents and completion rules.
- Preserve compatible conventions and partial progress. Present incompatible rules for decision; do not overwrite repository instructions or restructure a backlog to impose defaults.
- Default to selected active/planned work. Keep completed history in place. Show one preview of creations, updates, untouched records, status/dependency mappings, tracker ownership and treatment of originals before applying.
- Initially support Markdown plans/checklists, GitHub/GitLab issues and existing Notion tasks. Other systems receive an inspected proposed mapping with unsupported portions identified. Adoption reruns must not duplicate work.

### Update awareness

- Every skills PR declares no brain impact, compatible impact, or coordinated changes required; CI requires the declaration and links for coordinated work.
- Record the installed/tested revision separately from the latest revision assessed for impact. Check newer releases **and unreleased changes** daily, at the start of product work and before brain release.
- Maintain one outstanding integration issue. Seeing a change does not dismiss unfinished work: classify it as ready for deliberate upgrade, linked brain work required, or reviewed/no action. Relevant unresolved work remains visible. Failed checks say status unknown.
- Block affected incompatible operations/releases, not unrelated general-skill development. Detect upstream changes and prepare reviewable update PRs; no automatic merge.
- Specify automation cadence, credentials, failure reporting and acceptance tests. Use repository workflow tokens where sufficient and a narrowly scoped installation credential for cross-repository operations where needed. Keep credentials private. An instruction reminder alone does not satisfy this decision.

## Migration and acceptance

Follow [the migration plan](../docs/skills-migration-plan.md). Test three small existing-project scenarios: standard software; connected software with a PR; and general work preparing a workshop directly under an Area. Preserve history, dependencies, partial progress and logging choices. Test shared interruption, retry, conflict, version and update behaviours once, with brief agent-specific smoke checks rather than duplicated suites.

## Consequences

This changes source ownership and the delivery contract without authorising immediate extraction. Implementation follows 0.8.0. Reflection retains its task identities and moves to 0.10.0 under [0061](0061-roadmap-and-launch-boundary.md). No personal configuration or knowledge enters either public source repository.

## Evidence

- The user's accepted grilling rounds and final request to record the plan, 2026-10-31.
- [Upstream setup at the reviewed revision](https://github.com/mattpocock/skills/blob/a496f5513d4a4cf889bc48e189e579f4b0bdf6aa/skills/engineering/setup-matt-pocock-skills/SKILL.md) and its tracker-specific templates.
- [0038](0038-delivery-lanes-and-release-gates.md), [0048](0048-modules-and-simpler-rows.md), [0049](0049-documents.md), [0054](0054-brain-assistant-buttons.md), [0055](0055-domains-capture-and-review.md), [0058](0058-acceptance-is-current-as-of-the-click-minute.md).
