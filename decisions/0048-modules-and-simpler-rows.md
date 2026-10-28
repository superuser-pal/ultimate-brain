# 0048 — Modules, simpler rows and buttons

**Status:** Proposed
**Date:** 2026-10-28
**Amends:** 0043, 0045
**Refines:** 0037, 0041

## Context
U-18 put 0.5.0 in the first brain on 2026-10-26 to 2026-10-28. Two of its four checks passed (a meeting re-read, a report refresh); the user didn't get to Fix, and Keep failed: a document attached to an Inbox row was taken in with Keep empty, so no `reference` note was written and the user couldn't find the document anywhere in Notion (decision 0049).

Looking back over the session, the user found the process too complex, and too tailored to their own needs, for another user to adopt:
- **Too many fields and states on a row.** An Inbox row has Brain Status (New, Ready, Processed, Skipped), seven Kinds, Keep, Full text, Refresh, Refresh report and What to fix, plus a hidden rule that a capture still New after a day is taken in anyway. A Review row can be one of ten Kinds.
- **Too many databases.** A new space has 14, whether or not the user plans goals, keeps documents or asks for reports.
- **Actions are checkboxes** (Full text, Refresh) mixed in with the other properties, so nothing on a row says what you can ask the brain to do.

The user's other U-18 findings (a placeholder written to Notion, a pull that skipped databases, a re-read correction added next to the old wording, a Kind the brain overwrote, a snapshot format the agent had to retry) are bugs, fixed in the 0.6.0 tasks.

The user decided each point in a grill on 2026-10-28. The audience stays v1's: a solo knowledge worker who already uses Claude Code or Codex and is fine with a terminal and git. The aim is less to learn, with nothing taken away.

## Decision
### Modules (0.6.0)
- **The space is a core plus optional modules.** Each module is a set of databases and the skill steps that use them:

  | Module | Databases | Default |
  |---|---|---|
  | **Core** | Inbox, Meetings, Projects, Areas, People, Review | always on |
  | **Knowledge** | Decisions, Questions, Concepts | on |
  | **Orgs** | Orgs | on |
  | **Documents** | Documents (0049) | off |
  | **Reports** | Ask and Report rows on the Inbox | off |
  | **Tasks** | Tasks, or the user's own tasks database | off |
  | **Planning** | Goals, Key Results | off |

- **Onboarding shows one checklist** before it builds anything, with each module's one-line purpose and "You can change this any time". The Notion build creates only what is ticked.
- **The user can change it later by asking the agent,** in Claude Code or Codex: "turn on documents", "I don't use goals, turn planning off". A skill handles it, with a CLI command underneath that lists and switches modules (`brain modules`), and `brain.json` records them in one block (`"modules": { "knowledge": true, "documents": false, … }`).
- **Turning a module on** runs its Notion steps with the user, like a migration: a Notion AI prompt for each database to create, the buttons and layouts by hand, then the config line. From then on, catch-ups use it.
- **Turning a module off** makes the brain stop reading and writing its databases, so catch-ups read less and cost fewer tokens. **Nothing is deleted:** the notes stay in Git and the Notion databases stay where they are. The agent says which views the user may hide. Turning it back on picks up where it left off.
- **The first brain keeps every module on.** Nothing changes for it beyond the rest of this decision.

### One rule for the Inbox (0.6.0; amends 0045)
- **Brain Status has three values: New → Ready → Done.** Processed becomes Done. A row the brain skips (a duplicate, say) also becomes Done, and its Summary says why ("Skipped: same as <source>"). Skipped is retired.
- **The brain takes in only Ready rows.** The rule that a capture still New after a day is taken in anyway (0045) is dropped.
- **Quick capture creates its row as Ready,** so the habit path is still one click. A row the user creates by hand starts as New.
- **The brain writes Kind only when it is empty.** A Kind the user chose is never overwritten. The Kind "Document" is renamed **File** (0049).
- **Refresh report is dropped.** An Ask row is always a new report; the Refresh button on a Report row (below) refreshes it. What to fix on a Report row stays.
- **Full text and Keep are replaced** by "Keep as document" and "Only keep" (0049).

### Three kinds of Review row (0.6.0; refines 0041 and 0045)
- **The user sees three kinds of row:**
  - **From <source>:** everything one input brings, lettered (0045);
  - **Conflict:** two sources disagree, a newer decision replaces an older one, or a possible duplicate;
  - **Answer:** new material answers an open question.
- **The brain's Kinds stay in the brain** (spec/schema.md §11) and in the Kind property, hidden from the user's views. The row's Name says which of the three it is.
- Your call (Approve, Reject, Fix) and What to fix don't change.

### Buttons for every action (0.6.0)
- **Every action the user asks of the brain is a Notion button** on the row, pinned at the top of the page. The button ticks a checkbox on the same row; the API sees the checkbox, not the click. The checkbox stays visible next to the button and reads as "waiting for the brain". The brain unticks it once it has acted.
- **The buttons:**

  | Button | On | Ticks | Also |
  |---|---|---|---|
  | **Keep as document** | Inbox rows | Keep as document | sets Brain Status to Ready |
  | **Refresh** | Report rows | Refresh | — |
  | **Promote to document** | Decisions, Concepts | Promote | — (0049) |

- Archived and Done (a milestone) stay checkboxes: they describe a state, not a request.

### Page layouts (0.6.0)
- **One rule for each database's page layout:** what the user acts on is pinned at the top; what the brain wrote comes next; system fields (Brain ID, Last Synced, State, the Review Kind, the action checkboxes once ticked) are collapsed.
- **The pinned properties:**
  - Inbox: the buttons, Brain Status, Project, Area, Only keep;
  - Review: Your call, What to fix, About Page;
  - Decisions and Concepts: Promote to document, Lifecycle;
  - Documents: Lifecycle, Project, Area, Sources.
- **The migration lists every layout change and every button as a by-hand step,** database by database: the API can't edit page layouts or create buttons.

## Consequences
- **Amends 0045:** the 1-day rule for captures is gone; Brain Status loses Skipped and renames Processed to Done; the Ask row's Refresh relation is dropped; Keep becomes Only keep (0049).
- **Amends 0043:** the Full text box is gone (0049); rows that already carry a Full text section keep it.
- **Refines 0037:** Quick capture rows start Ready; the brain writes an Inbox row's Kind only when it is empty.
- **Refines 0041 and 0045:** Review shows three kinds of row; the Kinds remain the CLI's and the spec's.
- **New:** the module list and its config block, the `brain modules` command, a skill that switches modules on request, buttons with their checkboxes, and the page-layout rule.
- **Notion:** one migration, 0010, for 0.6.0, together with decisions 0049 and 0050.

## Evidence
- U-18, 2026-10-26 to 2026-10-28: the user's session in the first brain (the catch-up reports and the user's questions about where the document went).
- The grill of 2026-10-28.
- docs/notion-space-design.md §3; spec/schema.md §11.
