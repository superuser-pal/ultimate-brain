# 0015 · Workflow settings on Projects and Areas

**Design change:** decision 0059; CC-103 (release 0.9.0; docs/notion-space-design.md §2, §3.19; spec/connected-workflows.md §4, §6.1, §9; spec/linked-repos.md §4). **Applies to:** spaces built or migrated before 0.9.0. Run 0014 first. A step whose property already exists, with its options, adds nothing, so running this again changes nothing.

What changes: Projects and Areas get four **Workflow settings** (Workflow, Work type, Logging level, Log artifacts), so a piece of work (a software repo or any folder) can be connected to a Project or an Area and publish its tasks and documents there. Every page starts as Standard: nothing is connected until you say yes to "Connect this work to Notion?". Nothing is renamed or deleted, no value is filled in, and no Tasks property, database, view or Review row is added.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** a prompt you paste;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Properties (agent)

On **Projects** and on **Areas**, in this order, each with its options in this order:

| Change | Who |
|---|---|
| **Workflow** (select): Standard, Connected | agent |
| **Work type** (select): Software, General | agent |
| **Logging level** (select): Tasks only, Tasks + final outputs, Full durable record, Custom | agent |
| **Log artifacts** (multi-select): Briefs, Plans, Specifications, Decisions, Final deliverables | agent |
| Descriptions on all four, both databases (notion/prompts/05-ownership.md, rule 2b): "Owner: you. The brain sets it only when you connect work to Notion, or end that connection, after your yes." | agent |

Before each write, read the data source:
- **The property is missing:** add it with the options above.
- **It exists, with the same type and every option:** add nothing.
- **It exists with the same type, without some options:** add only the missing ones, sending the existing options with their ids first (an update without them drops them). Never rename or remove an option you added yourself; the skills read an unknown option as empty and report it.
- **It exists with another type** (a text Workflow you made, say): change nothing, report it, and ask the user. The skills read these properties by name, so it has to be renamed by hand first.

Fill in no values. Read each property back on both data sources after writing it.

## 2 · Page layouts (by hand)

The API can't edit page layouts ([../views-guide.md](../views-guide.md) §9). On **Projects** and on **Areas**, `•••` → **Customize layout**: put **Workflow, Work type, Logging level, Log artifacts** at the end of the property group in the panel. Don't pin them.

## 3 · Projects template line (Notion AI)

**Notion AI** — paste on the Projects database page:

```text
In the Projects default template, replace the gray paragraph "Brief and Decision log are written by the brain. Add your own notes in My notes." with the gray paragraph "The brain writes only inside its toggles: Brief and Decision log, and Workflow or Repo tasks when you connect work or link a repo. Add your own notes in My notes." Keep everything else in the template.
```

Existing project pages keep their old line; edit it there if you want.

## 4 · What this migration doesn't do

- **No toggles on existing pages.** The skills append **Workflow** to a destination page, **Work record** to its Task pages, and **`Repo tasks · <repo>`** to the page of a linked repo with tasks tracked in the repo, the first time they write them (docs/notion-space-design.md §2). Drag each one up once if you want it higher.
- **No Tasks change.** The default Tasks database already has Brain ID, mapped as `brain_id`. With your own Tasks database, connecting work checks that its Brain ID is mapped and says what to add if it isn't.
- **No `brain.json` change.** The settings are read by name from Notion.
- **No module is turned on.** A connected workflow needs Tasks, and Documents for any level above Tasks only; setup offers what is missing, once.

## Verify
- [ ] Projects has **Workflow** (select: Standard, Connected), **Work type** (select: Software, General), **Logging level** (select: Tasks only, Tasks + final outputs, Full durable record, Custom) and **Log artifacts** (multi-select: Briefs, Plans, Specifications, Decisions, Final deliverables), with the options in that order and none of them shared by two ids.
- [ ] Areas has the same four properties with the same options in the same order.
- [ ] Hover each of the eight: the description starts "Owner: you" and says "after your yes".
- [ ] No Project or Area has a value in any of the four (a filter "Workflow is not empty" on each database shows nothing, unless you connected work since).
- [ ] The page layouts of Projects and Areas show the four at the end of the panel, not pinned.
- [ ] A new Project from the default template starts with the new gray line.
- [ ] `brain-connect-notion`, run again, reports no difference for Projects or Areas.
