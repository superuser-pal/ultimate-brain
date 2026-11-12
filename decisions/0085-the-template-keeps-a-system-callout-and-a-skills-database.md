# 0085 — The template keeps System as a callout on its top page, and Brain Assistant's skills database is named Skills

**Status:** Accepted
**Date:** 2026-11-12
**Release:** 0.14.0
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) §1, two phrases: "The System page carries a **Template version** line" (in the template, System is a callout on the top page, and the line is in that callout), and "the Brain Assistant Skills database" (the database is named **Skills**)
**Keeps:** every other rule of 0078 and [0084](0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md): the Template version line itself, its exact form `Template version: NNNN` and `notion.template_version`; a version that is unknown when the line is missing, never guessed; the database's two properties and its eleven skills; Brain Assistant's access to Brain Data, How it works and the skills database only

## Context

0078 §1 put the Template version line on a System page, and the design (docs/notion-space-design.md §5) has System as a backend page holding the navigation, Archive, How it works and the skills database "Brain Assistant Skills". 0084 makes the template a copy of the author's own space. On 2026-11-12 the coordinator scanned that copy for CC-232 and found two differences:

- In the author's space, **System is not a page**: it is a callout on the top page "Ultimate Brain", holding the links to Brain Data, Archive, How it works and the skills database. A connect step that looks for a System page finds none, so it records the version as unknown.
- The skills database is named **Skills**, not "Brain Assistant Skills".

## Decision

The user kept their own layout ("I like better the design and location I have") and the shorter name ("skills is a better name"):

1. **System is a callout on the template's top page,** holding the links to Brain Data, Archive, How it works and Skills. The **Template version** line is a plain line of its own inside that callout, exactly `Template version: NNNN`. brain-connect-notion reads the top page's text, including the blocks inside its callouts, for that exact line (spec/setup.md §9). A space built from the prompts keeps its System page and has no version line, as before.
2. **The database Brain Assistant reads its skills from is named Skills.** Product text names it "Skills", or "the Skills database (Brain Assistant's skills)" where the bare word could be confused. A space built before this keeps its old name, "Brain Assistant Skills": the user renames nothing, and nothing the brain does may depend on the name (the brain never reads that database; Brain Assistant reaches it through its Tools and access).

### Out of scope

Moving an existing space's System page into a callout; renaming the database in an existing space; changing the build prompts' System page; a Notion migration (neither choice changes a database, property, view or button, and the template is built from the author's space, not from a migration); editing earlier decisions' bodies, migrations or build/HISTORY.md.

## Consequences

- spec/setup.md §9 and §6.5: the line is in the System callout on the top page, and connect reads the top page, callouts included.
- docs/notion-space-design.md (§5's tree, Brain Assistant, §10's table), notion/TEMPLATE.md, notion/CHECKLIST.md, notion/brain-assistant.md and notion/prompts/01, 07 and 09 name the callout and the Skills database.
- The skills fork, released as brain-v1.8.2: brain-connect-notion's step 4a and its module line, brain-notion-change's template version step, brain-setup's `references/notion.md`, and brain-howto's guides.
- 0078 gets a header pointer to this decision; its body stays as recorded. CC-232 carries the change.

## Evidence

- The coordinator's scan of the template copy for CC-232, and the user's two answers on 2026-11-12, relayed by the coordinator.
- [0078](0078-onboarding-and-early-access-in-0-14-0.md) §1, [0084](0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md), [spec/setup.md](../spec/setup.md) §9, [docs/notion-space-design.md](../docs/notion-space-design.md) §5 and §10.
