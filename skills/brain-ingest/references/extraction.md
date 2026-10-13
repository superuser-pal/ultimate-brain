# Extraction rules (step 6)

How to read one meeting's minutes and decide what becomes a note, what becomes a proposal and what is left out. The minutes may follow notion/minutes-format.md (Attendees, Decisions, Action items, Facts & numbers, Open questions, Risks, Summary), or any other headings, such as Notion AI's. The format is a hint: classify each line by what it says, not by the heading it sits under.

## Who is who

- **The owner:** "I", "me" and descriptions of the owner's role in the minutes ("the new team member" when that is the owner) mean the owner in `brain.json`. Link them to the owner's person note; if there is none, create it in the batch with `title` = the owner name in `brain.json`. Keep the wording verbatim in quoted facts.
- **Mentioned people** (named, not attendees) get a person note only when they own a system, deliverable or decision named in the minutes, or have an action item. Otherwise their name stays in the text, with no note.
- **Projects are per item.** A meeting may touch several projects: set `projects` on each decision and question from what that item is about, and list every one on the meeting. Ask only when an item could belong to two. Tasks get the meeting's projects (`sync tasks` takes no per-task project).

## What each part of the minutes becomes

| In the minutes | Becomes | Through |
|---|---|---|
| The whole meeting | One **meeting** note (`knowledge/meetings/`) | `note new` |
| Attendees | Links to **person** notes. Unknown names → new person notes | `note new` |
| Decisions | A **decision** note if it passes the decision gate; otherwise a line in the meeting body, plus a proposal if it changes a fact | `note new` / `proposal new` |
| Action items | Notion **tasks** (Notion mode), and a list in the meeting body. Never notes | `sync tasks` |
| Facts & numbers | A change to a `facts` key of an existing note → `update_fact`. A new fact about an existing note → `update_fact` with no `before`. Facts about a new note go in its frontmatter | `proposal new` / `note new` |
| Role changes ("Maria is now PM") | `update_fact` on the person's `role` | `proposal new` |
| Open questions | A **question** note (`kind: question`) when it matters beyond this meeting | `note new` |
| Risks | A **question** note with `kind: risk` | `note new` |
| Summary | The meeting note's `summary` (≤200 characters) and its `## Summary` section | `note new` |
| Something that contradicts a loaded note | `contradiction` (both claims kept until the user decides) | `proposal new` |
| A standing requirement of the client ("Acme's legal team requires EU data residency") | `add_to_note` on the org, besides any decision that cites it | `proposal new` |
| An answer to an existing open question | `add_to_note` on the question, with the answer and the meeting as source | `proposal new` |
| A person working on an existing project they're not listed on (new or existing person) | `add_link` on the project, `field: people` | `proposal new` |

## Owner rulings (decision 0031)

When the user answers a pre-check question with content (a ruling, a correction, or a fact the minutes lack), that answer is a source:
- add a **source note** to the batch: `title` `<meeting title> (owner ruling)`, `file_date` today, `source_key` `agent:<agent>/<meeting date>-<meeting slug>-ruling`, body = your question and the user's answer, verbatim;
- every claim resting on it lists this source in `sources`, next to the minutes source;
- a ruling that settles a decision becomes a decision note (when it passes the gate) citing both sources; the meeting's `## Decisions` links it instead of marking the line `^[ambiguous]`.

Answers that only fix the input (a date, attendees, which spellings are one person) are not rulings: use them directly, with no source note.

## The decision gate (AGENTS.md rule 6)

- **"(tentative)" does not lower a decision below the gate.** It only sets `assessment: provisional`. A tentative launch date passes the gate; a tentative routine ("send drafts on Fridays") does not, because routines never do.
- **A decision that changes a fact gets both:** the decision note and an `update_fact` for the fact ("launch on 15 Feb 2027" → `launch_date` 2027-02 → 2027-02-15).
- **An assignment that answers an open question** ("Carlos owns the mobile app") is an `add_to_note` on the question. It gets a decision note only if it passes the gate on its own. The user marks the question Answered in Notion.
- **`deciders`** only when the minutes say who decided; otherwise leave it out.


A decision gets its own note only when at least one of these holds:
- it is **hard to reverse** (a vendor, an architecture, a contract, a hire, a launch date commitment);
- it would be **surprising without context** later ("why are we on Supabase?");
- it is a **real trade-off** between alternatives that were discussed.

Anything smaller ("send the deck on Friday", "use the blue logo") stays a line in the meeting's `## Decisions` section. A decision marked "(tentative)" in the minutes gets `assessment: provisional`. A firm one gets `accepted`. A decision that reverses an earlier decision note becomes a new decision note plus a `supersede` proposal; never edit the old one.

## Facts: change, new, or contradiction

Compare each fact with the loaded notes' current `facts`:
- **Same value:** nothing to do.
- **The minutes state a new value as a change** ("launch moves to February"): `update_fact`, with `after` copied verbatim and `from` = the meeting date (the CLI fills `before`).
- **No current value:** `update_fact` without `before`.
- **The minutes disagree without saying it changed** (e.g. "budget is 70k" while the note says 80k and nobody said it was cut): `contradiction`. The user decides which is true.

Fact keys are lowercase `snake_case` and stable: `launch_date`, `budget`, `deadline`, `owner`, `role`. Reuse an existing key before inventing one. Dates use `YYYY-MM-DD`, months use `YYYY-MM`. Money keeps its unit (`95000 EUR`).

## People

- **Match by alias:** "Maria", "María López" and "Maria (Acme, PM)" are all `per-3h8w2n6c` if those aliases are on her note. When a person is matched under a spelling that is not yet an alias, propose `add_link` with `field: aliases` and the spelling **exactly as written** in the minutes, including the surname if given ("Mari López", not "Mari") (decision 0028). Do this only when organization and role leave no doubt it is the same person; otherwise stop and ask.
- **New person:** create a person note with `title` = their full name as written, `aliases` = the short forms used, `org` if the minutes name their organization and it has a note, `facts.role` + a matching timeline entry only when the role is stated, and `sources` = the meeting. Their note lists the project in `projects`; also propose `add_link` to add them to the project's `people`, because the project note is an existing note.
- **Same name, different person, or one name matching two people:** stop and ask (SKILL.md stop conditions).

## Subject boundary and verbatim (AGENTS.md rule 4)

- Every claim stays on the note of the thing it is about. Carlos's new role goes on Carlos, not on the project. A client's budget goes on the project, not on the client contact.
- Copy names, numbers, dates and quotes exactly as written. "February 2027" stays "February 2027" in prose; in `facts`, convert only to the schema's form (`2027-02`) and keep the prose verbatim.
- Never merge two statements into one claim, and never extend a statement beyond what was said.

## Provenance (decision 0004)

Sentences in note bodies are statements from the meeting (the note's `sources`), unless marked:
- `^[inferred]`: your conclusion, not said in the meeting ("This likely delays the blog.")
- `^[ambiguous]`: the minutes are unclear or contradict themselves.

No other `^[...]` markers. Prefer leaving an inference out over marking it.

## Note bodies

- **Meeting** (for agents; the user's Notion page keeps the human summary): sections in this order, each only if non-empty:
  1. `## Summary`: 2–5 sentences.
  2. `## Decisions`: links to decision notes, and lines for decisions below the gate.
  3. `## Facts`: the facts stated, verbatim.
  4. `## Action items`: `action — owner — due`.
  5. `## Open questions` and `## Risks`: links to question notes.

  Link people and notes with relative Markdown links (decision 0002), e.g. `[Maria López](../people/maria-lopez.md)`.
- **Decision:** `## Decision`, `## Context`, `## Consequences`, `## Sources` (a link to the meeting note).
- **Question:** one or two sentences on what is open and why it matters, with a link to the meeting.
- **Person:** one or two sentences on who they are in relation to the work. Volatile status ("currently on leave") is dated or left out (AGENTS.md rule 7).

## Summaries

Every new note needs a `summary` of at most 200 characters, written so someone scanning `index.md` can tell what it is: "Acme moves the website launch to 15 Feb 2027 to fit the new CMS." It is not "Decision about the launch."

## Earn every note (AGENTS.md rule 5)

Small talk, status updates with no change, and anything already in the brain with the same value produce nothing. A run that creates only the source and the meeting note is a good run.
