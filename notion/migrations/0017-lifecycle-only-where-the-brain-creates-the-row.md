# 0017 · Lifecycle only where the brain creates the row

**Design change:** decision [0070](../../decisions/0070-lifecycle-only-where-the-brain-creates-the-row.md); CC-121 (release 0.9.0; docs/notion-space-design.md §3; spec/schema.md §8; spec/cli.md §5.14). **Applies to:** spaces built or migrated before 0.9.1. Run 0016 first. A step already done changes nothing, so running this again is safe.

What changes: **Domains, Areas, Goals, Projects and Orgs lose Lifecycle.** You create those rows, so a Draft there tells you nothing; you close one with **Archived**, which Orgs gains. People, Decisions, Questions, Concepts and Documents keep Lifecycle: the brain writes those from what it reads, and you confirm them in Review.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Orgs · Archived (agent; Orgs module)

Read the Orgs data source first. **Archived is missing:** add **Archived** (checkbox) with the description "Owner: you." **It exists as a checkbox:** add nothing. **It exists with another type:** change nothing, report it, and ask the user.

Before step 2, tick Archived on every org whose Lifecycle is Archived, so it stays out of your active views (agent, with your yes: list them first).

## 2 · Remove Lifecycle (agent, after your yes)

Deleting a property deletes its values. On **Areas** and **Projects**, and on **Domains**, **Goals** (Planning) and **Orgs** (Orgs) when the space has them: remove **Lifecycle**. A database without it has nothing to do here. Before the yes, list any row whose Lifecycle is Disputed or Archived and whose Archived is unticked: those are the only values that carry something, and you decide whether to tick Archived on them.

A space that keeps Lifecycle on any of these works the same: the brain ignores it there.

## 3 · Views and layouts (by hand)

The API can't edit views or layouts ([../views-guide.md](../views-guide.md) §9).
- **Knowledge → Orgs:** "Which clients do I have?" and "Who else do we work with?" filter **Archived is unchecked** instead of Lifecycle.
- **Archive → Orgs, "Which orgs are archived?":** filter **Archived is checked**.
- **Page layouts** of Areas, Goals, Projects and Orgs: Lifecycle leaves the panel; Orgs shows Archived there.

Any other view of yours that filters, sorts or groups these databases by Lifecycle now shows a warning in Notion: point it at Archived, or remove the rule.

## What this migration doesn't do

- **No `brain.json` change.**
- **No brain edit by hand.** Notes keep their `lifecycle` in Git. New rows of these five come in as `reviewed`; a note the brain retires (a merge or a supersession) ticks Archived on its page once.

## Verify
- [ ] Areas, Projects, and Domains, Goals and Orgs where present have no Lifecycle; People, Decisions, Questions, Concepts and Documents still do.
- [ ] Orgs has **Archived** (checkbox), described "Owner: you".
- [ ] The Orgs views on Knowledge and Archive show no warning.
- [ ] A new Area created in Notion comes in, after `brain sync`, with `lifecycle: reviewed` in its note.
- [ ] `brain-connect-notion`, run again, reports no difference for these databases.
