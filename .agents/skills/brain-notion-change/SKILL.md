---
name: brain-notion-change
description: Change the structure of the user's Notion space (a database, property, select option, relation, template, view) the safe way, design first in the product repo and then applied in Notion, or check the live Notion space against the design and report drift. Use when the user says "add a property to Projects", "change the Notion space", "add an option to Kind", "check my Notion space", "is my Notion set up right", or after a structural edit made directly in Notion.
---

# Change or check the Notion space

The Notion space's structure is designed in the product repo, in docs/notion-space-design.md, and built from the prompts in notion/ (decisions 0019, 0022). Structure is never edited in Notion first: the design changes, a prompt is generated for just that change, the user runs it, and this skill checks the result. Content (notes, facts, decisions) is not structure; it goes through ingest, proposals and sync.

Pick the mode from the request:
- **Change:** the user wants the structure to be different. Run it in the product repo (`ultimate-brain`).
- **Check:** the user wants to know whether the live space matches. Run it anywhere the Notion connection and the design doc are available.

## Change

1. **Understand the change and its consequences.** For a new or renamed property, select option or relation, find everything that names it:
   - docs/notion-space-design.md §3 (the tables), §4 (templates) and §5 (views);
   - notion/prompts/ (the build prompt that creates it) and notion/views-guide.md;
   - spec/cli.md §5.14 (sync plan's ownership table, sync render's rendered properties, value conversion), spec/schema.md §14 (Notion property mapping), and `brain.json` defaults (templates/brain/brain.json, spec/schemas/brain.schema.json);
   - skills that read or write it.

   A property the brain reads or writes is a CLI change too: say so, and add a task for Codex. A change that clears the decision gate (it changes what the brain stores, or who owns a field) gets a decision record in decisions/.
2. **Change the design and the build prompts** in the same branch, so a new user building from scratch gets the new structure (0022).
3. **Write a migration**, `notion/migrations/<NNNN>-<slug>.md` (next number; format in notion/migrations/README.md), for spaces that already exist. It holds:
   - a Notion AI prompt that changes **only** this, and keeps everything else as it is;
   - the by-hand steps when Notion AI can't do it reliably (select options, see below);
   - a **Verify** list.
4. **Open a PR.** The user merges it, then runs the migration in their space.
5. **Check** (below), limited to what the migration touched, and report.

**Select options: add, never delete-and-recreate.** Options added by Notion AI can share an internal id with an existing option. Deleting one of them then deletes both. That happened with Add Link and Supersede in Review → Kind. Migrations that add an option say: add it by hand (property → Edit property → Add an option), then run the check to confirm every option has its own id.

## Check

**References.** Properties and types: docs/notion-space-design.md §3, plus the relations notion/prompts/03-relations.md creates (where the two differ, the prompts are the exact definition). Ownership descriptions: notion/prompts/05-ownership.md.

1. **Find the databases** from `brain config get notion.databases` (+ `notion.tasks.database`). Without a brain, search for the page titled exactly **"Brain Data"** (ask if there is more than one), and use the ids of its child databases (brain-connect-notion skill, steps 1–2).
2. **For each database:** retrieve it, then its data source (`data_sources[0]`), and compare the properties with docs/notion-space-design.md §3:
   - **Missing or extra property:** a property the references list but Notion lacks is drift. A property in neither is the user's own: fine, report it as "yours, not used by the brain".
   - **Type:** e.g. text vs select. "Status" in the design means Notion's status type (Tasks), not a select.
   - **Select options:** every listed option exists, with the exact spelling; extra options are reported. **Within one property, no two options share an id.** The same id across different properties is normal in Notion.
   - **Relations:** they point at the right database (compare the relation's `database_id` with the configured ids), and two-way relations have their pair.
   - **Ownership description:** it starts with the owner Prompt 5 assigns (`Owner: brain.`, `Owner: you.`, `Owner: you when creating, then brain.`, `Owner: system. Do not edit.`).
   - **Formula and rollup:** Progress exists in Key Results (formula) and Goals (rollup).
3. **Report** one line per difference, most serious first, each with how to fix it:
   - **Breaks the brain:** a property the brain reads or writes is missing, renamed or the wrong type, or a select option the brain renders is missing. Fix:
     - a missing select option is added **by hand** (property → Edit property → Add an option);
     - a missing property or relation is restored with the matching migration, or with the matching part of a build prompt, quoted as a one-off prompt. Never re-run a whole build prompt on an existing space.
     - If the user meant the change, bring it into the design instead (Change mode).
   - **Confusing but harmless:** ownership descriptions, extra options.
   - **Fine:** extra properties of the user's own.

   **Not checkable through the API**, so say so and point to the Verify lists in notion/prompts/ and notion/views-guide.md:
   - templates and views;
   - display formats: percent on Progress, a date range on Dates, time on Last Synced.

**Never change anything in Notion while checking.**
