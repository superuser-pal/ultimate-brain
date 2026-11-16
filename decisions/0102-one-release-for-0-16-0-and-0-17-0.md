# 0102 — One release: 0.17.0's two features ship in 0.16.0

**Status:** Accepted
**Date:** 2026-11-16
**Release:** 0.16.0
**Amends:** [0098](0098-agree-by-subject-and-check-a-changed-document.md) (§4 to §7 ship in 0.16.0, not 0.17.0); [0100](0100-keep-a-task-as-a-document.md) §6 (keeping a task as a document ships in 0.16.0); [0061](0061-roadmap-and-launch-boundary.md) (no 0.17.0 before 1.0.0: 0.16.0 is the one release after the cutoff, and it holds the two features)
**Keeps:** every rule of 0096, 0098, 0099, 0100 and 0101 other than its release; 0.15.0 as the feature cutoff for anything else; the beta invites wait for 0.16.0 (0096)

## Context

After 0099 (PR #414), 0100 (PR #415) and 0101 (PR #416), the plan had two releases before 1.0.0:
- **0.16.0:** decide in the session (0096), ingest by subject (0098 §1 to §3), no Decisions or Questions databases (0099), Notion edits asked in the session (0101 §4 to §7). It gates the beta invites.
- **0.17.0:** a changed document checked as an Inbox row before it goes in (0098 §4 to §7), and a task kept as a document (0100).

Both releases change the same Notion space, the same skills and the same template. On 2026-11-16 the author asked for them in a single release, with the cost in view: the invites wait for all of it.

## Decision

1. **0.17.0's scope ships in 0.16.0.** 0098 §4 to §7 and all of 0100 move to 0.16.0, unchanged. There is no 0.17.0 before 1.0.0.
2. **The invites wait for the whole release.** U-28 still waits for 0.16.0, which is now larger; the testers get one template and one upgrade.
3. **The tasks keep their identities.** CC-308 to CC-311 and U-35 move to 0.16.0, with dependencies on the 0.16.0 work they touch instead of on 0.16.0's release: CC-308's contracts after CC-307 and CC-313, which edit the same files; CC-309 after CC-296 and CC-314; CC-310's skills after CC-298, in the next skills release; CC-311's migration after CC-299, with the next number. The template (U-33) waits for CC-311 too, so the testers' template has everything.
4. **The cutoff.** 0.16.0 is the one explicit roadmap change after 0.15.0: it removes and simplifies (0096, 0099, 0101) and adds the two features of 0098 §4 to §7 and 0100. Anything else new waits for after 1.0.0.

## Consequences

- 0.16.0 has two Notion migrations (CC-299's, then CC-311's) and two skills releases (CC-298's, then CC-310's) unless the builder joins them; the release notes and `brain upgrade` name both migrations in order.
- The coordinator runs CC-308 beside CC-296 and CC-314, after the contracts it depends on.

## Evidence

The author's answer of 2026-11-16 in the planning session (CC-330): "All of 0.17.0 into 0.16.0", asked with the cost that the invites wait for it.
