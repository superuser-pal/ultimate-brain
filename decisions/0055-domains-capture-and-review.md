# 0055 — Optional Domains, selected capture and editable Review

**Status:** Accepted
**Date:** 2026-10-30
**Amends:** 0043 (minutes format), 0045 (Review presentation and corrections), 0048 (modules and Review controls), 0052 (release placement only)
**Release amendment:** [0056](0056-buttons-move-into-0-8-0.md), 2026-10-31, builds 0054's buttons in 0.8.0 too; 0.7.1 becomes a small patch.
**Refines:** 0003, 0007, 0018, 0021, 0032, 0050, 0051, 0054

## Context

In a grill on 2026-10-30, the user asked for a level above Areas, a Won't Do task status, voice captures, less work cleaning meeting summaries, and Review pages that explain and let them edit the actual changes. The user accepted the design below and its release placement, then explicitly asked Codex to record it while Claude Code was busy. That is a one-task authorship exception for CC-74, not a change to decision 0044's implementation ownership or the independent-review requirement.

The current minutes prompt requires eleven headings and empty sections, although extraction accepts other headings. Review's Proposed property compresses additions to 80 characters and body changes to a line count, with a 2000-character total limit; a bundled row's About Page points to its source rather than each affected note. Fix already applies corrected values, including corrections supplied with Approve. These are presentation and interaction limits, not reasons to abandon Markdown/Git as canonical.

## Decision

### Release order
- **0.7.0 and 0.7.1 keep their existing scope.** 0.7.1's exact accepted-wording mechanism (0054) is a prerequisite for the new Review flow.
- **0.8.0 ships this decision:** optional Domains, Won't Do, voice capture, subject-based summaries and inclusion controls, and editable Review.
- **Reflection moves from 0.8.0 to 0.9.0:** CC-65 to CC-67 and U-21 retain their identities and purpose. Improve Review before reflection creates more proposals. All other reflection rules in 0052 remain in force.

### Domains surround PARA; they do not replace it
- **Domains is an optional module, off by default**, offered in onboarding's module checklist and switchable later under 0048's non-destructive module rules.
- A Domain groups a work or life context around PARA. An Org describes an organization; a Domain organizes the user's work in that context and may link to an Org. It does not replace the Org.
- **An Area belongs to at most one Domain, or none.** Projects remain in Areas. Two contexts' similarly named responsibilities are separate Areas; shared subject knowledge is reusable and need not be duplicated beneath each Domain.
- Documents can be tied to their Area and Project. Domain grouping follows the Area; the contracts must prevent a second, contradictory assignment. Optional Domains must not make Orgs or Documents mandatory or require existing Areas to acquire a Domain.
- Contracts define the note/config/relation representation and how the optional layer fits existing navigation and area homes. Existing brains gain no required classification step.

### Won't Do closes work without claiming completion
- **Won't Do is terminal, reopenable and distinct from Done.** Retain the task and its history; remove it from active work, reminders, due counts and overdue views.
- Exclude it from active scope when calculating progress. Display completed and dropped counts separately, e.g. **8 completed · 2 dropped**; a percentage uses non-dropped work as its denominator. Define the zero-active-scope case in the contracts without implying completed achievement.
- Update Notion status options, filters, formulas and progress views together, including mapped external task databases. This does not introduce Markdown task management or unrestricted task-status sync (0018).

### Voice captures and meeting summaries
- Add an **Inbox voice/ramble template** that preserves the transcript and presents concise highlights, explicit commitments and ideas to explore separately. It remains **New** while the user checks it; only **Ready** permits ingestion. Creating the summary never authorizes Tasks.
- Verify the available Notion recording/transcription mechanism before specifying a native voice block or automation. If unavailable, support supplied transcripts and document the recording step; do not claim an unverified capability exists.
- Meeting summaries start with **Highlights** and **My actions**, linking into meaningful **subject sections**. Within each subject distinguish highlights, decisions, my actions, other commitments, open questions and concerns raised, as applicable. Keep substantive context and source references; omit empty sections and avoid repeating identical text in the overview and subject.
- A highlight explains significance; a decision records an agreement. Never invent a risk to fill a heading. Concerns must be supported by the conversation; uncertainty or inferred ownership is shown as needing clarification.
- **Only the owner's explicit commitments become Tasks by default.** Resolve the owner using configured identities and aliases, not a name hardcoded in a prompt. Other people's commitments remain in the subject, with an explicit option to track one as **Waiting On**. Ambiguous owners or tentative ideas create no Task.

### Include subjects and items without a checklist chore
- Each substantive subject starts as **Use in brain**; its items inherit that selection. The user can set a subject or individual item to **Meeting only**. A subject exclusion excludes its contents unless the user explicitly selects an individual exception. Items without an explicit choice inherit the subject; no choice is not a blocker.
- Every unprocessed summary visibly says: **All subjects included unless marked Meeting only. Mark Reviewed to confirm.** Use Ready for Inbox captures. No extra confirmation dialog is required.
- **Reviewed/Ready confirms the visible selections**, not approval of later proposals. Default Quick capture behavior remains unchanged for other templates; the new voice template starts New. An unattended run may use confirmed selections, but may not turn an unconfirmed summary into Reviewed/Ready.
- The assistant can suggest Meeting only for small talk, but must expose the exclusions for confirmation. An unfamiliar substantive subject stays included. Included material may produce nothing when no durable knowledge emerges; inclusion does not require a new note.
- **Meeting only is outside the canonical brain**, not merely a request to suppress new notes. Preserve the original full transcript in Notion; the Git source snapshot contains only selected passages and is explicitly identified as a selected extract. No excluded content goes into notes, Tasks, proposals, retained Documents, indexes or retrieval context. Preserve actual selected source wording and provenance; an AI summary is not a substitute for source evidence.
- Selection applies consistently to overviews and derived material too: a global highlight must not reintroduce an excluded subject. Selected content that depends on excluded context must not silently import that context or fabricate a standalone meaning.
- The contracts must define stable subject/item identities, passage mapping, the chosen Notion controls, precedence, versioning, re-inclusion and the outcome when selection cannot be reliably mapped. Missing or ambiguous mapping is a blocker for that input, not permission to snapshot the whole transcript.

### Changing selection after ingestion reconciles prior effects
- Excluding previously ingested content triggers a reconciliation that identifies its existing contributions and **proposes necessary removals or corrections**, rather than silently deleting everything it touched.
- Preserve independently supported knowledge and show affected Tasks to the user. Do not silently delete or cancel Tasks, or erase independently supported claims.
- Newly excluded material stops being used as evidence while reconciliation is pending. The contracts must define how that restriction reaches retrieval, reflection, pending proposals, derived outputs and kept text before cleanup is accepted.
- Source versions and audit history remain attributable under 0032. This is an operational exclusion, not a promise to erase earlier Git history; the original Notion meeting remains intact. Contracts specify versioned selected extracts and suppression of older excluded passages from active use without rewriting immutable historical sources.

### Review is readable content with independent decisions
- Keep **one Review page per source for ordinary changes**, with independently actionable sections. **Conflicts have separate pages**; preserve the existing Answer workflow and its attribution.
- Detailed proposals live in the **page body**, not a compressed Proposed property the user must clean. Properties serve queue navigation, status and decisions. Each section has a stable identity, links to its affected note and source evidence, and shows the relevant current content, proposed exact replacement or creation, and why it matters.
- Clearly distinguish **new draft notes already created** from **proposed changes to existing notes**. Accepting a new draft makes it reviewed; accepting an existing-note change applies the displayed change. Reject/defer and partial decisions must preserve their different lifecycle effects (0041, 0045).
- Put guidance beside the actions: **Creates**, **Changes**, the affected target and what Accept will do. Tooltips may explain details but must not hide the consequences. Use readable examples and a short first-use explanation.
- The user edits the **proposed final wording** directly, then **Accepts** that exact version. No second approval of the user's own wording. A whole-page accept shortcut may accept only eligible pending items; it cannot bypass an unresolved revision or conflict.
- Replace the user-facing **Fix** decision with **Request revision** for instructions such as "make this clearer." The next draft remains Pending until accepted. Internal correction operations may retain their existing names; legacy Fix/What to fix rows must not lose pending instructions or decisions on upgrade.
- Acceptance is bound to the exact proposed text and the canonical base version. Later edits invalidate the affected acceptance; a changed base requires renewed review instead of a silent merge. Publishing preserves pending edits and revisions, as 0054 does for accepted wording.
- **User corrections are authoritative and separately attributed.** If a source says March 15 and the accepted correction says March 18, retain both provenance statements; do not claim the source said March 18. Write history for the accepted current value.
- Editing or deleting replacement text changes the proposal; it does not silently delete the target note. A missing section is not an implicit Accept, Reject or delete instruction. Contracts define recovery and explicit reject/defer controls.
- An unattended run applies only explicit, exact, current decisions whose mapping is deterministic. It never interprets revision instructions, ambiguous edits or incomplete selections (0051).
- Verify feasible Notion body editing and independent decision controls before finalizing contracts. Do not assume native per-section buttons, tooltips or acceptance hashes are provided by Notion. If a control cannot be built as specified, retain the behavior with a supported interaction; material changes to the agreed experience return to the user.

## Consequences
- Contracts come first, then implementation, skills, Notion migration and end-to-end acceptance. This decision records behavior, not an assertion that it is already implemented.
- New contracts must cover the full selection-to-Review lifecycle, source and user attribution, stale edits, partial decisions, module-off behavior, reconciliation and unattended runs. Update query/reflection eligibility so exclusion cannot be bypassed through older sources or generated views.
- Migration follows 0.7.1's 0012; reserve **0013** for this release's Notion changes. Preserve existing row content, pending decisions and the option to leave Domains off.
- Tasks and acceptance are in [build/TASKS.md](../build/TASKS.md), CC-74 to CC-82 and U-23. CC-65 to CC-67 and U-21 now target 0.9.0. Claude Code implements; CC-74 alone is recorded by Codex at the user's explicit request and needs independent review, not a Codex self-pass.

## Evidence
- The user's grill and explicit acceptance, 2026-10-30: the five initial improvements, rounds Q1–Q19, the default-selection flow, and the accepted 0.8.0/0.9.0 release split. No personal examples from that conversation are stored here.
- [Minutes prompt](../notion/minutes-format.md); [extraction rules](../skills/brain-ingest/references/extraction.md); [templates](../notion/templates.md).
- [CLI contract](../spec/cli.md) §5.14.4, Review rendering; [apply skill](../skills/brain-apply/SKILL.md), Reading What to fix.
- [0048](0048-modules-and-simpler-rows.md), [0050](0050-area-homes.md), [0051](0051-unattended-catch-up-and-schedules.md), [0052](0052-reflection.md), [0054](0054-brain-assistant-buttons.md).
