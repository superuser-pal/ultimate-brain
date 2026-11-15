# 0095 — The skills repo has its own README

**Status:** Accepted
**Date:** 2026-11-15
**Release:** 1.0.0
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) §6 (the skills repo README keeps upstream's text and gains one block)
**Keeps:** everything else about the fork: upstream's skills, their folders and their history stay unchanged, `brain/` is the one place operational skills are written, and upstream changes arrive through upstream-sync PRs (spec/skills-delivery.md §10).

## Context

0078 §6 left the README of ultimate-brain-skills as upstream's, with a four-line block at its top. The beta readiness review of v0.15.0 (2026-11-15) found what that looks like to a visitor: below the block, the repository presents upstream's product under upstream's name, with its banner, title, newsletter and install instructions, and its CONTRIBUTING sends bugs and questions about the brain skills to upstream's tracker and discussions.

Asked on 2026-11-15, the user decided: the skills and everything related to them stay as they are; the README, and the support documents that aren't about the skills, are replaced with the repository's own, holding the product's information and how the skills tie to it. The repository keeps its name for now and becomes `sentina-skills` when it is renamed.

## Decision

1. **`README.md` is the repository's own.** It says what Ultimate Brain is, what the skills do for it, that nothing is installed from the repository, each operational skill with what it does, how versions work, that upstream's general skills are carried unchanged and are not part of what a brain installs, where to report a problem, and the credits and licence.
2. **`CONTRIBUTING.md` is the repository's own.** Reports about a brain skill go to the product's issue tracker; reports about a general skill go to upstream, where those skills are maintained.
3. **Nothing else changes.** No skill, no upstream folder, no manifest, package name or licence text. `NOTICE.md` lists the two files as local although they sit at upstream's paths.
4. **Upstream-sync.** A conflict on either file is resolved by keeping the repository's version.

## Consequences

- spec/skills-delivery.md §10.1 names the two files as the exception to "the path tells local content from upstream content".
- An upstream change to its README or CONTRIBUTING now opens an `upstream-sync` conflict issue each time, resolved by rule 4.
- The package and plugin manifests still carry upstream's name; they change with the rename.

## Evidence

- The user's answers of 2026-11-15.
- The fork's `README.md`, `CONTRIBUTING.md` and `NOTICE.md` before this decision; [0078](0078-onboarding-and-early-access-in-0-14-0.md) §6; [spec/skills-delivery.md](../spec/skills-delivery.md) §10.1 and §10.5.
