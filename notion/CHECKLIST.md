# Notion space build checklist

Build the space by pasting each prompt into Notion AI, one per message, in order (decision 0019). After each prompt, tick its **Verify** list before moving on: a mistake caught early is one fix, a mistake caught at the end is a rebuild.

The prompts are generated from [docs/notion-space-design.md](../docs/notion-space-design.md). To change the space, change the design first (decision 0022).

## Build

- [ ] [1 · Pages](prompts/01-pages.md)
- [ ] [2 · Databases](prompts/02-databases.md) (leave out Tasks if you'll map your own)
- [ ] [3 · Relations](prompts/03-relations.md)
- [ ] [4 · Formula and rollup](prompts/04-formula-rollup.md)
- [ ] [5 · Ownership descriptions](prompts/05-ownership.md)
- [ ] [6 · Templates](prompts/06-templates.md)
- [ ] 6b · Paste [minutes-format.md](minutes-format.md) into the Meetings template (by hand)
- [ ] [7 · Spaces and views](prompts/07-spaces-views.md)
- [ ] [8 · Navigation](prompts/08-navigation.md)

## After building

- [ ] Tell your agent "connect the brain to Notion". The connect-notion skill finds the databases by name through the Notion MCP and writes their IDs into `brain.json` (decision 0015).
- [ ] Using your own Tasks database? Tell the agent which one. It maps its property names into `brain.json` `notion.tasks` (decision 0018). The title property is required; a relation to Meetings is preferred for the backlink.
- [ ] Ask the agent to verify the live space against the design. It reports any property, option or relation that differs (decision 0022).

## Changes for spaces built before 2026-10-11

If you built the space with the earlier prompts in docs/notion-space-design.md, make these two fixes by hand:

- [ ] **Projects template (decision 0026):** open the Projects default template, and turn the "Brief" and "Decision log" headings into toggle headings (block menu → **Turn into** → **Toggle heading 2**). Without this, the brain can't publish the brief and decision log.
- [ ] **Ownership descriptions:** re-run [Prompt 5](prompts/05-ownership.md). It now marks Meetings Name, Date, Attendees, Project and Area, plus Areas Goals/Projects and Goals Key Results/Projects, as yours, and Name/Area/Goal as "you when creating, then brain".
