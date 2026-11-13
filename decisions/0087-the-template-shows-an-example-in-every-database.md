# 0087 — The template shows an example in every database, and Brain Data says they are examples

**Status:** Accepted
**Date:** 2026-11-12
**Release:** 0.14.0
**Amends:** [0084](0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md) §3, two sentences: "The template carries seven rows" (it now carries fifteen, one or more in every database on Brain Data) and "No other rows: no Review, Inbox, Decisions or Documents rows (nor Questions, Goals, Key Results or Brain Assistant Skills beyond the skills themselves)" (only the skills database has no Example row); and 0084 §4's list of the skills that skip a row (brain-apply, brain-catch-up's Review read and ultimate-assistant are added)
**Keeps:** every other rule of 0084: the template is the author's emptied space (§1); the scrub list and the coordinator's read-only scan (§2); the prefix `Example · `, matched exactly; setup moves every Example row to Notion's trash at step 4 after one yes, before anything reads Notion; a renamed row is the user's own; nothing in the brain is ever made from an Example row; no CLI change, and the CLI skip in `sync plan` stays 0084's named follow-up

## Context

0084 §3 gave the template seven Example rows (a Domain, an Area, a Project, a Person, an Org, a Meeting and a Task) and left every other database empty. Those empty databases are Review, Decisions, Questions, Documents, Inbox, Goals and Key Results: the pages that show what the brain does with a meeting. A new user who opens Review, Knowledge or Plan in a fresh duplicate sees empty views, and can't tell what a Review page asks of them or where a decision ends up.

On 2026-11-12, in the coordinator's session, the coordinator proposed one Example row in each of those databases, all from the same story as the seven, so the pages link to each other, and a callout on Brain Data saying they are samples. The user answered: "yes, let's go ahead." The reason is the one 0084 gave for the first seven, carried to every page: a new user sees every page working before setup deletes the examples.

Each new row must be safe to leave in a space connected to a brain. 0084 §4's guard covers the rows the pull, the ingest and the catch-up read. A Review row is read by brain-apply too, and Tasks, Projects and Areas by Ultimate Assistant, so the guard grows with the rows.

## Decision

### 1. One Example row in every database, from one story

The template's Example rows tell one story: a kickoff meeting with Northwind Studio about refreshing its website. Besides 0084 §3's seven rows (unchanged), the template carries these eight. Each title starts with `Example · `; each row's state is one that no skill acts on.

| Database | Title | State | Related to |
|---|---|---|---|
| Inbox | `Example · Notes from a call with Sam` | Brain Status Done, Kind Capture, a Summary | the Project, the Person |
| Decisions | `Example · Keep the blog as it is` | Lifecycle Draft, Assessment Accepted | Decided In the Meeting, the Project |
| Questions | `Example · Can the site go live by the end of March?` | Status Open, Lifecycle Draft, Kind Question | Raised In the Meeting, the Project |
| Documents | `Example · Website refresh brief` | Origin Kept, Lifecycle Reviewed; Accepted unticked, nothing asked (Refresh asked unticked, What to fix empty) | the Project; Sources the Inbox row |
| Review | `Example · From Kickoff with Northwind: 1 decision, 1 question` | State Pending, Your call empty, nothing submitted (Decided unticked); the page in the current section format (spec/capture-and-review.md §7.2: the first-use note, the Review summary, one section per item with **Proposed final wording** and `Decision: Pending`) | Source Meeting the Meeting, Area the Area |
| Goals | `Example · Launch three client websites this year` | Status Active | Area the Area, Projects the Project |
| Key Results | `Example · Sites launched` | Kind Number, Start 0, Target 3, Current 1 | Goal the Goal |
| Tasks (a second one) | `Example · Brand guidelines from Sam` | Status Waiting On | the Project, the Meeting |

- **Every Example row is invented,** with the synthetic names of the story (Northwind Studio, Sam Rivera, Website refresh, Clients, Work) and nothing from anyone's space (0084 §2).
- **Only the skills database** (Brain Assistant's skills) has no Example row: its pages are product text.
- **Their exact content** (properties, page bodies, the Meeting's minutes) and the Notion AI prompts that create them are kept in [notion/template-examples.md](../notion/template-examples.md), so a maintainer can rebuild them.

### 2. A callout on Brain Data

The first block of Brain Data is a callout reading:

> These are examples. Every row titled "Example · " is a sample. When you say "set up my brain", it moves them all to Notion's trash after one yes. You can also delete them yourself.

The callout stays after setup: it is product text, and the user may delete it.

### 3. Setup removes all of them, as before

Nothing changes in 0084 §3's removal: step 4 already queries every database on the duplicate's Brain Data, whatever its module, for rows titled `Example · `, lists them and moves them to Notion's trash after one yes. The list now has fifteen rows.

### 4. The guard covers every skill that could act on one

For a brain connected before its Example rows were removed (0084 §4):
- **brain-sync's pull** leaves every Example row out of its snapshot (0084 §4, unchanged). That covers the new Decisions, Questions, Documents, Goals and Key Results rows, the Inbox rows the pull reads, and Documents' Accepted, Refresh asked and What to fix.
- **brain-ingest and brain-catch-up** skip an Example meeting or Inbox row (0084 §4, unchanged).
- **brain-apply skips an Example Review row,** in either layout, and so does brain-catch-up's read of Review rows. Both read every Pending Review row themselves, and the Review example is Pending. The CLI would only ignore it (it has no Brain ID: `NOT_CREATED_IN_NOTION`), so nothing would be applied, but the run would read the example's page, show it among the user's reviews, and answer a Submit on it with nothing. Skipped, it is named once as an example.
- **Ultimate Assistant leaves Example rows out of its live snapshot** of Tasks, Projects and Areas. It reads every row of those three, so an Example Task would otherwise become a finding with offers to change it (0084's Task, not started, is `task_stalled` two weeks after the duplicate), and the Example Project and Area would be read as a project and an Area outside the brain.
- The other skills can't reach an Example row. spec/setup.md §6.5 names each and says why.

## Consequences

- [spec/setup.md](../spec/setup.md) §6.5: the fifteen rows, and the guard by skill. [docs/notion-space-design.md](../docs/notion-space-design.md) §10 and [notion/TEMPLATE.md](../notion/TEMPLATE.md) list the rows and the callout; TEMPLATE.md's build step points at [notion/template-examples.md](../notion/template-examples.md) (new).
- In the skills fork, released in brain-v1.8.2 with CC-232 and vendored by CC-232's product PR: brain-apply and brain-catch-up skip an Example Review row; ultimate-assistant leaves Example rows out of its snapshot; brain-setup's description of the rows names them all.
- U-27 adds the eight rows and the callout to the template copy with the prompts of notion/template-examples.md, and the coordinator's read-only scan (0084 §2) treats them as Example rows.
- CC-193's release gate is unchanged: it duplicates the published template, so it also checks that step 4 removes all fifteen.
- 0084 gets a header pointer, `§3 and §4 amended by: 0087`; its body stays as recorded.
- No CLI, schema or brain change. Only the author changes Notion, by hand, as U-27.

## Evidence

- The user's answer in the coordinator's session, 2026-11-12: "yes, let's go ahead", to the table of §1 and the callout's text.
- [0084](0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md) §3 (the seven rows and the removal) and §4 (the guard); [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) (the Meeting's lean minutes); [0055](0055-domains-capture-and-review.md) and spec/capture-and-review.md §7 (the Review page's section format).
- The skills that read Notion rows, in the vendored snapshot under `.agents/skills/`: brain-sync, brain-ingest, brain-catch-up, brain-apply, ultimate-assistant, brain-query, brain-workflow, brain-workflow-adopt.
