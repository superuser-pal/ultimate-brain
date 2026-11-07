# 0.10.0 acceptance: results (CC-110)

The blind runs of [docs/acceptance-0.10.0.md](../../docs/acceptance-0.10.0.md), on 2026-11-07, with `main` at 9018320 merged in (CC-109's skill vendored as ultimate-brain-skills 1.2.0).

- **Installation:** `install.sh /tmp/cc110/i` gave `vendored skills OK: ultimate-brain-skills 1.2.0` and `installed: 0.10.0`. The fixture check on a fresh sandbox passed: `192/192 checks pass; 13 findings at 2026-12-01, 13 planted`.
- **Sandboxes A to G:** each was made with `make-sandbox.sh … "$(date +%F)"`, so `D` = 7 Nov 2026. Variants: D `repos`, E `unreachable`, G `fail-update` (then `clear-fail` before G2).
- **Runners:** one fresh Sonnet general-purpose sub-agent per session, given [harness/RULES.md](harness/RULES.md) with the sandbox filled in, its start, and the user's first message. The building session answered with the scenario's words and checked every result on the sandbox's files, Git, and the notion-sim state and call log (`evidence.mjs`, `reference.mjs`).

**Verdict:** every scenario passes. No change happened without a yes or a "propose". No run wrote more Review rows than it was asked for, and no page showed more than 10 findings. The findings in §4 are wording, count and guidance gaps; none changed what landed in Git or Notion.

## 1. Sessions

| Session | Sandbox | Start | User's words, in order | Scenarios |
|---|---|---|---|---|
| A1 | A | agent | `Review my projects.` · `more` · `1: due 14 Nov` · *(user-edit: logo task Status → Doing)* · `yes 2b` · `yes 7` · `yes 8` · `yes 9` · `yes 12` · `Studio` · `yes 6` · `Draft the abstract` · `done` | 3.1, 3.2, 3.9 |
| B1 | B | agent | `Review my projects.` · `more` · `propose 13` · `propose 12` · `12: Studio` · `propose 10b` · `skip 4` · `Someday` · `skip 3 because the client paused it` · `no, just skip it` · `skip 11` · `no reason` · `show the skipped ones` · `unskip s2` · `done` | 3.3, 3.4 |
| B2 | B | chat | *(user-edit: Your call Approve, Approve, Reject on the three rows)* · `Sync my brain.` | 3.3 |
| B3 | B | agent | `Review my projects.` · `done` | 3.3, 3.4 |
| C1 | C | chat | the ramble of 3.5 (Due `13 Nov`) · `yes 1, 2, 3, 4, 5; later 7` | 3.5 |
| D1 | D | agent | `Review my projects.` · `done` | 3.6 |
| E1 | E | agent | `Review my projects.` · `yes 2` · `propose 3` · `Also, I need to call Ines Marlowe about the contract by 13 Nov.` · `done` | 3.7 |
| F1 | F | sub-agent | `Review my projects and tasks. report only` | 3.8 |
| F2 | F | sub-agent | `Review my projects.` (never resumed) | 3.8 |
| G1 | G | agent | `Review my projects.` · `yes 7` · `done` | 3.10 |
| G2 | G | agent | `Review my projects.` · `done` | 3.10 |

No runner called a Notion MCP tool, the real `gh` or anything outside its sandbox (C7). Every runner's first command was `brain status`, which named its sandbox's brain.

## 2. Scenarios

### 3.1 Signals: pass
- **The report (A1):** the first page and "more" were identical to the reference. The page-1 snapshot A1 wrote, run through `brain assistant findings`, gave a `data.report` byte-equal to `reference.mjs A`. Page 2 showed numbers 11 to 13, as `reference.mjs -- --exclude <page 1 keys> --number-from 11` does.
- **Coverage:** the 13 findings are exactly planted.json's `planted` (signal and pages), and none of the 8 `not_flagged` rows appears. "Get a quote from the tiler" (Waiting On) and the rows one day under a threshold are absent.
- **Each signal's line** reads as the doc's table says, and each recommendation was carried out where the table says (below). S1 to S10 all pass.
- **The same report elsewhere:** B1, F1, F2 and G1 showed the same first page.

### 3.2 A yes in chat: pass (A1)

| Answer | Proposal | What changed | Confirmation |
|---|---|---|---|
| `1: due 14 Nov` | `prp-w1rmsyxe` notion_change tasks due `2026-10-28` → `2026-11-14`, finding `task_overdue:notion:…019`, `decided_by: chat`, applied | Tasks · Update the case studies · Due 2026-11-14 | `1: due date moved to 14 Nov` |
| `yes 7` | `prp-ckj7qxaw` notion_change projects status Active → Done, applied | Projects · Larkspur Bakery packaging · Status Done | `7: Status set to Done` |
| `yes 8` | `prp-8bw9t4qc` set_field area, applied; then `prp-xs402tgj` notion_change tasks area (no finding), applied | `projects/studio-newsletter/project.md` area → Marketing, committed (c97027a), then published (7e48610: Projects page Area = Marketing's page, Brief and Decision log toggles); Tasks · Write the December issue · Area = Marketing | `8: moved to Marketing, with its 1 open task` |
| `yes 9` | `prp-mw94azfa` merge (target the catalog redesign, merge_into the catalogue), applied; then `prp-wweyg7de` notion_change tasks project (no finding), applied | merge committed (53c8c64) and published (8ae1cd0: both project pages, the duplicate Archived); Tasks · Lay out the catalog grid · Project = the catalogue | `9: merged into Quayside Books catalogue, with its 1 open task` |
| `yes 12` → `Studio` | `prp-97y242h1` set_field domain = Studio's id, applied | `areas/finance.md` committed (8c65e6c), published (b217b41: Areas · Finance · Domain = Studio's page) | `12: Finance moved to the Studio Domain` |
| `yes 6` → `Draft the abstract` | none (`sync tasks --direct`) | Tasks · Draft the abstract · To Do · Project = Conference talk proposal · Area Marketing (from the project); nothing in Git | `6: added the task "Draft the abstract" …` |
| `done` | | `brain index`, `views`, `lint` (0 errors); log `assistant - "" mode=live scope=all findings=13 shown=13 applied=7 proposals=0 dismissed=0 tasks=1 projects=0 captures=0`; commit 7d1aa76; tree clean | `Done: 7 changed, 1 created (1 task).` |

- **C1, the report:** identical to the reference.
- **C2, nothing before an answer:** after the report there were 0 commits and 0 writes.
- **C3, every write traced:** A1 made 16 notion-sim writes. Each belongs to one of the answers above (the publishes are the `update` and `toggle` calls that follow a brain-owned yes).
- **C4, each change the one named:** every proposal carries `source` `agent:ultimate-assistant/20261107T132227Z`, and every one from a finding carries its key.
- **The summary's count:** 7 changed counts the move's and the merge's task moves, as §4.4 says.

### 3.3 A Review row when asked, decided in Notion: pass (B1, B2, B3)
- **B1:** `propose 13`, `propose 12` (the Domain was asked first, `12: Studio`) and `propose 10b` wrote 3 pending proposals and 3 Review rows:

  | Review row | Kind | State |
  |---|---|---|
  | `Suggestion: Workshops: Archived → yes` | Notion Change | Pending |
  | `Suggestion: Finance: Domain → Studio` | Set Field | Pending |
  | `Suggestion: Book a dentist appointment: Status → Won't Do` | Notion Change | Pending |

  Each row's Brain ID is its proposal's id. Each proposal was committed with its own commit (`assistant: propose …`), and nothing changed on the Workshops, Finance or dentist pages. The confirmation was `13: proposed; it's in Review now.`
- **B2 and B3:** see §3 below.

### 3.4 Skips: pass (B1)
- **`skip 4`:** the skill offered Waiting On or Someday in one question; `Someday` → `prp-haw1jrxw` set_task_status, applied. The task's Status is Someday, no dismissal was written, and the summary counts it as changed.
- **`skip 3 because the client paused it`:** the skill offered On Hold; `no, just skip it` → `brain assistant dismiss`, one entry `project_stalled:prj-0a10b003`, reason `the client paused it`, `until` = `dismissed_at` + 30 days. Confirmation `3: skipped for 30 days. It comes back on 7 Dec.`
- **`skip 11`:** there was no offer, so the skill asked the reason once; `no reason` → an entry with reason `""`.
- **`show the skipped ones`:** §8 item 3's list, exactly:
  `s1. Pinecrest Clinic signage (project) · stalled projects · skipped 7 Nov, back on 7 Dec · "the client paused it"`
  `s2. "Renew the studio domain name" (task) · tasks with no project · skipped 7 Nov, back on 7 Dec · no reason`
  `Say "unskip s2" to see it again.`
- **`unskip s2`:** `dismiss` with `remove`; confirmation `s2: unskipped: it shows in the next report.`
- **`done`:** the dismissal store (one entry, Pinecrest) was committed at the close (155414d) with the log line `… applied=1 proposals=3 dismissed=1 …`, and the summary read `Done: 1 changed, 3 Review rows, 1 skipped.`

### 3.5 A ramble: pass (C1)
- **The list:** C1 read Notion, showed no report, and gave the 7-item list as expected:
  - the logo task → Done;
  - the call → Tasks, Due 13 Nov, Project Pinecrest Clinic signage;
  - Tomas Quill → a Waiting On task, Project Tidewell Logistics brand refresh;
  - a new project in Marketing;
  - the blog series → Inbox capture;
  - the domain name → `already in Tasks`;
  - the mailing list → `Due: ?`.
- **After `yes 1, 2, 3, 4, 5; later 7`:**
  - **The project first:** `prj-t3dstedg` `Client onboarding guide`, committed (ad694ad); its Projects page created with the Brief and Decision log toggles and recorded (7dfa81d).
  - **Two Tasks:** the call (To Do, Due 2026-11-13, Project Pinecrest) and `Brand guidelines from Tomas Quill` (Waiting On, Project Tidewell). Neither is recorded in Git.
  - **The Done change:** `prp-qwkhwm1x`, a notion_change with no `finding` and the user's words as `why`, applied.
  - **Two Inbox rows:** both Kind Capture with the user's words as the body; the blog series Brain Status Ready, the mailing list Brain Status New.
  - **Nothing for the domain name.**
- **The log line:** `… findings=13 shown=0 applied=1 proposals=0 dismissed=0 tasks=2 projects=1 captures=2`.
- **The owner:** the fixture maps no task owner, so Tomas Quill's name is only in the task's title, and no unmapped Owner property was written.
- **Findings:** 2 and 7 (§4) are from this session: it closed without the user's "done", and its summary has a different form.

### 3.6 A linked repo's rollup: pass (D1)
- **The report** equals `reference.mjs D --repo-error "site-issues=gh not logged in"`:
  - line 2 ends `Repo site-issues not read: gh not logged in.`;
  - there are 12 findings, `2 more`;
  - there is no `project_no_next_step` for Conference talk proposal (talk-notes' open item counts as its next step);
  - Workshops is still empty.
- **Nothing written:** 0 notion-sim writes, no toggle, and both repos clean (`git status` empty). The only commit was the close (log line `findings=12 shown=10 …`).

### 3.7 Notion unreachable: pass (E1)
- **The report** equals `reference.mjs E --unreachable`:
  - line 2 is `Notion unreachable: brain only. Statuses as of 6 Nov 2026; tasks not checked.`;
  - there are 4 findings: Pinecrest with `no change I can make here: skip it, or say what to do`, the misplaced newsletter, the duplicate pair, and Finance;
  - no Notion-owned recommendation, task signal or `area_empty` is shown.
- **`yes 2`:** set_field `prp-tjsm34wc` applied and committed (5026438), no publish. Confirmation `2: done in the brain; Notion shows it after the next sync.`, and that its tasks weren't moved.
- **`propose 3`:** merge `prp-89favrff` pending, committed (5af69ae), no row. Confirmation `3: proposed; the row appears in Review after the next sync.`
- **The ramble item:** marked `(Notion unreachable)`, with no yes to give.
- **`done`:** `Done: 1 changed, 1 Review row.` then `Not placed (Notion unreachable): Call Ines Marlowe about the contract (due 13 Nov).` The log line has `mode=brain_only … findings=4 shown=4 applied=1 proposals=1`.
- **Notion:** 12 calls, 5 of them failed reads, and 0 writes.

### 3.8 Report only, and no answer: pass (F1, F2)
- **F1** returned the report as its whole answer, identical to the reference: 0 commits, 0 uncommitted, 0 log lines, 0 proposals, 0 writes, 5 reads.
- **F2** (no `report only`, never resumed) returned the report: 0 commits, 0 writes, 4 reads.
- **The catch:** F2 called its run "report only" itself and said it skipped step 3 (finding 3). With nothing waiting from Review, the outcome is the same.

### 3.9 A stale write: pass (A1)
- **The setup:** `user-edit` set the logo task's Status to Doing after the report.
- **`yes 2b`:** `prp-p9ck76vs` (status To Do → Done) was approved. The skill read `Doing`, wrote nothing, and settled it `stale` (`closed`). The page still says Doing, and there is no `update` on it in the log.
- **The confirmation:** `2: not changed: it changed in Notion since it was proposed. … Say "review again" to see it as it is now.` Finding 4 covers the wording.

### 3.10 A failed write carried into the next session: pass (G1, G2)
- **G1, `yes 7`:**
  - `prp-5evzcgdp` approved;
  - the `update` failed with `network` (the call log has it with `error: network`);
  - nothing was settled, so the proposal stays `approved` (commit f556427);
  - confirmation `7: couldn't be written to Notion; it stays approved and I'll write it next session.`
- **G2 (fresh runner):**
  - before the report it replayed the recorded decision, read Status `Active` (= `expect`) and wrote Done (one `update`, 13:25:34);
  - it settled `applied` and committed (fcbe488 `apply: 1 Notion changes`);
  - it then read Notion and printed `Carried out 1 approved change from Review.`;
  - its report equals `reference.mjs G` computed after the write: 12 findings, no Larkspur Bakery packaging.
- **G2's summary** read `Done: 1 changed.` (finding 11).

### 3.11 The Review workload: pass

| Session | "propose" answers | Review rows written | Most findings on a page |
|---|---|---|---|
| A1 | 0 | 0 | 10 (then 3) |
| B1 | 3 | 3 | 10 (then 3) |
| B2 | 0 | 0 new (decides B1's) | — |
| C1 | 0 | 0 | no report |
| D1 | 0 | 0 | 10 (2 more) |
| E1 | 1 | 0 (Notion unreachable; the merge waits as `pending`) | 4 |
| F1, F2 | 0 | 0 | 10 |
| G1, G2 | 0 | 0 | 10 |

## 3. The Review-row path after B1: B2 and B3 (pass)
- **Between sessions:** `user-edit` set `Your call` to Approve on the Workshops and Finance rows and to Reject on the dentist row.
- **B2 (`Sync my brain.`, start chat):** the session picked brain-sync and read every database. `sync plan` gave 3 decisions and nothing else; the skill asked before applying (`publish: ask`), and the user said `yes`.
  - **`sync apply`:** Finance `applied`, dentist `closed`, and Workshops `awaiting_notion` with one `notion_writes` item. The skill read Archived `false` (= `expect`), wrote `true`, and settled it `applied`; one commit (5ded57f).
  - **The publish:** after `yes, publish them`, it published 4 pages (b063ab6): the Finance Area (Domain = Studio's page, its Brief) and the three rows' State (Workshops Applied, Finance Applied, dentist Closed).
  - **The dentist task:** still To Do; nothing was written to it.
  - **C3:** B2's 6 writes are the Workshops write and the 5 publish calls, each from a decision.
- **The rejected row:** the apply closes a rejected `notion_change` (`result=closed`), and render maps `closed` → State Closed (cli.md §5.14.4). This answers phase 1's open question; the row shows Closed, as the spec says.
- **B3 (`Review my projects.`):** the report is identical to `reference.mjs B` after B2. It has 8 findings and `2 skipped for now.` (Pinecrest's dismissal, and the dentist finding left out as a rejected Suggestion). It doesn't have Workshops (archived), Finance (in a Domain) or the running shoes (Someday). "Renew the studio domain name" shows again after the unskip. After `done`, the only change was the log line (7a258fc), with no write.

## 4. Findings

None blocks the release: every write landed as the spec says, and every check passed. The building session classed each one:

| # | Where | Finding | Fix |
|---|---|---|---|
| 1 | CLI `brain log` / spec/assistant.md §9 | The log line is written `assistant - "" mode=…`: `brain log <op> -` always prints a quoted title (cli.md §3.9's `<op> <id> "<title>"`), while §9 shows the line without it. The same holds for `publish - ""` and `catch-up - ""`. Every runner noticed it | none needed: §3.9 is the line's format and `brain status` reads it; §9 gives the `brain log` arguments. Noted for a later wording pass |
| 2 | fork: ultimate-assistant (ramble) | C1 closed the session by itself once the ramble's items were placed, with no "done" from the user (§1 step 8: close only when the user ends the session) | fork skill text: the ramble reference should say the session stays open after placing |
| 3 | fork: ultimate-assistant (sub-agent) | F2, delegated without `report only`, called its run "report only" and skipped step 3; §1 says the skill never infers it. Harmless here (nothing was waiting); with a waiting `approved` proposal it would leave it for later | fork skill text: say that a sub-agent run without the words still does step 3 |
| 4 | fork: brain-apply vs answers.md | brain-apply's "Notion writes" gives the stale line as `…since it was proposed.`; answers.md and spec §6.4 say `…since I read it.` A1 used brain-apply's | fork: one wording, the spec's |
| 5 | spec/assistant.md §4.1, CLI | `move it to Marketing (and its 1 open task that name Clients)`: the verb doesn't agree for 1 | **fixed here:** §4.1 says `that names` for 1, `assistant-findings.ts` follows, and `tests/assistant-acceptance.test.ts` checks it on the CC-140 sandbox. The vendored answers.md quotes the old label as an example; the fork's next release can follow |
| 6 | harness | notion-sim returns no `created_time`, and its Tasks Status is a select while the fixture's brain.json said `status_type: status`. Runners used `last_edited` for `created` and `group: null` (B1 and B3 guessed groups); no signal reads `created`, and Done/Won't Do are named, so findings were unaffected | **fixed here** for the status type (build-fixture.mjs writes `status_type: select`; check-planted 192/192, and `sync tasks` renders Status as a select). `created_time` stays a harness note: notion-sim is 0.9.0's, which this task doesn't change |
| 7 | fork: ultimate-assistant (close) | C1's summary read `Done: 1 changed, 1 created project, 2 tasks, 2 captures` instead of §4.4's `Done: 1 changed, 5 created (2 tasks, 1 project, 2 captures).` | fork: none needed beyond 2 (same close step) |
| 8 | fork: ultimate-assistant (propose) | B1's first proposal took `why` = `Workshops (area) · nothing active` (subject included); §6.2 says the evidence text (`nothing active`) | fork: say "the evidence text after the subject" |
| 9 | runner | B1's status-offer proposal (`prp-haw1jrxw`) left out `area`; the runner said so itself; the skill text has it | none (runner slip) |
| 10 | fork: ultimate-assistant (log) | G2's log line has `findings=13 applied=0`, but its first report's total was 12 and its summary said `1 changed` (§9: `applied` is the summary's changed) | fork: §9's counts could be read from the session record in one place |
| 11 | spec/assistant.md §4.4 | G2's summary was `Done: 1 changed.` for a replay of an earlier session's yes, with no answer this session; that is what §4.4 says (waiting writes count as changed). A runner found it surprising | none |
| 12 | product, existing merge design | After A1's merge, the duplicate's meeting still names the archived duplicate as its Project in Notion (render sends a meeting's Project `if_empty`); §6.2 moves only open tasks | noted; a merge's meetings are outside 0.10.0's scope |
