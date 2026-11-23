# 0105 — Domains on Projects, Meetings and Documents, and Domains without Type

**Status:** Accepted
**Date:** 2026-11-17
**Release:** 0.16.1
**Amends:** [0055](0055-domains-capture-and-review.md) (a Domain page lists its Projects, Meetings and Documents, not only its Areas and Org); [0065](0065-domains-database-in-every-space.md) (the Domains database loses Type, and Projects, Meetings and Documents gain a Domain rollup in every space); the 0.9.0 move of Type from Areas to Domains (CC-120, migration 0016), which had no decision of its own
**Keeps:** [0061](0061-roadmap-and-launch-boundary.md)'s feature cutoff, changed explicitly here as by 0096 to 0103; [0103](0103-first-things-first-and-upgrades-with-unrelated-work.md)'s scope for 0.16.1; capture-and-review §1.3, "Domain grouping follows the Area": a Project or Document has no `domain` field
**Amended by:** [0113](0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) (2026-11-23; 0.18.0): Tasks get the Domain rollup through their Area too, a task's Area is filled from its Project when empty, and a Domain page also lists its Areas, Tasks, Inbox rows, Goals and Factories

## Context

Domains group Areas by work or life context (0055), and every space has the Domains database (0065). A Domain page lists only its Areas and Org. To see whether a project, a meeting or a document is Personal or Professional work, the user must open its Area. A Domain page doesn't list that Domain's projects, meetings or documents.

Domains also carry **Type** (Personal, Entrepreneurship, Professional), moved there from Areas in 0.9.0 (CC-120, migration 0016). The user owns it. Sync reads it into the domain note's `notion_fields.type` (`src/lib/sync.ts`, `notionFields`; spec/cli.md §5.14), and nothing else reads it. A Domain's name and Summary already say what kind of context it is, and they are what guides the agent.

0.15.0 was the feature cutoff. This decision is an explicit roadmap change after the cutoff, like 0096 to 0103. It adds a Notion-only view of existing data and removes one property. It adds no knowledge feature and no new field in Git.

## Decision

### 1. A Domain rollup on Projects, Meetings and Documents (Notion only)

- Each of **Projects**, **Meetings** and **Documents** gets a read-only **Domain** rollup: through its **Area** relation, the Area's **Domain**, with the function *Show original*. Its description says that Notion owns it: it is derived from the Area, and you never edit it. It is not a relation the brain writes. A Project, Meeting or Document gets its Domain from its Area, as capture-and-review §1.3 says. There is still no second assignment and no `domain` field on these notes.
- The **Domains page template** gets three linked views: **Projects**, **Meetings** and **Documents**. Each one is filtered by **Domain contains This page**. A Domain page then lists that Domain's projects, meetings and documents. The goal is to tell Personal from Professional work at a glance, and to see each Domain's meetings and projects.
- The rollups are in every space, like the Domains database (0065). The Domains module still decides only what pages show: with it off, Domain is hidden on the Projects, Meetings and Documents layouts and views, as it is on area homes.
- **Reading the rollup.** A rollup of a relation reads back as a list of relations, not as one page id. Any code or skill that reads it must expect a list. The brain doesn't read it: `sync plan` reads only the properties it maps for each database, so the rollup is ignored like Orgs · Meetings via projects. The normalized-value table of spec/cli.md §5.14.1 now says "rollup: its scalar result" for every rollup. It must also say that a rollup of a relation normalizes as a relation, a sorted array of page ids.

### 2. A meeting's or Document's Area follows its projects

The rollup shows a Domain only when the row has an Area. The specs didn't make this a rule. The ingest skill's example sets a meeting's `area`, its match step looks up "the area of the project", and extraction sets a kept Document's `area` "from the row or the project". The rule is now:

- When an ingest writes a meeting or a Document that has `projects` and no `area`, it sets `area` to the projects' Area when they all share one. When they are in different Areas, it sets none and says so in its report.
- Render keeps its current modes. A meeting's Area is sent *if empty*, so an Area the user set stands, and a Document's Area is its note's `area`.
- A meeting that hasn't been ingested (Not Reviewed or Skipped) has only the Area the user set, and shows no Domain until it is ingested or the user sets its Area.
- No backfill of old notes beyond what the next render sends.

### 3. Domains lose Type

- **Domains · Type** is removed from the design, the build prompts, the template and the Domain page. A Domain's name and Summary carry its meaning.
- **In Notion,** 0.16.1's one migration removes Domains · Type **only with the user's yes**, after warning that deleting a property deletes its values (Notion's undo lasts only while the page is open), as migration 0016 did for Areas · Type. A space whose Domains has no Type has nothing to do. Views or layouts that used Type are pointed elsewhere or cleaned up by hand.
- **In Git,** lint keeps accepting an existing `notion_fields.type` on a domain note: the schema keeps the enum, marked legacy. `sync plan` no longer maps Type, so a space that kept the property doesn't import it again. The next sync drops the old value, because a domain's `notion_fields` then differs from what the row gives. This is the same treatment as an area's old `type` since 0.9.0. Nothing is edited by hand.
- Setup no longer asks a Domain's Type when seeding, and the assistant no longer sets one after creating a Domain.

### 4. Both join 0.16.1

- The Notion steps go into 0.16.1's **one migration**, CC-337's 0028. They join it as CC-331 joined 0.16.0's, so an existing space runs one migration for the release.
- The skills changes ride CC-338's one skills release from the fork.
- U-37 publishes the template with these steps, and U-38 runs the release in the author's brain. 0.16.1 had no task for that.

## Delivery and acceptance

- **CC-342** writes the contracts first: the schema, the capture-and-review rule, the normalized rollup value, sync's mapping without Type, and the ingest's Area rule.
- **CC-343** writes the Notion design, prompts, guides and the migration steps inside CC-337's migration.
- **CC-344** removes Type from `sync plan`'s mapping, with its test.
- **CC-338** gains the setup and ramble changes.
- Claude Code builds. Each PR gets an independent review, and the user merges. The normal release checks and the native smoke gate (0082) still apply.

This planning task changes only this decision, the amendment pointers on 0055 and 0065, `build/TASKS.md` and `docs/vision.md`. It changes no spec, CLI, schema, skill, prompt, template or live Notion space.

## Evidence

- **A test in a disposable test space, with synthetic rows only** (author, 2026-11-17):
  - The API created the three rollups.
  - Each test row showed its Area's Domain.
  - An API query filtered on the rollup returned exactly the matching row.
  - In the Domains page template, *This page* was offered for the rollup filter, and a new Domain made from the template listed its project, meeting and document.
  - So mechanism A, Notion only and computed from the Area, was chosen over a relation the brain writes.
- **The author's answers in the coordinator's scope review of 2026-11-17:**
  - both parts join 0.16.1;
  - Type goes;
  - the ingest sets a meeting's or Document's Area from its projects' shared Area;
  - Type values follow migration 0016's precedent;
  - a small CLI task removes Type from the sync mapping.
- **The planning task's search** corrected the brief, which assumed no CLI code reads Type. `notionFields` in `src/lib/sync.ts` maps Domains · Type to `notion_fields.type`, and `tests/modules.test.ts` asserts it. No other CLI code reads a domain's `type`, and no CLI code reads a Domain rollup.
