# 0016 · Type moves from Areas to Domains

**Design change:** CC-120 (release 0.9.1; docs/notion-space-design.md §3.1 and the Domains database; spec/schema.md §14). **Applies to:** spaces built or migrated before 0.9.1. Run 0014 first. A step already done changes nothing, so running this again is safe.

What changes: the **Type** select leaves Areas and goes to Domains, with the options Personal, Entrepreneurship and Professional. A Domain is the context that groups Areas, so the kind of context is set once there rather than on every area. Type stays yours: the brain reads it into the domain note and never writes it. Nothing else is renamed, and no other value is filled in.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **by hand:** you, in Notion (the API can't, or ignores it with a 200: always read the result back).

## 1 · Domains · Type (agent)

Read the Domains data source first:
- **Type is missing:** add **Type** (select) with Personal, Entrepreneurship, Professional, in that order, and the description "Owner: you." (notion/prompts/05-ownership.md, rule 3).
- **It exists, with the same type and every option:** add nothing.
- **It exists without some options:** add only the missing ones, sending the existing options with their ids first (an update without them drops them).
- **It exists with another type:** change nothing, report it, and ask the user.

Fill in no values: you set each Domain's Type. Read the property back after writing it.

## 2 · Areas · Type (agent, after your yes)

Deleting a property deletes its values, and Notion's undo for it lasts only while the page is open. Before you say yes, note any area Types you want to keep; the brain's area notes still hold them in `notion_fields.type` until the next sync.

With your yes, remove **Type** from Areas. A space whose Areas has no Type has nothing to do here.

## 3 · Views and layouts (by hand)

The API can't edit views or layouts ([../views-guide.md](../views-guide.md) §9).
- **Plan → Areas, "Which areas do I own?":** sort by Name only; show Name.
- **Archive → Areas, "Which areas did I close?":** show Name.
- **Areas page layout:** the heading holds At a glance (Type is gone).
- **Domains page layout:** show Type with Areas and, when Orgs is on, Org.

Any other view of yours that sorted, grouped or filtered by Areas · Type now shows a warning in Notion: point it at Domain, or remove the rule.

## What this migration doesn't do

- **No `brain.json` change.** Type is read by name.
- **No brain edit by hand.** The next `brain sync` stores each Domain's Type in its note and drops the old `type` from area notes.

## Verify
- [ ] Domains has **Type** (select: Personal, Entrepreneurship, Professional), in that order, with no option shared by two ids; its description starts "Owner: you".
- [ ] Areas has no Type property.
- [ ] Plan's and Archive's Areas views show no warning.
- [ ] After `brain sync`, a domain note whose Domain has a Type holds it in `notion_fields.type`, and no area note holds `notion_fields.type`.
- [ ] `brain-connect-notion`, run again, reports no difference for Domains or Areas.
