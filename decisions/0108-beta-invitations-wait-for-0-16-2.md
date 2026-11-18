# 0108 — Beta invitations wait for 0.16.2

**Status:** Accepted
**Date:** 2026-11-18
**Release:** 0.16.2
**Amends:** [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §2 (when the beta starts: on 0.16.2, no longer 0.16.1)
**Keeps:** everything else in 0106, §2 included: U-31, then U-32, then U-28; five testers, reached directly by the author, English-speaking only, each with Notion Business and Notion credits (0078 §6's rule); testers without Notion AI join after 0.17.0

## Context

0106 §2 started the beta on 0.16.1: U-31 (the attended setup steps 4a and 4b), then U-32 (the readiness recheck from `v0.16.1`), then U-28 (the invites). The same day the author added two items to 0.16.2 (0106 §12, §13), and 0.16.2's Notion migration 0029 carries them: the minutes laid out with headings, dividers and bold-prefixed bullets, which is what setup step 4a produces, and a New task button on Home, the first page a tester opens. Testers invited on 0.16.1 would meet a template that changes under them a week later, and U-31 and U-32 would have checked a setup no tester gets.

## Decision

1. **Beta invitations wait until 0.16.2 is released**, not 0.16.1, so the attended run and the readiness recheck run on what testers will get.
2. **U-31** runs in a fresh duplicate of the published template after 0.16.2 is released and its template migration is applied (U-41; U-42 applies it to the author's brain).
3. **U-32** rechecks from `v0.16.2` (was `v0.16.1`), after U-31.
4. **U-28** invites after U-31 and U-32, on 0.16.2.

## Consequences

- build/TASKS.md: the When columns of U-28, U-31 and U-32 say 0.16.2, their earlier conditions kept in brackets; the 0.16.2 intro and a status line say the beta starts on 0.16.2.
- 0106 carries an "Amended by 0108" line; docs/vision.md says the testers are invited once 0.16.2 is released.

## Evidence

The author's answer of 2026-11-18, relayed by the coordinator to CC-358.
