# 0098 — Agree by subject, and check a changed document before it goes in

**Status:** Accepted
**Date:** 2026-11-16
**Release:** 0.16.0 (§1 to §3); 0.17.0 (§4 to §7)
**Amends:** [0096](0096-one-place-to-decide.md) §2 and §5 (an attended ingest goes by subject, and in each part the questions come before its yes); [0049](0049-documents.md) and [0071](0071-a-simpler-notion.md) (Keep as document with Only keep filled shows the part chosen as a changed version to check, instead of an item to approve); [0061](0061-roadmap-and-launch-boundary.md) (a 0.17.0 before 1.0.0, with one feature after the cutoff)
**Keeps:** 0096 §1, §3, §4, §6 to §8 (you decide in the session; what is asked; work done without you never decides; the Review database is removed; the weekly Inbox row; beta invites wait for 0.16.0); [0077](0077-trust-repair-in-0-13-0.md) (every item names its passages); [0012](0012-meeting-minutes-reviewed-before-ingest.md), [0055](0055-domains-capture-and-review.md) and [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) (minutes are checked in Notion before ingest); [0054](0054-brain-assistant-buttons.md) (Tidy capture); Keep as document with Only keep empty (the whole input, verbatim)

## Context

0096 moved every decision into the Claude Code or Codex session, and CC-295 wrote its contract: one preview with one yes, then the questions in order of kind. On 2026-11-16, before that flow was built, the author asked how documents differ from meetings and Inbox items, and proposed two changes:
- **Agreement by parts.** Grouped by subject, with questions, the way a grill goes. The notes the brain already has that may be related come first, so a possible conflict is visible before the yes.
- **A checked version of a changed document.** When the user wants a document changed (part of it kept, rewritten, corrected) before it goes in, the brain writes the changed text to an Inbox item. The user checks it, and on confirmation the system ingests it.

How each input is checked before ingest today:
- **Meetings:** Check minutes in Notion, unticked lines, the For the brain toggle, then Reviewed (0012, 0055, 0079).
- **Captures:** Tidy capture rewrites the body while the row is New, and the user sets Ready (0054).
- **Documents** (a file, an email, a PDF): nothing. Only keep lets the brain choose a part, and the user sees that part only as an item to approve after the ingest.

The grill that day (Q1 to Q9) took the recommended option in each question. Q4 added that a checked row set to Ready can also be taken in by the next catch-up. The author also set the shape of a part: no "what the brain holds" heading, a short plain view of what is there, then what is being added, then the questions.

## Decision

### 1. An attended ingest goes by subject *(Q1)*
- The ingest splits what it found into **parts, one per subject**: a project, an area or a topic the brain already has, or a new subject named plainly.
- A source with one subject is one part with one yes. A short capture is no slower than before.
- Each part has its own yes. "Later" on a part leaves its items waiting, as 0096 §2's "later" does.

### 2. Each part shows what is there, then what is added, then the questions *(Q2, Q3)*
In order:
1. **What the brain has on the subject.** A short, plain list: each related note by title with one line. It is found with the brain's own retrieval (`brain query --candidates`, eligible notes only, 0077). The full passage is quoted only where something conflicts.
2. **What is being added**, highlighted: new notes, additions, links and new facts, each with its text.
3. **The questions** on this part: what 0096 §3 asks, at most five per round, with options, the recommended one marked and one line on why.
4. **"Accept the rest of this part?"** The yes covers the part's undisputed items, which go in as `reviewed`. It comes after the questions, not before them as in 0096 §2.

Example: a document covers the pilot and hiring.

```
Part 1 of 2: Pilot rollout
  Pilot scope: 3 regions, starts in March (decision, Oct)
  9 depots in the pilot
  Open: who signs off the pilot?

  Adding
  + Kickoff date moved to 4 March (new fact)
  + Risk: driver shortage in the north (new note)
  + Link: Pilot rollout → Ops lead (person)

  Q1. Depot count: 9 today, the document says 11
      a) 11 (recommended: the document is newer and signed)  b) keep 9  c) later
  Q2. "Who signs off?" is answered with "Ops lead"
      a) accept (recommended)  b) no, leave it open
  → The rest of part 1 (the 3 additions): accept?
Part 2 of 2: Hiring
  ...
```

### 3. A later session's waiting questions follow the same shape
Questions that wait for a later session (0096 §5) keep their order of importance. A question shows its subject's short view before it is asked, and questions on the same subject in one round come together. Whether a waiting proposal records its subject, so that a later session groups it without recomputing, is the contract's choice (CC-307).

### 4. A changed document is checked as an Inbox row before it goes in *(Q4, Q8)*
- **When you ask in the session** for a document to be changed before it goes in ("keep only the requirements, as a spec", "drop the appendix", "the depot count is 11, not 9"), the session writes the changed text to a **new Inbox row** linked to the original. Nothing is taken in yet.
- **Keep as document with Only keep filled** does the same: the part the brain chose becomes such a row, and you check it before it goes in. With Only keep empty, the whole input is kept verbatim, as today.
- You read the row in Notion and edit it if you want. Then either:
  - you say **"go"** in the session, and the ingest takes in the row as in §1 and §2; or
  - you set the row to **Ready**, and the next catch-up takes it in (§6).

### 5. What the brain cites *(Q5)*
- The checked row **is the source**: its items cite its passages. You checked that text, so it is your version.
- The original stays in the brain as a source, linked from the row, so every item can be traced back.
- The row lists **what the change dropped or altered** compared with the original (sections left out, values changed), so the check is not a blind one.

### 6. Ready approves the text only *(Q6)*
A scheduled catch-up that takes in a checked row set to Ready treats it as any input of a run without you (0096 §4): its new notes stay `draft`, and its additions, links and conflicts wait for your next session, asked once per source. Ready says "this text is right". It approves no note you have not seen.

### 7. Meetings and captures keep their own checks *(Q7)*
Minutes keep Check minutes and Reviewed; captures keep Tidy capture. The checked row is for documents, the one input with no check before ingest.

### 8. Releases *(Q9)*
- **§1 to §3 go in 0.16.0.** They change the flow CC-298 is about to build, add no feature, and need no Notion change. CC-307 rewrites CC-295's contract first.
- **§4 to §7 go in 0.17.0**, after 0.16.0 and before 1.0.0. It is a new feature after the 0.15.0 cutoff, and this record is the explicit roadmap change that 0061 requires. Beta invites (U-28) still wait for 0.16.0 only.

## Consequences

- **The 0.16.0 contract changes before it is built.** capture-and-review §7.3 and §7.5 and cli §5.6 (as CC-295 wrote them) move from one yes then questions by kind to parts by subject, each with its short view, its additions, its questions and then its yes (CC-307). CC-296 and CC-298 build that version.
- **0.17.0 needs contracts, CLI, skills and possibly Notion:** the checked row (its Kind or marker, its link to the original, its list of what changed), the original kept as a linked source, a row set to Ready taken in like any input, and Only keep producing the row. Whether the row needs a new Kind or property in Notion is CC-308's choice. If it needs none, CC-311 is dropped.
- **Trust holds:** every item still names its passages, now in a text the user has checked; the original is never lost; Ready approves no note.
- **Known cost:** a changed document takes two steps, the check in Notion and the ingest. That is the step the author asked for, and only documents take it.
- Work: recorded by CC-306; the 0.16.0 and 0.17.0 sections of build/TASKS.md.

## Evidence

- The author's grill of 2026-11-16 (Q1 to Q9), after 0096 and CC-295 (#405).
- docs/notion-space-design.md: Keep as document and Only keep, Tidy capture, Check minutes.
- spec/capture-and-review.md §4.4 and §7 (CC-295), spec/cli.md §5.6 and §5.13.
