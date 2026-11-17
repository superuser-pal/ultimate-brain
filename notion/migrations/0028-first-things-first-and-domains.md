# 0028 · First things first, and Domains on Projects, Meetings and Documents without Type

**Design change:** decision [0103](../../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md), CC-337 (part "First things first"); decision [0105](../../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) §1 and §3, CC-343 (part "Domains"; spec/capture-and-review.md §1.2 to §1.5; spec/schema.md §4 domain, §14; docs/notion-space-design.md §3, §3.15, §4). It is 0.16.1's one Notion migration. **Applies to:** every space built or migrated before 0.16.1, the template's copy included. Needs migration 0027. A step already done changes nothing, so running this again is safe.

**What changes in part "Domains" (0105):**
- **Projects, Meetings and Documents show their Domain.** Each gets a read-only **Domain** rollup: through its Area, the Area's Domain. Notion computes it; the brain never writes or reads it, and no note gets a `domain` from it. A row with no Area, or whose Area has no Domain, shows none.
- **Each Domain page lists its projects, meetings and documents**, in three linked views filtered by Domain.
- **Domains lose Type.** A Domain's name and Summary say what kind of context it is. Type is removed from Notion only after your yes; in your brain, the next sync drops a domain's old `notion_fields.type` by itself.

Run this migration after `brain upgrade` has put 0.16.1 in place, in an attended session (never from a schedule): part "First things first", then part "Domains". Part "Domains" has no brain step: it runs the same in a space connected to a brain and in **the template's copy** (no brain), which also does D5.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **by hand:** you, in Notion. The API can't create or edit a view, a page template's views or a page layout, and it can ignore a write while still answering 200, so always read the result back.

## Domains (0105)

### D1 · The Domain rollups (agent)

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

### D2 · Domains · Type (agent, after your yes)

Read the Domains data source.
- **No Type:** nothing to do here. Go to D3.
- **Type is there:** list the Domains that have a Type, with their values, and warn: *Deleting a property deletes its values, and Notion's undo for it lasts only while the page is open. A Domain's name and Summary say what kind of context it is; your brain stops reading Type at 0.16.1 and drops the old value from each domain note at the next sync. Note any Type you want to keep, for instance in the Domain's Summary, before you say yes.* Ask: "Remove Type from Domains?"

With the user's yes, remove it: a data source update with `{"Type": null}`. Read Domains back: it has no Type. Without a yes, leave it: the brain no longer reads it (spec/capture-and-review.md §1.4), so a space that keeps it loses nothing else; this step asks again the next time the migration runs.

Remove only Domains · Type. A property named Type on another database is not this step's.

### D3 · The Domains page template (by hand)

The API can't edit a page template's views. Open Domains → the **New** arrow (▾) → the default template (create one if there is none, and set it as the default) → **Edit**:
1. Under the page title, keep **Areas** and, with Orgs, **Org** visible. Remove any Type the template shows.
2. Add three linked views, each under an H3 heading, with the database title hidden, exactly as [../views-guide.md](../views-guide.md) §9a lists them: **"Which projects?"** (view Projects), **"Which meetings?"** (view Meetings, Date descending) and, with Documents, **"What do we know?"** (view Documents), each filtered by **Domain contains This page**, where Domain is the rollup of D1. *This page* is offered in the filter's value menu only while you edit a page template.
3. Then a toggle **My notes**, if the template has none.

The template applies to new Domains. A Domain page made before it doesn't change: apply the template to it from the page (the template picker at the top of an empty page), or add the three views by hand.

### D4 · Page layouts and views that used Type (by hand)

1. **Domains layout** (open a Domain → **Customize layout**): the heading holds Archived; the property group holds Areas, Org (with Orgs) and Summary; Brain ID and Last Synced are hidden. Type is gone.
2. **Projects, Meetings and Documents layouts:** with the Domains module on, put **Domain** in the property group right after Area (on Documents, where Area is pinned, first in the property group). With it off, hide it. Never pin it: you change the Area, not the Domain.
3. **Views:** any view that sorted, grouped, filtered or showed Domains · Type now shows a warning in Notion, or an empty column: point it at Domain or Name, or remove the rule.

### D5 · The template's Example document (agent, on the template's copy, with your yes)

On the template's copy only: the Documents row `Example · Website refresh brief` gets **Area** `Example · Clients` if its Area is empty ([../template-examples.md](../template-examples.md), step 7), so `Example · Work`'s Domain page lists the Example project, meeting and document. Read the row back: its Domain rollup shows `Example · Work`. A space connected to a brain skips D5: its Example rows were moved to the trash at setup.

## What this migration doesn't do

- **No brain edit by hand, and no `brain.json` change.** Sync stops reading Domains · Type with 0.16.1 (spec/cli.md §5.14.2), and the next `brain sync apply` drops a domain's old `notion_fields.type`; lint accepts it until then. The rollups map to no field.
- **No Area is filled in.** A meeting or Document with projects and no Area shows no Domain until its next ingest sets the projects' shared Area (spec/schema.md §4 meeting), or until you set one. No backfill.
- **No row is deleted, and no value but Type's.** Type's values go only with your yes (D2).

## Verify

Part "Domains":
- [ ] Projects, Meetings and (Documents) Documents each have **Domain**: a rollup of Area → Domain, Show original, described "Owner: Notion. Derived from the Area's Domain; you never edit it." Running D1 again reports nothing to add.
- [ ] A row whose Area has a Domain shows that Domain; a row with no Area shows none. A query filtered on the rollup for one Domain returns exactly the rows whose Area has it.
- [ ] After your yes, Domains has no Type, and running D2 again has nothing to do. Without your yes, Type is still there.
- [ ] A Domain made from the template lists its projects, meetings and documents in its three views, and shows no Type; its layout shows Areas and Org.
- [ ] With the Domains module on, a project, meeting and document page show Domain after Area; no view shows a warning for Type.
- [ ] (Template's copy) `Example · Work`'s Domain page lists `Example · Website refresh`, `Example · Kickoff with Northwind` and `Example · Website refresh brief`.
- [ ] (With a brain) After `brain sync`, no domain note holds `notion_fields.type`, `brain lint` passes, and `sync plan` shows no conflict for a Domain rollup.
