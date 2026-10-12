---
name: brain-query
description: Answer a question from the user's second brain with citations, such as what was decided and why, who someone is, a date, budget, owner or other key fact, what changed and when. Works from the brain repo or any repo linked to it with `brain link`. Read-only. Use when the user asks "what did we decide about…", "why did we…", "who is…", "when is the launch…", "what do we know about…", or when the repo's "Ultimate Brain" block says to consult the brain before a decision.
---

# Answer from the brain

Find the notes that answer the question, read them, and answer briefly, citing the notes. **Read-only:** never write to the brain from this skill. If the user wants the answer saved, that is a separate step (an ingest or a proposal), done only when they ask.

## Where the brain is

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
