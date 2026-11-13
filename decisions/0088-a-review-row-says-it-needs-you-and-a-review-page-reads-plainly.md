# 0088 — A Review row says it needs you, and a Review page reads plainly

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.14.0 (§1, CC-239) and 0.15.0 (§2, CC-240 and CC-241)
**Amends:** [0045](0045-review-in-one-row-fix-before-ingest.md) (the words on a Review row: on a row with item sections, About, Now, Proposed and Why are left empty and hidden, and Your call and What to fix leave the row's heading); [0055](0055-domains-capture-and-review.md) ("Review is readable content", from 0.15.0: the guidance beside each item is its plain heading plus one explanation at the top of the page, not a "What Accept does" line per item; *Current* is shown for a change of a fact or a body, not for text appended to a note; the people or aliases added to one note are one item); [0068](0068-projects-from-the-template-review-bodies-by-markdown.md) (from 0.15.0, a pending Review row nobody has touched is rebuilt once as a new page; the markdown write still goes only to a page just created)
**Keeps:** [0003](0003-proposal-review-flow.md) (nothing changes existing knowledge without the user's yes), [0041](0041-review-makes-notes-reviewed.md) (what accepting a new note does), [0051](0051-unattended-catch-up-and-schedules.md) (what an unattended run may apply), 0055's decision words (Accept, Reject, Defer, Request revision), Submit decisions and Submit and accept all, the binding of an acceptance to the exact wording and its base, and the attribution of corrections; [0077](0077-trust-repair-in-0-13-0.md) (every change names its passages, checked at creation and before apply); every rule of `sync plan` and `sync apply`

## Context

On 2026-11-13, in CC-239's session, the user opened a Review row of their brain and reported four problems:
1. **Nothing says a new row needs you.** Your call starts empty and State is hidden, so a fresh row looks the same as one waiting for the brain.
2. **About, Why, Proposed and Now mean nothing to them.** On a row from a source they repeat the page: Proposed says "20 changes: decide each one in the page", About names the source with its id.
3. **Twelve Kinds are too many to learn.** The Type formula already groups them into four, but the guide still teaches a table of ten Kinds.
4. **The page itself is a mess.** One meeting gave 20 sections:
   - a summary of 20 near-identical lines ("<project> — Waiting for your decision");
   - every section repeats its title under its heading and shows its id (`[a · it-6ghrz0nc]`);
   - a text addition quotes "The end of the note now (the text is appended after it):";
   - every change sits in a collapsed toggle;
   - "Why it matters" says "What came in from <source>" on every new note, and "What Accept does" repeats under every section;
   - linking four people to a project gives four full sections, and an alias is labelled "adds the link";
   - "Creates: <name>" doesn't say the new note is a person.

   "Even with the instructions it is not clear what needs to be done."

The user asked for a grill at the highest effort. Its answers (Q1 to Q11) are below. The user confirmed the whole of it with "confirmed" the same day.

The brain's own numbers, counted by kind and status only: 51 rows from a source decided and 29 pending, all 29 with item sections; one merge and one answer in total, both decided; no contradiction, supersede or Suggestion row ever created.

## Decision

### 1. The row and the queue (0.14.0, CC-239)

- **Status (Q1).** Review gets a formula property **Status**, Notion-only, so it moves by itself when the user clicks Submit and the CLI never writes it. In this order:
  - State Applied → **Done**;
  - State Closed → **Closed**;
  - Decided ticked, or Your call set → **Submitted: waiting for the brain**;
  - Proposed empty, or the old pointer "… decide each one in the page" → **Needs you · decide in the page**;
  - otherwise → **Needs you · set Your call**.

  Status comes first in the row's heading and in the Review views. Home's "What's waiting for you?" lists the rows whose Status starts with "Needs you".
- **Type, never Kind (Q3).** Kind stays the brain's own field, hidden in every view and on the page. The user sees **Type**: From source, Conflict, Answer, Suggestion. The guide explains those four in a table of four rows, each with one line on what Accept does. The detailed Kinds reach the user in 0.15.0 only as the plain heading of a section ("New decision", "Adds to", "⚠ Changes a fact").
- **One place to decide on a row with sections (Q2, option B').** On a row with item sections, `sync render` leaves About, Now, Proposed and Why empty, and Notion hides each one when it is empty. **Your call** and **What to fix** leave the row's heading for its property group, where they still serve a Conflict, Answer or Suggestion row and an old row without sections. The heading holds Status, Submit decisions, Submit and accept all and About Page.
- **Where it lands.** These are Notion changes made through migration 0024, plus one CLI change in `sync render`. The published template gets the migration, and the guide's "Deciding in Review" gets the matching text in the skills fork.

### 2. The Review page (0.15.0, CC-240 and CC-241)

A Review page from a meeting, an email or a document reads as follows (Q4):
- **The top:** the Status line, one sentence on what the source brings ("2 changes to what you know, 3 new notes and 3 links"), and what to do. The sentence never suggests accepting: it says what ⚠ marks.
- **The source's own summary note comes first (Q10),** under "What this meeting was about", in its toggle. It is still an item: Accept makes it Reviewed.
- **Then groups:** changes to what you already know, new notes, links.
- **Plain headings with the note type:** "New person: Ana Ortiz", "Adds to Website refresh", "⚠ Launch date on Website refresh: 2027-02 → 2027-03". The item id moves to a gray `ref it-…` line in the section, out of the heading.
- **No repeats:**
  - the title line under the heading goes;
  - the source link appears once at the top;
  - Why appears only when it says something specific;
  - there is no "What Accept does" line per item, since the heading's verb says it and the top explains it once;
  - *Current* stays for a fact or body change only.
- **The summary counts by group** until items are decided ("2 changes, 3 new notes, 3 links waiting"). After decisions it names each outcome, as today.
- **People and aliases (Q5).** One item per note and field: "People on Website refresh: + Ana Ortiz, + Lee Chen". A name the user deletes from the wording is not added; Accept adds the rest. An alias reads "New alias for Ana Ortiz: Anna".
- **Visible wording (Q6).** The wording of a change or a link is shown in the section, between the heading and the `Decision:` line. A new note keeps a toggle, "Read or edit the note", because a summary can run to dozens of lines. Before the parser is built, a round trip on a synthetic Notion page proves the read-back is exact (Q11): the agent writes the page through the API after the user's yes, the user edits it, and the agent reads it back and deletes it.
- **Passage markers (Q7).** A `^[src-…#¶72:55476822]` marker is shown as `[¶72]` and expanded back on read. A short label that matches no marker of that item leaves the item unreadable: it stays Pending and is never applied. Markers are never hidden, because an edit would drop them.
- **Pending rows rebuilt once (Q8).** At the first publish after the upgrade, every pending row with no typed decision, no edited wording and no Submit is rebuilt as a new page in the new format. The old page goes to Notion's trash, and the report names how many. A row the user touched keeps today's format and rules until it is done.

The decision words, the two Submit buttons, the hashes that bind an acceptance to its wording and base, and every apply rule stay as they are.

### 3. Not now: every Review row a page

Turning Conflict, Answer and Suggestion rows into pages with one section each (Q2, option A) would give one way of deciding everywhere. It would also touch the proposal format, the plan, apply and its tests, and Ultimate Assistant, for rows that occur about once a month. It is noted in [docs/v2-ideas.md](../docs/v2-ideas.md), to be revisited when Conflict, Answer or Suggestion rows become common (reflection and Ultimate Assistant would create them).

## Consequences

- **CC-239 (0.14.0):**
  - spec/cli.md §5.14.4, spec/capture-and-review.md §7.1 and spec/schema.md (`notion.review_sections`) say that a row with sections has those four properties empty;
  - `src/lib/sync.ts` renders them null, so a row already published is sent once by `--changed` to clear them;
  - docs/notion-space-design.md §3.10, the build prompts, notion/views-guide.md and notion/brain-assistant.md follow;
  - migration 0024 adds Status and changes the layout and views (nothing renamed or deleted);
  - notion/TEMPLATE.md moves to version 0024, with the Example Review row matching;
  - the guide changes in the fork.
- **CC-240 and CC-241 (0.15.0)** build §2: contract first, then the render, the parser and apply, then the skills, the guide, the template and any migration. They join 0.15.0 next to the weekly review. 0.15.0 stays the feature cutoff.
- **0045's promise line** ("Approving makes these notes trusted …") stays on Review and on Your call's description.
- **0055's legacy rule** (§7.9: rows from before migration 0013 keep Your call and What to fix) still holds.

## Evidence

- The user's report and grill, 2026-11-13, in CC-239's session (this file is its record). The answers:
  - Q1: a Notion-only Status formula;
  - Q2: option B' now, option A later on evidence;
  - Q3: Type only;
  - Q4: all eight points of the page;
  - Q5: one link item per note and field;
  - Q6: visible wording, new notes in a toggle;
  - Q7: short markers;
  - Q8: untouched rows rebuilt once;
  - Q9: split across 0.14.0 and 0.15.0;
  - Q10: the summary first;
  - Q11: an API-written synthetic test page, with a yes asked again.

  The user's confirmation, "confirmed", also dated 2026-11-13.
- The user's brain, counted by proposal kind and status only (no content read): 51 rows from a source decided, 29 pending with sections, one merge and one answer.
- `src/lib/review-body.ts` (the page as rendered today), `src/lib/sync.ts` (the Review properties), docs/notion-space-design.md §3.10 (Kind and the Type formula), spec/capture-and-review.md §7.
