# 0031 · 0.18.0: Domain homes, Factories, Home's card per Domain, and two Notion Brain Assistant texts

**Design change:** decisions [0113](../../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) §1, §3, §6 and §8 to §10, and [0114](../../decisions/0114-a-task-with-only-a-factory-gets-the-factorys-area.md) §3; CC-399 (release 0.18.0; docs/notion-space-design.md §3.20, §4.1, §5 Home and §10, spec/setup.md §6.2.3 and §8.2, spec/linked-repos.md §1). Part E: CC-384 and CC-386 ([../brain-assistant.md](../brain-assistant.md), docs/notion-space-design.md §10.1, spec/setup.md §6.4). It is 0.18.0's one Notion migration. **Applies to:** every space built or migrated before 0.18.0, the template's copy included. Needs migration 0030. A step already done changes nothing, so running this again is safe.

**What changes:**
- **Tasks, Inbox and Goals show their Domain** (0113 §9, 0114 §3), as Projects, Meetings and Documents do: a read-only rollup through the Area. Notion computes it; the brain never reads or writes it.
- **A Domain page is that Domain's home** (0113 §8): what needs you, your areas, your tasks, projects, goals, factories, meetings and documents of that Domain, on one page.
- **Home has one card per Domain** (0113 §10): the first tab is Domains, and a card opens that Domain's home. With Domains off, Home doesn't change.
- **Factories** (0113 §1, §3, §6): a database with one row per working folder where agents build, a Factory property on Tasks, and a page per Factory with what the brain says is being built and a board of the tasks you want done there.
- **Two texts of Notion Brain Assistant** (CC-384, CC-386): Weekly review's answer line names only the task options, and First things first says that Tools and access decide which Skills database the agent runs.

| Part | For | Skip it when |
|---|---|---|
| A · Domain on Tasks, Inbox and Goals | every space | never (step by step, as it says) |
| B · Domain homes | Domains module | Domains is off: B3 alone, which hides the new Domain |
| C · Home | Domains module | Domains is off: your Home stays as it is |
| D · Factories | Factories module | Factories is off: "turn on factories" runs the same steps later |
| E · Notion Brain Assistant's texts | every space with First things first or a Skills database | it has neither |
| The last steps | every space with a Template version line | it has none |

Run it after `brain upgrade` has put 0.18.0 in place, in an attended session (never from a schedule), in this order. **The template's copy** (no brain) does every part.

Who does each step:
- **agent:** the `brain-notion-change` skill, through your Notion connection, with your yes. Notion's API can answer 200 and still ignore a write, so the agent reads every write back.
- **by hand:** you, in Notion. Notion's API documents no way to edit a page template, use *This page* in a filter, put a view inside a tab, make a button or set a relation's limit (API reference, version 2026-03-11, read on 2026-11-25).

Some agent steps need a call the local Notion MCP has no tool for (a database, a view, a template applied to a page). With the hosted Notion MCP the agent uses its tools; with the local one it calls the REST API with that connection's token, never shown in the chat, as [0014](0014-domains-database-in-every-space.md) does. Where neither works, the step says what you do instead.

## Part A · Domain on Tasks, Inbox and Goals (every space; agent)

Do these, whether Domains is on or off (with it off they are hidden, B3):
- **Tasks**, the default database, when your space has it. **Your own tasks database** (0018) is not this migration's: the agent offers it a Domain when it connects it or when you turn on Domains (spec/setup.md §6.2.3).
- **Inbox**, always.
- **Goals**, when your space has it.

Read each data source, and the Areas one. Areas must have **Domain**, a relation to Domains: without it, run [migration 0014](0014-domains-database-in-every-space.md) first. Each of the three must have **Area**, a relation to Areas; one that lacks it is reported, and gets no rollup.

For each, by its property named **Domain**:
1. **Already done?** It is a rollup over Area → Domain with Show original and the description below. Then change nothing.
2. **Missing:** add it, with a data source update:
   ```json
   { "Domain": { "rollup": { "relation_property_name": "Area", "rollup_property_name": "Domain", "function": "show_original" },
                 "description": "Owner: Notion. Derived from the Area's Domain; you never edit it." } }
   ```
3. **The right rollup with another description:** send the same rollup with that description (a description alone is refused).
4. **Anything else** (another type, or a rollup over another relation or property): change nothing, report it and ask. Never rename or replace your property.

**Read back** each data source: Domain is a `rollup` with `relation_property_name` Area, `rollup_property_name` Domain, `function` `show_original` and that description. Then check that it computes: query each database filtered on the rollup for one Domain that has an Area, `{"property": "Domain", "rollup": {"any": {"relation": {"contains": "<the Domain's page id>"}}}}`, and compare with the rows whose Area has that Domain.

## Part B · Domain homes (Domains module; B3 in every space)

### B1 · The Domains page template (by hand)

[../views-guide.md](../views-guide.md) §9a holds the views, in order.
1. **Already done?** Open **Domains** → the **New** arrow (▾) → the default template → **Edit**: it starts with the heading "What needs me here?" and holds "How are my areas?". Then change nothing.
2. **Otherwise,** build §9a's headings and views there. "Which meetings?" and "What do we know?" are in the template already: keep them, and change them to §9a's. "Which projects?" becomes "What's active here?". A heading of a module you left off is left out.
3. **What you should see:** create a Domain named `Home check: delete me` from the template. Its page shows the headings of §9a in order, each view empty and without a warning. Move the test Domain to the trash, before any catch-up: B2 shows you the views with your own rows.

### B2 · Domain pages you already have (agent, with your yes for each page; or by hand)

A Domain page made before B1 keeps its old three views. For each Domain:
1. **Already done?** Its page holds the heading "What needs me here?". Then change nothing.
2. **Otherwise,** the agent shows what it will do, and on your yes applies the default template to the page (a page update with `template` of type `default`, never with `erase_content`, which would delete your notes). Notion adds the template's blocks below what the page holds; your text stays.
3. **Read back, before anything is removed:** the page holds §9a's headings once, and each new view's filter names **this Domain's page** (the agent reads each view). If one names another page, or the read fails, the agent says which and stops: set that view's filter to this Domain by hand.
4. **By hand, after the read back:** delete the three old headings with their views ("Which projects?", and the first "Which meetings?" and "What do we know?", above your notes), and one of the two **My notes** toggles: the empty one. Move your own text where you want it.
5. **Without the API call,** by hand on the page: copy each heading and view from a Domain made from the template, and set its filter to **Domain contains** this Domain.
6. **What you should see:** the page opens with "What needs me here?" and shows only this Domain's rows; your own notes are still there.

### B3 · Page layouts (by hand)

Open any row → **Customize layout**.
1. **Already done?** On Tasks, Inbox and Goals, Domain stands in the property group right after Area (on Inbox, whose Area is pinned, first in the group). Then change nothing.
2. **Otherwise,** put it there. Never pin it: you change the Area, not the Domain.
3. **Domains off:** hide Domain on the three instead, and skip B1 and B2.
4. **What you should see:** a task whose Area has a Domain shows that Domain in its panel.

## Part C · Home's card per Domain (Domains module; by hand)

Tabs are made by hand. [../views-guide.md](../views-guide.md) §1 holds the two views.
1. **Already done?** The first tab of "What's on today?" is **Domains**, and it holds "Which domain?" and "Which areas have no domain?". Then go to step 3.
2. **Otherwise,** in "What's on today?" add a tab **Domains**, first, with the two views of §1 (0c and 0d).
3. **Delete the tabs Areas and Projects.** Your areas are on each Domain's home, and your active projects there and in the Projects Space. If you grouped the Areas view by Domain, it goes with its tab. **The template's copy keeps both tabs**: its tabs are Domains, Areas, Tasks, Meetings, Projects, Inbox, and each user deletes the set they don't use (docs/notion-space-design.md §10).
4. **What you should see:** one card per Domain that isn't archived, with its name and summary; a click opens that Domain's home. Under the cards, the Areas with no Domain, or nothing. The tabs Tasks, Meetings and Inbox are as before, with every Domain together.

## Part D · Factories (Factories module)

A space that turns Factories on follows [../modules/factories.md](../modules/factories.md): "turn on factories" runs it, and it holds each step in full. The template's copy does D1 to D7 from the same file. Nothing here makes a Factory's row: the brain does, for each folder you link or connect.

| Step | In factories.md | Who | Already done? |
|---|---|---|---|
| D1 · The Factories database | step 1 | agent, or Notion AI | Brain Data holds **Factories** with Name, Workflow, Overview as of, Archived, Brain ID and Last Synced |
| D2 · Area, Projects, Domain and, with Tasks, Tasks · Factory; their descriptions | step 2 | agent | Factories has Area, Domain, Projects and (Tasks) Tasks; Tasks has Factory; each has its description |
| D3 · The limits | step 3 | by hand | Factories · Area and Tasks · Factory say **Limit: 1 page** |
| D4 · The database's views | step 4 | agent, or by hand | Factories has the views Open and Archived |
| D5 · The Factory page's template | step 5 | by hand | a new Factory opens with **Overview**, the board and **My notes** |
| D6 · The layouts | step 6 | by hand | a Factory pins Workflow, Area and Projects; a task shows Factory after Area |
| D7 · The Factories tab of the Projects Space | step 7 | by hand | Projects has the tab **Factories** |

With Tasks off, Tasks · Factory, the board and its Factory property are skipped. **Your own tasks database** is offered the Factory property by the agent ("Add a Factory property to your tasks database?"): a no leaves your database as it is.

**The template's copy** also gets the Example Factory: [../template-examples.md](../template-examples.md), "Updating a copy to 0.18.0".

## Part E · Notion Brain Assistant's texts

### E1 · The Weekly review skill (CC-384; by hand)

Open **Skills** (on System; "Brain Assistant Skills" in a space built before 0.14.0) under your top page, and the page **Weekly review**. No Notion Brain Assistant: skip this step, or make the same replacement in your personal Weekly review skill if you set one up; Claude Code and Codex read the new text from the installed copy.
1. **Already done?** The skill's text (in Description, or in the body) has a step 8 holding "The answer line names only these numbered task options". Then change nothing.
2. **Otherwise,** replace the text where the page keeps it with the text block of [../brain-assistant.md](../brain-assistant.md) under "Weekly review" (from "Goal:" to "Never recommend Approve or Reject."), word for word, and nothing else on the page:
   - **The text is in the Description property and the page body is empty** (the standard layout: the template, every space duplicated from it, and a Skills database published from 0.18.0 on): replace **Description's whole text**, and leave the body empty. The short **Description:** line isn't copied.
   - **The text is in the page body** (a Skills database built from Prompt 9 before 0.18.0): replace the whole **body**, and leave Description as it is (its short line didn't change).

   Re-link *[@Brain Data]* with a real @mention of Brain Data under your top page. Keep **Use automatically** on. Only steps 8 and 11 differ from migration 0030's text: the message that asks about Focus first's tasks ends with an answer line that names only the numbered task options, and the closing list says the items are ticked in the row.
3. **Check it took:** open Description and the body again. Neither holds `Then say: "Answer like 1a 27 Nov, 2d."` (the old step 8); if one still does, the agent still runs the old skill.

### E2 · First things first, item 3 (CC-386; the agent, or by hand)

The page **First things first** (under your top page; migration 0028) has the item **Give it access**. After its last sentence, "A mention in the Instructions doesn't give access: only Tools and access does.", it gets: "The agent runs the skills of whichever Skills database is in its Tools and access, so keep exactly one there: the one under your top page." (docs/notion-space-design.md §10.1, the exact text).
1. **Already done?** The item holds "The agent runs the skills of whichever Skills database is in its Tools and access". Then change nothing.
2. **Otherwise,** the agent, with your yes, adds that sentence at the end of the to-do block and keeps the rest of the item, its bold words and its tick as they are. Then it reads the item back. Or add the sentence by hand.
3. **No First things first page** (a space that skipped 0028's part A): nothing to change.

### E3 · Your agent's Tools and access (CC-386; by hand; a space with its own Notion Brain Assistant)

The API can't read Tools and access, so only you can see this. The template's copy skips it.
1. **Already done?** Tools and access holds exactly one Skills database, the one under your top page ("Brain Assistant Skills" in a space built before 0.14.0). Then change nothing.
2. **Otherwise,** remove every Skills database that isn't under your top page, and add the one that is when it is missing. Instructions, skills and buttons don't change.

## The last steps

### L1 · Template version (by hand, or the agent)

**Already done?** The System callout on your top page reads `Template version: 0031`, or your space has no such line. Otherwise, if it reads a lower number, change it to `Template version: 0031`.

## What this migration doesn't do

- **It fills in no Area and no Domain.** A row whose Area is empty, or whose Area has no Domain, is on no Domain home. From 0.18.0 a catch-up fills an unfinished task's empty Area from its Project or its Factory (0114); it never changes one you set.
- **It deletes no row, no property and no text of yours.** The old views of a Domain page and Home's two tabs are deleted by you.
- **It adds no New task button to an area home.** Whether a task added in an area home's own list gets that Area is checked by hand (Verify): Notion's documentation doesn't say, and nothing depends on it.
- **It writes no Overview and no Factory row.** The brain does, once the module is on (spec/connected-workflows.md §9.1).
- **It changes no agent, button or other skill page.**

## Verify

Three kinds: *(API)* the agent reads it back; *(you)* only you can see it, and the agent never ticks it from what it read; *(with a brain)* it needs a connected brain.

Part A:
- [ ] *(API)* Inbox, (Tasks) Tasks and (Planning) Goals each have **Domain**: a rollup of Area → Domain, Show original, described "Owner: Notion. Derived from the Area's Domain; you never edit it." Running part A again reports nothing to add.
- [ ] *(API)* A row whose Area has a Domain shows that Domain; a row with no Area shows none. A query filtered on the rollup for one Domain returns exactly the rows whose Area has it.

Part B (Domains on):
- [ ] *(you)* A Domain made from the template shows §9a's headings in order; a Domain page you use shows only that Domain's rows.
- [ ] *(API)* Each Domain page you had holds "What needs me here?" once, and the filter of each of its views names that page.
- [ ] *(you)* Your own notes on each Domain page are still there, and no old view is left.
- [ ] *(you)* A task, an Inbox row and a goal show Domain in their panel, not in the heading.
- [ ] *(you)* Hand check, whatever the answer: on an **Area's** page, add a row in "What's on my plate here?" → Open, and open it. Note whether its Area is filled, then move it to the trash.

Part C (Domains on):
- [ ] *(you)* Home's first tab is Domains, with one card per Domain and "Which areas have no domain?" below; a card opens that Domain's home; Areas and Projects are gone, and Tasks, Meetings and Inbox are as before.
- [ ] *(you, template's copy)* The tabs are Domains, Areas, Tasks, Meetings, Projects, Inbox, in that order.
- [ ] *(you)* With Domains off, Home is as it was.

Part D (Factories on, and the template's copy): the Verify list of [../modules/factories.md](../modules/factories.md).
- [ ] *(API)* With Factories off, Brain Data has no new database, and Areas, Projects and Tasks have no Factories or Factory property.

Part E:
- [ ] *(API)* Where Skills is shared with the integration, the Weekly review page's Description and body, read together, hold "The answer line names only these numbered task options" once, and neither holds `Then say: "Answer like`.
- [ ] *(you)* In the agent's chat, **Run Weekly review** on a weekly row with an A, a U and a C item and a Focus first task: its answer line holds no row label and no "tick", and "tick C1 for me" is refused.
- [ ] *(API)* First things first's item **Give it access** ends with the sentence of E2, once, and its tick is as it was.
- [ ] *(you)* Your agent's Tools and access holds exactly one Skills database, the one under your top page.

The last steps:
- [ ] *(API)* The System callout reads `Template version: 0031`.
