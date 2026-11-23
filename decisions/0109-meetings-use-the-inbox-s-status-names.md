# 0109 — Meetings use the Inbox's status names

**Status:** Accepted
**Date:** 2026-11-18
**Release:** 0.16.2
**Amends:** [0007](0007-notion-meeting-notes-not-deleted.md) (an ingested meeting's Brain Status reads Done, no longer Ingested; Ingested At stays); [0045](0045-review-in-one-row-fix-before-ingest.md) (a corrected meeting is set back to Ready, no longer Reviewed, to be read again); [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §1 (this rename ships in 0.16.2 as a named exception, as §12 and §13 did)
**Keeps:** [0048](0048-modules-and-simpler-rows.md)'s Inbox Brain Status (New → Ready → Done) unchanged; 0079's ids, quotes, selection and For the brain toggle; [0007](0007-notion-meeting-notes-not-deleted.md)'s rule that a meeting page is marked, never deleted or rewritten; Documents' Lifecycle (its Reviewed means you checked the knowledge, not that an input may be taken in)
**Amended by:** [0113](0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) (2026-11-23): the name map that maps New, Ready, Done and Skipped for Meetings is 0.20.0's (CC-354)

## Context

The Inbox and the Meetings database do the same job with different words. An Inbox row is New (not confirmed), then Ready (you confirmed it, take it in), then Done (the brain took it in, or skipped it with a reason in Summary, 0048). A meeting is Not Reviewed, then Reviewed, then Ingested, with a fourth value, Skipped, that you set on a meeting you keep but don't want in the brain. A user learns two vocabularies for one rule, and Home shows both side by side ("Needs you" lists Not Reviewed meetings, the Inbox tab New and Ready rows). The beta starts on 0.16.2 (0108), and 0.16.2 already has one Notion migration (0029) and one skills release, so testers who start there would never meet the old names.

## Decision

1. **Meetings' Brain Status is New → Ready → Done**, the Inbox's names: Not Reviewed → **New**, Reviewed → **Ready**, Ingested → **Done**. The Inbox doesn't change. "Ready" means the same in both: you checked it, the brain may take it in.
2. **Skipped stays, on Meetings only, set only by you**: a meeting you keep but don't want in the brain. The Inbox doesn't need it: a row you don't want, you delete. The guides say it once: "Meetings have one extra state, Skipped, for a meeting you keep but don't want in the brain."
3. **It ships in 0.16.2**, a named exception to 0106 §1 like §12 and §13: launch-readiness polish, so beta testers only ever meet the new names and nobody migrates twice.
4. **Old names are still read.** The CLI and the skills read Not Reviewed as New, Reviewed as Ready and Ingested as Done, and write only the new names, as `Processed` is still read as Done (0048). Reading the old names ends at 1.0.0 or later, by a later decision.
5. **Ingested At stays** under that name: the brain owns it, nobody acts on it.
6. **The minutes' sentence** becomes "All subjects included unless marked Meeting only. Set Ready to confirm." Minutes with the old sentence ("Mark Reviewed to confirm.") are still accepted, by the parser and by Check minutes; existing meeting pages are never rewritten (0007). It ships with 0106 §13's layout (CC-356).
7. **Question titles stay; status words change.** "Which minutes need review?", the Areas tab "Meetings (to review)" and the formula "Meetings to review" keep their names, because checking the minutes is still what you do; their filters read New. Text that names a status value changes: the template's "Before marking Reviewed" callout becomes "Before setting Ready", and its gray line says "set Brain Status to Ready … Set Ready again".
8. **Migration 0029 renames the select options** in a by-hand step with a read-back check (Notion renames an option on every row that has it, so no meeting loses its state), and replaces the template's text of §7. The published template takes it in U-41, the author's brain in U-42.

## Consequences

- Two build tasks in 0.16.2: CC-360, the contract and the CLI (spec first; render writes Done; the old names read as the new; tests), and CC-361, stacked on it: Notion design, prompts, views guide, TEMPLATE.md, template examples, Brain Assistant (Check minutes, Write minutes, Weekly review's count, the Tasks rule), migration 0029's step, and the fork's catch-up, ingest, sync and how-to texts in 0.16.2's one skills release; the minutes sentence coordinates with CC-356.
- 0.18.0's name map (CC-354) maps New, Ready, Done and Skipped for Meetings.
- A "Noted for 1.0.0" line: the old names stop being read by a later decision, not before 1.0.0.
- 0007, 0045 and 0106 carry an "Amended by 0109" line.

## Evidence

The author's answers of 2026-11-18 in a grilling session (two rounds: the names, Skipped, the release, the old names, Ingested At; then the minutes' sentence, the view titles, Documents' Lifecycle and the task split). Facts checked before the questions: `docs/notion-space-design.md` (Meetings · Brain Status: "You set Reviewed or Skipped; brain sets Ingested"; no Summary on Meetings), `spec/schema.md` §4 (Inbox · Brain Status), `notion/minutes-format.md` (the confirm sentence), `src/lib/sync.ts` (render writes `Ingested`).
