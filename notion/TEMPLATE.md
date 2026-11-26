# The Ultimate Brain Notion template

A new user **duplicates this template** into their Notion workspace instead of building the space from the prompts (decision 0078 §1). This file is the only place its link and its version are kept: the README's Get started, docs/setup.md and the `brain-setup` skill take them from here (spec/setup.md §6.2, §9). The design it follows is [docs/notion-space-design.md](../docs/notion-space-design.md) §10.

Two templates exist; this one is the **Notion template**. The **brain folder** (`templates/brain/`) is the Git repository `brain init` creates.

| | |
|---|---|
| **Link** | https://sentina.notion.site/TEMPLATE-Ultimate-Brain-419495661e9980859df9ca0c3d836d27 |
| **Template version** | `0030` |

**Template version** is the four-digit number of the last migration in [migrations/](migrations/) the template includes. The template shows the same number as a line of its own in the System callout on its top page (as inline code or plain text, spec/setup.md §9), `Template version: NNNN`, and the connect step stores it in `brain.json` as `notion.template_version`; `brain upgrade` then names the migrations newer than it (spec/setup.md §9, spec/cli.md §5.15).

## What a duplicate contains

Everything a space built from every prompt has (the build prompts include every migration up to the version above), with **every module**, plus what only the template carries, and **an Example row in every database on Brain Data**. Nothing from anyone's own space: the template is a copy of the author's space, emptied and scrubbed (decision 0084; "Building and updating the template" below).

**Pages**
- **Ultimate Brain**, the top page, starting with the **Start here** callout (with Notion's info icon; read back on 2026-11-23). Its own text is one text: "Start here:" in bold, then "This is the Notion half of Ultimate Brain.", "Next: install Ultimate Brain, and in your brain folder tell your agent "set up my brain".", "Get started shows every step." (a 👉 before it), with "Get started" linked to the Get started section of the product README on GitHub; and "Then open First things first: create your own Notion Brain Assistant and select it in its buttons.", with "First things first" linked to the page below (decision 0103 §1); then, a paragraph of its own inside the callout, "Notion Brain Assistant and its buttons need Notion's Business or Enterprise plan with Notion credits.", with "Notion credits" linked to Notion's help page, https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents (decision 0101 §7: Custom Agents use credits each time they run, and only Business and Enterprise can buy them). It holds no plan table: what works on each Notion plan is in the README's Get started, which "Get started" opens, and in [docs/setup.md](../docs/setup.md). Its exact text is [docs/notion-space-design.md](../docs/notion-space-design.md) §10's; a step or check finds a sentence by its first words.
- **First things first**, a page under the top page: the checklist of what only you can do in Notion for Notion Brain Assistant (create your own, give it access, paste its Instructions and replace the mentions, check the mentions in its skills, select it in the three buttons), the note to say "set up my brain" in Claude Code or Codex, and Run Today with the button checks. Its exact text and links are [docs/notion-space-design.md](../docs/notion-space-design.md) §10.1 (decision 0103 §1, spec/setup.md §6.4.1). Duplicating the template copies this page, never a configured Notion Brain Assistant.
- **System**, a callout on the top page, not a page (decision 0085): the links to **First things first** (first), **Brain Data**, **Archive**, **How it works** (filled with the user guide) and the **Skills** database (Notion Brain Assistant's skills), and the line `Template version: NNNN` (the version above) on its own, formatted as inline code.
- Home, Tasks, Meetings, Projects, Plan, Knowledge, with their views, buttons and synced navigation.
- **Brain Data**, holding the databases below.

**Databases**

| Database | Where | Module |
|---|---|---|
| Inbox, Meetings, Projects, Areas, People | Brain Data | Core |
| Domains | Brain Data | Domains (in every space, 0065) |
| Orgs | Brain Data | Orgs |
| Documents | Brain Data | Documents, and Reports (a report is a Documents row) |
| Tasks | Brain Data | Tasks |
| Goals, Key Results | Brain Data | Planning |
| Skills (Notion Brain Assistant's skills; one page per skill: Today, Check minutes, Prep, Weekly review, Plan check, Tidy capture, Voice summary, Clean email, Write up, Refresh report, and Write minutes, the minutes prompt). A database of Notion's own skills type: the title property Skill name, Description (text), Select, Tags and Files; the product reads and writes the title and Description only | linked from the System callout | Notion Brain Assistant; the brain never reads it |

**Example rows** (decisions 0084 §3, 0087 §1, 0099). Thirteen invented rows show what a filled space looks like, at least one in every database on Brain Data, all from one story (a kickoff with Northwind Studio about refreshing its website) and related to each other, so each page links to the next. Each is titled with the prefix `Example · ` (the word, a space, the middle dot `·`, a space), and each is in a state no skill acts on. Their exact content, the Notion AI prompts that create them and the step that sets their relations are in [template-examples.md](template-examples.md).

| Database | Example row | State | Related to |
|---|---|---|---|
| Domains | `Example · Work` | | |
| Areas | `Example · Clients` | | the Domain |
| Projects | `Example · Website refresh` | | the Area |
| People | `Example · Sam Rivera` | | the Org |
| Orgs | `Example · Northwind Studio` | | |
| Meetings | `Example · Kickoff with Northwind` | New, with short lean minutes (decision 0079) | the Project, the Area, the Person |
| Tasks | `Example · Send the project plan` | not started (To Do) | the Project, the Meeting |
| Tasks | `Example · Brand guidelines from Sam` | Waiting On | the Project, the Meeting |
| Tasks | `Example · Can the site go live by the end of March?` | Waiting On, Kind Question (a question tracked as a task, 0099) | the Project, the Meeting |
| Inbox | `Example · Notes from a call with Sam` | Brain Status Done, Kind Capture, a Summary | the Project, the Person |
| Documents | `Example · Website refresh brief` | Origin Kept, Lifecycle Reviewed, Accepted unticked, nothing asked | the Project, the Area; Sources the Inbox row |
| Goals | `Example · Launch three client websites this year` | Status Active | Area the Area, Projects the Project |
| Key Results | `Example · Sites launched` | Kind Number, Start 0, Target 3, Current 1 | Goal the Goal |

The Project, the Meeting and the Document are all in the Area `Example · Clients`, whose Domain is `Example · Work`, so each shows Domain `Example · Work` through its Domain rollup, and the `Example · Work` page, made from the Domains template, lists all three (decision 0105). The Domain has no Type.

**The Brain Data callout.** The first block of Brain Data is a callout: "These are examples. Every row titled "Example · " is a sample. When you say "set up my brain", it moves them all to Notion's trash after one yes. You can also delete them yourself." It is product text and stays after setup.

Only the Skills database has no Example row: it holds Notion Brain Assistant's skills, which are product text. "Set up my brain" moves the Example rows to Notion's trash when it connects the brain (step 4, with the user's yes), and the skills that read Notion never take anything in from one that is left (spec/setup.md §6.5).

Eleven databases on Brain Data, and Skills linked from the System callout. There is no Review, Decisions or Questions database since 0.16.0 (decisions 0096, 0099). Each database's templates, page layout and buttons are as in [prompts/](prompts/), [modules/](modules/) and [views-guide.md](views-guide.md) §9.

**Modules.** The brain uses the modules `brain.json` turns on: a new brain starts with Orgs, Documents, Reports and Tasks, and Domains after seeding (spec/schema.md §12). The databases and page parts of a module that is off stay in the duplicate, unused, so turning it on later needs no Notion step beyond connecting it. A user with their own tasks database maps it at the connect step (decision 0018) and leaves Tasks unused.

## The steps a duplicate still needs

A duplicate can't carry these; "set up my brain" walks through each and checks it (spec/setup.md §2):
1. **Connect your agent to Notion** (the Notion MCP), step 3.
2. **Connect the brain to Notion** (brain-connect-notion), step 4: the modules, the database ids, the Tasks database and this template version; then setup removes the Example rows (spec/setup.md §6.5).
3. **The minutes prompt**, step 4a: run in the Notion AI chat on a meeting page, below the transcript, with the line "Write the minutes on this page, below the transcript, and nothing else.", as [pasting-the-minutes-prompt.md](pasting-the-minutes-prompt.md) says; its text is [minutes-format.md](minutes-format.md), the lean format of decision 0079. The Meetings template doesn't hold it. Taken only when your transcripts come from Notion AI meeting notes (spec/setup.md §13); otherwise your agent writes the minutes, or you run the prompt in another tool ([docs/meetings-from-other-tools.md](../docs/meetings-from-other-tools.md)).
4. **Your own Notion Brain Assistant**, step 4b: the duplicate has no configured agent, whatever the template's own space has. You create it, give it access, paste its Instructions, replace the mentions and select it in the Tidy capture, Write up and Refresh report buttons, as **First things first** lists; setup checks each. It is a Custom Agent, which with its buttons needs Business or Enterprise with Notion credits (decision 0101 §7; without them, setup leaves it out and the same skills run from Claude Code or Codex, spec/assistant.md §13) whose Tools and access hold only the duplicate's Brain Data, How it works and Skills, picked by the duplicate's top page (spec/setup.md §6.4), with its Instructions' @mentions pointing at those pages ("Setup" in [brain-assistant.md](brain-assistant.md); its skills are already in the duplicate).

A Custom Agent is not part of a duplicate: each user creates their own (decision 0103 §1). What else survives duplication (whether a button's Send message to keeps any agent, relations, the Home buttons, and whether the First things first link in Start here opens the duplicate's own page) is checked on a fresh duplicate (0078 §5, CC-193; U-37 for 0.16.1), which records the result here. A button never needs to keep the template's agent: First things first has you select your own.

## Building and updating the template

The template is a **copy of the author's own Ultimate Brain space, emptied**, made inside the author's one workspace (decision 0084, amending 0078 §1). Nothing personal may be published: rows are the obvious place, and the scrub list below covers the others. For whoever maintains it (U-27 the first time):

1. **Bring your own space up to date first.** Every migration in [migrations/](migrations/) is applied (`brain upgrade` in your brain names none), and CC-197 is merged and applied, so Check minutes and Voice summary in Skills are the 0079 versions.
2. **Copy.** Duplicate your top page **Ultimate Brain** inside your workspace, and name the copy **Ultimate Brain**. From here on, work only in the copy: check each page you edit is under it.
3. **Point everything at the copy.** Every linked view (Home, Tasks, Meetings, Projects, Plan, Knowledge), every relation, every button that adds or edits a page, and every synced block must use the copy's own databases and blocks, never your space's. Re-point or rebuild any that doesn't.
4. **Empty every database.** Delete every row of the eleven databases on Brain Data, and every page under Archive. In Skills, keep the eleven skills and check each against [brain-assistant.md](brain-assistant.md): a skill you changed for yourself goes back to the product's text, and Write minutes' body is the text block of [minutes-format.md](minutes-format.md). How it works holds the user guide only.
   - **The skill pages' layout:** each page holds its skill's whole text block in **Description**, with an empty body; Write minutes alone holds its short line in Description and the minutes prompt in its body ([docs/notion-space-design.md](../docs/notion-space-design.md) §5). A page of a skill brain-assistant.md no longer has goes to the trash. `scripts/skills-pages-check.mjs` compares them all ([docs/releasing.md](../docs/releasing.md), step 4).
5. **Scrub where personal data hides,** ticking each:
   - **Database templates:** each database's templates, their default property values (a person, a project, an area, an org) and their body text.
   - **Select and multi-select options:** only the options of [docs/notion-space-design.md](../docs/notion-space-design.md) §3 stay; delete any other (a client, a tag, a person's name).
   - **Buttons:** what each one sets, inserts or sends (a person, a page, a fixed text).
   - **Views:** filters and sorts that name a person, a page or a value, and view names.
   - **Mentions:** `@` people, pages and dates with reminders, on every page, in callouts and in How it works.
   - **Synced blocks:** each is the copy's own, holding only the navigation.
   - **Icons and covers:** no photo, logo or emoji that points to you or a client.
   - **Titles and text:** no page titled with your name, no person or client named in a page, a formula or a description.
   - **Comments** on any page or row.
   - **The public page:** the workspace's name, icon and `notion.site` domain shown on a published page name nothing personal.
6. **Every module.** Compare the copy with the table above. A module or part your space never had is added from [modules/](modules/) (or its migration), so the template holds every module (0078 §1).
7. **Add the Example rows and the Brain Data callout** of "What a duplicate contains", related as its table says, with the content and the Notion AI prompts of [template-examples.md](template-examples.md), run on the copy's Brain Data page, then its step 7 for the relations (the agent through the API with your yes, or by hand). Leave each row in its state there: the Meeting New, nothing ticked.
8. **Start here and First things first.** Check the callout on the top page, and link its "Get started" to the README's Get started section and its "First things first" to the copy's own First things first page. That page holds [docs/notion-space-design.md](../docs/notion-space-design.md) §10.1 word for word, every to-do unticked, and the System callout links it first. A button in the copy may still send to your own Notion Brain Assistant: a duplicate can't use it, and First things first's item 6 has each user select their own.
9. **Template version.** The System callout on the top page holds the line `Template version: NNNN` on its own, the number of the last migration in [migrations/](migrations/) applied to the copy. Record the same number in the table above.
10. **The coordinator's read-only scan.** Give the coordinator session in this repository the copy's top page, shared with its Notion connection. Reading only, through the Notion MCP, it lists every row, database template, select option, mention and page title it can reach, and flags anything that is not an Example row or the product's own text. Fix each finding by hand, then ask for the scan again until it finds nothing. What the API can't read (button contents, view filters) is checked by your ticks in step 5 alone.
11. **Publish** the top page with duplication allowed (Share → Publish; search engine indexing off), and put its link in the table above, with one `scripts/leak-allow.txt` entry for it (`notion/TEMPLATE.md:<the link's pattern>`), in the same change as the version.

The copy is the template only: never use it as your own brain's space, and never connect a brain to it.

**When a release adds a migration:** apply it to the template copy as well (its last step updates the Template version line in the System callout), add nothing personal, leave the Example rows as they are unless [template-examples.md](template-examples.md) changed one in that release (0.16.0 removed the Decision, Question and Review rows with their databases, which the migration archives, added the example question as a Task (row 10) and changed one line of the Meeting's minutes: [template-examples.md](template-examples.md), "Updating a copy to 0.16.0", says how; 0.16.2 put the Meeting's minutes in the divided layout: "Updating a copy to 0.16.2"; 0.17.0's weekly row changes only Notion Brain Assistant's texts, in migration 0030's part D, and adds no Example row: the template's Inbox holds no Weekly row, since a brain's first weekly run writes its own), run the scan again, and change the version above in the same release. A duplicate made earlier is brought up to date with the migrations `brain upgrade` names.

**The skill pages, all of them:** after a release with a migration, or one that changes [brain-assistant.md](brain-assistant.md) or [minutes-format.md](minutes-format.md), compare every page of the template's Skills database with brain-assistant.md's "Skills", not only the pages the migration names, in the layout of step 4 above (the text in Description), and move a page whose skill brain-assistant.md no longer has to the trash. [docs/releasing.md](../docs/releasing.md) step 4 has the command and the offline check.
