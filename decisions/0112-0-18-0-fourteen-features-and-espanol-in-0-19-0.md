# 0112 — 0.18.0 holds fourteen features from the LifeOS study, and Español moves to 0.19.0

**Status:** Accepted
**Date:** 2026-11-22
**Release:** 0.18.0 (§A to §E); 0.19.0 (Español, §F)
**Amends:** [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §5 and its release order (Español ships in 0.19.0 with its rules unchanged; three feature releases come before 1.0.0, and 1.0.0 is cut after 0.19.0); [0061](0061-roadmap-and-launch-boundary.md) (release order: an explicit roadmap change after the cutoff); [0111](0111-post-launch-candidates-from-the-lifeos-study.md) §1, §4 and its Consequences (its five candidates get a release, 0.18.0; the author's selection replaces "the beta's reports decide the order"); [0110](0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md) §2 (Your week gains Loose ends and a goal line) and §7 (`brain status` says more about a scheduled job than installed and matches)
**Keeps:** Markdown and Git canonical, Notion as the human interface; [0003](0003-proposal-review-flow.md) as amended (a change to existing knowledge needs your yes); [0008](0008-agent-memory-store.md), [0009](0009-memory-scope-levels.md) and [0074](0074-scoped-memory-handovers-and-bounded-recall.md) (memories, their reach and approval; they never reach Notion); [0015](0015-notion-access-via-mcp.md) (the brain's program never reads Notion; 0111 §3); [0051](0051-unattended-catch-up-and-schedules.md) as amended by 0111 (which takes effect with §1 here); [0072](0072-ultimate-assistant.md)'s ten signals and thresholds; [0075](0075-weekly-review-and-targeted-corrections.md)'s limits as amended by 0110 (5 Actions, 10 doubtful items); [0077](0077-trust-repair-in-0-13-0.md) and CC-345 (one eligibility rule; a view never rests on a memory); [0099](0099-notion-without-decisions-and-questions.md) (a question you follow up is a task); [0101](0101-where-notion-ai-and-the-brain-each-write.md); [0104](0104-product-design-principles.md); 0106 §6 to §8 (the release-candidate bar and the soft launch); 0111 §2, §3 and §5

## Context

0111 recorded five post-launch candidates from the study of the open-source LifeOS project, with no release. On 2026-11-21 the author asked for a second, independent reading of that project, and on 2026-11-22 chose what to build from both lists: the five candidates of 0111 and nine more. The author asked for all fourteen in 0.18.0, for the checks the evaluation had not made to open the release, and for a plan that a coordinator session builds from. Nothing is built by this decision.

0.18.0 was the Español release (0106 §5). Asked where Español goes, the author moved it to 0.19.0: the features ship in English first, and the translation is done once, over finished texts.

What the author left out, from the second reading: "Last met" on People, prep written onto a meeting page unasked, a glossary of the user's terms, and importing existing notes. They stay unrecorded ideas; none is rejected.

## Decision

Each feature below states what the user gets, the rules that bound it and what its opening scope review still has to settle. Where a rule says **default**, the contract may choose otherwise only with the author's answer, recorded in the task.

Rules that hold for every feature:
- **No new Notion database** (0104 §3) and no new everyday tool (0104 §5).
- **The same outcome on macOS and Windows** (0104 §7); any difference is named in the contract with how it is closed.
- **Both agents:** each feature works in Claude Code and in Codex. A difference between the agents is named and is not a platform gap.
- **Nothing rests on a memory** except §2, which lists them (CC-345).
- **The brain's program reads no Notion** (0015): what a feature knows about Notion comes from the agent's live read or the last snapshot, and says which.
- **Texts are written in English**; 0.19.0 translates them (§F).

### A. Rules and what the brain uses about you

#### 1. A rule you state once takes effect (0111 candidate 1)

- When the user says "remember this" about how the brain should work (minutes, ingest, reports, the weekly row), the closing review writes it, after the user's yes, as one line under "My rules" in the brain's `AGENTS.md`, instead of a memory. A lesson for a linked repo stays a memory with its reach, as today (0111 §2).
- The agent says where the rule goes before the yes ("This is about how your brain works: I'll add it to My rules"), and the user can send it to memory instead.
- A rule that contradicts a line already in "My rules" is not added beside it: the agent shows both and asks which stands.
- "Forget that rule" removes the line after a yes. "My rules" stays the user's section: `brain upgrade` never touches it.
- **A scheduled run applies a rule the user stated, as written** (0051 as amended by 0111). A rule the agent inferred is never written to "My rules"; it is offered and waits for the user's words.
- **Depends on §15's check 3:** that a scheduled run and the assistant's sub-agent load "My rules" in both agents. If one doesn't, the contract closes that gap first.
- **To settle:** whether a rule line carries the date it was stated; how the agent tells "about the brain" from "about this repo" when the session is in a linked repo.

#### 2. "What do you use about me here?" (0111 candidate 2)

- One list in chat for the folder the session is in, grouped by where each line comes from: the response style, "My rules", the memories that reach this folder (each with its reach and confidence) and each Area's What to track.
- Each line says how to change it, and the change goes through the existing path for that store (the style setting, a rule edit, a memory's correction or supersession, the Area's `track` proposal).
- Never stored as a view, a report or a Document, and never published to Notion (0008, CC-345).
- **Default:** a list command in the CLI gives the memories that reach the caller, so the skill doesn't rebuild reach itself; `brain recall` today takes exactly one of `--pack` and `--search`.
- **To settle:** whether the list also names the brain's fixed rules block (default: one line saying it exists and where, not its text).

### B. Scheduled runs you can trust

#### 3. The brain says when a scheduled run didn't happen (0111 candidate 3)

- For each job with a slot in `settings.schedule`, the slots that were due are compared with the runs the log records. A slot that was due and left no record is a **missed run**.
- The next attended session says it in one line with its fix ("The weekly review didn't run on Monday: say *weekly review* to run it now"), and the week's row says it in its header.
- A run that happened and found nothing reads differently from a missed run. A run that started and failed reads as failed, with its reason, as today.
- `brain status` gives, per job, its last run and its missed slots, computed offline.
- Only slots after the schedule was installed count, and only on a computer that has the brain's entries. A user who declined a slot never sees it as missed.
- This names a missed run; it does not add a run at login. The macOS gap 0110 deferred (a Mac that is off at a slot skips it) stays deferred, and this feature is how the user learns of it.
- **Depends on §15's check 4:** what a scheduled run records and when. If a run that dies before the agent starts leaves nothing, that is exactly the missed case; if the log can't tell "found nothing" from "never ran", the contract adds the record.
- **To settle:** how far back it looks (default: 7 days, at most 3 lines); whether a run made on another computer and pushed counts (default: yes, the log is in Git).

#### 4. `brain status` is quiet about what you declined (second reading, item 14)

- What the user turned off by choice (a declined schedule slot, a module that is off, `gh` off, no Notion AI) is shown as **off by your choice**, never as a warning and never as "next step".
- A warning the user acknowledged ("I know") stays quiet until what it describes changes. The acknowledgement is recorded with what was true at that moment; a new or different problem speaks again.
- **Never silenced:** a warning about trust, data loss or recovery (the brain off its working branch, an unreadable suppression record, a failed scheduled run, a missed run of §3 until it is run or dismissed).
- **Default:** acknowledgements are kept in `brain.json`, so they follow the brain to another computer.
- **To settle:** the closed list of warnings that can be acknowledged; whether an acknowledgement expires.

#### 5. A plain list of what the scheduled jobs do (second reading, item 15)

- Before the user's yes at setup's schedule step and in "schedule my brain", each job is shown in plain words: when it runs, what it reads, what it may write, what it never does, its spending ceiling where the agent has one, and how to turn it off.
- The same list answers "what runs on its own?" at any time.
- **Default:** the CLI prints the list from the same table that installs the jobs, so the words can't drift from the behaviour.
- A rule from §1 that a scheduled run will apply is listed here too, so nothing steers an unattended run unseen.

#### 6. The next move in the status line (second reading, item 18)

- A command prints one short line, offline and fast, naming what waits: decisions waiting in the session, a missed or failed run, the week's row not yet read. It prints nothing when nothing waits.
- What it knows about Notion comes from the last snapshot and says its age, or is left out: it never calls Notion.
- Opt-in: asked once, at setup or by "show my brain in the status line". The agent's setting is written only after the yes and only in the brain folder, and "remove it" restores what was there.
- The command runs the same on macOS and Windows, with no shell-specific script.
- **Depends on §15's check 2:** whether Codex has a status line. If it has none, Claude Code gets the status line, Codex gets the same line as the first line of a session, and the difference is recorded as an agent difference.
- **To settle:** the line's length and its order of priority when several things wait.

### C. Reports and thinking over your notes

#### 7. A report says when what it rests on has changed (0111 candidate 4)

- A report that cites a decision since superseded, or a fact since changed, shows a stale label naming what changed, and offers a refresh. It is not withheld: this is not an eligibility failure.
- The label shows where the report is read: in `brain lint` and `brain status`, on the report's row in Notion at the next publish, and when the report is used to answer.
- No receipt, judge or "verified" label (0111 §1).
- **Depends on §15's check 5:** that a superseded decision and a changed fact are detectable from what a report records today (`generated_from`, `generated_at`), or what must be recorded.
- **To settle:** which changes count (default: supersession of a cited note, and a change to a cited fact after `generated_at`; a typo fix does not).

#### 8. Reports about a person or an organisation (0111 candidate 5)

- Report mode takes a person or an organisation as its subject: what was agreed, what is open, what they said and when, each line cited. Stored and refreshed like any report, published as a Document with Origin Report.
- No scoring of people, no inferred traits: only what the notes record, with dates.
- A person the brain holds little on gets a short report that says so; the brain never fills gaps.
- **To settle:** the sections of a person report and of an organisation report (today's report has six fixed sections written for a project or an area); whether the report is asked from the person's row in Notion or only in the session (default: session only in 0.18.0).

#### 9. "Think it through" over your own notes (second reading, item 6)

- Five ways of thinking, asked in the session in the user's words:
  1. **Challenge a decision:** each reason behind it as a hard constraint, a soft one or an assumption; who decided and when; which still hold.
  2. **What someone has said over time:** the positions of a person or an organisation across meetings, with how often ("in 6 of 9 meetings") and what changed.
  3. **Where a disagreement stands:** each side's position, what they agree on, and what would change each mind.
  4. **First principles** (the author's addition): the question broken into what the notes establish as true, and the answer rebuilt from there.
  5. **Second-order effects** (the author's addition): for a decision about to be taken, what follows next and what follows from that, against the user's projects, commitments and goals.
- Every line is marked as **from your notes** (cited) or **reasoning** (the agent's own step). A mode never presents reasoning as a recorded fact.
- A mode says when the notes are too thin for it ("only one meeting mentions this") and stops there.
- It writes nothing by default. "Keep this" stores the result through an existing path.
- No web research, and no new database or note type.
- **Default:** a mode of the existing query skill, not a new skill.
- **To settle:** the words that start each mode; the form a kept result takes (a report or a learned Document); whether Notion Brain Assistant offers them (default: session only in 0.18.0).

#### 10. Facts, conclusions and recommendations kept apart at ingest (second reading, item 16)

- When a document someone else wrote is ingested, each statement taken from it is marked as a **fact** it reports, a **conclusion** of its author, or a **recommendation** of its author. The part's preview shows the three groups before the yes.
- A recommendation never becomes the user's decision, and a conclusion is never stored as a fact: the decision gate stays as it is.
- Later answers keep the mark ("the report recommends…", not "you decided…").
- **Depends on §15's check 6:** where a document's statements are kept today, so the mark has one place.
- **To settle:** which inputs get the split (default: documents the user did not write; meetings and the user's own notes are unchanged); what an ambiguous statement becomes (default: a conclusion).

### D. The weekly row

#### 11. Loose ends in the weekly row (second reading, item 8)

- Your week gains **Loose ends**: what is stuck halfway in Notion, as counts with the oldest date ("3 meetings not marked Ready since 10 Nov", "4 Inbox rows still New").
- Rendered by the CLI from the run's snapshot, at most 3 lines, information only: nothing to tick, and it counts against neither the 5 Actions nor the 10 doubtful items. Left out when nothing is stuck or Notion wasn't read.
- **Depends on §15's check 1:** what the row already says about these. Anything it already says is not said twice.
- **To settle:** the kinds (default: meetings not Ready and Inbox rows left New) and how old a row must be (default: 7 days); the row's 450-word cap with the new lines.

#### 12. One slipping goal a week (second reading, item 9)

- With the Planning module on, Your week names at most **one** goal with no movement: an active goal none of whose projects or tasks changed in the period. It says the last thing that moved and when.
- Below it, at most 3 **goals with no open work**: an active goal with no live project and no open task.
- No score, no estimate of capacity, no advice on what matters. The same goal is not named two weeks running while another one qualifies, and the weekly row's rule for dismissed items applies.
- Computed by the weekly run only: it is not an eleventh assistant signal (0072 unchanged).
- Off, with no line, when the Planning module is off.
- **To settle:** the period (default: 21 days, as a stalled project); what counts as movement.

#### 13. Expectations you can check later (second reading, item 12)

- When an ingest finds a dated expectation about someone else ("they will sign by 15 December"), it offers to track it, in the part's questions. The user can also say "track that …".
- **Default:** a tracked expectation is a task with Kind Question, its date as the due date and **how to check** in its text: no new database, Kind value or property (0099, 0104 §3).
- In the week of its date, the weekly row asks "did this happen?" as one of the Actions. The answer is recorded as a fact on the notes it concerns, through a proposal.
- No score of how reliable a person is (0111 §1).
- **Depends on §15's check 7:** how the assistant and the weekly row treat a Kind Question task today.
- **To settle:** whether the question counts against the 5 Actions (default: yes); whether the user's own forecasts are tracked the same way.

### E. A problem report that is safe to send

#### 14. "Report this problem" (second reading, item 7)

- At any time the user says "report this problem". The CLI builds the report: versions, agent, platform, the failing command with its error code, the health summary's counts and the last log lines.
- **Redaction is done by code, not by the agent:** the home path, the owner's name, emails, Notion ids and links, repository names and every note title are replaced.
- **Then a second pass refuses:** if any string the brain knows to be private (the owner, a person, an organisation, a project or Area title, a path, an id from `brain.json`) is still in the text, the command fails and names the line, and nothing is offered for sending.
- The report is shown whole, then sent only after a yes, as the setup report is today: `gh issue create` with a label, or, when `gh` is off or missing, a prefilled new-issue link, and the text to paste when the link would be too long. No telemetry.
- It reuses the setup report's rules ("no names, no content") and its path; the setup report gains the same refusing pass.
- **To settle:** the label; which log lines are safe by construction.

### F. Español in 0.19.0

- 0106 §5 holds word for word, with 0.19.0 where it says 0.18.0: the guides, a Spanish template, the skills' texts and the CLI's messages, the name map, the parity tests, the author's read. English users see nothing change before 0.19.0.
- 0.19.0 translates 0.18.0's texts too. From 0.19.0 on, a PR that changes a migration or a guide changes both languages.
- CC-354 and U-40 move to 0.19.0 with their text. [0109](0109-meetings-use-the-inbox-s-status-names.md)'s "0.18.0's name map" is 0.19.0's.
- 1.0.0 is cut after 0.19.0. Its release-candidate bar (0106 §6) is unchanged.

### 15. The release opens with its checks

Before any contract is written, a first task answers, from the code, the contracts and the vendors' current documents, with no sitting by the author:

1. What the weekly row already says about loose ends (§11).
2. Whether Codex has a status line, and what Claude Code's needs (§6).
3. Whether a scheduled run and the assistant's sub-agent load "My rules", in Claude Code and in Codex (§1).
4. What a scheduled run records in the log, and when (§3).
5. Whether a superseded decision and a changed fact can be detected from what a report records (§7).
6. Where an ingested document's statements are kept (§10).
7. How a Kind Question task is treated by the assistant and the weekly row (§13).

Each answer is recorded with its evidence. An answer that changes a rule above goes to the author before the contracts start.

The release then opens with its scope review (0061), on the **To settle** lines above.

### 16. What this costs

- 0.18.0 is the largest release since 0.16.0, and 1.0.0 moves later by a release.
- 0111 §4 wanted the beta's reports to order this work. The author chose to build ahead of them. The beta's evidence is still read at the scope review, and a feature whose check in §15 shows it is already covered is dropped there.
- If the release proves too large to ship at once, the groups are separable: B and E (keeping the brain running) can ship before A, C and D. Splitting is the author's call, recorded as an amendment.

## Consequences

- `build/TASKS.md`: 0.18.0 becomes this release, with its rows; a 0.19.0 section holds CC-354 and U-40; the release sequence gains 0.19.0, and 1.0.0 follows it.
- `docs/vision.md`, `docs/v2-ideas.md` and `AGENTS.md` name the new order.
- "Amended by 0112" lines in 0061, 0106, 0110 and 0111.
- No spec, CLI, skill, template, Notion or CHANGELOG change in this decision's own PR.

## Evidence

- The author's selection of 2026-11-22: all five candidates of 0111 "in 0.18.0"; the second reading's items 6 to 9 "as well", with "Think it through might need to have additional thinking models like first principles"; "12, 14, 15, 16, and 18"; the unverified points to "the initial stage of 0.18.0"; and "plan this, draft the requirements, but don't implement; this will be the task of another coordinator agent".
- The author's three answers of the same day: Español moves to 0.19.0; prep written onto the meeting page stays out; first principles and second-order effects are added to "Think it through".
- Read on 2026-11-22: `spec/weekly-review.md` §3, §5 and §11; `spec/assistant.md` §3.3; `spec/cli.md` §5.2, §5.18 and §5.21; `spec/memory.md` §3; `spec/setup.md` §7 and §12; `templates/brain/AGENTS.md`; `src/lib/schedule.ts` (`scheduleStatus`).
- 0111's evidence, and LifeOS read statically and never run.
