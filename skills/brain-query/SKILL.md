---
name: brain-query
description: Answer a question from the user's second brain with citations, such as what was decided and why, who someone is, a date, budget, owner or other key fact, what changed and when. Works from the brain repo or any repo linked to it with `brain link`. Read-only, except its report mode, which writes a dated report and publishes it to the Inbox. Use when the user asks "what did we decide about…", "why did we…", "who is…", "when is the launch…", "what do we know about…", "report on…", "where do we stand with…", when an Ask row is waiting in the Inbox, or when the repo's "Ultimate Brain" block says to consult the brain before a decision.
---

# Answer from the brain

Find the notes that answer the question, read them, and answer briefly, citing the notes. **Read-only:** never write to the brain from this skill, except a report in report mode (below). If the user wants an answer saved as knowledge, that is a separate step (an ingest or a proposal), done only when they ask.

## Where the brain is

If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry.

- **In the brain repo:** run `brain <command> --brain . --json`.
- **In a linked repo** (it has a `.brain` file and an "Ultimate Brain" block in AGENTS.md): run `brain <command> --json` without `--brain`. The CLI finds the brain through `BRAIN_DIR` or `~/.config/ultimate-brain/config.json`, and reads `.brain` in the current folder to favour that repo's project.
- **If the CLI exits 3** (`BRAIN_NOT_CONFIGURED`, `BRAIN_NOT_FOUND`), tell the user the brain isn't configured on this machine and stop. Don't search the disk for it.

## Procedure

1. **Search.** Run `brain query --candidates "<the question, in the user's words>" --json`.
   - Add `--types decision` (or `person`, `project`, `question`, …) when the question is clearly about one kind of note.
   - Read each candidate's `title`, `summary`, `assessment`, `lifecycle` and `snippets`. **Usually this is enough to choose what to open.**
   - **Search matches whole words from their start.** If the top candidates miss, search again with abbreviations expanded or reversed ("PM" ↔ "product manager", "CMS" ↔ "content management"), with a person's other names, or with the client's name.

2. **Read** the full text of the few notes that answer it, usually 1–5. Follow the links the question needs:
   - **A decision:** read its `## Decision` and `## Context`. For "why", also open the meeting in `decided_in`, and if the reason isn't there, the meeting's source snapshot (`sources/notion/…`), which holds the minutes verbatim.
   - **A `superseded` decision, or a note with a `superseded_by` relation:** follow it to the current note. Answer with the current one, and mention the old one as history.
   - **A fact** (date, budget, role, owner): read the note's `facts` for the current value, and its `timeline` for when it changed and from which meeting.
   - **A person:** their note's `facts.role` (current) and `org`, and the meetings that list them in `attendees`.
   - **Status, priority or progress:** these live in Notion. Use `notion_fields` and say "as of <`notion_fields.as_of` date>".

3. **If nothing fits:** before saying the brain has nothing, retry with other words (a person's alias, the client's name, a synonym), and grep the brain's note folders for the key term (AGENTS.md rule 2: search before claiming absence). If there is still nothing, say so, and say what you searched.

4. **Answer.** Lead with the answer in one to three sentences, then the evidence.
   - **Cite every claim** with the note path, and with the meeting and date for decisions and facts: "Decided at the Acme sync on 2026-12-03 ([knowledge/decisions/2026-12-03-use-supabase-for-auth.md](…))". Use links relative to where you are, or plain paths.
   - **Label trust**, from the frontmatter and markers:
     - `accepted`: state it plainly.
     - `provisional`: "tentatively", "mentioned once, not confirmed".
     - `contested`: give both values and their sources; don't pick one.
     - `superseded`: "was X until <date>, replaced by Y".
     - Lifecycle `draft`: the user hasn't reviewed this note yet. Say so if the answer rests on it.
     - Lifecycle `disputed`: the user marked it wrong. Say so, and don't rely on it.
     - A sentence ending `^[inferred]`: say it is the brain's inference, not something said in the meeting.
     - `^[ambiguous]`: the sources were unclear.
   - **Separate what the brain knows from your own reasoning.** If you add advice, mark it as yours.

## Report mode (decision 0043)

A report gathers everything the brain knows about one subject, as of today: "report on the Acme launch", "where do we stand with Acme?", or an **Ask** row in the Inbox (the catch-up hands you its page id, its question and its Project or Area). It runs only in the brain repo.

1. **Gather.** `brain query --candidates "<the subject>" --limit 50`, then again with the project's and client's names and the people's names. Read the project or area note, its Brief, and every decision, question, meeting and source that is about the subject. Unlike an answer, a report reads widely: everything that bears on the subject, `draft` notes included.
2. **Write the body:** exactly these six sections, in this order, with nothing before the first (spec/schema.md §16.4):
   1. `## Where it stands`: 3 to 5 lines, as of today.
   2. `## Timeline`: one bullet per dated event, oldest first: `- 2026-12-03 · Supabase chosen for auth ([Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md))`.
   3. `## Decisions in force`: current decisions only; a superseded one appears in the timeline, never here.
   4. `## Open questions and risks`.
   5. `## People involved`, each with their role.
   6. `## Gaps`: what the brain doesn't know ("no development update since August", "no budget figure").

   A section with nothing says `- None`. **Every line that rests on a `draft` note ends with ` *(not reviewed)*`:** a line whose linked note is still `draft`, even when a proposal about it was approved. A proposal still pending isn't in the brain yet: name it under Gaps ("waiting for your review: …"). Links are relative to `reports/` (`../knowledge/…`, `../projects/…`). Trust labels as in step 4 below; copy figures and dates as the notes state them.
3. **Store it:** `brain report new --input <file>` with `{ "title": "<subject>: where we stand", "question": "<the question as asked>", "projects": ["prj-…"], "area": "area-…", "asked_in": "<the Ask row's page id, only for an Ask row>", "body": "…" }`, with note ids for `projects` and `area`. The CLI checks the sections and links and writes `reports/<date>-<slug>.md`. Commit: `report: <title>`.
4. **Publish** *(Notion, per `settings.publish`)*: `brain sync render --changed`, write the Report row (its body is the report: the brain-ingest skill's references/notion.md, "Inbox bodies"), then set the Ask row's Brain Status to Processed through the MCP, then `brain sync record`, and commit `publish: report <title>`. In a catch-up, the run's one publish does this.
5. **Answer in chat** with the "Where it stands" lines and the Gaps, and the link to the Report row when published.

**A report is a snapshot.** It is never ingested, never rebuilt and never cited as a source, and it creates no proposal: if the brain learned from its own summaries, its mistakes would become knowledge. To refresh one, ask again: a new dated report is written.

## Example (synthetic Acme brain)

**Question:** *"What did we decide about auth with Acme, and why?"*

`brain query --candidates` returns the old Firebase decision first (score 16, `superseded`) and the Supabase decision second (15, `accepted`). The skill follows the supersession and answers with the current decision:

> Acme uses **Supabase for auth**, decided at the Acme sync on 2026-12-03 (knowledge/decisions/2026-12-03-use-supabase-for-auth.md). It replaced the earlier choice of Firebase, made at the kickoff on 2026-10-01 (knowledge/decisions/2026-10-01-use-firebase-for-auth.md, now superseded).
>
> **Why:** the minutes record the switch but not the reason. The brain's note suggests Firebase pricing changed and the team already used Supabase for the database, but that is marked as an inference, not something said in the meeting. The decision note is still a draft you haven't reviewed.

## Don'ts

- **Don't answer from `index.md` or the project views alone.** They're for navigation; cite the canonical note they point to (AGENTS.md rule 8).
- **Don't present a superseded or contested value as current.**
- **Don't read the whole brain.** Search, then open a few notes.
- **Don't edit anything,** including a "fix" you notice. Report it instead; the user can change it through a proposal or in Notion.
