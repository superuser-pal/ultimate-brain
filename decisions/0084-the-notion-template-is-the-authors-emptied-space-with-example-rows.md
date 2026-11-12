# 0084 — The Notion template is the author's emptied space with Example rows, and setup removes them when it connects

**Status:** Accepted
**Date:** 2026-11-12
**Release:** 0.14.0
**Amends:** [0078](0078-onboarding-and-early-access-in-0-14-0.md) §1, one sentence: "The template is built in a dedicated Notion workspace holding only the template, never copied from the author's space" (it is now a copy of the author's own Ultimate Brain space, emptied and scrubbed, in the author's one workspace); and 0078's Out of scope, one item: "a synthetic sample meeting in the template" (the template now carries one Example meeting among seven Example rows, removed when setup connects the brain)
**Keeps:** every other rule of 0078: the published template with every module, published with duplication allowed; its link and version kept once in `notion/TEMPLATE.md` with one leak-allow entry; the Start here callout; the Template version line and `notion.template_version`; the two templates named apart; §2 to §6 (the guided setup, seeding, the new-brain defaults, the three-way evidence with CC-193's release gate in a separate test space, early access); its other exclusions

## Context

0078 §1 had the template built in a dedicated Notion workspace holding only the template, so nothing from the author's own space could reach it. U-27 was to make that workspace and build the space there from the prompts in `notion/CHECKLIST.md`.

On 2026-11-12, in the coordinator's session, the user chose otherwise:
- **There is one workspace.** "I am not creating a new workspace." The author has one Notion workspace, and a second one is a second account to keep up for a single page.
- **Building from the prompts is slow.** It takes about fifteen Notion AI prompts, each edited by hand, then the buttons and page layouts by hand. The author's own space already has every part, kept current by every migration since 0.3.0.
- **A copy, emptied, with a few examples.** On copying the author's own space and emptying it: "this is what i am going to do, and have some placeholder examples." An empty duplicate shows a new user fourteen empty databases. A few invented rows show what a filled space looks like: a Project under its Area, a meeting with its minutes, the Task it led to.

The risk is the one 0078 §1 avoided: personal data left in the copy, published to anyone with the link. Rows are the obvious place, but not the only one. A copy also carries database templates, select options, buttons, view filters, mentions, synced blocks and icons, and each can hold a client's or a person's name. The copy is made safe by a scrub list, followed by hand, and a read-only scan by the coordinator before publishing (§2).

The examples bring a second risk: an invented row read into a new user's brain as their own. A brain imports rows created in Notion (0021) and ingests Reviewed meetings, so an Example Project could become a project note and an Example Person a person. Setup removes the examples before anything reads Notion (§3), and the skills that read Notion leave out any that remain (§4).

## Decision

### 1. The template is the author's space, copied and emptied

- The author duplicates their own Ultimate Brain space **inside their one workspace**, empties every database and scrubs every other place personal data hides. The emptied copy is the template.
- It still has **every module** (0078 §1). A part the author's space lacks (a module they never turned on, a migration not yet applied) is added from its module file or migration before publishing.
- The steps are `notion/TEMPLATE.md`'s "Building and updating the template". U-27 follows them the first time.

### 2. Nothing personal is published

- **The scrub list,** done by hand on the copy: every database's rows; each database's templates; select and multi-select options (only the options of `docs/notion-space-design.md` §3 stay); buttons; view filters and sorts that name a person, a page or a value; mentions of people or pages; synced blocks; page and database icons and covers; comments; the workspace's public name and domain as shown on the published page.
- **The coordinator's read-only scan,** before publishing: through the Notion MCP, reading only, it lists every row, every database template, every select option and every mention it can reach in the copy. It flags anything that is not an Example row (§3) or the product's own text. Each finding is fixed by hand, and the scan runs again until it finds nothing. The scan writes nothing in Notion and nothing in this repository except, after a clean scan, the link and the version in `notion/TEMPLATE.md`.
- **What the API can't read** (button contents, view filters) is on the by-hand list only. The author ticks each item before the scan.
- **When a release adds a migration,** the author applies it to the template as to any space, and nothing personal goes in.

### 3. Seven Example rows, removed when setup connects

- **The template carries seven rows**, each titled with the prefix `Example · ` (the word, a space, a middle dot `·`, a space) and obviously invented:
  - one Domain, one Area, one Project, one Person and one Org;
  - one Meeting with short lean minutes (0079), left Not Reviewed;
  - one Task.

  They are related to each other as a filled space would be: the Project under the Area, the Area under the Domain, the Meeting linked to the Project and the Person, the Task to the Project and the Meeting.
- **No other rows:** no Review, Inbox, Decisions or Documents rows (nor Questions, Goals, Key Results or Brain Assistant Skills beyond the skills themselves).
- **Setup removes them at the connect step** (spec/setup.md §2 step 4, §6.5). In a duplicate of the template, once the brain has found the duplicate's databases, the brain-setup skill finds every row on Brain Data whose title starts with `Example · `. It lists them and, on the user's yes, moves them to Notion's trash. This happens before identities, seeding, a sync or an ingest reads Notion. Step 4 is done only when none is left. A row already gone is fine; a re-run removes what is left. Declined, setup stops at step 4, as at any required item.
- **A row the user renamed** so it no longer starts with `Example · ` is the user's own, and is left alone.

### 4. Nothing in the brain is ever made from an Example row

- **A guard in the skills,** for a brain connected before the examples were removed (brain-connect-notion run on its own, an interrupted setup): brain-ingest and brain-catch-up skip a meeting or Inbox row whose title starts with `Example · `, and brain-sync's pull leaves such a row out of the snapshot it gives `brain sync plan`, so no note, source, proposal, Task or report line is made from it. Catch-up's pull is brain-sync's, so it inherits the pull's guard.
- **No CLI change.** The CLI never reads Notion itself; it receives what the skills send.

## Consequences

- [notion/TEMPLATE.md](../notion/TEMPLATE.md): "What a duplicate contains" lists the Example rows; "Building and updating the template" becomes the copy-and-empty procedure with the scrub list and the scan; the dedicated workspace goes.
- [docs/notion-space-design.md](../docs/notion-space-design.md) §10 and [spec/setup.md](../spec/setup.md) (§2 step 4, §3, §4.1, §6.5, §12, §14) say the same. [build/TASKS.md](../build/TASKS.md)'s U-27 rows are reworded.
- In the skills fork, released in brain-v1.8.0 and vendored by CC-212: brain-setup removes the rows at step 4; brain-ingest, brain-catch-up and brain-sync skip them.
- **Follow-up, only if a leftover example ever reaches a brain:** the CLI's `sync plan` ignores a `create` for a row whose title starts with `Example · ` (an `ignored` item with its own reason), specified in spec/cli.md §5.14 first. It is not built now.
- CC-193's release gate is unchanged: it runs in the user's separate test space, reached through its own integration token, and duplicates the published template like any new user.
- 0078 gets a header pointer, `§1 amended by: 0084`, and 0019's pointer gets one line; their bodies stay as recorded.
- No CLI, schema or brain change. Only the author changes Notion, by hand, as U-27.

## Evidence

- The user's answers in the coordinator's session, 2026-11-12: "I am not creating a new workspace"; on copying their own space and emptying it, "this is what i am going to do, and have some placeholder examples"; the seven Example rows and the rows left out; CC-193's test space unchanged.
- The user's step-by-step checklist for U-27, kept in their Notion: the copy, emptying every database, the places personal data hides, the examples, Start here, the Template version line, the coordinator's read-only scan and publishing. `notion/TEMPLATE.md` restates it without personal detail.
- The coordinator's call of 2026-11-12, within the user's choice: setup removes the examples at the connect step; the guard is in the skills only (brain-ingest, brain-catch-up, brain-sync's pull), and a CLI skip is the named follow-up.
- [0078](0078-onboarding-and-early-access-in-0-14-0.md) §1 and Out of scope; [0021](0021-notion-first-creation.md) (rows created in Notion are imported); [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) (the lean minutes).
