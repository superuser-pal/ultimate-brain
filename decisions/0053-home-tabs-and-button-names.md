# 0053 — Home's Areas and Inbox tabs, readable area counts, button names

**Status:** Accepted
**Date:** 2026-10-29
**Amends:** 0048 (button label, page layouts), 0050 (where Home's area lines sit)

## Context
The user ran Notion migration 0010 (release 0.6.0) on their space and filed four `dogfood` issues the same day, triaged with them on 2026-10-29 into CC-68:
- **#143:** the per-area lines and "What's due across areas?" at the top of Home, above its two columns, didn't fit a start-of-day page with navigation and "Needs you" on the left and buttons and tabs on the right. The user moved them into a tab.
- **#144:** each button's property name was its label, so the page layout showed "Keep as document" twice; "Refresh" was awkward as a name, the obvious short names clashed (Report, Documents), and the pinned checkboxes repeated what the buttons say.
- **#145:** "How are my areas?" showed `0 0 0`: a List view hides property names.
- **#146:** "What's in my inbox?" had seven properties and sat on Knowledge, though the user looks for it on Home.

## Decision
### Home's area lines are its first tab (amends 0050)
- **"What's on today?" opens on a tab "Areas"** holding "How are my areas?" (one line per area) and, with Tasks, "What's due across areas?" below it. Nothing sits above Home's two columns.
- 0050's "Home starts with one line per area" becomes: **the first tab Home shows is the areas.** The per-area counts still come before everything due across areas.

### Area counts read as one line (refines 0050)
- **An Areas formula, At a glance,** joins the counts: "4 to review · 1 meeting · 2 due". A count of 0 is left out, a module that is off has no part, and an area with nothing waiting reads "all clear". "How are my areas?" shows Name and At a glance; area pages pin it in the heading.

### The Inbox is a tab on Home
- **"What's in my inbox?" moves to a last tab "Inbox"** of "What's on today?", showing Name, Kind and Brain Status: the New and Ready rows, oldest first. Knowledge keeps "What came in?", the history.

### Button names apart from their labels (amends 0048)
| Property name | Label | Database |
|---|---|---|
| Keep | Keep as document | Inbox |
| Update | **Refresh report** (was Refresh) | Inbox, on Report rows |
| Promote | Promote to document | Decisions, Concepts |
- **The name and the label differ,** so the layout never shows the same text twice, and no name equals or nearly equals another property. The brain reads only the boxes the buttons tick, so a space that names its buttons otherwise works the same.

### What a page layout pins (amends 0048)
- **The boxes a button ticks, and Only keep, are not pinned:** they sit at the top of the property group. Pinned: Inbox Keep, Update, Brain Status, Project, Area; Decisions and Concepts Promote, Lifecycle; Areas Type, At a glance.

## Consequences
- **Notion:** migration 0011, for spaces on 0010; the build prompts, the views guide and the design for new spaces. The button renames in 0011 are optional.
- **The brain:** nothing changes; the CLI reads Document asked, Refresh asked and Promote asked, never a button.
- Built in 0.6.1 (CC-68).

## Evidence
- Issues #143, #144, #145, #146 (closed into CC-68).
- notion/migrations/0011-home-tabs-at-a-glance-button-names.md.
