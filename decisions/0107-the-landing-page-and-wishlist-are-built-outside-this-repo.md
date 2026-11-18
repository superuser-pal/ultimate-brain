# 0107 — The landing page and its wishlist are built outside this repo

**Status:** Accepted
**Date:** 2026-11-18
**Release:** 0.16.2
**Amends:** [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §3 (its wishlist item is removed), §7 (the soft launch links to the author's landing page; the waitlist email is the author's) and §8 (removed)
**Keeps:** everything else in 0106: the beta on 0.16.x patches, 0.17.0 and 0.18.0 before 1.0.0, the release-candidate bar, and 1.0.0 as a soft launch with npm `latest` and the template links

## Context

0106 §3, §7 and §8 put the wishlist page's words and a PRIVACY.md waitlist paragraph in 0.16.2 (CC-351), a script for the demo video in 0.17.0 (CC-353), and the page in GoHighLevel as the author's task (U-39). CC-351's PR (#450) wrote both. When the author read it on 2026-11-18, they said the landing page and its wishlist are built in a separate project outside this repo, and were never meant to be part of this plan.

## Decision

1. **This repo builds no landing page, wishlist, waitlist text or demo.** The landing page, its wishlist, the demo and their privacy text are the author's, built and kept outside this repo. PRIVACY.md describes the product only.
2. **1.0.0 is still a soft launch** (0106 §7): the package on npm `latest` and the template links in English and Spanish, and it links to the author's landing page. The waitlist and its announcement email are the author's, outside this repo; wider outbound promotion is still decided later.
3. **0106 §8 is removed.** Where the page is hosted, when it goes live and what it shows are not planned here.
4. **Dropped:** CC-351 (the wishlist page's words and PRIVACY.md's waitlist paragraph; PR #450 closed unmerged), CC-353 (the demo video's script) and U-39 (the page in GoHighLevel).

## Consequences

- build/TASKS.md: CC-351, CC-353 and U-39 marked dropped by 0107, their text kept; the 0.16.2, 0.17.0 and 1.0.0 intros, the release sequence table and the CC-348 status line no longer say the repo builds the page, its words or the demo.
- 0106 carries an "Amended by 0107" line; docs/vision.md and docs/v2-ideas.md say the landing page is the author's, outside this repo.

## Evidence

The author's answer of 2026-11-18 to the three questions on PR #450, relayed by the coordinator.
