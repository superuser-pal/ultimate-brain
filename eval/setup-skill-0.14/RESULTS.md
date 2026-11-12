# Results: blind runs of brain-setup (CC-191), 2026-11-11

All runs used the CLI at `d0c52cf` (`brain --version` 0.12.0), the stand-ins described in [README.md](README.md), and a fresh general-purpose sub-agent per run (run 3's continuation went to the same agent). Fork commits are in ultimate-brain-skills, on the branch of fork PR #14. The `setup` lines are those the run added, as `grep -h ' setup - ' <brain>/log/*.md` printed them, without timestamps. Lines from earlier runs or from `start-state.sh` are not repeated.

| Run | Fork commit | Skills in the sandbox | Notion | Starting stage |
|---|---|---|---|---|
| 1 | `42b3704` | fork: brain-setup, brain-connect-notion; no others | none | `fresh` |
| 2 | `96de483` | as run 1 | none | `connected` |
| 3 | `da6c132` | as run 1 | stand-in | `notion-lost` |
| 4 | `2241266` | fork: brain-setup, brain-connect-notion; CLI snapshot: brain-ingest, brain-apply, brain-query, brain-sync, brain-catch-up | stand-in | `seeded` |
| 5 | `501b64d` | as run 4 | stand-in | run 4's sandbox, Tasks turned off, a second document (`resumed` approximates it) |
| 6 | `8c37e84` | the defaults: fork brain-setup, brain-connect-notion, ultimate-assistant, brain-ingest, brain-catch-up, brain-notion-change; CLI snapshot: brain-apply, brain-query, brain-sync, brain-workflow-adopt | stand-in | `notion-lost`, with `inputs/harbor-lane-site-notes.md` in the drop folder |
| 7 | `8c37e84` | as run 6 | stand-in | run 6's brain, then `prepare-run7.sh` |

Runs 1 and 2 used `RULES.md` without its product-files exception in item 1. They needed no product file: the CLI at `d0c52cf` has no `notion/TEMPLATE.md`, so step 3 used the checklist.

## Run 1: first setup, no Notion tools

The agent went through steps 1 and 2 and stopped at step 3. Steps 1 and 2 ran with Notion AI yes, no Custom Agents, and the settings kept with the email filled in. Without `gh`, the remote came from the skill's steps for a local repository. Setup stood at 4 of 9.

```text
setup - "" step=started result=done
setup - "" step=prerequisites result=done notion_ai=yes custom_agents=no
setup - "" step=settings result=done
```

Found, then fixed in the fork:

- `32e7b99`: push the current branch, no commit before the identity, the log grep, settings from `brain.json`.
- `96de483`: `.example` addresses, the remote URL kinds as code.

One finding went to the spec. The CLI writes `setup - "" step=…`, so §4.1's example was fixed in this PR.

## Run 2: resume without Notion

Start: steps 3 to 5 recorded as done, as if by the user in another session, and no Notion tools in this session. The online check reopened step 3, the agent logged it failed, and it stopped there with the connection steps.

```text
setup - "" step=notion-mcp result=failed reason=notion-unreachable
```

Found, then fixed in `da6c132`: a reopened step is logged before the count, and the template is never offered again once the space was connected.

## Run 3: resume to the seeding preview, then through to the end

The search found Brain Data and step 3 was logged done. The agent asked for the description and showed the preview. **Nothing was written before the yes**: the brain's only change was the `notion-mcp` line.

```text
setup - "" step=notion-mcp result=done
```

After "yes to all", the agent turned the Domains module on and wrote 16 notes plus their source (`inputs/run3-seed.json` is that batch). It then ran first value, declined the schedule, showed the report (not sent) and wrote `finished`:

```text
setup - "" step=seeding result=done notes=16 documents=0
setup - "" step=first-value result=done tasks=fail report=fail organised=pass
setup - "" step=schedule result=declined
setup - "" step=finished result=done
```

That `first-value result=done` with two failed checks followed the phase 1 rule, where an attempt counted as done. CC-213 (#314) corrected the contract, and step 7 was rebuilt (`2241266`). Runs 4 and 5 check the rebuilt step.

Found, then fixed:

- `4619b72`: Domains on before the batch, the source and role formats, a failed publish, checks with no document, people by Org.
- `8ed0c73`: the count once the required items are done, the report's step history.

## Run 4: first value unresolved

Start: run 3's seeded brain with nothing published, and `harbor-lane-site-notes.md` in the drop folder. That document holds no commitment of the owner. The user rejected all of its Review row and said Robin Vale was listed twice.

```text
setup - "" step=first-value result=failed reason=first-value-unresolved tasks=unsuitable report=pass organised=fail answer=unsuitable
```

- No task, Review item or answer was invented: the Notion stand-in's Tasks database had 0 pages afterwards.
- The schedule was not offered: no `schedule` line.
- The setup report, asked for while unresolved, showed step 8 as `not offered (first value unresolved)` and wrote no `finished` line.
- The agent showed each check not passed, the smallest next action, and how to resume.

Found, then fixed in `501b64d`: a document taken in step 7 keeps the passed checks, and the count line names the real next step.

## Run 5: first value resumed to done

Start: run 4's sandbox the next day. The user had turned Tasks off and dropped `harbor-lane-worktops.md`.

- The agent kept `report` (passed before) and showed `tasks` as `skipped (Tasks off)`.
- It ran `organised` and `answer` again. The ingest took in the worktop decision and published it after a yes, and the user accepted one item.
- The question "What did we decide about the kitchen worktops, and why?" was answered with the passage it rests on, and the user confirmed it.
- Only then was the schedule offered (declined), and `finished` written.

```text
setup - "" step=first-value result=done tasks=skip report=pass organised=pass answer=pass
setup - "" step=schedule result=declined
setup - "" step=finished result=done
```

Found, then fixed in `dd21375`:

- a `tasks` check left over when Tasks is turned off becomes `skip`;
- a Review row decided with nothing accepted;
- step 4b's bracket in the report comes from the plan answer.

## Run 6: seeding through Ultimate Assistant

Start: steps 1 to 5 recorded, Notion reconnected, and the site notes in the drop folder.

- **The preview.** Seeding went through `ultimate-assistant/references/ramble.md`, its "Seeding" section and its rows. The preview was changed once ("6: Status Planned"), then "yes to all".
- **The notes.** It wrote 16 notes and their source. The People were written `draft`, each with `facts.role` and a `timeline` entry. Clients' `track` used the user's words (budgets, deadlines, client sign-offs). The Domains module was turned on before the batch.
- **The publish.** It published the notes, then set each Project's Status and each Domain's Type on the new pages.
- **The document.** It was kept whole under Clients and Harbor Lane renovation. Its ingest kept the bathroom budget as a fact, because Clients tracks budgets.
- The run stopped at step 7's first question, as scripted.

```text
setup - "" step=notion-mcp result=done
setup - "" step=seeding result=done notes=16 documents=1
```

Found, then fixed in `31847c3`:

- Domains are matched through `brain index`, since `brain query` takes no `domain` type;
- the seeding publish includes its source;
- the drop folder's question is not asked a second time.

Not a skill problem: CLI 0.12.0 refuses the `passages` keys that the fork's brain-ingest sends since CC-180, so the agent left them out. The 0.14.0 CLI accepts them.

## Run 7: the first-meeting line and the template version (targeted)

Four copies of run 6's brain:

- **brainA:** first value unresolved, with `organised` fail.
- **brainB:** first value passed.
- **brainC:** template 0024.
- **brainD:** no template version.

There was no scripted user. The agent followed brain-catch-up's section 4, steps 5 and 6, and brain-notion-change's Migrate, steps 5 and 6.

- **(a) brainA.** The catch-up report had no first-meeting line, and nothing was logged.
- **(b) brainB.** The report had one line: "First meeting in: 2 tasks for you, 3 notes, 2 people matched, 1 new person. Anything wrong? Say "that's wrong: …"". The agent logged `setup - "" step=first-meeting result=done`, committed `setup: first-meeting` and pushed.
- **(c) brainB the next day.** No first-meeting line, and nothing was logged.
- **(d) brainC.** After migration 0025, `notion.template_version` was `0025` (it was `0024`), committed as `config: template version 0025`.
- **(e) brainD.** The version stayed unknown: nothing was set and nothing committed.

Found, then fixed in `b9ff13c`:

- the line's counts and its place under the three lines;
- the singular "1 new person";
- the unknown case: `config get`'s USAGE means no value;
- the versions are compared as numbers;
- the commit is pushed per `settings.push`;
- the System page sentence.

## Not covered by a run

- **The fixes after each run.** `31847c3` and `b9ff13c` were read against the findings that led to them, not run again blind. Fork PR #14's head is `b9ff13c`.
- **Limits of the stand-in.** notion-sim writes no page bodies and has no database templates. Bodies were rendered by the CLI but not written to the stand-in.
- **The path without Notion AI** (steps 4a and 4b not required) was read but not run.
