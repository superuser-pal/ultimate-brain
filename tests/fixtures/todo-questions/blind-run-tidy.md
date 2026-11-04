# Blind run: the to-do tidy (2026-11-04, Sonnet, fresh context)

Run on the skill as of commit 1fa923d. The skill was copied out of the repo, and the agent was given no answer key.

## Prompt

> You are an agent that operates a personal "brain" with a skill. Read ONLY the skill at /tmp/cc126-blind/skill/ (SKILL.md and the files in references/) and the brain files in /tmp/cc126-blind/brain/ (here: `brain/`). Read no other file on this machine, run no `brain` command, and call no Notion or other service: this is a dry run on paper, where you say exactly what you would do.
>
> Setting: the brain's owner is Sam Rivera (`brain.json` owner; aliases "Sam", "I"). Notion is configured and the Tasks module is on. Meeting mtg-3h5j7k9m ("Steering prep", 20 Nov 2026) is published, and its note's `tasks` is empty. The project prj-4f6g8h2j is "Globex onboarding".
>
> Turn 1. The user says, in chat: "turn my to-do questions into tasks". Report: (a) every command or write you would do BEFORE the user replies, or "none"; (b) the exact message you would send to the user.
>
> Turn 2. The user replies "all". Report, in order, every step you would do for each item (commands with their JSON input; use "page-X" for a Notion page id the MCP returns), then the final three-line report.
>
> Turn 3 (instead of turn 2). The user replies "none". What do you do?
>
> Be literal and brief.

## Output (verbatim)

**Turn 1**

(a) Commands before the user replies:
- `brain status --brain <brain> --json` (read-only: owner, Tasks module on, Notion configured).
- Read the four question files in `knowledge/questions/` (file reads, not commands).
- No writes. No `brain index`, no `brain sync`, no `brain question drop`, no Notion calls. The tidy is attended: nothing is written until the user answers.

Classification:
- `que-2k4m6p8r` "Send the board deck…": Sam's own to-do ("I'll send the board deck…") → **Convert**
- `que-5n7q9s2t` "Will Dana share…": Dana's commitment → **Drop** (no task)
- `que-8v2w4x6y` "Is the phase two budget approved?": a real question → not listed
- `que-3c5d7f9g` "Vendor may deliver the scanners late": `kind: risk` → not listed

(b) Message to the user:

```
2 open questions read as to-dos, not questions:
1. Convert: "Send the board deck to the steering group?" → task "Send the board deck to the steering group" (Steering prep, 20 Nov · Globex onboarding)
2. Drop: "Will Dana share the signed contract?" (Dana's commitment: no task)
Which ones? "all", the numbers, "all but 2", or "none".
```

**Turn 2: user replies "all"**

Item 1, Convert `que-2k4m6p8r`:
1. `brain sync tasks --meeting mtg-3h5j7k9m --brain <brain> --input items.json --json` with input `{"items":[{"title":"Send the board deck to the steering group","projects":["prj-4f6g8h2j"]}]}` (no `due`: no date given; no `item`: not a re-read).
2. Notion MCP: create the page in the returned `database_id` with the returned `properties` → MCP returns `page-X`. (If the item has `pending_relations`, I would not create it: stop that item and report.)
3. `brain sync record --brain <brain> --input - --json` with `{"records":[{"id":"mtg-3h5j7k9m","synced_at":"<now ISO UTC>","tasks":["page-X"]}]}`
4. `brain question drop --brain <brain> --input - --json` with `{"items":[{"id":"que-2k4m6p8r","task":"page-X"}]}`

Item 2, Drop `que-5n7q9s2t`:
5. `brain question drop --brain <brain> --input - --json` with `{"items":[{"id":"que-5n7q9s2t"}]}`

Finish:
6. `brain index`, `brain views`, `brain lint`: stop on a lint error in a file this run wrote.
7. `brain log tidy-questions - converted=1 dropped=1`
8. Commit in the brain repo: `tidy: 1 to-do questions converted, 1 dropped`
9. Publish: `brain sync render --changed` → Notion MCP updates the two question pages (Lifecycle Archived and Status Dropped, as render returns them) → `brain sync record` with one record per page written.
10. Commit `publish: to-do tidy`, then push per `settings.push`.

Final report:
```
Done: 1 to-do question turned into a task · 1 dropped
Needs you: nothing
Next: nothing; the task is in Notion
```

**Turn 3: user replies "none"**

Nothing is run or written: no `sync tasks`, no `question drop`, no Notion call, no log, no commit. Both questions stay as they are. Reply in one line: "Nothing changed; the questions stay as they are."
