# CC-258: where the transcript and the minutes are read (gate problems 1 and 8)

This is a blind check of the fork's changed steps (ultimate-brain-skills PR #33 at `904f4fa`) on five synthetic meeting pages in [pages/](pages/). Each page stands in for the markdown the Notion MCP returns for that page. A `<transcript>` element inside `<meeting-notes>` stands for what the meeting's transcript tool returns. That form is an approximation, and CC-266 meets the real one on rc.3. The meeting pages reuse `tests/fixtures/minutes-0079/notion-export-summary.md` and `notion-export-transcript.md`. The setup pages use brain-setup's own sample meeting. Every name is invented.

**How it ran.** A fresh Sonnet sub-agent had no project context and read only three texts:
- brain-setup references/notion.md, "Step 4a";
- brain-ingest references/notion.md, "What counts as minutes";
- brain-ingest references/selection.md, §2 step 1.

It said which log line and message it would give, or wrote the summary and transcript files it would pass to the CLI. Then `brain source extract-plan` ran on those files in a synthetic sandbox brain (`brain init`, a failing `gh` stub).

| Page | What the page holds | Agent's result | `extract-plan` |
|---|---|---|---|
| setup-pass | the sample in the body, then lean minutes below it | `step=minutes-prompt result=done` | `ok`, lean, 0 unplaced |
| setup-no-transcript | lean minutes, no sample | `step=minutes-prompt result=failed reason=transcript-missing`, with the fix word for word | not run (setup's check) |
| meeting-recorded | lean minutes as the meeting-notes block's own summary, transcript in the block | summary: the block's summary (as before); transcript: the block's Transcript | `ok`, lean, 10 paragraphs, 0 unplaced |
| meeting-pasted | an empty meeting-notes block; a pasted transcript in the body, chat-written minutes below it | summary: the body minutes; transcript: the body text above them | `ok`, lean, 10 paragraphs, 0 unplaced |
| meeting-no-transcript | an empty meeting-notes block; chat-written minutes in the body, no transcript | blocker (no transcript), no files, the fix word for word | not run (blocked) |

The recorded and the pasted page gave byte-identical summary and transcript files. A page whose only minutes are in the block's summary therefore reads as before, and a pasted transcript with chat-written minutes reads the same way.

**What the agent had to guess** (none of it changes an outcome):
- Step 4a gives no wording for a pass.
- "Verbatim" doesn't say whether the transcript tool's wrapper tag is kept.
- Blank lines around a pasted transcript aren't specified. `extract-plan` normalises whitespace for matching, so they don't change the plan.
