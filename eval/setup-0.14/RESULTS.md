# Results: the 0.14.0 release gate (CC-193)

One run, with Claude Code, from `npm install` to the first-meeting line. The Codex run was taken out of this gate's scope by the author on 2026-11-13; see "Scope" below.

## Run 1: Claude Code

- **Date:** 2026-11-13
- **Package:** `ultimate-brain@0.14.0-rc.2` (npm `next`) · **skills snapshot:** ultimate-brain-skills 1.8.4 (`skills.lock.json` `installed_by` 0.14.0-rc.2) · **template version:** 0024
- **Agent:** Claude Code, a fresh headless session (`claude -p`, resumed turn by turn) in a new brain made with `brain init` (without `--set-default`, so the machine's existing brain stayed the default). The person running the gate played Ines from [persona.md](persona.md); the steps in Notion (the minutes prompt, Brain Assistant, Review, the meeting) were done by hand in a fresh duplicate of the published template.
- **Notion:** a duplicate of the published template in a test page of a workspace that also holds a real brain's space and the template itself (three spaces with the same page and database names).

### Timings

From the brain's `setup` log lines (UTC). Wall time includes the time the person took in Notion and the gate's own investigation; the agent's own time over the 21 turns was about 32 minutes.

| Step | Done at | Minutes |
|---|---|---|
| Prerequisites, settings, backup created | 18:02 | 2 |
| Notion connected, 15 Example rows trashed | 18:06 | 4 |
| Minutes prompt (failed twice, then passed) | 18:34 | 28 |
| Brain Assistant (`/Today`) | 20:02 | 88 |
| Identities | 20:03 | 1 |
| Seeding: preview, 14 notes, 3 documents | 20:17 | 14 |
| First value (Review decided, four checks) | 20:38 | 21 |
| Total to first value | | 2 h 38 |
| First meeting: catch-up, two turns (the minutes by hand not timed) | 22:44 | 10 |

The 88 minutes of Brain Assistant were mostly finding why `/Today` read another space (problem 4) and a break; the 28 of the minutes prompt were two failed runs (problem 3).

### First value

| Check | Result | Evidence |
|---|---|---|
| `tasks` | pass | From the launch plan: "Finalise the beta tester list (40 riders from the current app)", Rider App 2.0, due 2026-11-28; "Sign off the app store listing text", Rider App 2.0, due 2027-01-09. Tomas's, Priya's and Dario's commitments were listed as others' and not made Tasks; "revisit the referral scheme" became nothing. Exactly persona.md's expectation. |
| `report` | pass | "Rider App 2.0: where we stand" in Documents, linked to the project, citing the three documents; it lists what the brain knows and six gaps. |
| `organised` | pass | Work › Product › Rider App 2.0 (1 decision, 3 questions, 3 Documents); Personal › Running › Port Aldern half marathon; the six people once each under their Orgs; the owner's note with no Org (the tester noted it and accepted it). |
| `answer` | pass | Item accepted: the survey's decision "Start the harbour pilot with 12 stations". Question: "How many stations does the harbour pilot start with, and why not all 14?" Answer: 12; Pier 3 and Ferry Terminal have no power connection for the chargers yet (eight to ten weeks), and join once it is in; it cites the accepted decision note and quotes the survey's two paragraphs. The tester confirmed it is useful and the passage supports it. |

Latest `first-value` line:

```text
setup - "" step=first-value result=done tasks=pass report=pass organised=pass answer=pass
```

Schedule offered only after `result=done`: yes (answered "not now"; `settings.schedule` off).

### What survived duplication

| Item | Survived | Note |
|---|---|---|
| Brain Assistant (Custom Agent) and its access | yes | Checked by the tester in the duplicate after the first meeting; its database access came with the duplicate. Its skills reached the wrong space through the @ picker (problem 4). |
| Buttons that message it | yes | Checked by the tester after the first meeting. |
| Relations | yes | Seeding, the documents and the Review apply wrote and read every relation they use (Area › Domain, Project › Area, People › Org, Documents › Project, Tasks › Project). |
| Home buttons | yes | Checked by the tester after the first meeting. |
| Minutes prompt in the Meetings template | yes | Checked by the tester after the first meeting. |
| The Skills database and its rows | yes | The duplicate's Today skill points at the duplicate's Brain Data. But its rows did not appear in the @ picker (problem 4). |
| The Example rows and the Brain Data callout | yes | 15 Example rows, all trashed by setup after one yes; a second query found none. |

### First meeting

The Rider App 2.0 sync was made from the Meetings template, its minutes written by Notion AI in the chat with the line "Write the minutes on this page, below the transcript, and nothing else.", no follow-up ticked, and set to Reviewed (about 22:33 UTC). Then "catch up" in a fresh headless session of the same brain, in two turns:

1. The first turn found the meeting but ingested nothing: the page held the minutes and the For the brain toggle, but no transcript, and the brain stores only the transcript paragraphs each quote points to (problem 8). It asked for the transcript on the page or as a file.
2. The second turn was given the transcript as a file (the path the skill offered) and a yes to publish. It ingested the meeting, created the Tasks and published.

```text
First meeting in: 4 tasks for you, 5 notes, 4 people matched, 0 new people. Anything wrong? Say "that's wrong: …".
```

```text
setup - "" step=first-meeting result=done
```

Against persona.md: the two dated tasks are Ines's (the onboarding copy, due 2026-12-12; the pilot pricing brief, due 2026-12-17), and the other two are the unticked quick follow-ups (book the call with the payment provider; forward the regulation PDF and send the font files). Tomas's and Dario's commitments stayed text in the meeting note. 4 people matched, **0 new people**: as expected. The 5 notes are the meeting, three decisions and one question, as drafts, with one Review row for the changes to existing notes.

The catch-up's two turns took 3 min 15 s and 7 min 6 s (43 and 66 turns) and cost about 15 USD in all (4.34 + 10.57; problem 9).

### The brain at the end

Checked again after the first meeting (step 6), with the same results.

- Working branch, nothing unpushed: yes. On `main`, a clean tree, 0 commits ahead of the remote, which is private.
- No branch, worktree or pull request opened by setup: yes. One worktree, no pull request on the backup repository.
- `brain status`: no warnings, no errors.
- Setup report holds no names or content: yes. It holds versions, modules, step results, reason codes and counts:

```text
Ultimate Brain setup report
CLI 0.14.0-rc.2 · skills ultimate-brain-skills 1.8.4 · agent Claude Code · platform darwin
Notion AI: yes · Custom Agents: yes · modules: domains, knowledge, orgs, documents, reports, tasks
Time: 2 h 38 min (first setup line to the last)
1 prerequisites: done
2 settings: done (markitdown on, gh on)
3 notion-mcp: done
4 connect: done (template 0024, 15 examples removed)
4a minutes-prompt: failed 2 times (shape-wrong, shape-wrong), then done
4b brain-assistant: done (custom agent)
5 identities: done
6 seeding: done (14 notes, 3 documents)
7 first value: passed on attempt 1 · tasks pass · report pass · organised pass · answer pass
8 schedule: off
```

### What went as designed

- Prerequisites found everything at once, and the settings screen applied in one yes and created the private backup with `gh`.
- With three spaces of the same names, setup listed the three Brain Data pages with their parents and recommended the fresh duplicate; it touched neither of the others.
- The seeding preview matched persona.md, and named what was its own reading (the Domain names, the Running Area, the statuses, the board updates as a project). The tester dropped the board-updates project; nothing was written before the yes.
- The structure block (decision 0089) was written after seeding: Personal › Running › Port Aldern half marathon, Work › Product › Rider App 2.0, each with its id and Notion page.
- The documents became Documents under Product and Rider App 2.0, with one Review row each, and the tasks were exactly the owner's.

### Problems found

Each is described as it would happen to any tester; none is fixed here (a fix is its own task).

1. **The minutes prompt's place and the way to run it are not said.** The skill says to paste the prompt "wherever you keep your meeting-summary prompt for Notion AI on Meetings"; docs/setup.md says "into your Notion AI settings". Twice, Notion AI wrote the readable part but no **Scope** toggle and no **For the brain** toggle, and replaced the transcript on the page (`shape-wrong` twice). The third run, sent to the Notion AI chat with the transcript kept on the page and the line "Write the minutes on this page, below the transcript, and nothing else", gave the full shape at once. Setup's check caught both failures and named what was missing.
2. **A second brain on the same machine is offered the first brain's drop folder.** The settings screen proposed the existing `~/Documents/brain-dropbox/` (it said that folder already exists, so its contents would be read by the first catch-up). Two brains reading one drop folder would take each other's files.
3. **The template's property names drift from the design.** Setup's property check found `Areas · To Review` and `Areas · Meetings to Review` where the design has "To review" and "Meetings to review", and the duplicated Inbox still has retired extras (the Kind options Report and Minutes, the Full text and Refresh report properties).
4. **Brain Assistant can reach another space's skill.** In the new Custom Agent, the @ picker offered only one "Today", the other space's, and the duplicate's skills didn't appear in it (likely not indexed yet). Run that way, `/Today` listed another space's tasks and Review rows. Mentioning the duplicate's Today page by its link gave the right answer. `/Today` as a slash command is not recognised in a Custom Agent; the setup step and the guide say `/Today`. The agent's access had also been given three databases named Skills; the step's "pick the ones under …" was not enough to tell them apart.
5. **Review decisions arrived as row-level Approve.** Two rows were applied as a row-level Approve rather than per-item `Decision:` lines, and the third arrived with no decision; the tester first asked whether to decide "in the property or in the body". The apply was correct, but deciding in the page body is not what a first-time user reaches for. Decision 0090 (merged after rc.2, release 0.15.0) already moves the decision to Your call and adds a guided review in Notion AI.
6. **The Decision log showed a decision before it was reviewed.** The project's Decision log in Notion listed the 12-station decision while its Review row was still waiting.
7. **Dead links in new Inbox rows.** Notion turned the file name in the first line of each of the three Inbox rows the drop-folder ingest made into a link that leads nowhere.

8. **The transcript doesn't stay on the meeting page.** After the minutes step the page held the minutes and the For the brain toggle but no transcript, so the first catch-up ingested nothing and asked for it (the meeting stayed Reviewed). Run 1's problem 1 already saw Notion AI replace the transcript; the line asking it to write below the transcript wasn't enough here. Neither setup nor the minutes guide says where the transcript must be (the meeting-notes block, or the page body) or checks it before the meeting is marked Reviewed.
9. **One meeting's catch-up cost about 15 USD.** The two turns ran 109 agent turns (4.34 and 10.57 USD), with the setup notes' Review rows, the report and 16 Notion pages in the same run. For a tester on a usage plan that is a large first bill.
10. **Setup's own report asks for Accept before it can be refreshed.** The catch-up wouldn't republish "Rider App 2.0: where we stand" because "its wording has not been accepted yet", although setup made it minutes earlier and nobody edited it; a first-time user is asked to click Accept on a page they never changed.

Minor, not product problems: the persona's documents are dated after the run (the agent noted it and copied the dates as written); Notion AI filled "Me" in the sample meeting's Attendees with the Notion account's own name, so test pages are never copied into this repository.

## Scope

- **Codex:** CC-193's Output and Acceptance ask for a second run with Codex before U-28. On 2026-11-13 the author took it out of this gate's scope; this gate records the Claude Code run only.
