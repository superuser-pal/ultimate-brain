# Factories

A **Factory** is a working folder where agents build: a linked repo, or any folder you connected to the brain (decision 0113 §1; docs/notion-space-design.md §3.20). One row per folder. Its page shows what is being built there, in an **Overview** the brain writes, and a board of the tasks you want done there. Off by default; offered once, when you link your first repo or connect your first folder.

You never make a row: say "link this repo" or "connect this folder" in a session there. One you make by hand is never taken in.

## Turning it on

Each step starts with a check: what is already there is kept. Some agent steps need a call the local Notion MCP has no tool for (a database, a view): the hosted Notion MCP has the tools, and with the local one the agent calls the REST API with that connection's token, never shown in the chat.

### 1 · The database (agent, with your yes; or Notion AI)

**Already done?** Brain Data holds a database **Factories** with the properties below. Then keep it. One named Factories that lacks them: ask, and change nothing without a yes.

**Agent:** create a full-page database under **Brain Data**: title **Factories**, with the first data source's properties
```json
{ "Name": { "title": {} },
  "Workflow": { "select": { "options": [ { "name": "Standard" }, { "name": "Connected" } ] } },
  "Overview as of": { "date": {} },
  "Archived": { "checkbox": {} },
  "Brain ID": { "rich_text": {} },
  "Last Synced": { "date": {} } }
```
Read it back: six properties with exactly these names, types and options.

**Notion AI** (when your connection can't create a database), on **Brain Data**:
> In this page, create one full-page database "Factories" with: Name (title), Workflow (select: Standard, Connected), Overview as of (date), Archived (checkbox), Brain ID (text), Last Synced (date). Don't change anything else.

### 2 · Relations, the Domain and descriptions (agent)

**Already done?** Each property below is there, as the table says. Add only what is missing; never rename or replace a property of yours.

| Change | Skip it when |
|---|---|
| Two-way relation Factories "Area" ↔ Areas "Factories" | never |
| Two-way relation Factories "Projects" ↔ Projects "Factories" | never |
| Two-way relation Tasks "Factory" ↔ Factories "Tasks" | Tasks is off. On your own tasks database (0018), the agent asks first: "Add a Factory property to your tasks database?" On a no, nothing is added there, and no work can be connected to a Factory |
| Factories **Domain**: a rollup over Area, property Domain, Show original | never (hidden with Domains off) |
| The descriptions below | never |
| Record it: `brain config set notion.databases.factories '"<database id>"'` and, with Tasks, `brain config set notion.tasks.properties.factory '"Factory"'` (your own name for it on a mapped database) | the template's copy, which has no brain |

| Property | Description |
|---|---|
| Factories Name, Area and Projects; Areas "Factories"; Projects "Factories" | "Owner: brain. Never read back: to change it, change the folder's link in a session there." |
| Factories Overview as of | "Owner: brain. When the Overview on the page was last written." |
| Factories Archived | "Owner: brain. Ticked when the repo is unlinked or the folder's connection ended. Never read back." |
| Factories Workflow | "Owner: you. The brain sets it only when you connect work to Notion, or end that connection, after your yes." |
| Factories Domain | "Owner: Notion. Derived from the Area's Domain; you never edit it." |
| Factories Tasks | "Owner: you." |
| Tasks Factory | "Owner: you. The folder where you want this done: a session there lists it and agrees with you how." |
| Factories Brain ID and Last Synced | "Owner: system. Do not edit." |

Notion takes a description only together with the property's type settings, and a select's options as the complete list. **Read back** Factories, Areas, Projects and Tasks: each relation shows on both sides with these names, Domain reads Area → Domain with `show_original`, and each description is there.

### 3 · The limits (by hand)

**Already done?** Factories → Area, and (Tasks) Tasks → Factory, say **Limit: 1 page**. Otherwise open each property → **Edit property** → Limit: **1 page**. Projects keeps no limit: a Factory may serve several. **What you should see:** picking a second Area on a Factory replaces the first.

### 4 · The database's views (agent, or by hand)

**Already done?** Factories has the views **Open** and **Archived**. Otherwise:
- **Open**, first: a table, Archived is unchecked, grouped by Area, showing Name, Projects, Workflow, Overview as of. Rename the view Notion made (Default view, or Table) and set it so.
- **Archived**: a table, Archived is checked, sorted by Name, showing Name, Area, Overview as of.

### 5 · The Factory page's template (by hand)

**Already done?** **Factories** → the **New** arrow (▾) shows a default template, and a page made from it has the three parts below. Otherwise open **New** ▾ → **New template**, name it **Factory**, and build:
1. A **toggle heading 2** named exactly **Overview**, empty. The brain fills it; don't write in it.
2. *(Tasks)* An **H3** "What should happen next here?" and under it a linked view of **Tasks**, named **Tasks**, *Show database title* off: **Board** grouped by **Status**; filter **Factory contains This page**, and (Last edited time is within *Past month*, **or** Status is not Done **and** Status is not Won't Do: a filter group joined with Or); sort Due ascending; cards show Name, Due, Project. On your own tasks database, use your names.
3. A toggle **My notes**.

Then, in the **New** ▾ menu, ••• next to the template → **Set as default**, for all views. *This page* is offered in a filter's value menu only while you edit a page template.

**What you should see:** a new Factory named `Factory check: delete me` opens with Overview, the board and My notes. Give a test task that Factory: it is on the board under its Status. A task with another Factory isn't. Move both test rows to the trash before any catch-up.

### 6 · The page layouts (by hand)

**Already done?** A Factory's heading holds Workflow, Area and Projects. Otherwise open a Factory → **Customize layout** and set it as [views-guide.md](../views-guide.md) §9 says: pinned Workflow, Area, Projects; in the panel Domain (Domains module), Tasks, Overview as of, Archived; Brain ID and Last Synced hidden. Then:
- **Tasks:** Factory in the panel right after Area.
- **Areas and Projects:** Factories in the panel after Tasks.

**What you should see:** a Factory opens with the three properties under its name and no Brain ID; a task shows Factory in its panel.

### 7 · The Factories tab of the Projects Space (by hand)

**Already done?** **Projects** (the Space) has a tab **Factories**. Otherwise add the tab, last, with the linked view of [views-guide.md](../views-guide.md) §4: "Where is work being built?". **What you should see:** the tab lists the open Factories, newest overview first, and no archived one.

**With the Domains module on:** add "Where is work being built?" to the Domains page template, after "What am I working toward here?" ([views-guide.md](../views-guide.md) §9a), and to each Domain page you have, filtered to that Domain.

### 8 · The rows and the first overviews (the skills)

The skills do the rest after your yes: a row for each folder you linked or connected, its first Overview, and the old `Repo tasks · <repo>` toggle of a repo taken off its Project or Area page (spec/linked-repos.md §4). Nothing for you to build.

### Verify
- [ ] *(API)* Brain Data holds **Factories** with Name, Area, Domain, Projects, (Tasks) Tasks, Workflow (Standard, Connected), Overview as of, Archived, Brain ID and Last Synced, each with its description; Areas and Projects have Factories; (Tasks) Tasks has Factory.
- [ ] *(API)* A Factory whose Area has a Domain shows it; a task with that Factory shows on the Factory's Tasks.
- [ ] *(API)* Factories has the views Open and Archived, and a default page template.
- [ ] *(you)* Area and Tasks · Factory are limited to one page.
- [ ] *(you)* A new Factory opens with Overview, the board and My notes, and the board holds only that Factory's tasks.
- [ ] *(you)* The Projects Space has the tab Factories; (Domains) a Domain's home lists its Factories.
- [ ] *(with a brain)* `brain modules` shows `factories` on with nothing missing; each linked folder has a row with an Overview.

## Turning it off

"Turn off factories" deletes nothing: the brain stops reading and writing Factories, their rows and last overviews stay, and a task keeps its Factory. A workflow connected in a Factory isn't ended: its sessions work locally until you turn the module on again (spec/connected-workflows.md §3.5). You may hide: the Factories tab of the Projects Space, "Where is work being built?" on Domain homes, Factory in the Tasks layout, and Factories on Areas and Projects.
