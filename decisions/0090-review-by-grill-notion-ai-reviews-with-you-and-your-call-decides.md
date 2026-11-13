# 0090 — Review by grill: Notion AI reviews a page with you, and Your call decides

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.15.0 (CC-240 and CC-241, rescoped; recorded by CC-248)
**Amends:** [0054](0054-brain-assistant-buttons.md) (Brain Assistant may write into a Review page, in its sections only, after the user's yes); [0088](0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md) §2 (the page gains a brain-context toggle and a "Review with me" button; headings are derived and never read; Your call, not the Submit buttons, submits a page); [0055](0055-domains-capture-and-review.md) (on a row with item sections, a row-level Approve submits the page as it reads, and Request revision with What to fix asks for redrafts)
**Keeps:** [0003](0003-proposal-review-flow.md) (nothing changes existing knowledge without the user's yes); [0035](0035-notion-ai-prompts-read-only.md) (Brain Assistant never decides what enters Git); [0041](0041-review-makes-notes-reviewed.md); [0051](0051-unattended-catch-up-and-schedules.md) (an unattended run never reads revision text and never runs Notion AI); [0077](0077-trust-repair-in-0-13-0.md) (every change names its passages, checked at creation and before apply); 0055's decision words, the hashes that bind an acceptance to its wording and base, and the attribution of corrections; 0088 §1 and the rest of 0088 §2 (grouping, plain headings, `ref` lines, visible wording, short markers, the one rebuild of untouched rows)

## Context

On 2026-11-13, after 0088, the author tested a Review page in their brain and found it still unclear to a first-time user: what to read, what to change, how to ask for a change. They proposed that Notion AI, a prerequisite for early access (0078), reviews the page with the user instead: the brain writes context for the AI into the page, the AI grills the user, writes the agreed result into the page, and the user decides with Your call.

Two rounds of evidence, on synthetic data:
1. **Simulated first-time readers** (three fresh agents, one per version of the page, and a fourth playing Brain Assistant). The 0088 page with a three-step guide scored better than today's page on what to read (4 against 2 out of 5). Every version scored worst on how to ask for a change. Every reader asked the same three things: does Reject leave a field empty, does accepting everything accept a ⚠ change, when does a redraft come back. A walkthrough by the assistant changed no decision, found a Notion-only conflict nobody else saw, and was called partly speculative. One reader: "If the AI could spot the mismatch, why did the page propose 11?"
2. **A live run in the author's test space** (Test Brain Data, Example rows only). A Review row with five items and a planted error (a pilot figure of 11 where the decision says 9, flagged by the brain as unsure), a task that only Notion knows about, and one decision recorded three times. The author ran a draft "Grill review" skill in Brain Assistant. Read back through the API, the page kept every `ref` line, every `Decision:` and `Revision request:` line, both toggles and every `[¶n]` marker, and no property changed. The run cost 3 Notion AI credits. Four problems:
   - the value became 9 but kept the marker `[¶1]`, a passage that says 11: the skill's rule "keep every marker exactly" produced a wrong citation;
   - the AI changed the heading (→ 11 to → 9) against its rules, because the rule made no sense once the value changed;
   - Your call Approve on an edited page is refused today (`EDITED_PROPOSED_NEEDS_SUBMIT`, capture-and-review §7.9);
   - nothing on the page records what was agreed in the chat.

   The author's observation on the grill: one question at a time makes a long page a long process; three to five questions per round are fine, and each question must give options with the recommended one.

The author accepted the decision below and the roadmap change on 2026-11-13, on the condition that every problem found is addressed or mitigated (the table in Consequences).

## Decision

### 1. The flow
1. **The brain writes the page** as 0088 §2 describes, plus a brain-context toggle (§2) and a **Review with me** button that sends Brain Assistant a message naming the page (0054's button pattern).
2. **Brain Assistant runs the Grill review skill** (§3): it reads the page, the toggle and the related Notion pages, and grills the user in rounds.
3. **It shows what it will write, asks for a yes, then writes** into the item sections only (§4).
4. **The user reads the page and sets Your call** (§5). Nothing is applied before that.

A user without Notion AI decides the same page by hand: edit the wording, type the `Decision:` lines, set Your call. The guide says so.

### 2. What the brain writes for the AI
A toggle **"For Brain Assistant (brain context)"** at the end of the page, written by `render`, never read back as wording, rebuilt on every render:
- **Source passages:** each `[¶n]` the page cites, with its text.
- **What each item changes:** the target, its current value or the end of its body, what Accept does.
- **Where the brain is unsure**, written at ingest (§6).
- **Repeats:** items that record the same fact or decision ("a, b and c record the 17 November decision").
- **Related pages:** the source, the project or area, the meeting, as page mentions; the page's relations (Area, Source Meeting) stay as they are.
- **The rules** for what may be written into the page (§4), repeated so the AI has them in the page it reads.

### 3. The grill
- **Rounds of three to five questions,** most important first, never one question per message. A page with more to ask gets more rounds; the user can say "enough" or "write it" at any point.
- **Each question gives options and marks the recommended one,** with one line on why: "The pilot figure: (a) 9, the starting depots, ¶4 — recommended, it matches the decision; (b) 11, the candidates, ¶1; (c) leave it empty." The user answers with letters or their own words.
- **What it asks about,** in this order: every point under "Where the brain is unsure"; any section whose text doesn't match its passages (both quoted); anything in the related Notion pages that the change would make wrong or out of date, said to come from Notion and not from the source; repeats (keep all, or drop some).
- **It never asks about something the page and the passages settle,** and never recommends Approve for the whole row.

### 4. What the AI may write, and how the brain reads it back
After the user's yes, and only in item sections:
- **The wording** of a section, the **`Decision:` line** (Accept, Reject or Defer) and the **`Revision request:` line**.
- **A marker change,** only to another passage listed in the toggle for that page, when the wording changed and the new text rests on that passage. It never invents a marker.
- **One line `Agreed in review: …`** under a section it changed, saying what the user decided and why, in a few words.

Never: a heading, a `ref` line, either toggle's structure, the brain-context toggle, any property, Your call.

The brain's read-back (`sync plan`), on top of today's rules:
- **Headings are derived and never read.** The parser finds each item by its `ref` line; `render` rebuilds headings from the item's state, so a heading the AI or the user edited changes nothing.
- **`Agreed in review:` lines are not wording.** They are excluded from the hashed text and stored with the item's decision (`item_decisions`), so the reason for a correction stays in Git.
- **Markers:** a marker must be one of the item's listed passages, as today (0077). **New for a fact change** (an `update_fact` item, whatever its value's type): the value must appear in one of the passages its markers cite, matched by type:
  - a number, as digits or as words ("9", "nine");
  - a date, in any form that names the same day, month or year at the value's precision ("2027-03", "March 2027");
  - a name, the value or one of the target note's aliases, ignoring case;
  - a status or any other select value, the option's name, ignoring case;
  - any other value, its exact text, ignoring case and surrounding punctuation.

  If it doesn't, the item is held: it stays Pending, is never applied, Approve leaves it (§5), and the page and the report show the reason `VALUE_NOT_IN_PASSAGE` with, when another listed passage holds the value, its label ("¶4 says 9"). The live run's `9 [¶1]` would be held until the marker is ¶4 or the user removes the change.
- Anything else outside the rules (a missing `ref` line, a broken `Decision:` line, an unknown marker) keeps today's outcome: the item is unreadable, stays Pending, and is shown, never applied by interpretation.

### 5. Your call decides a page (amends 0055 and capture-and-review §7.3, §7.9)
On a row with item sections:
- **Approve** submits the page as it reads now: each item's `Decision:` line is its decision, and an item still on Pending is read as Accept (as Submit and accept all does today), **except** a ⚠ fact change or an item with an unsure flag: those are accepted only by an explicit `Decision: Accept`, so Approve leaves them Pending and the row keeps needing the user. Items not eligible (a requested revision, a changed base, held, unreadable) are not applied either. The report names every item Approve left, and why. Edited wording no longer blocks Approve: `EDITED_PROPOSED_NEEDS_SUBMIT` is retired for these rows.
- **Request revision** with What to fix asks for redrafts: the next **attended** run drafts what What to fix asks for, item by item, as §7.8's revisions, and sets Your call back to empty so the row needs the user again. Request revision without What to fix is the conflict `REVISION_WITHOUT_TEXT`. `ROW_REVISION_NOT_SUPPORTED` is retired for these rows.
- **Reject** rejects every item still on Pending; an item with an explicit `Decision:` keeps it. Rejecting changes nothing in the brain: a rejected fact change leaves the field as it is now (an empty field stays empty), a rejected addition or link is not made, and a rejected new note is archived (0041).
- **What the guide and the grill's preview say,** in these words or close: "Reject leaves the note as it is now. Approve accepts what's still Pending, except ⚠ changes and flagged items, which need Accept on their line. A redraft you ask for comes back on this page after your next catch-up, and the row needs you again."
- **The submission time** is the row's last edit, as for a row-level call today, with 0058's click-minute limit stated in the guide.
- **The Submit decisions and Submit and accept all buttons leave the Review layout** (a migration hides them; the properties Decided, Decided at and Accept all stay, unused for new rows, so rows already submitted with them still apply).
- **Rows rendered before this change** keep their rules until they are done (0088's rule for touched rows).

### 6. Unsure flags at ingest
When the brain proposes an item, it writes "Where the brain is unsure" for:
- **two passages of the source giving different values** for what the item sets (a number, a date, a name, a status);
- **a value the brain chose between readings** (a candidate count against a starting count, a suggestion against a decision);
- **a person or project it matched by name only.**

The flag names both passages and the reading it chose. A page with no flag says "Nothing flagged". Deterministic checks (two numbers for one field) are in the CLI; the readings are the ingest skill's, and say so.

### 7. Not now: review claims instead of edits
The live run's page still asked about one decision three times (a fact, a body addition, a new decision note). Extracting claims and deriving the edits from the accepted claims would remove the repeats at their source, and touches the proposal format, ingest, apply and every skill that reads proposals. Here the brain marks repeats (§2) and the grill asks about them (§3). It goes to docs/v2-ideas.md, to revisit if repeats stay common after 0.15.0.

## Consequences

Every problem found, and how this decision handles it:

| Problem | Where it was found | Handled by | Status |
|---|---|---|---|
| A first-time user doesn't know what to read, change or how to ask | the author; round 1 | the grill asks, the user answers in words; the top of the page says what to do in three steps | addressed |
| Readers can't find where to ask for a change | round 1, every version | asking is the conversation; Request revision with What to fix on the row; the `Revision request:` line stays visible under each item | addressed |
| Does Reject empty a field, does accepting all accept ⚠, when does a redraft come back | round 1, every reader | §5 states all three (Reject leaves the note as it is; Approve never accepts a ⚠ or flagged item still on Pending; a redraft comes back after the next attended catch-up); the grill's preview and the guide say it in those words | addressed |
| The page proposed an error the brain could have caught | round 1, reader C | unsure flags at ingest (§6), and the grill asks about each first | mitigated: only flagged kinds are caught |
| The same decision appears in several items | both rounds | repeats marked in the toggle, asked in the grill | mitigated: the root cause is §7, not now |
| The assistant speculates or adds Notion content | round 1, reader C | Notion items are named as Notion-only and enter only with the user's yes, attributed to them | mitigated: rule in the skill, not checkable by the CLI |
| A corrected value kept a wrong citation (`9 [¶1]`) | live run | marker change limited to listed passages; `VALUE_NOT_IN_PASSAGE` holds a fact whose value isn't in its cited passage | addressed for facts; for prose, the 0077 marker check plus the skill rule (mitigated) |
| The AI edited a heading | live run | headings derived and never read | addressed |
| Your call Approve refused on an edited page | live run, by the contract | §5 | addressed |
| The grill leaves no record | live run | `Agreed in review:` line, stored with the decision | addressed |
| One question at a time is too long | the author | rounds of three to five | addressed |
| Questions without choices | the author | options with the recommended one marked | addressed |
| Credits | live run: 3 credits, five items | measured again on a twenty-item synthetic page in CC-241's acceptance and written in the guide | measured; no limit set |
| The AI writes outside its zones or sets Your call | risk | the parser holds anything off-format; only the user sets Your call (skill and instructions) | mitigated: Notion can't tell who set a property |
| No Notion AI | risk | the page can be decided by hand | addressed |

- **Roadmap (the author's yes, 2026-11-13).** 0.15.0 keeps its scope and gains this one; still the feature cutoff. CC-240 adds the toggle, derived headings, the read-back rules and §5 to its contract and CLI work; CC-241 adds the Grill review skill, the button, the migration and the guide. 0088 §2's page stays: the user still reads it before Your call.
- **Spec:** capture-and-review §7.1 to §7.4 (with §7.3's Precedence paragraph, which today refuses a row-level Approve after an edited Proposed, and §7.3's click-minute text), §7.8 (a revision is read after a Submit today; from here also from Your call's Request revision) and §7.9; cli.md §5.14.2 to §5.14.4 (the conflicts retired and added); schema.md §11 (`item_decisions` gains the agreed line; the unsure flags in the proposal file).
- **Notion:** a migration for the button, the Submit buttons hidden, Your call's description; Brain Assistant's Instructions gain the one exception for Grill review; notion/brain-assistant.md gains the skill.
- **Skills fork:** brain-ingest writes the unsure flags and repeats; brain-apply and brain-catch-up read §5; the guide's "Deciding in Review" describes the grill and the hand path.
- **Not changed:** what an unattended run may apply (0051); the hashes, base checks and eligibility (0077); Conflict, Answer and Suggestion rows (0088 §3).

## Evidence

- The author's test and grill notes, 2026-11-13, in CC-248's session: the Review page of a test brain, the proposal to let Notion AI grill, and the answers recorded here (Your call instead of Submit, rounds of three to five, options with a recommendation, a test before deciding).
- Round 1: four fresh sub-agents on a synthetic scenario (Example · Courier App 3), with today's page, the 0088 page with a guide, and that page with the assistant's walkthrough.
- CC-193's release-gate run 1 (on its branch, `eval/setup-0.14/RESULTS.md`, finding 5): a first-time tester decided Review rows with a row-level Approve and asked whether to decide "in the property or in the body".
- The live run: Test Brain Data, a Review row "Example · From Depot survey (grill test)" written through the API after the author's yes, the draft Grill review skill run by the author in Brain Assistant, the page read back through the API; 3 credits reported by the author.
- src/lib/review-plan.ts (`ROW_REVISION_NOT_SUPPORTED`, `EDITED_PROPOSED_NEEDS_SUBMIT`); spec/capture-and-review.md §7; decisions 0054, 0055, 0077, 0088.
