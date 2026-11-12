# The runs' prompts

Each run's task, verbatim, as given to a fresh general-purpose sub-agent (run 3's continuation was sent to the same agent). `@SANDBOX@` is the sandbox folder. One change from the originals: run 1's scripted email was `sam@` at `example.com`; it reads `sam@studio.example` here, the address the leak check allows (the address only fills the Git identity).

## Run 1: first setup, no Notion tools

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- Notion plan question: "Yes, I have Notion AI. No Custom Agents."
- The settings screen, first time: "My email is sam@studio.example. Keep the rest."
- The settings screen shown again: "Yes."
- Git identity scope, if asked separately: "All my repositories."
- Creating the private remote on their Git host (if the skill gives steps): the user created an empty private repository whose URL is file://@SANDBOX@/remote.git; run the commands the skill gave with that URL, then continue.
- Anything about the Notion template or connecting Notion: the user says "OK, I'll do that now" (and nothing more happens in this session).
```

## Run 2: resume without Notion

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, comes back after a break and says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- Anything about the Notion template or connecting Notion: "OK, I'll do that now" (and nothing more happens in this session).
```

## Run 3: resume to the seeding preview

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, has reconnected their agent to Notion, restarted it, and says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- When asked to describe their work: "I'm a project lead at a small renovation studio, Northwind Interiors. My main client is Harbor Lane Homes: we're renovating their kitchen and bath, the Harbor Lane renovation, due in spring. I'm also pitching a cafe fit-out for Bluebird Cafe. I work most with Robin Vale, the site manager at Harbor Lane Homes; Jamie Ortiz, a freelance electrician; Priya Shah, my partner at the studio; Leo Brandt, who owns Bluebird Cafe; and Mina Cho, our supplier at Tilecraft. At home I'm planning a garden redesign this summer. No folder or repo to adopt."
- There is no scripted answer to the seeding preview itself: when you have shown it, stop there.
```

## Run 3, continued (sent to the same agent)

```text
The scripted user answers the preview: "yes to all". Continue the skill exactly as before (same RULES.md; re-read @SANDBOX@/skills/brain-setup files if you need them). Further scripted answers (use only these; stop as RULES.md item 5 says when none fits):
- Asked to drop key documents: "I'll add them later."
- Review rows to decide before first value: "There's nothing in Review."
- Asked to run or say "report on <main project>": "Yes, run it." (If the skill or the report needs a skill you don't have, say what you would do and record that check as you judge it.)
- Is the organised list right, anyone twice?: "Yes, that's right, nobody twice."
- Any other first-value question: "Yes."
- The scheduled catch-up: "No, not now."
- Send the setup report as an issue: "No."
When you stop, end with the same report format as before (messages shown, Eval notes with commands, setup log lines, git status), covering only this continuation.
```

## Run 4: first value unresolved

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- Asked to take or drop a key document now: "Yes: I've put harbor-lane-site-notes.md in my drop folder. Keep it as a document under Harbor Lane renovation."
- Any question the ingest asks about that file (which parts, keep as document, place it): "Keep it whole, as a document, under the Clients area and the Harbor Lane renovation project."
- Asked to decide the Review rows, or to accept an item from the document: "I looked: there's nothing in it I want to accept, so I rejected it all." (If you need to record that decision, the user rejects every item of that Review row in chat.)
- Asked whether tasks are their own commitments, or about tasks: answer truthfully from the document only if the question still applies; the user's position is "None of those are mine: Robin and Jamie said them."
- Asked to run "report on Harbor Lane renovation" or similar: "Yes, run it."
- Asked whether each note is where they expect and whether anyone is listed twice: "No: Robin Vale is listed twice."
- Asked to ask a question about an accepted item: there is no accepted item; if you ask anyway the user says "I didn't accept anything."
- If setup offers the scheduled catch-up: "Yes, turn it on." (Record in your eval notes that it was offered.)
- After setup stops at first value, the user says: "show my setup report". Then, to the offer to send it: "No."
```

## Run 5: first value resumed to done

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, comes back the next day (they turned the Tasks module off meanwhile) and says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- Asked about a document to take in, or about the checks that failed: "I've put harbor-lane-worktops.md in my drop folder; keep it whole as a document under the Clients area and the Harbor Lane renovation project."
- Asked before publishing to Notion: "Yes, publish."
- Asked to decide the Review row or accept an item: "I accept the worktop decision; reject anything else in that row." (If the decision has to be recorded in chat, the user approves that one item and rejects the rest, in chat.)
- Asked to ask a question about the accepted item: "What did we decide about the kitchen worktops, and why?"
- Asked whether the answer is useful and the passage supports it: "Yes, that's useful, and the passage supports it."
- Asked whether each note is where they expect and whether anyone is listed twice: "Yes, that's right now: I was looking at an old page outside the brain."
- Asked about any task: the user has no tasks to check (they turned Tasks off).
- Offered the scheduled catch-up: "No, not now."
- Offered to send the setup report: "No."
Note in your eval notes which first-value checks you kept from the last attempt and which you ran again, and why.
```

## Run 6: seeding through Ultimate Assistant

```text
Start with a fresh context: you have no prior knowledge of this project. First read @SANDBOX@/RULES.md and follow it exactly.

The user, in their brain folder @SANDBOX@/brain, has reconnected their agent to Notion, restarted it, and says: "set up my brain"

You are Claude Code. The scripted user's answers (use only these; if a question isn't covered, stop as RULES.md item 5 says):
- When asked to describe their work: "I'm a project lead at a small renovation studio, Northwind Interiors. My main client is Harbor Lane Homes: we're renovating their kitchen and bath, the Harbor Lane renovation, due in spring. I'm also pitching a cafe fit-out for Bluebird Cafe. I work most with Robin Vale, the site manager at Harbor Lane Homes; Jamie Ortiz, a freelance electrician; Priya Shah, my partner at the studio; Leo Brandt, who owns Bluebird Cafe; and Mina Cho, our supplier at Tilecraft. At home I'm planning a garden redesign this summer. For client work I want the brain to track budgets, deadlines and client sign-offs. No folder or repo to adopt."
- The first time the seeding preview is shown: "6: Status Planned" (or, if item 6 isn't the Bluebird Cafe project, the change "the Bluebird Cafe project: Status Planned").
- The preview shown again: "yes to all".
- Asked to drop key documents: "I've put harbor-lane-site-notes.md in my drop folder; keep it whole as a document under the Clients area and the Harbor Lane renovation project. That's my only one for now."
- Any other question the ingest asks about that file: "Keep it whole, under Clients and Harbor Lane renovation."
- Asked before publishing the document to Notion: "Yes, publish."
- When setup reaches step 7 (the first-value check) and asks its first question, stop there.

In your eval notes also say: which files of the ultimate-assistant skill you followed for the seeding and what they decided; the area notes' `track` lists as written; how the ingest of the document used the Clients area's tracking list (if at all); and the lifecycle of each person note written.
```

## Run 7: the first-meeting line and the template version (targeted)

```text
Start with a fresh context: you have no prior knowledge of this project. Read @SANDBOX@/RULES.md and follow it, with these changes for this run: the brains are @SANDBOX@/brainA, brainB, brainC and brainD (pass `--brain <that folder>` to every brain command; begin every shell command with `. @SANDBOX@/env.sh;`), the skills to read are @SANDBOX@/skills/brain-catch-up/SKILL.md and @SANDBOX@/skills/brain-notion-change/SKILL.md, and there is no scripted user: do not ask anything. This is a targeted check of two rules, not a full run: do only what each part says, then report.

Part 1, brain-catch-up's section "4. Publish, push, report", steps 5 and 6 only (the report's three lines and the first meeting after setup). Assume an attended catch-up has just done everything before step 5 on the brain, and that it ingested exactly one Reviewed meeting, "Harbor Lane weekly sync" (it is not in the brain; assume it), whose ingest created 2 Tasks for the owner (0 from quick follow-ups), wrote 3 notes, matched 2 attendees to existing person notes and created 1 new person note. The rest of the run: 1 input ingested, nothing needs the user. For each of these, in order, follow steps 5 and 6 exactly, including any log line, commit and push they call for, and show the report you would give:
  (a) brainA; (b) brainB; (c) brainB again, as a second catch-up the next day that also ingested one Reviewed meeting with the same counts.

Part 2, brain-notion-change's "Migrate" section, steps 5 and 6 only. Assume steps 1 to 4 were done and checked for a migration file named 0025-example-change.md, which has no step that updates the System page. Follow steps 5 and 6 exactly (including any config change and commit) for: (d) brainC; (e) brainD.

End with: the report or message for each of (a) to (e); then "Eval notes": the commands you ran with their key results, the `setup` log lines of brainA and brainB (`grep -h ' setup - ' <brain>/log/*.md | tail -3`), `brain config get notion.template_version` for brainC and brainD, `git status --short` of each brain, and anything unclear, missing or wrong in the two skills' text.
```
