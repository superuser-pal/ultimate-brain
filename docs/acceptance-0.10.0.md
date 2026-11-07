# Acceptance of 0.10.0 (decisions 0064, 0072): Ultimate Assistant

What CC-110 checks before 0.10.0 ships, with the steps and the evidence each check needs. The results are in [eval/acceptance-0.10.0/RESULTS.md](../eval/acceptance-0.10.0/RESULTS.md); nothing here claims a check that wasn't run.

The bar is the task's acceptance: **every scenario passes with its evidence; no change happens without a Review row or a yes; the Review workload of one run stays within the cap the contracts set.** The contract is [spec/assistant.md](../spec/assistant.md) (cited as §n below); where this file and the spec differ, the spec decides and the difference is a finding.

Synthetic data only: the studio fixture of [eval/acceptance-0.10.0](../eval/acceptance-0.10.0/README.md) (CC-140), on an isolated installation. No real brain, no real Notion, no real GitHub, nothing under the user's `~/.claude`, `~/.agents`, `~/.codex` or brain.

## 1. Setup

### 1.1 The installation
The CLI and the vendored skills under test are this branch's `HEAD` after CC-109 is merged and ultimate-brain-skills 1.2.0 is vendored (CLI 0.10.0, skills range `>=0.10.0-0 <0.11.0`):

```sh
sh eval/acceptance-0.10.0/harness/install.sh /tmp/cc110/i
```

Evidence: the script's last lines, `vendored skills OK: ultimate-brain-skills 1.2.0` and `installed: 0.10.0 at …`, recorded in RESULTS.md.

### 1.2 One sandbox per scenario group
```sh
sh eval/acceptance-0.10.0/harness/make-sandbox.sh /tmp/cc110/i /tmp/cc110/<name> "$(date +%F)"
sh eval/acceptance-0.10.0/harness/scenario.sh /tmp/cc110/<name> <variant>     # only where a scenario says so
```

The sandbox is made at today's date, so the machine clock the skill uses (§2.1) and the fixture agree; `D` below is that date, and `D+6` the date six days later, written as the report writes dates (`13 Nov`). Every sandbox's `bin/gh` always fails (not logged in), so no runner can reach the real GitHub. [scenario.sh](../eval/acceptance-0.10.0/harness/scenario.sh) prepares a variant: `unreachable` (every notion-sim query and get fails), `fail-update` (the next update fails once), `repos` (two linked repos, below), `clear-fail`, and `user-edit <page> <json>`, which stands for the user editing a page in Notion: it changes the page and its `last_edited`, and leaves no entry in the call log, so the log holds only the agent's MCP calls.

Before each session, `. <sandbox>/env.sh; brain status --json` names `<sandbox>/brain` and `git status` is clean.

### 1.3 The blind runner
Each session is a **fresh Sonnet general-purpose sub-agent** with no answer key. Its prompt holds, in this order: the text of [harness/RULES.md](../eval/acceptance-0.10.0/harness/RULES.md) with `<sandbox>` filled in; how it was started (one of the three below); and the user's first message, verbatim from the scenario. It never sees this file, planted.json, the spec or the source.

| Start | The runner's role | Used for |
|---|---|---|
| **agent** | the main agent of `claude --agent ultimate-assistant` in the brain: it reads `.claude/agents/ultimate-assistant.md` and follows it | review sessions |
| **chat** | an ordinary Claude Code session in the brain: it reads `AGENTS.md` and `CLAUDE.md` and picks the skill | the ramble, brain-sync |
| **sub-agent** | a sub-agent the main session delegated to, with the prompt given; nobody answers it | report only, no answer |

The building session plays the user. It answers with the scenario's words, filling in the numbers the agent's own report gave (a scenario names findings by subject, "the Larkspur Bakery packaging finding", and the runner says that finding's number), and continues the same agent with SendMessage until the session closes. It never answers a question the scenario doesn't expect with anything but the plainest reply a user would give ("yes", "no date"), and records each such exchange in RESULTS.md.

### 1.4 The evidence tools
All three read the sandbox and write nothing in it but their own files:
- **[reference.mjs](../eval/acceptance-0.10.0/harness/reference.mjs)** `<sandbox> [--unreachable] [--repo-error <name>=<reason>] [-- <findings args>]` builds the snapshot of §2.1 from notion-sim's current state (and the rollups of §2.2) and runs `brain assistant findings` on it, printing `data.report` and the keys. It is the **reference report**: what the skill must show, byte for byte. Run it right after the agent's report, on the same state.
- **[evidence.mjs](../eval/acceptance-0.10.0/harness/evidence.mjs)** `<sandbox> --mark` before a session (and before an answer, where a scenario says so), then `evidence.mjs <sandbox>` after it: the brain's commits and their files since the mark, what is uncommitted, every proposal added or changed (kind, status, finding, decision, settle), the dismissal store, the log lines added, every notion-sim write with its properties, the number of reads, the Review rows, and `brain lint`'s counts.
- **[check-planted.mjs](../eval/acceptance-0.10.0/harness/check-planted.mjs)** `<sandbox>` on a fresh sandbox: the fixture still plants what planted.json says (CC-140).

## 2. The checks every interactive session must pass

Each scenario below lists only its own expectations; these hold for every **agent** and **chat** session as well, and RESULTS.md records each, with its evidence, per session.

| # | Check | Evidence |
|---|---|---|
| C1 | **The report is the CLI's.** The report the agent shows equals the reference report (§4: the skill prints `data.report` as returned), including line 2 and the closing lines | `diff` of the agent's report and `reference.mjs`'s, empty |
| C2 | **Nothing before an answer.** Between the start and the user's first answer: no commit, no uncommitted change, no notion-sim write (§1 step 6), except step 3's replays where a scenario has some waiting | `evidence.mjs` after the report: 0 commits, 0 uncommitted, 0 writes |
| C3 | **Every change has its yes or its Review row** (0072 §2). Each commit and each notion-sim write is traced to one answer of the user's: a yes (direct apply, §6.2), a "propose" (its proposal and its row, §6.3), a ramble item said yes to (§7), a status picked from a skip's offer (§8), or a decision recorded earlier (§1 step 3). A write no answer explains fails the scenario | `evidence.mjs`: the commits and writes, each annotated in RESULTS.md with the answer it belongs to |
| C4 | **Each change is the one named.** Every proposal carries the finding's key as `finding` (none for a ramble's or a task move's), `source` `agent:ultimate-assistant/<compact as_of>`, the report's evidence text or the user's words as `why`, `decided_by: chat` for a yes; a `notion_change`'s `value_before` is the snapshot's value; the Notion page holds `value_after` afterwards | `evidence.mjs` proposals; `notion-sim get <page>` |
| C5 | **The confirmations are the spec's.** One line per change as it is made (§4.2), with the wording of §2.3, §6.4 and §8 where those apply | the transcript |
| C6 | **The session closes once** (§1 step 8) when the user says "done": `brain index`, `brain views`, `brain lint`, one log line in §9's form with the right counts, a commit of what was left (dismissals, index, views, log) naming its paths, no push (the sandbox has no remote), then the closing summary of §4.4 with the same counts. Afterwards `git status` is clean and `brain lint` has 0 errors | `evidence.mjs`: log line, commits, uncommitted 0, lint; the transcript's summary |
| C7 | **Nothing outside the sandbox.** No call to a Notion MCP tool, no `gh` other than the sandbox's, no file outside the sandbox | the agent's tool calls (the transcript), `git -C <repo> status` for any linked repo |

## 3. The scenarios

### 3.1 Signals (§3.3): a scenario per signal

**Sandbox A** (plain). **Session A1**, start **agent**: the user says `Review my projects.` and, after the report, `more`.

The first page shows 10 findings and `3 more. Say "more", …`; "more" shows numbers 11 to 13. Together they are exactly planted.json's 13 `planted` entries (signal and pages), each once, and none of its 8 `not_flagged` rows. Each signal's row below is its own scenario: it passes when its finding is shown with that evidence text and those recommendations (C1 compares the exact wording), and when the scenario named in the last column carries out its recommendation as §6 says.

| # | Signal | Planted subject | Evidence text (§4.1) | Recommendations | Carried out in |
|---|---|---|---|---|---|
| S1 | `task_overdue` | "Update the case studies", "Send the logo proposals" | `due <D−10>, 10 days late`, `due <D−5>, 5 days late` | a) give it a new due date b) mark it Done c) mark it Won't Do | 3.2 (a yes with a value), 3.9 (a stale write) |
| S2 | `task_stalled` | "Buy new running shoes", "Write the About page copy" | `no edit for 31 days (status Doing)`, `no edit for 20 days (status To Do)` | as S1 | 3.4 (skip, status offer taken) |
| S3 | `project_stalled` | Pinecrest Clinic signage | `nothing done or mentioned for 35 days (last: meeting Pinecrest signage kickoff, <D−35>)` | a) set Status to On Hold b) add a next step c) set Status to Done | 3.4 (skip, offer declined); 3.7 (brain only: no change offered) |
| S4 | `project_no_next_step` | Conference talk proposal | `Active with no next step` | a) add a next step b) set Status to On Hold c) set Status to Done | 3.2 (add a next step); 3.6 (a rollup's open item clears it) |
| S5 | `project_done_but_open` | Larkspur Bakery packaging | `every task done (3 done), Status still Active` | a) set Status to Done b) add a next step | 3.2; 3.10 (a failed write) |
| S6 | `project_misplaced` | Studio newsletter | `in Clients, but 3 of its 3 notes are in Marketing` | a) move it to Marketing (and its 1 open task …) | 3.2 (move); 3.7 (brain only) |
| S7 | `project_duplicate` | Quayside Books catalog redesign and Quayside Books catalogue | `look like the same project` | a) merge Quayside Books catalog redesign into Quayside Books catalogue (and move its 1 open task) | 3.2 (merge); 3.7 (propose, brain only) |
| S8 | `task_no_project` | "Book a dentist appointment", "Renew the studio domain name" | `no project` | a) put it in <the Area's only Active project> b) mark it Won't Do | 3.3 (propose b, rejected); 3.4 (skip, no offer) |
| S9 | `area_no_domain` | Finance | `no Domain` | a) put it in a Domain | 3.2 (a yes with a value); 3.3 (propose) |
| S10 | `area_empty` | Workshops | `nothing active` | a) archive it | 3.3 (propose, approved in Review) |

Evidence: C1 (the agent's two pages against `reference.mjs` and `reference.mjs -- --exclude <page 1 keys> --number-from 11`), the keys of both pages against planted.json, and C2. Session A1 then continues as 3.2.

### 3.2 A yes in chat: direct apply (§5, §6.2)

**Session A1 continued.** Before the stale-write answer, see 3.9. The user's answers, one message each:

1. `<the "Update the case studies" finding>: due <D+7>` → a `notion_change` (`tasks`, `due`) proposed, approved `decided_by: chat`, carried out and settled `applied`; the task's Due in notion-sim is `D+7`; confirmation `<n>: due date moved to <D+7>`.
2. `yes <Larkspur Bakery packaging>` → `set_project_status` `Done`: the Projects page's Status is Done, the proposal `applied`.
3. `yes <Studio newsletter>` → a `set_field` (`area`) applied by `brain apply` and committed; `sync render --ids` publishes the project's Area (the Projects page's Area relation is Marketing's page) and `sync record` is committed; then its one open task that names Clients gets a `set_task_area` `notion_change` with no `finding` and the finding's `area`, whose page's Area is now Marketing.
4. `yes <Quayside Books duplicate>` → a `merge` (`target` the catalog redesign, `merge_into` the catalogue) applied and published; the duplicate's open task moved to the survivor (`set_task_project`, no `finding`): its Project relation names the catalogue's page.
5. `yes <Finance>` → the skill asks for the Domain (value `null`); the user says `Studio` → a `set_field` (`domain`) applied and published: the Areas page's Domain relation is Studio's page.
6. `yes <Conference talk proposal>` → the skill asks for the words of the next step; the user says `Draft the abstract` → a Task created through `sync tasks --direct` and the MCP, with Project = the talk's page, no Source and no Meeting, nothing recorded in Git.
7. `done` → C6. The summary counts `changed` as §4.4 does (the move counts its task move, the merge its task move) and `created (1 task)`.

Evidence: `evidence.mjs` marked before answer 1; each proposal's fields (C4); `notion-sim get` on each page named; the commits in order (each brain-owned change committed before its publish, §6.2 step 3); the log line `assistant - mode=live scope=all findings=13 shown=13 applied=<n> proposals=0 dismissed=0 tasks=1 projects=0 captures=0`.

### 3.3 A Review row when asked, decided in Notion (§6.3)

**Sandbox B** (plain). **Session B1**, start **agent**: `Review my projects.`, then:
1. `propose <Workshops>` → a `pending` `notion_change` (`areas`, `archived`), published at once: a Review row whose Kind is `Notion Change`, Name starts `Suggestion: `, State Pending, Brain ID the proposal's id; nothing changes on the Workshops page.
2. `propose <Finance>` → the skill asks the Domain; `Studio` → a `pending` `set_field` (`domain`), a row of Kind `Set Field`.
3. `propose <"Book a dentist appointment">b` → a `pending` `notion_change` (`tasks`, `status`, `Won't Do`) and its row.
4. The skip answers of 3.4, in the same session; then `done` → C6, with `proposals=3` in the log line and `3 Review rows` in the summary.

Between sessions the user decides in Notion: `scenario.sh B user-edit <Workshops row> '{"Your call":"Approve"}'`, the same for the Finance row, and `'{"Your call":"Reject"}'` on the dentist row.

**Session B2**, start **chat**: `Sync my brain.` (brain-sync, §6.3 "How a decided row is applied") → the three decisions are read by `sync plan` and applied by `sync apply`; the Workshops write is carried out by the skill (Areas · Archived true) and settled `applied`; the Finance `set_field` is applied and published (Domain relation Studio); the dentist proposal is rejected and nothing changes on its task; each row is then rendered with its proposal's new status (cli.md §5.14.4): the two applied ones with State Applied, and the rejected one, which the apply closes, with State Closed.

**Session B3**, start **agent**: `Review my projects.` → the report has no Workshops, Finance or dentist finding; the dentist one is left out as a rejected Suggestion and counted in `<n> skipped for now.` with 3.4's dismissal (C1 shows the count is the CLI's); then `done`.

Evidence: the Review rows (`evidence.mjs` review rows) after B1 and after B2; the proposals' status after each session; `notion-sim get` on the Workshops and Finance pages and on the dentist task; C1 for B3. C3 for B2: every write in B2 belongs to one of the three decisions, or to brain-sync's own publish of what was applied.

### 3.4 Skips, with and without a status offer (§8)

**Session B1**, after 3.3's three proposals:
1. `skip <"Buy new running shoes">` → the skill offers Waiting On or Someday in one question; `Someday` → a `set_task_status` applied (§6.2): the task's Status is Someday, no dismissal is written, and it counts as changed, not skipped.
2. `skip <Pinecrest Clinic signage> because the client paused it` → the skill offers On Hold; `no, just skip it` → `brain assistant dismiss` with reason `the client paused it`: one entry in `_assistant/dismissals.json`, `until` = `dismissed_at` + 30 days.
3. `skip <"Renew the studio domain name">` (no offer for `task_no_project`) → the skill asks for a reason once; `no reason` → an entry with `reason` `""`.
4. `show the skipped ones` → the list of §8 item 3: `s1.`, `s2.` sorted by `until`, each with its subject, signal label, dates and reason (`· no reason` for item 3), then `Say "unskip s2" to see it again.`
5. `unskip <the domain-name entry's s number>` → `brain assistant dismiss` with `remove`; confirmation `s<n>: unskipped: it shows in the next report.`
6. `done` → the dismissal store is committed at close (C6); the log line has `dismissed=1` and the summary `1 skipped`.

Evidence: the dismissal store after the session (one entry, Pinecrest, with its reason); the running shoes page; the transcript's list. In B3: Pinecrest absent and counted in "skipped for now", "Renew the studio domain name" shown again, the running shoes task not flagged (Someday is parked).

### 3.5 A ramble lands in its place (§7)

**Sandbox C** (plain). **Session C1**, start **chat**, with no request for a review:

> The logo proposals went out this morning, so that task is done. For the Pinecrest Clinic signage project, I need to call Ines Marlowe about the contract by `<D+6>`. Tomas Quill promised to send the brand guidelines for the Tidewell Logistics brand refresh; I want to keep track of that. Start a project for a client onboarding guide in Marketing. Maybe a blog series on onboarding too. I should renew the studio domain name. Oh, and sort out the workshop mailing list next week.

Expected: the session picks `ultimate-assistant` from the brain's AGENTS.md, reads Notion (steps 1 to 5) and **shows no report**; it shows a numbered list, one line per item with where it goes (§7), then `Answer with "yes …", a change …, "later …", or "yes to all".`:
- "Send the logo proposals" (task) → mark it Done;
- a task "Call Ines Marlowe about the contract" → Tasks, Due `<D+6>`, Project Pinecrest Clinic signage;
- a Waiting On task for Tomas Quill → Tasks, Waiting On, Project Tidewell Logistics brand refresh;
- a new project "Client onboarding guide" → a project in Marketing;
- the blog series → Inbox capture;
- "Renew the studio domain name" → `already in Tasks`, with nothing to say yes to;
- the mailing list → `Due: ?`.

The user answers `yes` to the first five numbers and `later` to the mailing list's, then `done`. Expected: the project first (`note new` type project, `lifecycle: reviewed`, area Marketing; committed; its page created from the Projects template, recorded, committed); the Done change as a `notion_change` with no `finding` and the user's words as `why`, applied and settled; two Tasks created (the call: Status To Do, Due, Project relation; Tomas Quill's: Status Waiting On, Project relation; neither recorded in Git); an Inbox row for the blog series (Kind Capture, Brain Status Ready, body = the user's words) and one for the mailing list (Brain Status New); nothing for the domain name. Close: log line `scope=all findings=0 shown=0 … tasks=2 projects=1 captures=2`, summary `created (2 tasks, 1 project, 2 captures)` and `1 changed`.

Evidence: `evidence.mjs` (writes: 1 project page, 2 Tasks, 2 Inbox rows, 1 Task update; commits: the project note and its record, the proposal); `notion-sim get` on each created page. The fixture maps no task owner (`notion.tasks.properties.owner` is empty), so the Waiting On task carries Tomas Quill's name only in its title or not at all; a write of an unmapped Owner property is a finding.

### 3.6 A linked repo's rollup (§2.2)

**Sandbox D**, `scenario.sh D repos`: two repos linked by kit, both tracked in the repo. `talk-notes` targets Conference talk proposal and its `TASKS.md` has one open item ("Draft the abstract"); `site-issues` targets the Area Workshops and tracks GitHub issues, and the sandbox's `gh` always fails (not logged in).

**Session D1**, start **agent**: `Review my projects.`, then `done`.

Expected: the skill runs `brain repo tasks talk-notes`, tries to fetch `site-issues`'s issues with the sandbox's `gh`, which fails, and adds it as an error; line 2 ends with `Repo site-issues not read: <reason>.`; Conference talk proposal has no `project_no_next_step` finding (the rollup's open item is its next step), so the report has 12 findings, `2 more`; Workshops is still `area_empty` (a repo that failed has no rollup). Nothing is written: no toggle on any page, no file in either repo, no task for the repo's item.

Evidence: C1 against `reference.mjs D --repo-error "site-issues=<the reason the agent wrote>"`; `evidence.mjs` (0 writes, 0 commits, the log line `findings=12`); `git -C D/repos/<name> status` clean for both.

### 3.7 Notion unreachable (§2.3)

**Sandbox E**, `scenario.sh E unreachable`. **Session E1**, start **agent**: `Review my projects.`, then:
1. `yes <Studio newsletter>` → the `set_field` applied and committed, no publish; confirmation `<n>: done in the brain; Notion shows it after the next sync.` and that the tasks that name Clients weren't moved.
2. `propose <Quayside Books duplicate>` → a `pending` `merge` proposal, committed, no row; confirmation `<n>: proposed; the row appears in Review after the next sync.`
3. `Also, I need to call Ines Marlowe about the contract by <D+6>.` → a one-item list marked `(Notion unreachable)`, with no yes to give.
4. `done` → the summary ends `Not placed (Notion unreachable): <the call>.`; the log line has `mode=brain_only`.

Expected report: line 2 `Notion unreachable: brain only. Statuses as of <the fixture's publish date>; tasks not checked.`; only the brain's signals (Pinecrest stalled, with `no change I can make here: skip it, or say what to do`; Studio newsletter misplaced; the Quayside pair; Finance with no Domain); no Notion-owned recommendation, no task signal, no `area_empty`.

Evidence: C1 against `reference.mjs E --unreachable`; `evidence.mjs`: every notion-sim call is a read that failed (or `databases`), 0 writes; the commits and the proposals' status.

### 3.8 Report only, and no answer (§1, §10)

**Sandbox F** (plain).
- **Session F1**, start **sub-agent**, prompt `Review my projects and tasks. report only`. Expected: the report as the agent's whole answer, equal to the reference (C1), and then nothing: no commit, no uncommitted change, no log line, no proposal, no dismissal, no notion-sim write (only reads).
- **Session F2**, start **sub-agent**, prompt `Review my projects.` (no `report only`; nobody answers, so the runner is not resumed). Expected: the report; with nothing waiting from Review, no write at all (§1: only step 3's writes are made when no answer comes).

Evidence: `evidence.mjs` after each: 0 commits, 0 uncommitted, 0 log lines, 0 writes, the read count.

### 3.9 A stale write (§6.4 step 2)

**Session A1**, between answers 1 and 2 of 3.2: `scenario.sh A user-edit <"Send the logo proposals" page> '{"Status":"Doing"}'` (the user changed the task in Notion after the report), then the user says `yes <"Send the logo proposals">b`. Expected: the proposal (`set_task_status` `Done`, `value_before` `To Do`) is approved; the skill reads the page, finds `Doing`, which is neither the `expect` nor the `value`, writes nothing and settles `stale`; confirmation `<n>: not changed: it changed in Notion since I read it. Say "review again" to see it as it is now.`

Evidence: the proposal `closed`, `closed_reason: stale`; the page's Status still `Doing`; no `update` on that page in the call log after the user-edit.

### 3.10 A failed write carried into the next session (§1 step 3, §6.4 step 3)

**Sandbox G**, `scenario.sh G fail-update`. **Session G1**, start **agent**: `Review my projects.`, then `yes <Larkspur Bakery packaging>`, then `done`. Expected: the `update` fails (`network`); nothing is settled: the proposal stays `approved`; the confirmation names it as not written; the summary counts it as neither changed nor skipped.

Then `scenario.sh G clear-fail`. **Session G2**, a fresh runner, start **agent**: `Review my projects.` Expected: before the report, the replay of §1 step 3 (the recorded decision passed to `brain apply` again, unchanged), the write carried out and settled `applied`, a commit, Notion read again, and the line `Carried out 1 approved changes from Review.`; the report has no Larkspur Bakery packaging finding, and equals the reference computed after the write (C1). C2 here allows exactly that replay's write and commit. Then `done`: the summary counts it as `1 changed`.

Evidence: `evidence.mjs` after G1 (the failed `update` in the log, the proposal `approved`) and after G2 (one `update` on the packaging page, the proposal `applied`, its commit before the report's reads).

### 3.11 The Review workload stays within the cap (§3.5, 0072 §2, §5)

Across every session above:
- **No Review row without a "propose".** The number of Review rows a session writes equals its "propose" answers: 3 in B1, 0 in A1, C1, D1, F1, F2, G1 and G2; E1's pending merge has no row (Notion unreachable). B2 writes no new row; it only updates the three rows' State.
- **No page over the cap.** Every report shows at most 10 findings (`REPORT_LIMIT`) and says how many more; A1's first page shows 10 with `3 more`, D1's 10 with `2 more`.
- **No answer, no workload.** F1 and F2 leave no row, no proposal and no write.

Evidence: `evidence.mjs` review rows and proposals per session, tabulated in RESULTS.md.

## 4. Results and findings

RESULTS.md has one section per session: the sandbox and its variant, the runner's prompt, the user's answers as sent, the agent's report and its diff against the reference, the `evidence.mjs` output with each commit and write annotated (C3), and pass or fail per scenario and per check. A failure is a finding: it is fixed in a follow-up commit on this branch when it is in this repo and small (the harness, a spec sentence, a CLI bug with its test), and otherwise written up in RESULTS.md and taken to the user (a fork skill text goes through a fork PR, skills-delivery §9.5).
