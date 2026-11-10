# The Ultimate Brain Notion template

A new user **duplicates this template** into their Notion workspace instead of building the space from the prompts (decision 0078 §1). This file is the only place its link and its version are kept: the README's Get started, docs/setup.md and the `brain-setup` skill take them from here (spec/setup.md §6.2, §9). The design it follows is [docs/notion-space-design.md](../docs/notion-space-design.md) §10.

Two templates exist; this one is the **Notion template**. The **brain folder** (`templates/brain/`) is the Git repository `brain init` creates.

| | |
|---|---|
| **Link** | **NOT PUBLISHED YET.** Placeholder: U-27 publishes the template and replaces this cell with its link, adding one `scripts/leak-allow.txt` entry for it in the same change. Until then there is nothing to duplicate. |
| **Template version** | `0022` |

**Template version** is the four-digit number of the last migration in [migrations/](migrations/) the template includes. The template's System page shows the same number on its first line, `Template version: 0022`, and the connect step stores it in `brain.json` as `notion.template_version`; `brain upgrade` then names the migrations newer than it (spec/setup.md §9, spec/cli.md §5.15).

## What a duplicate contains

Everything a space built from every prompt has (the build prompts include every migration up to the version above), with **every module**, plus what only the template carries. No rows: no sample meeting, project or person, and nothing from anyone's own space.

**Pages**
- **Ultimate Brain**, the top page, starting with the **Start here** callout: line 1, bold, "Start here."; line 2, "This is the Notion half of Ultimate Brain. Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain". Get started shows every step.", with "Get started" linked to the Get started section of the product README on GitHub.
- Home, Tasks, Meetings, Projects, Plan, Review, Knowledge, with their views, buttons and synced navigation.
- **Brain Data**, holding the databases below.
- **System**, starting with the line `Template version: 0022`, then the navigation's synced blocks, and holding **Archive**, **How it works** (filled with the user guide) and the **Brain Assistant Skills** database.

**Databases**

| Database | Where | Module |
|---|---|---|
| Inbox, Meetings, Projects, Areas, People, Review | Brain Data | Core |
| Domains | Brain Data | Domains (in every space, 0065) |
| Decisions, Questions | Brain Data | Knowledge |
| Orgs | Brain Data | Orgs |
| Documents | Brain Data | Documents, and Reports (a report is a Documents row) |
| Tasks | Brain Data | Tasks |
| Goals, Key Results | Brain Data | Planning |
| Brain Assistant Skills (one page per skill: Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report) | System | Brain Assistant; the brain never reads it |

Fourteen databases on Brain Data and one on System. Each database's templates, page layout and buttons are as in [prompts/](prompts/), [modules/](modules/) and [views-guide.md](views-guide.md) §9.

**Modules.** The brain uses the modules `brain.json` turns on: a new brain starts with Knowledge, Orgs, Documents, Reports and Tasks, and Domains after seeding (spec/schema.md §12). The databases and page parts of a module that is off stay in the duplicate, unused, so turning it on later needs no Notion step beyond connecting it. A user with their own tasks database maps it at the connect step (decision 0018) and leaves Tasks unused.

## The steps a duplicate still needs

A duplicate can't carry these; "set up my brain" walks through each and checks it (spec/setup.md §2):
1. **Connect your agent to Notion** (the Notion MCP), step 3.
2. **Connect the brain to Notion** (brain-connect-notion), step 4: the modules, the database ids, the Tasks database and this template version.
3. **The minutes prompt**, step 4a: pasted into your Notion AI settings for meeting summaries, as [pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md) says; its text is [minutes-format.md](minutes-format.md), the lean format of decision 0079. The Meetings template doesn't hold it.
4. **Brain Assistant pointed at the copy**, step 4b: a Custom Agent (or the same text as personal Instructions, on a plan without Custom Agents) whose Tools and access hold only the duplicate's Brain Data, How it works and Brain Assistant Skills, with its Instructions' @mentions pointing at those pages ("Setup" in [brain-assistant.md](brain-assistant.md); its skills are already in the duplicate).

What survives duplication (the Custom Agent and its access, the buttons that message it, relations, the Home buttons) is checked once on a test duplicate (0078 §5, CC-193), which records the result here and may shorten this list.

## Building and updating the template

For whoever maintains it (U-27 the first time):
1. Use a **Notion workspace that holds only the template**: never copy it from your own space (0078 §1).
2. Build it with **every module** from [CHECKLIST.md](CHECKLIST.md) "Build it yourself": Prompts 1 to 9, then the buttons and page layouts by hand. Build it once CC-197 is merged, so Check minutes and Voice summary in Brain Assistant Skills are the 0079 versions.
3. Check the Start here callout and link its "Get started" to the README's Get started section.
4. Add the first line of System, `Template version: NNNN`, with the number of the last migration in [migrations/](migrations/), and put the same number in the table above.
5. Publish the top page with duplication allowed, and put its link in the table above, with one `scripts/leak-allow.txt` entry for it (`notion/TEMPLATE.md:<the link's pattern>`), in one change.

**When a release adds a migration:** apply it in the template workspace (its last step updates the System line) and change the version above in the same release. A duplicate made earlier is brought up to date with the migrations `brain upgrade` names.
