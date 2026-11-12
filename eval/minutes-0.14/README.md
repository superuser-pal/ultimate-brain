# The lean minutes prompt gate (CC-197, decision 0079 §6)

Before the lean minutes ship in 0.14.0, the prompt of [notion/minutes-format.md](../../notion/minutes-format.md) is run once by Notion AI on a synthetic transcript, and its output is counted against 0079 §6's bar, the bar of capture-and-review T6 (spec/capture-and-review.md §9.2):

- at least 9 of 10 items carry an id and quotes that occur in the transcript (here: every quote of the item occurs verbatim, after whitespace and quote-mark folding, in exactly one paragraph, as T6 counted), and
- every quick follow-up carries a `q` id, and
- the **For the brain** toggle is a real toggle block, which the Notion API's markdown returns as `<details><summary>For the brain</summary> … </details>`. The contract reads only that form (§4.1, "Shapes", rule 1), so the gate records the form Notion AI writes: a toggle heading (`## For the brain {toggle="true"}`) or a plain line fails it, and reading another form would be a contract change first.

Notion AI can't be run through the API, so the run needs the user, in a test space, never their brain.

| File | What |
|---|---|
| `transcript.md` | The synthetic meeting: the Rider App 2.0 sync of an invented bike-rental company. Four invented people (the owner is Ines Varga), three subjects, small talk to leave out, 13 expected items (4 + 3 + 4 subject lines, 2 tasks) and 3 quick follow-ups of the owner. |
| `reference-output.md` | What a perfect run looks like, written by hand in the Notion API's markdown form. Never shown to Notion AI. It scores 13 of 13 and proves the scorer (`tests/minutes-gate-score.test.mjs`). |
| `score.mjs` | The count: `node eval/minutes-0.14/score.mjs <output.md>` prints the counts, each miss and the verdict; `--json` gives everything. |
| `run-1/` | The run: `output.md` (as returned by the API) and `score.txt`. |
| `RESULTS.md` | The counts against the bar and what the run showed. |

## Running the gate

In a Notion **test** space with Notion AI, never in the space that holds Brain Data:

1. Create a page **Gate transcript** and paste the whole of `transcript.md` into it as plain paragraphs (one paragraph per speaker turn, as the file has them).
2. Create an empty page **Gate minutes** next to it.
3. On **Gate minutes**, open Notion AI and send one message: the whole text block of `notion/minutes-format.md` (between the ```` ```text ```` fence lines, not the fences), then, after a blank line, these two lines:

   ```text
   The transcript is on the page @Gate transcript. For this test, I am Ines Varga.
   Write the minutes on this page, Gate minutes, and nothing else.
   ```

   (`@Gate transcript` is a real @mention of the page from step 1.)
4. Let it write the minutes onto the page. Don't edit them, regenerate them or ask for changes: the gate is the first output.
5. Read **Gate minutes** back as the Notion API's markdown: `GET /v1/pages/<page id>/markdown` (the Notion MCP's "retrieve page markdown" tool), with the user's yes for that one page. That text, unchanged, is `run-1/output.md`. A copy from Notion's screen loses the toggle's form, so it can't show the third point of the bar; it would be recorded as such.
6. Before committing, replace any page id or link in the output (a mention of the transcript page) with `<page>`: the leak check refuses ids. Nothing else is changed.
7. `node eval/minutes-0.14/score.mjs eval/minutes-0.14/run-1/output.md > eval/minutes-0.14/run-1/score.txt`, then record the counts in `RESULTS.md`.

Afterwards the user may delete both test pages.

## Limits

- One run. Notion AI isn't deterministic, so this shows the prompt can meet the bar, not that every run will. CC-193's release gate runs the prompt again, inside a duplicated template's Meetings page.
- The run uses Notion AI on a plain page, not a meeting-notes block's summary: a pasted transcript can't feed a meeting-notes block. Whether the block's summary writes the toggle the same way is CC-193's to see.
- The count is this folder's, not the CLI's parser (CC-196): it reads the same tags, toggle and quote rule, and also lists what §4.1 would report (lost tags, orphan quote entries, tokens on readable lines, Selection lines outside the toggle) so a shape problem is visible even when the bar passes.
