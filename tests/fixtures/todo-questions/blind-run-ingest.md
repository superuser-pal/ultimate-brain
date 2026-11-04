# Blind run: ingest classification (2026-11-04, Sonnet, fresh context)

Run on the skill as of commit 1fa923d. The skill was copied out of the repo, and the agent was given no answer key. Its inputs are `minutes-v1.md` and `minutes-v2-tracked.md` in this folder.

## Prompt

> You are an agent that operates a personal "brain" with a skill. Read ONLY the skill at /tmp/cc126-blind/skill/ (SKILL.md and the files in references/) and the input files named below. Read no other file on this machine, run no `brain` command, and call no Notion or other service: this is a dry run on paper, where you say exactly what you would write.
>
> Setting, for all scenarios: the brain's owner is Sam Rivera (`brain.json` owner; aliases "Sam", "I"). Notion is configured. The meeting is confirmed (Brain Status Reviewed), its summary has item ids, so it is a selected input: assume `brain source extract-plan` placed every quote and every item's effective selection is `use`. The project "Globex onboarding" exists as prj-4f6g8h2j. The meeting note will be mtg-6r8t2v4w, and the extract source src-9b3c5d7f.
>
> A. First ingest of minutes-v1.md with the Tasks module ON.
> B. Instead of A: first ingest of minutes-v2-tracked.md (the same meeting, where the user marked one item), Tasks ON.
> C. Instead of A: first ingest of minutes-v1.md with the Tasks module OFF.
> D. After B was ingested and published: task_items on the extract is { "s1.i3": "task-page-A", "s1.i4": "task-page-B" }. The user sets the meeting back to Reviewed with no change to its text (a re-ingest). Separately, assume the brain also already holds a question note que-7m9p2r4t, raised in this meeting in an earlier version of the product, titled "Sam to draft the onboarding checklist?" for item s1.i3. What Tasks, if any, does this re-ingest create?
>
> For each of A, B and C give: 1. every knowledge note you would create (type, kind for questions, title, item id); 2. the exact `brain sync tasks` input (JSON), or "none"; 3. the lines of the meeting note's `## Action items`; 4. what goes under the report's Check; 5. for each item id s1.i2 to s1.i6, one line: what it became, and the rule in the skill that decided it. For D: the Tasks created (with item ids) or "none", and why, citing the skill.

## Output (verbatim)

### A. First ingest, minutes-v1.md, Tasks ON

**1. Knowledge notes**
- `meeting`: "Globex onboarding sync" (the whole meeting), linking `prj-4f6g8h2j`
- `question`, kind `question`: "Has Globex approved the budget for the second phase?" ← `s1.i2`
- `question`, kind `risk`: "Globex IT may not have the user list ready before the start date" ← `s1.i6`
- `person` notes for Dana Kim and Lee Park, only if the match step finds none (Dana has an action item; Lee is an attendee)
- Nothing for `s1.i3`, `s1.i4`, `s1.i5`. (`s1.i1` → no note; an `update_fact` for the start date 2027-01-11 if the project holds a different value. The source is the extract, so no `note new` for the source.)

**2. `brain sync tasks`**
```
brain sync tasks --source src-9b3c5d7f --input items.json
{ "items": [ { "title": "Draft the onboarding checklist for the finance team", "item": "s1.i3", "due": "2026-12-17", "projects": ["prj-4f6g8h2j"] } ] }
```
(After the Notion page is created: `brain sync record` with `tasks: [<page id>]` and `task_items: { "s1.i3": "<page id>" }`.)

**3. `## Action items`**
```
- Draft the onboarding checklist for the finance team — Sam Rivera — 2026-12-17
- Share the signed contract with the whole team — Dana Kim — no date
```

**4. Check**
- `s1.i5`: unclear owner, so no task and no question.
- The 17 December due date has no year in the minutes: dated 2026-12-17 from the January 2027 start.
- Under the report's Action items: Dana's contract item is not a task. Write `Track: Waiting On —` before that item on the page to track it.

**5. Per item**
- `s1.i2` → question note (`extraction.md` "Questions or commitments", row 1: a later document can settle it)
- `s1.i3` → Task (`due` 2026-12-17) + Action items line (`extraction.md` "Questions or commitments", the owner's own to-do row; `selection.md` §6 "Whatever the section", owner's explicit commitments; Sam is the owner via the aliases in `brain.json`)
- `s1.i4` → Action items line only, no Task (`selection.md` §6 "Another person's commitment" with no `Track` token; `extraction.md` someone else's commitment row)
- `s1.i5` → nothing, named under Check (`extraction.md` "Questions or commitments", the ambiguous-owner row; `selection.md` §6)
- `s1.i6` → question note, `kind: risk` (`extraction.md` "Questions or commitments", the risk row)

### B. First ingest, minutes-v2-tracked.md, Tasks ON

**1. Knowledge notes:** identical to A. The `Track` token on `s1.i4` adds no note.

**2. `brain sync tasks`**
```
brain sync tasks --source src-9b3c5d7f --input items.json
{ "items": [
  { "title": "Draft the onboarding checklist for the finance team", "item": "s1.i3", "due": "2026-12-17", "projects": ["prj-4f6g8h2j"] },
  { "title": "Share the signed contract with the whole team", "status": "waiting_on", "owner": "Dana Kim", "item": "s1.i4", "projects": ["prj-4f6g8h2j"] }
] }
```
(If `brain.json` `notion.tasks.properties.owner` is empty, the title becomes "Waiting on Dana Kim: Share the signed contract with the whole team", and the user is told. `brain sync record` then carries `task_items: { "s1.i3": "<page id>", "s1.i4": "<page id>" }`.)

**3. `## Action items`:** the same two lines as A (Dana's line stays in the body too: everyone's items are listed there).

**4. Check:** only `s1.i5` (unclear owner, so no task and no question) and the year assumed for 17 December. Dana's item is a Task now, so it is not listed as an item that failed to become a task.

**5. Per item**
- `s1.i2` → as A
- `s1.i3` → as A
- `s1.i4` → Waiting On Task for Dana Kim + Action items line (`selection.md` §6, "Another person's commitment … unless the item carries `Track: Waiting On —`"; the user wrote the token, it was not added)
- `s1.i5` → as A
- `s1.i6` → as A

### C. First ingest, minutes-v1.md, Tasks OFF

**1. Knowledge notes:** identical to A, with no extra notes. `s1.i3` is **not** turned into a question.

**2. `brain sync tasks`:** none (`selection.md` §6: with Tasks off, write no Task items and say nothing about them).

**3. `## Action items`**
```
- Draft the onboarding checklist for the finance team — Sam Rivera — 2026-12-17
- Share the signed contract with the whole team — Dana Kim — no date
```

**4. Check:** `s1.i5` (unclear owner) and the assumed year. Under the report's Action items, both lines appear, since they did not become tasks. Tasks being off is not mentioned.

**5. Per item**
- `s1.i2` → as A
- `s1.i3` → Action items line only, never a question (`selection.md` §6 "With Tasks off"; `extraction.md` "Questions or commitments", the owner's to-do row: "with Tasks off, a line in the meeting's `## Action items`")
- `s1.i4` → Action items line, as A
- `s1.i5` → as A
- `s1.i6` → as A

### D. Re-ingest after B, text unchanged

**Tasks created: none.**
- `SKILL.md` steps 2–3: the exact text was already ingested, so the dry run skips it as `DUPLICATE_SOURCE`. Nothing changed: skip to publish and set Brain Status back to Ingested. Equivalently on the extract path, `extract-plan` returns `write_required: false` (`UNCHANGED`) and goes straight to Tasks (`selection.md` §2).
- `s1.i3` and `s1.i4` already have `task_items` entries (`selection.md` §6 "Never twice": no second Task).
- `s1.i3` is also held as question `que-7m9p2r4t`, raised in this meeting: the same "Never twice" paragraph and `extraction.md` "Re-reads" forbid turning a question into a Task. Only the to-do tidy (`todo-tidy.md`) converts or drops it, after the user's yes.
- `s1.i5`: unclear owner, so no Task. `s1.i2` and `s1.i6` are not to-dos.
- Under Check: `que-7m9p2r4t` duplicates the existing Task for `s1.i3`. Offer the tidy's Drop for it, but don't act without a yes.
