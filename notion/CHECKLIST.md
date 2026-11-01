# Notion space build checklist

Build the space by pasting each prompt into Notion AI, one per message, in order (decision 0019). After each prompt, tick its **Verify** list before moving on: a mistake caught early is one fix, a mistake caught at the end is a rebuild.

The prompts are generated from [docs/notion-space-design.md](../docs/notion-space-design.md). To change the space, change the design first (decision 0022).

## Choose your modules (decision 0048)

The space is a core (Inbox, Meetings, Projects, Areas, People, Review) plus the modules you choose. You can change this any time by asking your agent ("turn on documents"); each module's steps for later are in [modules/](modules/).

- [ ] **Domains:** group Areas by the work or life context they belong to
- [x] **Knowledge:** Decisions, Questions, Concepts
- [x] **Orgs:** client and partner organizations
- [ ] **Documents:** keep a document, or part of one, as a page
- [ ] **Reports:** ask the brain in the Inbox, get a report you can refresh
- [ ] **Tasks:** action items as Notion tasks (leave it off if you'll map your own tasks database: [modules/tasks.md](modules/tasks.md))
- [ ] **Planning:** Goals and Key Results

**How the prompts follow your choice.** A line that starts with a module in brackets, such as `[Planning]`, belongs to that module. Before pasting a prompt, **delete every line tagged with a module you didn't choose**. Leave the tags on the other lines: each prompt tells Notion AI to ignore them. A line with two tags (`[Knowledge] [Documents]`) needs both modules. Untagged lines are Core: keep them all.

## Build

- [ ] [1 · Pages](prompts/01-pages.md)
- [ ] [2 · Databases](prompts/02-databases.md)
- [ ] [3 · Relations](prompts/03-relations.md)
- [ ] [4 · Formulas and rollups](prompts/04-formula-rollup.md)
- [ ] [5 · Ownership descriptions](prompts/05-ownership.md)
- [ ] [6 · Templates](prompts/06-templates.md)
- [ ] [7 · Spaces and views](prompts/07-spaces-views.md): one prompt per page (Home, Review, Meetings, Tasks, Projects, Plan, Knowledge, Archive)
- [ ] (optional) [8 · Navigation](prompts/08-navigation.md)
- [ ] **Buttons and page layouts, by hand** (the API and Notion AI can't create buttons or set page layouts): for each module you chose, do the "By hand" steps of its file in [modules/](modules/), then set each database's page layout as in [views-guide.md](views-guide.md) §9.

Prefer to build Spaces and views by hand? [views-guide.md](views-guide.md) spells out every view (filters, sorts, grouping, visible properties, use case), the database page layouts and the navigation. It replaces steps 7 and 8.

## After building

- [ ] Tell your agent "connect the brain to Notion". The connect-notion skill records your modules (`brain modules`), finds the databases by name through the Notion MCP and writes their IDs into `brain.json` (decision 0015).
- [ ] Using your own Tasks database? Tell the agent which one. It maps its property names into `brain.json` `notion.tasks` (decision 0018). The title property is required; a relation to Meetings is preferred for the backlink.
- [ ] Ask the agent to verify the live space against the design. It reports any property, option or relation that differs (decision 0022).

## Changes for spaces built with the earlier prompts

If you built the space from the prompts that used to live in docs/notion-space-design.md (before `notion/prompts/` existed), make these two fixes by hand:

- [ ] **Projects template (decision 0026):** open the Projects default template, and turn the "Brief" and "Decision log" headings into toggle headings (block menu → **Turn into** → **Toggle heading 2**). Without this, the brain can't publish the brief and decision log.
- [ ] **Ownership descriptions:** re-run [Prompt 5](prompts/05-ownership.md). It now marks Meetings Name, Date, Attendees, Project and Area, plus Areas Goals/Projects and Goals Key Results/Projects, as yours, and Name/Area/Goal as "you when creating, then brain".
