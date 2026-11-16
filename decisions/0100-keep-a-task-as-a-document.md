# 0100 — Keep a task as a document: research and answers become durable knowledge

**Status:** Accepted
**Date:** 2026-11-16
**Release:** 0.17.0
**Amends:** [0049](0049-documents.md) (Keep as document also works on a task); [0099](0099-notion-without-decisions-and-questions.md) §4 (Tasks gains Document asked and the Keep as document button, beside Kind); [0061](0061-roadmap-and-launch-boundary.md) (0.17.0 holds a second feature after the cutoff)
**Keeps:** [0096](0096-one-place-to-decide.md) §4 (work done without you only queues questions); [0098](0098-agree-by-subject-and-check-a-changed-document.md) §4 to §7 (a changed document is checked before it goes in); [0077](0077-trust-repair-in-0-13-0.md) (every claim names its passages, and excluded inputs give no evidence); a whole Document is the input's text, word for word (0049, spec/schema.md §4 reference)
**Amended by:** [0102](0102-one-release-for-0-16-0-and-0-17-0.md) (2026-11-16): ships in 0.16.0, not 0.17.0 (§6)

## Context

0099 makes the questions and risks you follow up tasks. The author pointed out that what a task gathers (the research done for it, the answer to the question it tracks) is often knowledge worth keeping, and a Notion task page is not where the brain looks for it: tasks live only in Notion, and Git keeps just their page id. Promote to document works on decisions, which are notes in Git; a task has no note to promote. The Inbox already keeps an input as a Document: its **Keep as document** button ticks **Document asked**, and the brain keeps the input as a whole Document and clears the box (0049).

The author's grill of 2026-11-16, after 0099: Q10 a, Q11 c, Q12 a with an addition, Q13 a, Q14 a, Q15 a.

## Decision

1. **Any task can be kept as a document** (Q13), in two ways (Q11): in the session ("keep the go-live task as a document"), or with a flag on the task. The flag is the Inbox's: a **Keep as document** button on Tasks that ticks a **Document asked** checkbox. The brain acts on it at the next catch-up and clears the box, as it does on the Inbox (0049).
2. **The task page becomes a source, then a whole Document** (Q12). The brain reads the task page through Notion, records it as a source the way it records an Inbox capture, and keeps it as a Document with your text word for word: `reviewed` at once, because it is your own text and not the brain's claim. The Document is linked to the task's project or area, to the question the task tracks (0099 §3) when there is one, and back to the task. Because the page is a source, answers cite it like any other input, and its exclusion rules apply.
3. **"From the brain"** (Q12's addition, Q14). After keeping it, the brain asks whether to add what it already holds on the subject: the decision the research led to, the answer it recorded, related Documents (eligible only). What you say yes to is added in one section at the end, **From the brain**, one line per item citing its note. Your text above it is never changed.
4. **Without you** (Q15). A scheduled catch-up that finds a ticked box keeps the task as a Document right away, since your own text needs no decision, and leaves the "From the brain" question for your next session (0096 §4).
5. **Modules.** It needs the Documents module. The flag needs the Tasks module; on a tasks database you mapped yourself, the connect step offers to add Document asked and the button, and without them you ask in the session. With Documents off, nothing is kept, and the session says so.
6. **In 0.17.0** (Q10), beside the checked document (0098 §4 to §7): both are about Documents, and 0.16.0, which gates the beta invites, does not grow. It is a second feature after the 0.15.0 cutoff, by explicit roadmap change.

## Consequences

- The 0.17.0 tasks grow: CC-308's contracts (the task source, its key and its versions when the page changes and you keep it again, the Document's links, the From the brain section as an addition to a whole body), CC-309's CLI, CC-310's skills, and CC-311's Notion migration (Document asked and the button on Tasks), which is no longer conditional. U-35 tries it in the author's brain.
- `notion.tasks.properties` gains a key for Document asked, next to 0099's Kind.
- A task kept twice: whether the second keep updates the Document or asks first is the contract's choice, under the existing rule that a brain-owned body changes only with your yes.

## Evidence

The author's grill of 2026-11-16 in the planning session (CC-321), after decision 0099 (PR #414). Today's shape: [docs/notion-space-design.md](../docs/notion-space-design.md) (the Inbox's Keep as document and Document asked), spec/cli.md §5.14 (the snapshot reads Document asked; the skill clears it), spec/schema.md §4 (`reference` origins, a whole body word for word).
