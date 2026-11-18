# Results: the lean minutes prompt gate (CC-197, decision 0079 §6)

## Run 3: 0.16.2's divided layout (CC-356, decision 0106 §13)

**Verdict: the bar is met (run 3, 2026-11-18).** The prompt in the divided layout (`notion/minutes-format.md` at CC-356's f07e0f42) was run once by Notion AI in the author's test space, read back once with the Notion API's markdown, kept unchanged in `run-3/output.md` and scored with `score.mjs` (`run-3/score.txt`).

| Bar (0079 §6) | Run 3 |
|---|---|
| The For the brain toggle is a real toggle, `<details><summary>For the brain</summary>` | **pass** |
| At least 9 of 10 items carry an id and quotes that occur in the transcript | **13 of 13** (22 quotes, none over 12 words) |
| Every quick follow-up carries a `q` id | **3 of 3** |

What else run 3 shows:
- **The layout is as asked.** `## In one line`, a divider and one sentence. Each heading has a divider under it. Each subject's lines are bullets, the gist first and unprefixed, then `**Decided:**`, `**Open:**`, `**Concern:**`, `**Waiting on <name>:**` and `**Idea:**` in bold. Quick follow-ups stay checkboxes, and each task is one line with its Scope toggle.
- **The CLI reads it:** `extract-plan` (CC-356's head) on `run-3/output.md` with `transcript.md` returns `ok`, the lean shape, 13 items with their prefixes, no problem and no unnumbered line. All 3 follow-ups are Task inputs, and both Scopes are read with no problem.
- **Two observations** (`run-3/NOTE.md`), with no prompt change: Notion AI asked which speaker the author was before writing, and it left both Scope Due lines empty because the dates were said without a year. It put the dates in Notes.


**Verdict: the bar is met (run 2, 2026-11-12).** The prompt of `notion/minutes-format.md` at commit 2d7e247 was run once by Notion AI in the user's test space. It was read back by the coordinator with the Notion API's `retrieve-page-markdown` and kept unchanged in `run-2/output.md`, then scored with `score.mjs` (`run-2/score.txt`).

| Bar (0079 §6) | Run 2 |
|---|---|
| The For the brain toggle is a real toggle, `<details><summary>For the brain</summary>` (the only form §4.1 reads) | **pass**: a `<details>` block, its children tab-indented |
| At least 9 of 10 items carry an id and quotes that occur in the transcript (each quote verbatim, in exactly one paragraph) | **13 of 13** (16 quotes, none over 12 words) |
| Every quick follow-up carries a `q` id | **3 of 3** |

What else run 2 shows:
- Every expected item is there: 4, 3 and 4 subject lines, plus 2 tasks under Tasks for the brain, each with a Scope toggle whose Due is the date said (2026-12-12, 2026-12-17). The small talk is left out. The tentative weekend pass is an `Idea:` line, not a task. The onboarding question is `Open:`, and the two other people's commitments are `Waiting on <name>:`.
- Each item is written once: no task is repeated in its subject. Each task's quote line sits under its subject's Selection line. Notion AI added `(depends on [s3.i4])` to the pricing brief, which relies on Dario's numbers.
- No untagged line, no tag in the middle of a line, no orphan quote line, no token on a summary line, no Selection line outside the toggle.
- Soft limits: one prefixed line has 16 words (target about 15). Gist lines are 17 words or fewer (limit 25). The In one line sentence is long (33 words) but one sentence, as asked.
- **The API escapes the tags' brackets** (`\[s1.i1\]`, `\[q1\]`, `(depends on \[s3.i4\])`). The scorer unescapes them. The CLI doesn't yet: `extract-plan` on `run-2/output.md` reads the tasks as `UNNUMBERED_LINE` and the follow-ups with no id. CC-229 (PR #336, "the minutes reader accepts escaped item ids"), opened from run 1's finding, fixes it, so the shape Notion AI writes is read once CC-229 is merged.
- **Project names:** the Projects line listed two subject titles ("onboarding redesign", "pricing pilot") beside the real project, and each task's Scope `Project:` named one of them. Under capture-and-review §6, a Scope Project that names no project holds back that Task: an unattended catch-up would have created neither task. The 0.9 prompt had the same two lines. After run 2 the prompt changed, with the coordinator's yes: the Projects line names only projects named as such, never a subject's title, and a Scope's Project comes only from that line, otherwise empty. Ids, tags and quotes are unchanged, so run 2 stays the gate. **The project-line change is not confirmed by a run:** the test pages were deleted after run 2, so no third run was made. CC-193's release gate is the first run of the changed prompt.

## Runs

| Run | Input | Result |
|---|---|---|
| [run-1](run-1/NOTE.md) | A partial copy of the transcript (22 of 35 paragraphs) | Not the gate. On what it saw: a real toggle, 8 of 8 items, 1 of 1 follow-up |
| [run-2](run-2/output.md) | The full transcript, on its own page | **The gate: pass** (above) |
| [run-3](run-3/NOTE.md) | The full transcript, 0.16.2's prompt (the divided layout) | **The rerun: pass** (above) |

## Limits

One run on a plain page, not a meeting-notes block (README, "Limits"). CC-193's release gate runs the prompt again on a duplicated template's Meetings page.
