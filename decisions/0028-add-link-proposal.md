# 0028 — `add_link` proposals add a link to an existing note's list

**Status:** Accepted
**Date:** 2026-10-12

## Context
The first ingest acceptance run (CC-06, PR #29) found a new person, Lucía, joining the Acme website project. The ingest could write Lucía's note with `projects: [Acme website]`. It could not add her to the project's own `people` list, and no proposal kind could either: `update_fact` changes `facts`, and `add_to_note` appends body text.

So the project's People in Notion and its brief left her out, and so did any agent reading the project note. The same gap blocks adding an alias to an existing person ("Lucia Fernandez" spelled without accents) and adding an existing person to an existing meeting's attendees.

Options considered:
- **A.** A new proposal kind that adds one value to one list.
- **B.** Let the ingest edit those lists directly.
- **C.** Leave it to the user in Notion.

B breaks decision 0003: existing notes change only through approved proposals. C leaves the brain incomplete until the user does it by hand.

## Decision
Add a proposal kind **`add_link`**. It adds one value to one list field of an existing knowledge note.

- **Fields:**
  - `target`: the note to change;
  - `field`: one of `aliases`, `tags`, `projects`, `people`, `attendees`, `deciders`, and only a field the target's type declares;
  - `after`: the value to add. For `projects`, `people`, `attendees` and `deciders`, an existing note id with the matching prefix. For `aliases` and `tags`, a string.
- **Proposing:** when `after` is already in the list, `proposal new` skips the item with reason `ALREADY_LINKED`, so a re-run after approval does nothing.
- **Approving:** appends `after` to `target.<field>`, unless it is already there. `updated` is set to today.
- **Rejecting:** changes nothing.
- **Editing is not allowed** (approve or reject only), like `supersede`, `merge` and `new_item`.
- **Write set:** the target only.
- **In Notion:** the Review Kind select gets the option **Add Link**. Before is empty. After reads `<Field>: <value>`, with a note id rendered as its title (`People: Lucía Fernández`).

Relations (`about`, `related_to`, …) and the persisted pairs (a meeting's `decisions`/`questions`, `supersedes`/`superseded_by`) are out of scope. Pairs have their own kinds (`new_item`, `supersede`). Relations stay a v2 question.

## Consequences
- **One more Review row per new link.** It's small and reviewed like any other change.
- **The ingest skill proposes `add_link`** when a meeting links an existing note to another existing or new note (CC-06 follow-up).
- **The CLI** (`proposal new`, `apply`, `sync render`) needs to implement the kind (Codex). The Notion Review database needs the new select option (Prompt 2 for new spaces; added by hand in existing ones).

## Evidence
PR #29, acceptance run: the Lucía case. Decision 0003 (proposal review flow). spec/schema.md §11.
