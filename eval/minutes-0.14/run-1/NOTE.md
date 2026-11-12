# Run 1: not the gate (partial input)

Run on 2026-11-12 by the user in a Notion test space, read back by the coordinator with the Notion API's `retrieve-page-markdown` and kept unchanged in `output.md` (no page id was in it).

**Not a fair gate.** Before Notion AI ran, the page **Gate transcript** held only a partial copy of `transcript.md`, ending at "I need final wording before we build the screens." (paragraph 22 of 35). The output fits that input: it covers the launch and onboarding subjects only.

**What it shows** (`score.txt`, scored against the full transcript):
- The For the brain toggle is a real toggle block: the API returns `<details>` / `<summary>For the brain</summary>` with tab-indented children, the form spec/capture-and-review.md §4.1 reads.
- 8 of 8 items carry an id and quotes that occur verbatim, each in exactly one paragraph (15 quotes, none over 12 words); 1 of 1 follow-up carries a `q` id; no line over 15 words, no untagged line, no problem the scorer reports.
- The API escapes the tags' brackets (`\[s1.i1\]`, `\[q1\]`). The scorer reads them; whether the CLI does is a separate task (reported to the coordinator).

**What the partial input explains:** everything after paragraph 22 is missing: subject s3 (the pricing pilot, 4 expected items, among them the only `Idea:` line), both owner tasks (so no Tasks for the brain section and no Scope toggles), and follow-ups 2 and 3 (the brand font files, the provider call). Notion AI wrote s2.i4 as "Open: Final wording for the three screens; owner needs clarification", which is right for what it saw: the owner's commitment is the next line after the cut.

So the riskiest part (task lines with Scope toggles in the readable part, beside the For the brain toggle) is untested here. Run 2, on the full transcript, is the gate.
