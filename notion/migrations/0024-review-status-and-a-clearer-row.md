# 0024 · Review says what a row needs: the Status formula, Kind out of sight, a clearer row heading

**Design change:** decision [0088](../../decisions/0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md) §1; CC-239 (release 0.14.0; docs/notion-space-design.md §3.10; spec/capture-and-review.md §7.1; spec/cli.md §5.14.4). **Applies to:** every space built or migrated before 0.14.0, the template's copy included. A step already done changes nothing, so running this again is safe.

**What changes:**
- **Every Review row shows a Status**, first in its heading and in the Review views. Its values:
  - **Needs you · decide in the page:** a row from a meeting, email or document. You type a decision on each change, then click Submit decisions.
  - **Needs you · set Your call:** a Conflict, Answer or Suggestion row, or a row from before 0.8.0.
  - **Submitted: waiting for the brain.**
  - **Done**, or **Closed**.

  Status is a formula, so it changes by itself when you click Submit. The brain never writes it.
- **Kind leaves every view and the page.** Type says the kind of row.
- **A row from a source stops repeating its page.** From 0.14.0 the brain leaves About, Now, Proposed and Why empty on such a row, and the layout hides each of them while it is empty.
- **Your call and What to fix move.** They leave the heading for the first group of the property panel, Your decision, where they still decide a Conflict, Answer or Suggestion row. The other properties follow in three more groups: What's proposed, Where it comes from, Submitted.

Nothing is renamed or deleted, and no Review row changes its content. A row the brain already published with About, Now, Proposed and Why filled gets them cleared at the next publish after the upgrade.

Run this migration after `brain upgrade` has put 0.14.0 in place. The order of the steps doesn't matter.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, with your yes;
- **Notion AI:** you paste a prompt;
- **by hand:** you, in Notion. The API can't edit a page layout or a view's columns, and it can ignore a write while still answering 200, so always read the result back.

## 1 · Review · Status (agent)

Read the Review data source first:
- **Status already exists as a formula:** replace its expression with the one below. Keep its name.
- **Status is missing:** add a formula property **Status** with the expression below, and the description `Owner: Notion (a formula). What this row needs: decide in the page, set Your call, or nothing (submitted, done or closed). The brain never writes it.`
- **A property named Status exists that isn't a formula:** change nothing, report it, and ask the user.

```text
if(prop("State") == "Applied", "Done",
  if(prop("State") == "Closed", "Closed",
    if(or(prop("Decided"), not(empty(prop("Your call")))), "Submitted: waiting for the brain",
      if(or(empty(prop("Proposed")), contains(prop("Proposed"), "decide each one in the page")), "Needs you · decide in the page",
        "Needs you · set Your call"))))
```

Read it back afterwards: the expression contains `"Needs you · decide in the page"`.
- The expression needs **Decided** (migration 0013). If the space doesn't have it, stop and run 0013 first.
- **The API refuses the expression, or reads it back unchanged:** do it by hand. Open Review → **+** → **Formula**, name it `Status` and paste the expression above (in Notion's formula editor, `not(...)` may show as `!`, which is the same).

The `"decide each one in the page"` test catches a row with sections published before 0.14.0, whose Proposed held that pointer until the next publish cleared it.

## 2 · Review · descriptions (agent)

Set these property descriptions. Read each one back afterwards.
- **About, Now, Proposed, Why:** `Owner: brain. Filled on a Conflict, Answer or Suggestion row. Empty on a row from a meeting, email or document: its page holds each change.`
- **Your call:** `Owner: you. Decide a Conflict, Answer or Suggestion row here: Approve, Reject, or Fix with what's wrong in What to fix. On a row from a meeting, email or document, decide each change in the page and click Submit decisions; Approve or Reject here is a shortcut for the whole row.`

## 3 · The Review row's layout (by hand)

Open any Review row → **⋯** → **Customize layout**:
- **Heading:** **Status**, **Submit**, **Submit all**, **About Page**, in that order.
- **Property panel,** in four groups, in this order:
  1. **Your decision:** **Your call**, **What to fix**.
  2. **What's proposed:** **About**, **Now**, **Proposed**, **Why**. Set each of these four to **Hide when empty**. On a row from a meeting, email or document all four are empty, so the whole group disappears.
  3. **Where it comes from:** Type, Area, Source Meeting.
  4. **Submitted:** Decided, Decided at, Accept all. Collapse this group if Notion lets you.

  Where Notion's layout editor has no groups, keep the same order without the headings.
- **Hidden:** Kind, State, Brain ID, Created time, Last edited time. Leave anything else as it is.

## 4 · Review views, Home and the area homes (Notion AI)

Paste on the **Review** page:

```text
Use only the databases on Brain Data. On this page ("Review"):
1. Replace the text of the gray paragraph above the tabs with exactly: "Approving makes these notes trusted: they appear in your Briefs and answers. Until then, the brain treats them as unconfirmed. Status says what each row needs. Needs you · decide in the page: open the row, type your decision on each change's Decision line and click Submit decisions. Needs you · set Your call: pick Approve or Reject, or Fix and say what's wrong in What to fix." Keep it gray.
2. In the view "What needs my decision?", show exactly Status, Name, Type, Your call, Area, in that order. Keep its filter and sort.
3. In the view "Where do sources disagree?", show exactly Status, Name, Now, Proposed, Your call, in that order. Keep its filter and sort.
4. In every view on this page, hide the property Kind. Where Status is shown, it comes first.
Change nothing else.
```

Then paste on the **Home** page:

```text
Use only the databases on Brain Data. On this page ("Home"), in the linked view "What's waiting for you?" of Review: replace the filter "State is Pending" with "Status starts with Needs you", keep the grouping by Type and the sort, and show exactly Status, Name, in that order. Change nothing else.
```

Last, on each **Area** page, and in the Areas default template (Areas → **New** ▾ → the default template's **⋯** → **Edit**): in the "Review waiting" tab, show exactly **Status**, **Name**, and keep its filter, grouping and sort. Notion AI can do this one page at a time, with the same kind of prompt. Doing it by hand in the template is enough for new areas.

**By hand, without Notion AI:** each view's **⋯** → **Properties** (to show and order columns) and **Filter**. For the gray line, click it and type the new text.

## 5 · Brain Assistant's skills (by hand)

Open the agent. [../brain-assistant.md](../brain-assistant.md) has the texts. In its **Skills** database, replace the bodies of these two skills with the blocks under their headings:
- **Today:** it counts the rows whose Status starts with "Needs you";
- **Review queue:** it reads a row's page when Status says "decide in the page", and explains each row by Type, not Kind.

Keep **Use automatically** on. The Instructions and the other skills don't change.

## 6 · How it works (by hand)

Replace the text of **How it works** with `brain-howto/references/guide.md` as it is in the skills release that ships with 0.14.0. Its "Deciding in Review" section now explains Status and a table of four Types.

## 7 · Template version (by hand, or the agent)

If the System callout on your top page reads `Template version: …` with a lower number, change it to `Template version: 0024`. A space without that line has nothing to change.

## What this migration doesn't do

- **No new decision word and no change to how decisions are applied.** Accept, Reject, Defer, Request revision, the two Submit buttons, Your call and What to fix all work as before.
- **No rewrite of a Review page.** The page body of a row from a source gets its new look in 0.15.0 (decision 0088 §2).
- **No brain edit by hand.** The next publish clears About, Now, Proposed and Why on rows with sections by itself (spec/cli.md §5.14.4).

## Verify

- [ ] Review has a formula **Status**. On a test row (State Pending, Kind Review Notes, Proposed empty), it reads **Needs you · decide in the page**. Then:
  - type `1 change: decide each one in the page` in Proposed: still **Needs you · decide in the page**;
  - type `2027-03` in Proposed: **Needs you · set Your call**;
  - set Your call to Approve: **Submitted: waiting for the brain**;
  - clear Your call and tick Decided: still **Submitted: waiting for the brain**;
  - set State to Applied: **Done**; to Closed: **Closed**.

  Delete the test row afterwards.
- [ ] No Review view shows Kind, and no row's page shows it outside **Show all properties**. "What needs my decision?" and "Where do sources disagree?" show Status first.
- [ ] A Review row's heading reads Status, Submit decisions, Submit and accept all, About Page. The property panel shows Your decision (Your call, What to fix), What's proposed (About, Now, Proposed, Why), Where it comes from (Type, Area, Source Meeting) and Submitted (Decided, Decided at, Accept all), in that order; without groups, the same order.
- [ ] On a row from a source, after the next publish, About, Now, Proposed and Why don't show. On a Conflict or Answer row, the ones with a value still show.
- [ ] Home's "What's waiting for you?" lists only rows whose Status starts with "Needs you". A row you submit leaves it.
- [ ] `/Today` and `/Review queue` talk about Status and Type, never Kind.
