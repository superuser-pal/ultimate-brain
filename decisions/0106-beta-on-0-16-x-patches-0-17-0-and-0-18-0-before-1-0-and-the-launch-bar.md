# 0106 — The beta on 0.16.x patches, 0.17.0 and 0.18.0 before 1.0, and the launch bar

**Status:** Accepted
**Date:** 2026-11-18
**Release:** 0.16.2 (§1 to §3, §12, §13); 0.17.0 (§4); 0.18.0 (§5); 1.0.0 (§6 to §8)
**Amends:** [0061](0061-roadmap-and-launch-boundary.md) (release order and launch details: two explicit roadmap changes after the cutoff, 0.17.0 and 0.18.0, before 1.0.0; the languages, channel, number of testers and launch it left to this grill); [0101](0101-where-notion-ai-and-the-brain-each-write.md) §9 (its 1.0.0 part, §3 and §8, ships in 0.17.0); [0078](0078-onboarding-and-early-access-in-0-14-0.md) §6 and [0101](0101-where-notion-ai-and-the-brain-each-write.md) §8 where they say "1.0" for Notion AI becoming optional (read 0.17.0); [0082](0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) §2 (CC-186 with CC-206 runs on a 1.0.0 release candidate, §6); [0072](0072-ultimate-assistant.md) §1's rename note (Notion Brain Assistant is built in 0.17.0); [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) §1's layout only (headings with dividers and bold-prefixed bullets, §13)
**Amended by:** [0107](0107-the-landing-page-and-wishlist-are-built-outside-this-repo.md) (2026-11-18; 0.16.2): the landing page, its wishlist, the demo and their privacy text are the author's, built outside this repo; §3's wishlist item and §8 are removed, and §7's soft launch links to the author's landing page; [0108](0108-beta-invitations-wait-for-0-16-2.md) (2026-11-18; 0.16.2): §2's beta starts on 0.16.2, not 0.16.1 (U-31 after 0.16.2's template migration, U-32 from `v0.16.2`, then U-28); [0109](0109-meetings-use-the-inbox-s-status-names.md) (2026-11-18; 0.16.2): Meetings' status names become the Inbox's (New, Ready, Done; Skipped kept on Meetings), shipped in 0.16.2 as a named exception to §1
**Keeps:** 0.15.0 as the feature cutoff for anything not listed here; [0083](0083-release-on-a-reviewed-reading-when-the-scorer-fails-a-smoke-run.md) (a scorer miss may be released on a reviewed reading, and the scorer is fixed before the next smoke run); the release scripts, the native smoke run per release (0082 §1) and the approval rules (0038, 0040, 0073); Markdown and Git canonical, Notion as the human interface; 0078 §6's rule that early-access testers have Notion Business with credits; 0079's ids, quotes, selection, For the brain toggle, quick follow-ups, Scope toggle and its §6 bar; [0007](0007-notion-meeting-notes-not-deleted.md) (existing meeting pages are never rewritten)
**Amended by:** [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) (2026-11-20; 0.17.0): §1: no more 0.16.x patches after 0.16.2, everything pending ships in 0.17.0, a trust or data-loss fix still ships at once; §4: 0.17.0 also holds the weekly row with its clean-up and scheduling on Mac and Windows, still one Notion migration
**Amended by:** [0112](0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) (2026-11-22): §5's Español ships in 0.19.0, its rules unchanged; 0.18.0 holds fourteen features from the LifeOS study; three feature releases come before 1.0.0, which is cut after 0.19.0 (§6 to §8 unchanged)

## Context

0.16.1 was released on 2026-11-17. 0061 left the launch's languages, channels, number of testers and offer to 1.0's opening grill, and 0078 §6 left how the template reaches testers and the npm channel to the same grill. 0101 put the path without Notion AI in 1.0.0, and 0082 put the complete native acceptance (CC-186, CC-206) there too, once beta testers are live. The 1.0.0 section had grown to hold beta fixes, two features, translation and the launch bar together, with no order between them.

On 2026-11-18 the author ran the 1.0.0 opening scope review (0061's grill) with the coordinator and answered the questions below; later the same day the author added two items to 0.16.2 (§12, §13). This decision records each answer as a rule, with the question it answered.

## Decision

### 1. The beta runs on 0.16.x patches (Q: what does the beta run on, and how often is a fix released?)
The beta runs on 0.16.x. A patch carries beta fixes and launch-readiness polish, never a new feature. A patch is cut when at least one fix a tester can see is merged, at most about once a week, each with the usual native smoke run, `results.md` read before `scripts/release.mjs` (docs/releasing.md). A trust or data-loss fix ships at once. Polish adds no capability: §12's button adds the row you would add by hand, and §13 lays out the same items, ids and selection to be read, so both fit a patch.

### 2. The beta starts now, on 0.16.1 (Q: when do invites go out, to whom, and how many?)
U-31 (the attended setup steps 4a and 4b), then U-32 (the readiness recheck, from `v0.16.1`, no longer `v0.16.0`), then U-28 (the invites). Five testers, reached directly by the author, English-speaking only, each with Notion Business and Notion credits (0078 §6's rule). Testers without Notion AI join after 0.17.0.

### 3. 0.16.2 holds the first beta fixes (Q: what goes in the first patch?)
- CC-346, the bookkeeping after 0.16.1 (merged).
- The scorer fix: the memory evaluation's scorer reads a "Neither … records" abstention as honest, the 0.16.1 smoke run's unk-05 in Claude Code, as CC-225, CC-231 and CC-275 did for earlier phrasings; under 0083 §1 item 5 it merges before the next smoke run.
- CC-283 rewritten for today's count: the Skills database holds ten skills, and Write minutes is an eleventh page, from one source with the minutes prompt.
- Clean email acts only on captures with Brain Status New, as Tidy capture does (assessment finding F-0010, noted for 1.0.0 since CC-151), as its own task.
- CC-267 (the catch-up's publish in a sub-agent) and CC-269 (the CLI writes the snapshot), moved from 1.0.0.
- The wishlist page's copy, in English, and the waitlist paragraph of PRIVACY.md naming GoHighLevel (GHL) as where the page, the list and the email live. GHL's current data-location and consent documents are checked and linked before the paragraph is written: no claim without a vendor link.
- A New task button on Home (§12) and the minutes layout (§13), added by the author later the same day.

0.16.2 has one Notion migration, numbered after 0028, for every Notion step of its tasks.

### 4. 0.17.0: the path without Notion AI, and the rename (Q: does the path without Notion AI wait for 1.0.0?)
A feature release, by explicit roadmap change after the cutoff. CC-325 (Brain Assistant sets your operational fields after your yes), CC-326 to CC-329 (the path without Notion AI) and U-36 move from 1.0.0 to 0.17.0, unchanged in scope. With them, the rename noted by 0072: the Notion custom agent Brain Assistant becomes **Notion Brain Assistant**, so it isn't confused with Ultimate Assistant (notion/brain-assistant.md, the button messages, the guides, the views guide, the template, a by-hand step of the Notion migration). The rename and CC-325 share **one** Notion migration, and the release has one skills release. CC-326, the contracts, may start beside the 0.16.2 work; the other 0.17.0 tasks start after CC-326 is merged.

### 5. 0.18.0 Español (Q: which languages does 1.0 ship in, and how far does translation go?)
A feature release, by explicit roadmap change after the cutoff: Spanish as a second language for everything a user meets.
1. **What is translated:** the guides (the README's Get started, docs/setup.md, the Everyday Guide and How it works), a Spanish Notion template, the skills' fixed texts (in the fork) and the CLI's messages.
2. **Names too:** database, property and select names are translated, through a per-language name map in the CLI. The author chose this over keeping the names in English.
3. **One setting drives it:** the existing setup language setting chooses the template link setup gives, the skills' texts, the CLI's messages and the guide linked. Changing it later switches replies, the skills' texts and the CLI's messages at once. A Notion space keeps the language it was created in, and the map records which; converting a space is a by-hand migration the brain offers and never runs itself.
4. **Parity is checked:** tests that every CLI message key and every skill text block exists in both languages, and that the guides have the same sections; and the author reads the Spanish before 0.18.0 is released. From 0.18.0 on, every PR that changes a migration or a guide changes both languages, and the reviewer checks it.
5. **English users see nothing change** before 0.18.0.
6. 0.18.0 is decomposed after its own opening grill: the contracts for the name map and the language setting first, then the CLI catalog, the skills, the guides and the template. The author builds the Spanish template from the English one after the contracts.

### 6. When 1.0.0's release candidates are cut (Q: what is the bar for a release candidate, and when does CC-186 run?)
1.0.0-rc.1 is cut when all three hold: at least 3 testers completed setup with no developer help and used the brain for 2 weeks; no trust, data-loss or recovery issue is open; U-36 passed. CC-186 with CC-206 (the complete native acceptance, 0082 §2) runs on that rc package; its fixes become the next rc. 1.0.0 is cut from a candidate that passed it, after 0.18.0.

### 7. 1.0.0 is a soft launch (Q: what does launching mean?)
1.0.0 is: the package on npm `latest`, the template links (English and Spanish), the wishlist page with the demo, and one announcement email to the waitlist. Wider outbound promotion is decided later and is not part of 1.0.0. The landing page's purpose is the wishlist; beta testers are reached directly, not through it.

### 8. The wishlist page (Q: who builds and hosts the landing page, and when?)
The author builds and hosts the wishlist page in GHL. It goes live early in the beta, in English; the demo video, which the author records, is added after 0.17.0; Spanish comes with 0.18.0. The repo keeps only its words.

### 9. After 1.0 unless the beta shows a need (Q: which 1.0.0 performance tasks wait?)
CC-268 (incremental pull) and CC-270 (page bodies read as Markdown) are held for after 1.0. They come back into a release if beta testers' syncs show the cost.

### 10. Dropped (Q: is CC-272 still needed?)
CC-272 targeted the Decisions and Questions databases, which 0099 removed. It is dropped.

### 11. Stays in 1.0.0
CC-347 (the Review and Questions transition code removed), CC-186, CC-206, CC-339 and CC-340, as they are.

### 12. A New task button on Home (0.16.2; Q: can a task be added from Home, as a project can?)
Next to New project in Home's right column, a **New task** button adds a Tasks row with Kind Task and the default Status, and opens it; it sets no project and no due date. It is polish under §1, not a new capability: it adds the row you would add by hand. The Notion design and template texts, the views guide, a check, and a by-hand step in 0.16.2's one Notion migration carry it; the published template takes it as the author's by-hand step.

### 13. The minutes layout (0.16.2; amends 0079's layout only; Q: can the minutes be easier to scan?)
1. **Sections:** every section is a `##` heading followed by a divider: `In one line` (its sentence moves to its own line below the heading, with no "In one line:" prefix), `Quick follow-ups`, `Tasks for the brain`, and each subject, `## <Subject> [s1]`.
2. **Subject lines** are bullets with a bold prefix: `- **Decided:** … [s1.i2]`, and the same for Open, Concern, Waiting on <name> and Idea. The gist line stays first, unprefixed, as a bullet.
3. **Unchanged:** quick follow-ups stay checkboxes; each task stays one line with its Scope toggle; 0079's ids, quotes, selection, the For the brain toggle and its bar (0079 §6) are kept, and the prompt is checked against that bar again before the release.
4. **Earlier shapes are still read** (0.14.0's lean shape with "In one line:", the 0.9.x shape), and existing meeting pages are never rewritten. The author pastes the new prompt once after the release; 0.16.2's migration has a by-hand step to replace the prompt where the user keeps it.

It is polish under §1: the same items, ids and selection, laid out to be read.

## Consequences

- build/TASKS.md gains the sections 0.16.2, 0.17.0 and 0.18.0 before 1.0.0. Moved rows keep their text and add a "Moved by 0106" line; new rows: the scorer fix, Clean email (F-0010), the wishlist copy and privacy paragraph, the New task button, the minutes layout, and U rows for 0.16.2's template and the author's brain (0.16.2); the rename and the demo script (0.17.0); the 0.18.0 plan (0.18.0); U rows for the GHL wishlist page and the Spanish template.
- U-28 and U-32 change per §2; U-36 runs in 0.17.0.
- 0061, 0072, 0078, 0079, 0082 and 0101 carry an "Amended by 0106" line; docs/vision.md, docs/v2-ideas.md and AGENTS.md say the new order.
- The cutoff still stands for anything not listed: 0.17.0 and 0.18.0 are the only feature releases before 1.0.0.

## Evidence

The author's answers in the 1.0.0 opening scope review of 2026-11-18, relayed by the coordinator to CC-348. The 0.16.1 smoke run's reviewed reading (kept outside this repo, 0083 §6): unk-05 in Claude Code, "Neither the brain nor this repo records a deploy freeze for Orbit, so I can't confirm one exists or rule one out.", a correct abstention the scorer doesn't read as one (reported, not gated). Finding F-0010 (CC-151) and notion/brain-assistant.md's Clean email ("Brain Status New or Ready") against Tidy capture ("Brain Status New"). Decisions 0061, 0072, 0078, 0082, 0083, 0099 and 0101.
