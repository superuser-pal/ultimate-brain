# 0069 — The package takes its skills from the fork in 0.9.1

**Status:** Accepted (by the user, 2026-11-04)
**Date:** 2026-11-04
**Release:** 0.9.0 (the plan), 0.9.1 (CC-105)
**Amends:** 0064 (0.9.0 stays one release: CC-105 moves to a 0.9.1 patch release)
**Keeps:** 0059 (shared skills, the fork, pinned snapshots; only the release of phase B changes), 0066, every architecture rule

## Context
By 2026-11-04 every 0.9.0 task but CC-105 and the acceptance (CC-107) was merged. CC-105 is phase B of spec/skills-delivery.md §9: skill authorship moves to the ultimate-brain-skills fork, and the package ships the fork's released snapshot verbatim. It works across two repos: the fork's only release, brain-v1.0.0, predates CC-104, CC-112, CC-114 and CC-117, so the fork first needs those changes and a new release whose range includes the CLI, and phase B's init, link, upgrade and lint changes still have to be specified (§9 leaves them out of its contract). Phase A already ships every 0.9.0 feature with pinned snapshots built from the product's `skills/`, so phase B changes where skills are written, not what a user can do.

## Decision
- 0.9.0 is released on phase A, after CC-107 and U-24. Its skills come from the product's `skills/`, under the snapshot name `ultimate-brain`.
- CC-105 moves to **0.9.1**, released right after 0.9.0, spec first. It keeps its identity, scope and acceptance.
- Until CC-105 merges, `skills/` stays the one place skills are written. Any skill change made before then must also reach the fork as part of CC-105.

## Consequences
- The 0.9.0 acceptance (CC-107) tests phase A: the effective skill source in each agent is the product's snapshot.
- Before releasing 0.9.0, the skills-integration issue classifies brain-v1.0.0 (the release gate refuses an unclassified first release). It is a deliberate upgrade CC-105 makes, so `ready`.
- 0059's rule that no step needs both repos upgraded at once is kept: 0.9.0 needs no fork release, and 0.9.1 needs one fork release whose range includes it.

## Evidence
The user's choice in the planning session of 2026-11-04 (of keeping CC-105 in 0.9.0, a 0.9.1 patch, or 0.10.0); spec/skills-delivery.md §9; build/TASKS.md (CC-105, CC-107).
