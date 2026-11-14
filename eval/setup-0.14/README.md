# The 0.14.0 release gate: a fresh user from template to first value (CC-193)

A fresh user, Ines Varga, goes from `npm install` to the first-meeting line in a clean duplicate of the published Notion template, with Claude Code. (A second run with Codex was planned; the author took it out of this gate on 2026-11-13.) The runs measure what an early-access tester gets (0078 §5), so they use the published package and template, never a product checkout.

Everything is synthetic: [persona.md](persona.md) holds the description, the scripted answers and the expected result of each check; [documents/](documents/) holds the three key documents. The meeting is the Rider App 2.0 sync of [../minutes-0.14/transcript.md](../minutes-0.14/transcript.md).

| File | What |
|---|---|
| `persona.md` | Who Ines is, what she types, her answers, and what each check must show |
| `documents/` | Her three key documents: the launch plan (the `tasks` and `report` checks), the station survey (the `answer` check), the Paylane email |
| `RESULTS.md` | Each run: the agent, the package and snapshot, timings, the four checks, what survived duplication, the first-meeting line, problems found |

## Before a run

1. **A clean test space.** In a Notion workspace with Notion AI, duplicate the published template (the page that `docs/setup.md` links) into a test page, never into or next to a real brain's Brain Data. Check its System callout reads the template version `notion/TEMPLATE.md` names. Connect the Notion integration the agent uses to the duplicate only.
2. **A clean machine state for the brain.** A new empty folder (e.g. `~/ub-gate-claude`, `~/ub-gate-codex`), no brain in it, and a private GitHub repo the setup creates or that is empty. `gh auth status` works (0086: `gh` is required).
3. **The package.** `npm install -g ultimate-brain@<candidate>` (0.14.0-rc.N, or 0.14.0). Record `brain --version` and the snapshot in `skills.lock.json` after setup.
4. A timer: write down the clock time at each step.

## The run

1. In the empty folder, start a fresh Claude Code session with no other context. Say **"set up my brain"**.
2. Act as Ines with [persona.md](persona.md): paste her description, give her scripted answers, drop the three documents into the drop folder when asked. An unscripted question stops the run; record it.
3. At first value, judge each check against persona.md's table, not against what the skill shows. Do as the skill asks to fix a failure, and record the attempt.
4. After `result=done`, check the schedule is offered only then (answer "not now").
5. Do the first meeting as persona.md says, then "catch up". Copy its first-meeting line.
6. In the brain folder: `git status`, `git branch --show-current`, `git log origin/<branch>..` (nothing unpushed), `gh pr list` (no pull request), `git worktree list` (one), `brain status --brain . --json`.
7. Look at the duplicate in Notion and record what survived duplication: the Custom Agent (Brain Assistant) and its access, the buttons that message it, the relations, the Home buttons, and whether the minutes prompt lives in the Meetings template.
8. Fill a RESULTS.md section. Replace every Notion id, URL and email with `<id>`, `<url>`, `<email>`: the leak check refuses them.

Afterwards the test space may be deleted.

## Limits

- One run per agent; the agents aren't deterministic, so a pass shows the path works, not that every run will.
- The tester's judgment ("are these your commitments?") is made against persona.md, by the person running the gate.
- Notion AI (minutes, Brain Assistant) can't be driven through the API, so the meeting step needs a person in Notion.
