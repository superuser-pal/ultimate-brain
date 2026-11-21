# CC-328: the path without Notion AI, walked on a synthetic brain

The fork's changed skills (ultimate-brain-skills, CC-328's fork PR) followed step by step on a synthetic brain, with CC-327's CLI and a simulated Notion: each page in [pages/](pages/) stands in for the Markdown the Notion MCP returns for that Meetings page, and [drop-folder/](drop-folder/) for the user's drop folder. Every name, page id and line is invented.

**How it ran.** The building session followed the skills' text itself; this is not a blind run. The CLI was CC-327's branch (`claude/CC-327-the-cli-for-the-path-without-notion-ai` at `bfdf02b`, PR #474), extracted with `git archive` and built in a scratch folder; the brain came from `brain init --owner "Sam Rivera"` in a sandbox with its own HOME and Git config. No real Notion, brain or remote was touched.

## 1. A pasted transcript gets minutes that pass the check (brain-ingest references/minutes.md)

| Step (minutes.md) | What happened |
|---|---|
| §1 find | [meeting-pasted.md](pages/meeting-pasted.md) is New, has text under a `## Transcript` heading and no minutes in the format: it is offered. [meeting-summary-or-transcript.md](pages/meeting-summary-or-transcript.md) has body text with no Transcript heading and no minutes: asked "is the text on the page a transcript or a summary?" (attended), named under Needs you (scheduled) |
| §3.1 the transcript | the text under the heading, without the template's callout and My notes: [run/transcript.md](run/transcript.md) |
| §3.2 the minutes | written by the session from the text block of `notion/minutes-format.md` (0.16.2's divided layout): [run/minutes.md](run/minutes.md) |
| §3.3 the check | `brain minutes check --page <id> --minutes run/minutes.md --transcript run/transcript.md` → `Minutes check: 12 of 12 items pass (11 needed) · 1 follow-ups`, `ok`, exit 0 |
| §3.6 the log line | `brain log minutes-written - page=<id> items=12 passing=12 mode=attended` |
| once a page | the same check again (the id given without dashes) → `ALREADY_WRITTEN`, `not ok`, exit 1; with `--again` (the user's "write the minutes for …") → `ok`, exit 0 |
| a paraphrase | [run/minutes-paraphrased.md](run/minutes-paraphrased.md), one quote reworded → `11 of 12 items pass (11 needed)`, `ok`, and the failure named: `[s2.i1] not-found: “they crack if you stack them over six high”`. minutes.md §3 step 3 rewrites a failing quote once before writing, even when `ok` is true (added after this run showed `ok` with a failure) |

**Nothing is ingested until Ready.** Writing the minutes sets no property (minutes.md §3 step 5: Brain Status stays New) and the ingest takes only Ready meetings (brain-ingest SKILL.md step 2, notion.md "Which meetings"). After the run the brain's `sources/` holds no source and its history only `init`. What the ingest will read once the user sets the meeting Ready: `brain source extract-plan` on the same two files → `ok`, shape `lean`, 12 paragraphs copied, 6 covered by no item (the small talk among them), no unplaced item, `q1` a Task-to-be (`task: true`).

## 2. A transcript file in the drop folder becomes a meeting (minutes.md §5)

`brain minutes row --file "drop-folder/meetings/2026-11-17 Compost rota call.vtt"` → Name `Compost rota call`, Date `2026-11-17`, Brain Status `New`, and a body that is one `Transcript` toggle with one paragraph per speaker turn (`Sam Rivera: Thanks for joining … from next week.`, `Priya Nair: I can take … start again.`). After `brain log meeting-file - page=<id> hash=<hash>`, the same file again → `FILE_ALREADY_A_ROW`, exit 4, naming the row: the skill moves it to `processed/` without a second row.

## 3. Setup answering no installs neither Brain Assistant nor the minutes prompt (brain-setup)

Step 1's two answers logged as references/prerequisites.md says, then `brain status`'s `setup.required.total`:

| `prerequisites` line | total | taken |
|---|---|---|
| `credits=no meetings=paste` | **7** | neither 4a nor 4b: no minutes prompt, no Brain Assistant; the buttons' line instead |
| `credits=no meetings=notion-ai,paste` | 8 | 4a only |
| `credits=yes meetings=tool,files` | 8 | 4b only |
| `credits=yes meetings=notion-ai,files` | 9 | both |

With `credits=no meetings=paste`, `next` is `remote` (step 2): steps 4a and 4b never come up. SKILL.md "The two answers" leaves both out of the settings screen's "Still to do" and gives the buttons' line.

## 4. "Prep my next meeting" answers from Brain Assistant's own Prep (ultimate-assistant)

ultimate-assistant references/brain-assistant-skills.md reads a skill's text only from `<product.path>/notion/brain-assistant.md`, section Skills, never from the user's Skills database. In the sandbox, `brain status`'s `product.path` holds that file, and its `### Prep` section is the one Brain Assistant's Prep page is made from (docs/notion-space-design.md §10): one text for both paths. The package's `files` include `notion/`, so an installed brain has it too.

## Not run here

- A blind run by a fresh agent, and the live Notion write (the minutes appended as blocks, the row created through the MCP): U-36 is the author's test on a Free workspace after CC-328 and CC-329 are merged.
- `vendor-skills.mjs --check --online` on the release: the release is 0.17.0's one shared skills release, tagged with the author's yes and vendored by the task the coordinator names.
