# 0018 · Concepts become Documents

**Design change:** decision [0071](../../decisions/0071-a-simpler-notion.md) §1; CC-123 (release 0.9.1; docs/notion-space-design.md §3.13, §3.14; spec/schema.md §4; spec/cli.md §5.15 step 5a). **Applies to:** spaces built before 0.9.1 that have a **Concepts** database. A step already done changes nothing, so running this again is safe. It can run before or after migration 0019 (the same release): both add the same Documents · Origin, and the second finds it there.

What changes: a concept is a **learned Document** now, a page of the Documents database with **Origin Learned**. The Concepts database is retired: its notes move to Documents with their Project, Area and Sources, and the database goes to Notion's trash after your yes. Promote to document stays on Decisions only.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Before: bring your Concepts edits into Git (agent)

Run a catch-up (or `brain sync`) first, so a Lifecycle you set on a Concepts row is in Git. Nothing else on a Concepts row is yours: its text and relations were the brain's.

## 2 · Documents · Origin (agent; Documents module)

**No Documents database** (the Documents module is off): learned Documents stay in Git and in the brain's answers, unpublished, as concepts were with Knowledge off. To see them in Notion, turn Documents on first ([../modules/documents.md](../modules/documents.md)); otherwise go to step 3, then step 5.

Read the Documents data source. **Origin is missing:** add **Origin** (select: Kept, Learned, Report, Promoted, Workflow) with the description "Owner: brain." **It exists as a select** (added by migration 0019 of the same release, which adds the same property): add any of the five options it lacks, sending the existing options with their ids first, so none is dropped. **It exists with another type:** change nothing, report it, and ask the user.

Add it **before** step 3: a sync after the upgrade sends Origin on every Document. (A Documents database without Origin still works: the brain-sync skill leaves Origin out and names this migration.)

## 3 · The brain: `brain upgrade` (agent)

After installing 0.9.1, `brain upgrade` (spec/cli.md §5.15 step 5a) turns every concept note into a learned Document: `type: reference`, `origin: learned`, moved to `knowledge/references/`, the same id, the links to it rewritten, `index.md` rebuilt. It also clears the note's Notion page link, so the next sync creates its page in Documents, and removes `concepts` from `brain.json`. Check its `converted` list: one entry per concept.

## 4 · Publish the learned Documents (agent)

Run `brain sync`: `sync render` creates a Documents page for each former concept it publishes, Origin Learned, with its Project, Area and Sources (the Inbox row's Documents relation). Every existing Document gets its Origin in the same run.

## 5 · Retire Concepts (agent, after your yes)

Before the yes, list the Concepts rows by Name, and with Documents on, show that each has a Documents page with the same Brain ID (step 4). A row without one is reported, never trashed silently: its note may be missing from Git (`brain lint` and `brain query` say).

Then, after the yes, in this order:
1. Remove the relation properties that point at Concepts: **Projects · Concepts**, **Areas · Concepts**, **Inbox · Concepts**, and **Documents · From concept** where they exist. A Document promoted from a concept keeps its text and its `promoted_from` in Git; in Notion it has no From relation any more.
2. Move the **Concepts** database to Notion's trash. It stays restorable there for 30 days.

A space that keeps its Concepts database works the same: the brain never reads or writes it again.

## 6 · Views, layouts and Brain Assistant (by hand)

The API can't edit views, layouts or a Custom Agent ([../views-guide.md](../views-guide.md) §9).
- **Knowledge:** remove the Concepts tab. With Documents on, add to the Documents tab a List "What did we learn?": Origin is Learned and Lifecycle is not Archived; sort Created time descending; show Name, Project, Summary. In "What came in?", remove the Concepts column.
- **Archive:** remove the Concepts tab.
- **Areas and Projects templates** (and the area and project pages built from them): under "What do we know?", remove the "Concepts" view; the Decisions and Documents views stay.
- **Page layouts:** Documents shows Origin in its panel, and From concept leaves it; Areas and Projects lose Concepts from their panels.
- **Brain Assistant:** paste again its Instructions and its Write up and Refresh report skills from [../brain-assistant.md](../brain-assistant.md): they no longer name Concepts, and Write up now checks Origin Promoted.

## What this migration doesn't do

- **No note edit by hand.** `brain upgrade` converts the notes; a concept written later by a brain still on old skills is reported by `brain lint` (`concept-retired`) and converted by the next upgrade.
- **No `brain.json` edit by hand.** The upgrade removes `concepts`; `notion.databases.documents` is unchanged.

## Verify
- [ ] `brain upgrade --json` listed every former concept in `converted`, and `brain lint` reports no `concept-retired`.
- [ ] (Documents) Documents has **Origin** (select: Kept, Learned, Report, Promoted, Workflow), described "Owner: brain".
- [ ] (Documents) Each former concept has a Documents page with Origin Learned, its Project, Area and Sources, and its Inbox row lists it under Documents.
- [ ] The Concepts database is in the trash (or kept on purpose), and no Projects, Areas, Inbox or Documents property points at it.
- [ ] Knowledge has no Concepts tab; with Documents on, its Documents tab has "What did we learn?". Archive has no Concepts tab.
- [ ] A new project page shows "What do we know?" with Decisions and, with Documents on, Documents.
- [ ] An idea taken in by the next ingest arrives as a learned Document in that input's Review row, never as a concept.
- [ ] `brain-connect-notion`, run again, reports no difference for Documents and no Concepts database.
