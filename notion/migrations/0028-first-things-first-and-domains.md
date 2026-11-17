# 0028 · First things first, and Domains on Projects, Meetings and Documents

**Design change:** decision [0103](../../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md) §1 and §2; CC-337 (release 0.16.1; spec/setup.md §6.4, §6.4.1, §6.4.2; docs/notion-space-design.md §5, §10, §10.1). Part B, Domains: decision [0105](../../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) §1 and §3; CC-343 (spec/capture-and-review.md §1.2 to §1.5; spec/schema.md §4 domain, §14; docs/notion-space-design.md §3, §3.15, §4). It is 0.16.1's one Notion migration. **Applies to:** every space built or migrated before 0.16.1, the template's copy included. Needs migration 0027. A step already done changes nothing, so running this again is safe.

**What changes:**
- **First things first** (0103). Your space gets a checklist page, **First things first**, under your top page, linked from the Start here callout and first in System. It lists what only you can do in Notion for Brain Assistant: create your own agent, give it access, paste its Instructions and replace the mentions, check the mentions in its skills, and select it in the **Send message to** of the Tidy capture, Write up and Refresh report buttons. Then: open Claude Code or Codex in your brain folder and say "set up my brain", and check Today and the buttons.
- **A Brain Assistant that works is kept.** This migration writes nothing to an agent or a button (the API can't), and never asks you to create a second agent. If yours already answers in its chat, you check it, and repair only what a check finds.
- **Projects, Meetings and Documents show their Domain** (0105 §1). Each gets a read-only **Domain** rollup: through its Area, the Area's Domain. Notion computes it; the brain never writes or reads it, and no note gets a `domain` from it. A row with no Area, or whose Area has no Domain, shows none.
- **Each Domain page lists its projects, meetings and documents**, in three linked views filtered by Domain.
- **Domains lose Type** (0105 §3). A Domain's name and Summary say what kind of context it is. Type is removed from Notion only after your yes; in your brain, the next sync drops a domain's old `notion_fields.type` by itself.

Run this migration after `brain upgrade` has put 0.16.1 in place, in an attended session (never from a schedule), in the order below: part A, then part B, then the last steps. Part B has no brain step. **The template's copy** (no brain) does the Notion steps alone, and B5.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion. The API can't edit a Custom Agent, a button, a view, a page template's views or a page layout, and it can't put a block before the first child of a page or a callout: it appends at the end, or right after a block it names. It can ignore a write while still answering 200, so always read the result back.

The top page is Brain Data's topmost parent page (spec/setup.md §6.4). In the template and its duplicates, the **Start here** and **System** callouts sit inside the top page's columns, not at its top level: read the columns' children to find them. Start here is the callout whose text begins "Start here"; System is the callout titled "System" that holds Brain Data.

## Part A · First things first (0103)

### A1 · The First things first page (agent)

Read the top page's child pages.
1. **Already there?** A child page titled **First things first** means this step ran: create nothing, and leave the page as it is, its ticks included. Go to A2. (Two such pages: say so, and ask the user which to keep; delete nothing without their yes for that page.)
2. **Otherwise,** with the user's yes, create a page titled **First things first** under the top page holding the checklist of [docs/notion-space-design.md](../../docs/notion-space-design.md) §10.1 word for word: its first line as a paragraph, then the eight items as to-do blocks, unticked, their bold words in bold, and its three links ("Notion credits", "Brain Assistant's setup page", "Get started") as that section gives them. Name every place as the text does, by where it sits under the top page: add no page mention.
3. **Read it back** through the API: one child page **First things first** under the top page, holding one paragraph and eight to-dos, none ticked, in §10.1's order, with the three links.

The API puts the new page at the end of the top page. Leave it there or drag it where you like: Start here and System link to it (A2, A3).

### A2 · The link in Start here (agent, or by hand)

Find the **Start here** callout. Add this line right after the line that ends "Get started shows every step." (before the line on Notion credits), a plain line inside the callout:

`Then open First things first: create your own Brain Assistant and select it in its buttons.`

Link "First things first" to the page of A1.
- **Already there?** A line in the callout that links to the First things first page means this step ran: change nothing.
- **The agent** adds it when the "Get started" line is a block of its own inside the callout: append a paragraph to the callout with `after` set to that block's id, the words "First things first" linked to the A1 page's URL. Then read the callout's children back: the new line is right after that one, once, and its link opens the A1 page.
- **By hand** when the "Get started" line is the callout's own text (the template's form: the new line is then the callout's first inner line, where the API can't write), or the lines are one block's text: click at the end of "Get started shows every step.", press Shift+Enter, type the line, select "First things first" and link it to the page (type its name in the link box and pick the one under your top page).
- **No Start here callout** (a space built before 0.14.0 without it): nothing to change. A1's page is on your top page, and A3 links it from System.

### A3 · The link in System (agent, or by hand)

Add a link to the page of A1 as the first link in **System**: in the template's copy and spaces from it, the System callout (decision 0085), where its pages and links follow the callout's title and a divider; in a space built from the prompts, the top of the System page.
- **Already there?** A link to the First things first page in System (a link to page, a page mention or a linked word) means this step ran: change nothing.
- **The agent** adds it when System's first inner block is a divider: append a **link to page** block (`{"type": "link_to_page", "link_to_page": {"type": "page_id", "page_id": "<the A1 page>"}}`) with `after` set to the divider's id. Then read System back: right after the divider, one link to the A1 page, then its other pages as before.
- **By hand** otherwise (the API can't add a block before the first one): at the start of System's first line, type `First things first`, press Enter, then select the words and link them to the page under your top page (or type `/link to page` and pick it).

### A4 · Your Brain Assistant: keep it, and check it (in the session)

Nothing is written here. Ask: "Does this space already have a Brain Assistant you created, that answers in its chat?"
- **Yes:** keep it. Don't create another, and don't change its Instructions or its buttons for this migration. Say "check Brain Assistant again" in your brain: setup's checks run on it (spec/setup.md §6.4: the scope check with Today, the mentions in Skills read through the API, your check of its access and Instructions, and each button on a sample page). Only a failed check shows its First things first item, as a repair.
- **No, or not sure:** tick through **First things first**, in order; "set up my brain" walks you through it and checks each item.

The template's copy skips A4: it has no brain, and a duplicate never carries an agent (decision 0103 §1).

## Part B · Domains (0105)

### B1 · The Domain rollups (agent)

Read the Projects, Meetings and (Documents module) Documents data sources, and the Areas data source. Areas must have **Domain**, a relation to Domains (every space has it, decision 0065): without it, run [migration 0014](0014-domains-database-in-every-space.md) first. Each of the three must have **Area**, a relation to Areas; one that lacks it is reported, and gets no rollup.

For each of the three, by its property named **Domain**:
- **Missing:** add it, through a data source update:
  ```json
  { "Domain": { "rollup": { "relation_property_name": "Area", "rollup_property_name": "Domain", "function": "show_original" },
                "description": "Owner: Notion. Derived from the Area's Domain; you never edit it." } }
  ```
- **A rollup over Area → Domain with Show original:** add nothing. If its description differs from the one above, send the same rollup with that description (a description alone is refused); nothing else changes.
- **Anything else** (another type, or a rollup over another relation or property): change nothing, report it, and ask the user. Never rename or replace their property.

Without the Documents module, do Projects and Meetings only: [../modules/documents.md](../modules/documents.md) adds the Documents rollup when you turn it on.

**Read back** each data source: Domain is of type `rollup`, with `relation_property_name` Area, `rollup_property_name` Domain, `function` `show_original` and the description above. Then check that it computes: query each database filtered on the rollup for one Domain that has an Area, e.g. `{"property": "Domain", "rollup": {"any": {"relation": {"contains": "<the Domain's page id>"}}}}`, and compare with the rows whose Area has that Domain. A rollup of a relation reads back on a row as a list of relations (spec/cli.md §5.14.1).

### B2 · Domains · Type (agent, after your yes)

Read the Domains data source.
- **No Type:** nothing to do here. Go to B3.
- **Type is there:** list the Domains that have a Type, with their values, and warn: *Deleting a property deletes its values, and Notion's undo for it lasts only while the page is open. A Domain's name and Summary say what kind of context it is; your brain stops reading Type at 0.16.1 and drops the old value from each domain note at the next sync. Note any Type you want to keep, for instance in the Domain's Summary, before you say yes.* Ask: "Remove Type from Domains?"

With the user's yes, remove it: a data source update with `{"Type": null}`. Read Domains back: it has no Type. Without a yes, leave it: the brain no longer reads it (spec/capture-and-review.md §1.4), so a space that keeps it loses nothing else; this step asks again the next time the migration runs.

Remove only Domains · Type. A property named Type on another database is not this step's.

### B3 · The Domains page template (by hand)

The API can't edit a page template's views. Open Domains → the **New** arrow (▾) → the default template (create one if there is none, and set it as the default) → **Edit**:
1. Under the page title, keep **Areas** and, with Orgs, **Org** visible. Remove any Type the template shows.
2. Add three linked views, each under an H3 heading, with the database title hidden, exactly as [../views-guide.md](../views-guide.md) §9a lists them: **"Which projects?"** (view Projects), **"Which meetings?"** (view Meetings, Date descending) and, with Documents, **"What do we know?"** (view Documents), each filtered by **Domain contains This page**, where Domain is the rollup of B1. *This page* is offered in the filter's value menu only while you edit a page template.
3. Then a toggle **My notes**, if the template has none.

The template applies to new Domains. A Domain page made before it doesn't change: apply the template to it from the page (the template picker at the top of an empty page), or add the three views by hand.

### B4 · Page layouts and views that used Type (by hand)

1. **Domains layout** (open a Domain → **Customize layout**): the heading holds Archived; the property group holds Areas, Org (with Orgs) and Summary; Brain ID and Last Synced are hidden. Type is gone.
2. **Projects, Meetings and Documents layouts:** with the Domains module on, put **Domain** in the property group right after Area (on Documents, where Area is pinned, first in the property group). With it off, hide it. Never pin it: you change the Area, not the Domain.
3. **Views:** any view that sorted, grouped, filtered or showed Domains · Type now shows a warning in Notion, or an empty column: point it at Domain or Name, or remove the rule.

### B5 · The template's Example document (agent, on the template's copy, with your yes)

On the template's copy only: the Documents row `Example · Website refresh brief` gets **Area** `Example · Clients` if its Area is empty ([../template-examples.md](../template-examples.md), step 7), so `Example · Work`'s Domain page lists the Example project, meeting and document. Read the row back: its Domain rollup shows `Example · Work`. A space connected to a brain skips B5: its Example rows were moved to the trash at setup.

## The last steps

### L1 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0028`. A space without that line has nothing to change.

## What this migration doesn't do

- **Part A changes no agent, button or skill page.** A working Brain Assistant and its Send message to bindings stay as they are. A repair is your own edit, made only where a check found something.
- **Part A creates, changes or deletes no row.** The sample pages of the button checks are setup's (spec/setup.md §6.4 check 7), not this migration's.
- **Nothing is ticked for you.** A ticked First things first box records nothing: the brain never reads the page. Brain Assistant is ready when setup's checks pass.
- **Part B edits no brain by hand and changes no `brain.json`.** Sync stops reading Domains · Type with 0.16.1 (spec/cli.md §5.14.2), and the next `brain sync apply` drops a domain's old `notion_fields.type`; lint accepts it until then. The rollups map to no field.
- **Part B fills in no Area.** A meeting or Document with projects and no Area shows no Domain until its next ingest sets the projects' shared Area (spec/schema.md §4 meeting), or until you set one. No backfill.
- **Part B deletes no row, and no value but Type's.** Type's values go only with your yes (B2).

## Verify

These come in two kinds. **Read back through the API** (the agent): the items marked *(API)*. **Only you can see** (Notion's interface): the items marked *(you)*. The agent never ticks a *(you)* item from what it read.

Part A, First things first:
- [ ] *(API)* The top page has exactly one child page **First things first**, holding the paragraph and eight to-dos of docs/notion-space-design.md §10.1, with its three links; a second run created no second page and changed no tick.
- [ ] *(API)* The Start here callout (where the space has it) holds the line "Then open First things first: …" once, right after the "Get started" line, its link opening that page.
- [ ] *(API)* System's first line links to the First things first page, once.
- [ ] *(you)* Clicking each link (Start here, System) opens the First things first page under your own top page.
- [ ] *(you)* An existing Brain Assistant is the same agent as before, with the same Instructions and Tools and access; each of Tidy capture, Write up and Refresh report still sends to it.
- [ ] *(with a brain)* "check Brain Assistant again" passes, or names the one item to repair.

Part B, Domains (decision 0105):
- [ ] *(API)* Projects, Meetings and (Documents) Documents each have **Domain**: a rollup of Area → Domain, Show original, described "Owner: Notion. Derived from the Area's Domain; you never edit it." Running B1 again reports nothing to add.
- [ ] *(API)* A row whose Area has a Domain shows that Domain; a row with no Area shows none. A query filtered on the rollup for one Domain returns exactly the rows whose Area has it.
- [ ] *(API)* After your yes, Domains has no **Type**, and running B2 again has nothing to do. Without your yes, Type is still there.
- [ ] *(API)* Domains has a default page template.
- [ ] *(you)* A Domain made from the template lists its projects, meetings and documents in its three views, and shows no Type; its layout shows Areas and Org.
- [ ] *(you)* With the Domains module on, a project, meeting and document page show Domain after Area; no view shows a warning for Type.
- [ ] *(you, template's copy)* `Example · Work`'s Domain page lists `Example · Website refresh`, `Example · Kickoff with Northwind` and `Example · Website refresh brief`.
- [ ] *(with a brain)* After `brain sync`, no domain note holds `notion_fields.type`, `brain lint` passes, and `sync plan` shows no conflict for a Domain rollup.

The last steps:
- [ ] *(API)* The System callout reads `Template version: 0028`.
