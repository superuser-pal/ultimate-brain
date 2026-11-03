# 0066 — Linked repos and the link kit

**Status:** Proposed
**Date:** 2026-11-03
**Release:** 0.9.0
**Amends:** 0042 (the brain writes one file in a linked repo: its link kit)
**Keeps:** 0001, 0003, 0014, 0015, 0022, 0055 (Domain follows the Area), 0059

## Context

0042 made other repos read-only sources of one brain. In the 0.9.0 scope grill of 2026-11-03 the user wanted more than one repo to give the brain context, each with its own way of working, without new stores or a second writer to Notion. Today a linked repo is only a list of glob patterns in `brain.json`: the brain doesn't know what the repo must never read, where the repo's tasks live, how its statuses map, which methodology it follows, or under which Project it sits. Two other models were weighed and rejected: a child brain in each repo, and independent brains publishing into one space (0042's "several brains" option). Decision 0059 adds connected workflows, where Notion owns a project's tasks; a linked repo either uses one or keeps its tasks in the repo.

## Decision

### The hub stays as 0042 made it
- **One brain is the only store and the only writer to Notion.** Linked repos stay read-only sources. No child brains and no independent brains.

### The link kit
- **A link kit is one file in the linked repo** that tells the brain how to read that repo. It declares:
  - **knowledge:** the patterns the brain ingests and the paths it must never read;
  - **tasks:** the task source and its mode, with a status mapping:
    - **connected:** Notion owns the tasks, through 0059's connected workflow and its adoption;
    - **tracked in the repo:** the tasks stay in the repo, and the brain shows a read-only rollup on the Project or Area, which the 0.10.0 brain assistant reviews;
  - **methodology:** a short summary of how work is done in the repo;
  - **placement:** the Area, and optionally the Domain and the Project, that the repo belongs to.
- **The skill writes the kit once, after the user's yes** to the content it shows. This is the one exception to 0042's rule that the brain never writes to a linked repo. After that, the hub only reads the kit.

### The skill
- **A new skill links a repo**, shows, changes and unlinks a link, and runs a health check on it. Unlinking keeps the knowledge already ingested.
- **It also starts a new repo from a starter.** 0.9.0 has one starter, a generic one.
- **Linking offers `brain link` the other way**, so that the repo can read the brain.

### Where things live
- **The kit's schema is in `spec/`** and **the starter is in `templates/`**, both in this product repo.
- **The skill is written in the skills fork**, under 0059.

## Consequences
- spec/linked-repos.md and spec/cli.md §5.29 define the kit, its JSON schema, the commands, the read-only rollup, unlinking and the health check. Only the `repos` lines of spec/schema.md §12 change.
- 0.9.0 acceptance gets a fourth scenario: a synthetic hub that links one connected repo and one tracked-in-repo repo.
- A repo linked before 0.9.0 keeps working without a kit. The health check offers to write one.

## Evidence
- The scope grill of 2026-11-03 (multi-repo questions).
- [0042](0042-repos-and-notion-attachments-as-sources.md), [0059](0059-shared-skills-and-connected-workflows.md), [0055](0055-domains-capture-and-review.md).
