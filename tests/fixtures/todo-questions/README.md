# Blind-run inputs for CC-126 (decision 0071)

Synthetic. Two fresh Sonnet agents read only `skills/brain-ingest/` (copied out of the repo) and these files, with no answer key, on 2026-11-04.

- **Ingest** (`minutes-v1.md`, then `minutes-v2-tracked.md`, owner Sam Rivera): A, Tasks on: s1.i2 → question, s1.i3 → one Task (`item` s1.i3, due 2026-12-17), s1.i4 → an Action items line with no Task, s1.i5 → nothing (named under Check), s1.i6 → a risk. B, with `Track: Waiting On —` on s1.i4: the same, plus one Waiting On Task for Dana Kim. C, Tasks off: s1.i3 stays an Action items line and is not a question. D, a re-ingest with no change, with `task_items` for s1.i3 and s1.i4 and an earlier question for s1.i3: no Task created.
- **Tidy** (`brain/`, "turn my to-do questions into tasks"): before the reply it wrote nothing and listed 1 Convert (que-2k4m6p8r) and 1 Drop (que-5n7q9s2t), leaving out the real question and the risk. On "all": `sync tasks --meeting`, the MCP create, `sync record`, then `question drop` with the task, and `question drop` without one for the Drop. On "none": nothing written.
