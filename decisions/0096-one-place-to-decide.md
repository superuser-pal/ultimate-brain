# 0096 — One place to decide: conflicts are settled in the session, and the Review database goes

**Status:** Accepted
**Date:** 2026-11-15
**Release:** 0.16.0
**Amends:** [0003](0003-proposal-review-flow.md) (where proposals are decided, and which changes to existing notes need a yes); [0028](0028-add-link-proposal.md) (a link is added directly); [0041](0041-review-makes-notes-reviewed.md) (how a new note becomes `reviewed`, and where an answer is accepted); [0045](0045-review-in-one-row-fix-before-ingest.md) (Review rows, Fix and What to fix); [0051](0051-unattended-catch-up-and-schedules.md) (what an unattended run takes in and leaves for the user); [0055](0055-domains-capture-and-review.md) (editable Review); [0072](0072-ultimate-assistant.md) (Review rows as the assistant's way to change things when no one is there); [0075](0075-weekly-review-and-targeted-corrections.md) §1, §2 and §5 (where the weekly review lives and where its decisions are made); [0093](0093-the-0-15-0-scope-grill.md) §2 and §3 (Weekly review in Notion decides nothing; the Reports offer); [0061](0061-roadmap-and-launch-boundary.md) (a 0.16.0 before 1.0.0)
**Supersedes:** [0088](0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md), [0090](0090-review-by-grill-notion-ai-reviews-with-you-and-your-call-decides.md), [0094](0094-the-review-button-reads-grill-me.md)
**Keeps:** Markdown and Git as canonical, Notion as the human interface; `_proposals/` as the store of proposals; [0077](0077-trust-repair-in-0-13-0.md) (every change names its passages, checked at creation and before apply); [0012](0012-meeting-minutes-reviewed-before-ingest.md) and 0055's selection (minutes are reviewed and confirmed before ingest); [0023](0023-notion-edits-as-user-corrections.md) and [0070](0070-lifecycle-only-where-the-brain-creates-the-row.md) (your edits in Notion are your corrections); [0058](0058-acceptance-is-current-as-of-the-click-minute.md) (a Document's accepted wording); 0075's limits; 0.15.0 as the feature cutoff
**Amended by:** [0098](0098-agree-by-subject-and-check-a-changed-document.md) (2026-11-16; 0.16.0): an attended ingest goes by subject; each part shows what the brain has on it, then what is added, then its questions, then its yes (§2 and §5)
**Amended by:** [0099](0099-notion-without-decisions-and-questions.md) (2026-11-16; 0.16.0): 0.16.0 also removes the Decisions and Questions databases, in the same migration, skills release and template
**Amended by:** [0101](0101-where-notion-ai-and-the-brain-each-write.md) (2026-11-16; 0.16.0): corrections from Notion and a tracked question's finished task are asked in the session too (§4, §6); from 1.0.0 a scheduled run may write a meeting's minutes from its transcript, which takes nothing in (§8.3)
**Amended by:** [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) (2026-11-20; 0.17.0): §4: the weekly run also applies mechanical, reversible clean-up alone; §7: the row's Actions and Clean-up are decided by ticks in Notion and applied by a catch-up once the row is Ready; other decisions stay in the session

## Context

Since 0003, a change to existing knowledge is a proposal, published as a row in a Notion **Review** database. The user decides it there, and the next catch-up applies it. The flow has been rewritten twice: once in 0045 (one row per review, Fix before ingest), then in 0088, 0090 and 0094 (a readable page, a grill by Notion AI, Your call). On 2026-11-15 the author still found it tiring and asked why a conflict found at ingest isn't settled in the same Claude Code or Codex session, before anything goes in.

The grill that day (Q1 to Q13) established:
- **What is tiring:** mainly the round trip (catch-up, then Notion, then another run to apply) and switching between the terminal and Notion; partly the number of items (repeats, false conflicts, trivial changes approved anyway). Fewer items must not cost the user's confidence that the brain's context is right.
- **0003 already allows deciding in chat** when the user is present, and `brain-apply` has a chat mode, used today when a brain has no Review database. The decisions are files in `_proposals/`; the Review rows show them.
- **What only the Review database did:** scheduled catch-up, the weekly review, reflection and the checks after a correction make proposals with no one present. Approving a Review notes row made new notes `reviewed` (0041), and Briefs list only reviewed decisions and questions. Grill me let the user decide from Notion, including on a phone.
- **Early access requires Claude Code and `gh`** (0086), so every tester has a terminal. 0.15.1 prepared the friends-and-family beta, and the published template has the Review database. No tester has been invited.

The author chose the recommended option in each question, and wrote one refinement in Q1.

## Decision

### 1. You decide in the session
Proposals are decided in chat, in Claude Code or Codex. Notion is where you read the brain, not where you decide what enters it. *(Q5)*

### 2. An attended ingest settles its conflicts before it ends
- The preview of an attended ingest (capture-and-review §4.4) shows every item with its full text, as today. **Your yes there takes the items in and makes their new notes `reviewed`:** you have read them. *(Q11)*
- The items that need a yes (§3) are asked in the same turn, in rounds (§5). The undisputed items don't wait for them. *(Q3)*
- **"Later"** leaves a question in `_proposals/`, and a later session asks it (§5). Nothing else waits.

Example: a meeting yields 12 items. One says the pilot has 11 depots, and the brain holds 9. After your yes, the 11 others go in. The depot figure is asked in the same turn, with both passages and a recommended answer.

### 3. What needs your yes
**Asked:** a change to a value the brain holds (a fact, a date, an owner, a status); a new decision that replaces an older one; a merge of duplicates; an answer to an open question; a change to a Notion work item proposed by the assistant or the weekly review; a correction check's replacement of a restated line (0075 §4); anything the brain is unsure of (0090 §6's flags: two passages with different values, a reading chosen between two, a person or project matched by name only).

**Applied directly in an attended run:** text added to an existing note with nothing contradicting it, and a link between notes. Each still names its passages (0077), is listed in the run's report ("Added to 3 notes", "Linked 2"), and can be undone in Git. *(Q9)*

The rule: anything that **removes or replaces** something the brain believes needs your yes. An addition doesn't, because you saw it in the preview.

### 4. Work done without you never decides
- **A scheduled catch-up** (0051) takes in what an attended run would take in without a question. New notes stay `draft`. Additions and links to existing notes are not applied: no one has seen them. Each disputed item, addition and link waits in `_proposals/`. An input with a blocker is skipped as today. *(Q2)*
- **The weekly review, reflection and correction checks** write proposals in `_proposals/` and nothing else. *(Q4)*
- **The assistant** (0072) changes things after a yes in chat. With no one there, it writes a proposal in `_proposals/`.

### 5. Each session asks what is waiting
- An attended catch-up, or "what needs my decision", asks **at most five waiting questions per round**, most consequential first: changed facts, dates, owners and decisions, then merges and answers, then each source's new notes and additions from a scheduled run, as one question per source ("From the Acme kickoff: 7 new notes and 2 additions: accept all, all except …, or reject"). *(Q7, Q11)*
- Each question gives options and marks the recommended one with a one-line reason, as in 0090 §3. You answer with letters or your own words. "More" asks the next round; "enough" stops, and the rest stays waiting.
- Accepting a source's notes makes them `reviewed`. Rejecting archives them, as 0041 says.
- The catch-up report's Needs you line names how many questions are still waiting.

### 6. The Review database is removed
- A Notion migration **applies the decisions already made on Review rows** (a row set to Approve or Reject, an item with an explicit `Decision:`), then **archives the Review database** and Home's "What's waiting for you?" view. Nothing is deleted. Pending rows need nothing: their proposals are in `_proposals/` and are asked as in §5. *(Q10)*
- The published template loses the Review database, its row template, the Grill me button and Home's view.
- **Retired:** the Review page, Your call, What to fix, the `Decision:` tokens and Submit (capture-and-review §7, 0055's editable Review, 0088, 0090, 0094); Brain Assistant's Review queue and Grill review skills; the Reports offer of 0093 §3.
- `sync` no longer writes or reads Review rows.

### 7. The weekly review is an Inbox row
- Each week's review is **one Inbox row, Kind Weekly**, beside the Catch-up rows. A rerun in the same week updates that row. It is never taken in as an input. It doesn't need the Documents or Reports module. Unattended publishing still needs `settings.publish: auto`. *(Q8)*
- Its What needs your decision lines name each decision and end with "decide in Claude Code or Codex: *what needs my decision*", instead of a link to a Review row. A task item is still decided on the task in Notion (0093 §2).
- The row is set to **Done** once none of its decisions is waiting.
- It is the one place in Notion that shows pending decisions. Home has no count. *(Q6)*
- Brain Assistant's Weekly review in Notion opens this week's row and reads it with you. It decides nothing and points to the session for decisions.

### 8. Release and beta
- **0.16.0, "one place to decide"**, its own release before 1.0.0. It removes and simplifies an existing flow and adds no feature: 0.15.0 stays the feature cutoff, and this record is the explicit roadmap change AGENTS.md requires. *(Q12)*
- **Inviting testers (U-28) waits for 0.16.0,** so no tester learns the Review database. *(Q13)*

## Consequences

- **The spec loses its largest part.** Capture-and-review §7 (the Review page, the tokens, Submit, Your call and their binding rules) is replaced by a short contract for deciding in the session. cli.md, schema.md, eligibility.md, weekly-review.md, assistant.md and docs/notion-space-design.md follow. Contracts come first (CC-295).
- **Proposal kinds change.** Additions and links stop being proposals in an attended run and remain queued ones in an unattended run. `review_notes` is asked in chat. The CLI creates a note as `reviewed` when the attended yes covers it.
- **Skills change in the fork:** ingest, catch-up, apply, weekly review, reflect, the assistant and the guides. They reach this repository as a vendored release.
- **One Notion migration** applies the decided rows, archives the Review database and its Home view, and adds the Kind Weekly. The published template is updated by the author.
- **Work already built is dropped:** CC-240 and CC-241's Review page and grill, and CC-278 (the Grill me rename, 1.0.0), which becomes `dropped`.
- **Trust holds:** nothing replaces what the brain believes without a yes, every change names its passages, and an unattended run still decides nothing.
- **Known limit:** you can't decide from your phone or from Notion. The author accepted this in Q5.
- Work: recorded by CC-288; the 0.16.0 section of build/TASKS.md.

## Evidence

- The author's grill of 2026-11-15 (Q1 to Q13), in the session that recorded CC-288.
- [0003](0003-proposal-review-flow.md) ("In session: when the user is present, the agent may ask for approval in chat instead").
- The vendored `brain-catch-up` skill, step 12 (pending proposals decided in chat when a brain has no Review database), and `brain-apply`'s chat mode.
- [spec/weekly-review.md](../spec/weekly-review.md) §1 and §6 (the weekly review published to Documents, its items linked to Review rows).
- [docs/notion-space-design.md](../docs/notion-space-design.md) (the Inbox's Kind Catch-up rows, Home's "What's waiting for you?").
