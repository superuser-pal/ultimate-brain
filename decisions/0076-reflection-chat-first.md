# 0076 — Reflection works like Ultimate Assistant: report first, on demand

**Status:** Accepted
**Date:** 2026-11-08
**Release:** 0.11.0 (CC-65 to CC-67, U-21)
**Amends:** [0052](0052-reflection.md) (how a run reaches the user, its schedule, skips, themes, the `note-size` scope and U-21's gate)
**Clarified:** 2026-11-08 (CC-160, the user's yes): in §1's table, "attributed to the user" applies to a value of the user's own; a value one of the claims holds keeps that claim's source.
**Keeps:** 0052's four signals, their thresholds and the 30-day window; its five finding kinds and their severity order; the fingerprint; the `orphan` and `near-duplicate` warnings; 0003; 0055's exclusion rules; 0064's boundary (the assistant reviews the structure of your work, reflection the content of your notes); 0061's feature cutoff

## Context
0052 was decided on 2026-10-29, before three later decisions changed the ground it stands on. 0071 retired concepts in 0.9.1, and 0052 writes a recurring theme as a draft concept. 0072 made Ultimate Assistant report first in a live chat, while 0052 writes Review rows only. 0075 plans one weekly brief for 0.13.0, on Monday at 08:00, that already includes knowledge corrections under shared limits, while 0052 plans its own weekly run. The 0.11.0 opening grill, on 2026-11-08, settled these points before the contracts (CC-65) are written.

## Decision

### 1. Report first, and the user picks
"Tidy the brain" shows its findings in the chat, each with a recommendation. For each one the user says **yes** (applied now), **later** (written as a Review row) or **skip**. This replaces 0052's "every finding is a Review row" for an attended run. Nothing changes without a yes, and 0003 holds: a change to existing knowledge is reviewed in the chat or in Notion.

- **Every answer is a proposal.** A yes is recorded as an approved proposal, a skip as a rejected one, both carrying the finding's fingerprint, so the history says what changed and why, and a skip is remembered. A finding the user doesn't answer leaves no record and can come back next time.
- **What a yes does, by kind** (apply rules of schema §11.2):

| Finding | What the brain asks | What the yes applies |
|---|---|---|
| Duplicate | "Merge *M. Lopez* into *María López*?", naming the survivor | `merge`: references rewritten, aliases joined, the duplicate archived |
| Contradiction | which value holds, or the user's own | `contradiction` with that value as the accepted truth, attributed to the user |
| Stale fact | "Still *PM at Acme*? Three meetings say she left in June" | `update_fact` |
| Promotion | the text to add to the project, shown in full | `add_to_note` |
| Theme | "Draft a Document on *pricing tiers*?" | a draft learned Document and its Review notes row (§4) |

A contradiction is never applied on a bare yes: the brain asks which value holds.

### 2. Top 10, then more
A run shows the 10 most severe findings in 0052's order (contradictions, stale facts, merges, promotions, themes), says how many more there are, and shows the next 10 on "more", as Ultimate Assistant does (0072). Review rows come only from "later", so 0052's cap of 10 rows per run has nothing left to cap.

### 3. A skip lasts as long as its reason
- **A skipped merge stays skipped:** two notes the user said are different stay different.
- **A skipped contradiction, stale fact or promotion** comes back only when a source newer than the skip names that note and field.
- **A skipped theme** comes back only when the term's source count grows.

This replaces 0052's "a rejected fingerprint is never proposed again" for every kind but merges, and matches 0075 §3: a finding returns when its evidence changes.

### 4. A theme is a draft learned Document
A recurring theme becomes a draft `reference` with `origin: learned` (0071), citing the sources behind it, in its own Review notes row whose source is the newest of them. A yes in the chat creates it as a draft; reviewing it stays the normal review of a new note.

### 5. On demand only in 0.11.0
Reflection runs when the user asks. It has no schedule and no unattended mode in 0.11.0. In 0.13.0 the weekly brief (CC-111, 0075) uses `brain reflect --candidates` as its knowledge stream, within 0075's shared limits, so there is one weekly run and one budget. 0052's "light pass inside catch-up" is replaced by 0075 §4's targeted check after an approved correction.

### 6. Excluded evidence, the same rule as `brain query`
`brain reflect --candidates` applies the restricted-evidence rule of `brain query` (spec/cli.md §5.13, capture-and-review §5.1): a restricted line, fact, timeline entry or note supplies no evidence and is never a target. One rule for both commands, so exclusion can't be bypassed through reflection (0055).

### 7. `note-size` checks the brain's own text
The warning checks every knowledge note, and among Documents the `learned` and `promoted` ones, which hold the brain's or the user's own text. It skips sources and `whole`, `part` and `workflow` Documents, which hold whole texts on purpose. `orphan` and `near-duplicate` stay as 0052 defines them.

### 8. One skill, one chat
`brain-reflect` stays its own skill (0052, 0064's boundary), and the Ultimate Assistant sub-agent loads it too, so "tidy the brain" works in the same chat as "review my projects".

### 9. U-21 runs on the brain as it is
The user's priority is 1.0 and its early testers; moving the agency brain in comes after 1.0. U-21 no longer waits for it: it runs on the user's brain as it is, where "nothing found" is a pass for the signals that need more meetings, and the synthetic brain with planted problems carries the acceptance of each signal. U-21's weekly-schedule step moves to CC-111 and 0.13.0's acceptance.

## Consequences
- **CC-65** specifies the chat flow (findings, answers, the proposal each answer records), the skip rule per kind and how a fingerprint records it, the restricted-evidence rule in `reflect --candidates`, themes as learned Documents and the `note-size` scope. It writes no unattended reflection rows into cli.md §6.1; F-0007's single unattended table stays in CC-65.
- **CC-66** builds the `note-size` scope of §7.
- **CC-67** builds report first, with no "Run on a schedule" section, and adds `brain-reflect` to the Ultimate Assistant sub-agent; its blind runs test yes, later and skip.
- **CC-111** takes its knowledge stream from `brain reflect --candidates`, and U-21's weekly step joins its acceptance.
- 0052 gets an "Amended by" pointer; its body stays as recorded. Planning only: no code, spec or skill changes here.

## Evidence
- The user's answers in the 0.11.0 opening grill, 2026-11-08, each choosing the recommended option: Q1 report first, Q2 on demand with the weekly run in 0.13.0, Q3 themes as learned Documents, Q4 query's restricted-evidence rule, Q5 all four signals, Q6 no move-in gate (1.0 and early testers first; the agency move-in after 1.0), Q7 a yes per kind with a contradiction asking which value holds, Q8 skips by kind, Q9 top 10 then more, Q10 one skill loaded by the assistant's sub-agent, Q11 the light pass replaced by 0075 §4, Q12 `note-size` scope, Q13 this record. The user confirmed the summary.
- Decisions [0052](0052-reflection.md), [0055](0055-domains-capture-and-review.md), [0064](0064-brain-assistant-before-reflection-hermes-after-1-0.md), [0071](0071-a-simpler-notion.md), [0072](0072-ultimate-assistant.md), [0075](0075-weekly-review-and-targeted-corrections.md); [schema](../spec/schema.md) §4 reference, §11.2; [CLI contract](../spec/cli.md) §5.13.
