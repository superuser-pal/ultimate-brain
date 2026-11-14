# Changelog

One line per task, under the release that ships it (decision 0038). From 0.4.0 on, `scripts/release.mjs` writes each section from the tasks' `**Changelog:**` lines in build/TASKS.md (decision 0039); don't edit those sections by hand. 0.3.x lines are hand-written.

## 0.14.0 — 2026-11-14

- CC-187 (#286): development only: the onboarding grill is recorded as decision 0078 with 0.14.0's task plan; onboarding and early access for friends and family move to 0.14.0, and the weekly review to 0.15.0, still the feature cutoff.
- CC-188 (#291): development only: the contracts for the guided setup, the `status` setup block, the template version and the new-brain defaults are written.
- CC-189 (#294): the Notion space design adds a Start here callout and a Template version line, and the product names one Notion template for a new user to duplicate.
- CC-191 (#302): say "set up my brain" and your agent walks you through everything once: the settings, the Notion connection, your work's Domains, Areas, Projects, people and key documents, and a first check that tasks, a report and your notes came out right.
- CC-192 (#340): the README's Get started takes a new user from nothing to "set up my brain" in six steps, with the link to duplicate the Notion template, and docs/setup.md explains every setting and how to recover from common failures.
- CC-193 (#363): development only: 0.14.0's setup is measured end to end on a synthetic fresh user in a clean duplicate of the published template.
- CC-194 (#289): development only: the minutes grill is recorded as decision 0079 with its 0.14.0 tasks: lean minutes for the reader, a For the brain toggle, and quick follow-ups left unticked becoming Tasks.
- CC-195 (#330): development only: the contracts for the lean minutes shape, the id → quote join and quick follow-ups becoming Tasks are written.
- CC-196 (#333): the brain reads the new minutes, with one line per item and the quotes in a For the brain toggle, and a quick follow-up you haven't ticked when you mark the meeting Reviewed can become a Task.
- CC-197 (#337): the minutes Notion AI writes are shorter and easier to skim: your quick follow-ups first, then the Tasks the brain will create, then a few lines per subject, with the ids and quotes tucked into a For the brain toggle.
- CC-198 (#335): catch-up turns the quick follow-ups you left unticked into Tasks when it ingests a reviewed meeting, and its report says how many.
- CC-208 (#308): development only: the response style grill is recorded as decision 0081 with its 0.14.0 tasks: a response style each user chooses, working principles and reply rules in the brain's rules, and plain writing for text people read.
- CC-209 (#309): development only: the contracts for the response style setting, the paragraph the CLI writes from it and its item on the setup's settings screen are written.
- CC-210 (#328): set how the brain talks to you (Standard, Simple, or your own mix of how much it explains, how long and how direct it is) and the brain's instructions follow it in every session, in the brain and in linked folders.
- CC-211 (#332): the brain asks before guessing, creates nothing you didn't ask for, changes only what you named and says what it checked; replies skip the pleasantries, state errors as cause and fix, and end with one next action; setup asks how the brain should talk to you, and you can change it any time by saying so.
- CC-212 (#329): the brain writes notes, Notion pages and reports in plainer language, without the patterns that make text read as AI-written; the skills repo also offers humanizer for your own writing.
- CC-216 (#311): a sync or catch-up finds the Documents and reports whose text you accepted from the Documents rows it has already read, instead of querying the Documents database a second time; what it imports, holds and protects is unchanged.
- CC-215 (#315): applying your reviews or catching up no longer asks you to say yes again to wording you already accepted and submitted on a Review page: the brain shows what it applies, checks that nothing changed since you submitted, and applies it.
- CC-219 (#316): an Everyday Guide puts the daily routine, useful requests, Notion buttons and all eleven Notion AI prompts in one short reference.
- CC-213 (#314): development only: the setup contract records each first-value check's outcome, passes first value only when every applicable check passes (now with a cited answer from the user's own document that they confirm), and retries what is unresolved before the scheduled catch-up is offered.
- CC-207 (#307): `brain note new` no longer writes a second person or org note when the matching one is withheld while it awaits cleanup: it skips the item as `WITHHELD_MATCH` with the existing id, so the ingest links to it instead.
- CC-225 (#326): development only: the memory evaluation's scorer reads "the brain holds no rule", an opening "No deploy freeze is recorded" and a quoted search query narrated at some length as the honest answers they are, so 0.13.0's second smoke run no longer fails three correct Claude Code answers.
- CC-226 (#327): development only: decision 0083 lets a release go out on the user's yes after a reviewed reading of the smoke run's failing answers, when every failure is the scorer's and no answer leaks anything, with the scorer fixed before the next release's smoke run.
- CC-227 (#331): the Notion template now shows what a filled space looks like with a few `Example · ` rows (a Domain, an Area, a Project, a Person, an Org, a Meeting and a Task); "set up my brain" removes them when it connects the brain to Notion, and the brain never takes anything from them.
- CC-228 (#334): development only: tests that check an excluded secret is absent no longer fail when a random note id happens to contain its text.
- CC-229 (#336): minutes read through Notion's markdown export keep their item ids: a Markdown escape such as `\[s1.i1\]` is read as the bracket it stands for.
- CC-230 (#338): development only: the release scripts' tests turn off git's background maintenance, so a temp repo is no longer removed while a detached `git maintenance` still writes into it (ENOTEMPTY).
- CC-231 (#339): development only: the memory evaluation's scorer reads an opening "There is no recorded rule about …" as an honest absence, and a "Nothing / None of … records that …" denial or a search query narrated as searched "under" a quoted phrase as not stating the fact, so 0.14.0-rc.1's smoke run no longer fails two correct Claude Code answers.
- CC-232 (#341): the user guides (How it works and the Everyday guide) describe the lean minutes: where `Meeting only` goes in the For the brain toggle, and that a quick follow-up still unticked when you mark a meeting Reviewed becomes a Task; setup finds the template version in the System callout on the template's top page, and Brain Assistant's skills database is named Skills.
- CC-233 (#342): development only: decision 0086 records that operating a brain never needs a pull request and that early access requires `gh`, with 0.14.0's tasks for it.
- CC-234 (#343): the Notion template now has an example row in every database, all from one story and linked to each other (a Review page waiting for a decision, a decision, an open question, a kept document, an Inbox capture, a goal with its key result and a task waiting on someone), with a note on Brain Data saying they are samples; "set up my brain" still removes them all after one yes, and the brain never acts on one.
- CC-235 (#349): development only: the setup and status contracts say a brain is worked on one branch, `gh` is required for early access, and testers read "backup".
- CC-236 (#352): `brain status` warns when your brain is off its working branch, and the brain's rules tell every agent to commit there and never open a branch or a pull request.
- CC-237 (#351): setup now needs the GitHub CLI and creates your private backup for you; reports say "backed up" or "not backed up", and "fix my backup" repairs it.
- CC-238 (#356): the README's Get started and the setup guide list the GitHub CLI among the prerequisites and explain the private backup.
- CC-239 (#346): a Review row now says whether it needs you, in a Status (Needs you · decide in the page, Needs you · set Your call, Submitted: waiting for the brain, Done, Closed); Review shows a row's Type, never its internal Kind; and a row with sections no longer repeats its page in About, Now, Proposed and Why.
- CC-242 (#347): development only: vendor ultimate-brain-skills 1.8.3 (CC-239's guides).
- CC-243 (#348): The template docs match the template as built: the Review row's property panel in four groups, fifteen example rows in the setup guide, Example minutes added below the Meetings template's blocks, and the Example rows' relations set in a step of their own.
- CC-247 (#357): The brain's structure in AGENTS.md, the linked folder's Domain line and the briefs' Documents ship in 0.14.0 rather than a later patch.
- CC-244 (#350): Decision 0089 records how every session in a brain knows its Domains, Areas and active Projects, which documents belong to each, and where to read their tasks.
- CC-245 (#353): Every session in your brain now knows your Domains, Areas and active Projects: `brain index` keeps them in a block of the brain's AGENTS.md, a linked folder shows its own Domain, Area and Project, and each project and Area brief lists its documents.
- CC-246 (#354): The brain answers "what belongs to this project" from the project's brief and its live tasks, and can explain the structure list in your AGENTS.md.
- CC-257 (#364): development only: the release gate's ten problems are triaged, eight fixes and CC-250 join 0.14.0, and rc.3 is planned with a re-run of the changed steps.
- CC-249 (#359): development only: dogfood issues #344 and #345 are triaged into decisions 0091 and 0092 and tasks CC-250 (0.14.1) and CC-251 (0.15.0).
- CC-250 (#368): a linked repo or file that uses `[[wikilinks]]` is ingested as it is, and on a Document's Notion page its links lead to the other Documents kept from the same repo.
- CC-258 (#365): setup and the minutes guide say where the transcript goes and how to run the minutes prompt, and setup checks that the transcript is still on the page.
- CC-259 (#371): setting up a second brain on a machine proposes a drop folder of its own instead of the first brain's.
- CC-260 (#372): setup and the guide say how to run Brain Assistant's skills in a Custom Agent and how to give it this space's databases only.
- CC-261 (#367): a project's Decision log marks a decision you haven't reviewed yet instead of listing it like a reviewed one.
- CC-262 (#369): a report the brain published and you haven't edited is refreshed by the next catch-up without asking you to click Accept.
- CC-263 (#366): a new Inbox row's first line names its file without a link that leads nowhere.
- CC-264 (#373): the first catch-up after setup does less work, so a tester's first meeting costs less.
- CC-265 (#376): the skills of 0.14.0-rc.3: the transcript check, the drop folder, Brain Assistant in a Custom Agent, wikilinked sources and the catch-up's quick wins.

Skills: ultimate-brain-skills 1.8.5 (sha256-16940a85922271dd631add1d3317ac7b4472d62deb6801aa9ce4d963da35805d)

## 0.14.0-rc.3 — 2026-11-14


Skills: ultimate-brain-skills 1.8.5 (sha256-16940a85922271dd631add1d3317ac7b4472d62deb6801aa9ce4d963da35805d)

## 0.14.0-rc.2 — 2026-11-13


Skills: ultimate-brain-skills 1.8.4 (sha256-6c69a85b4dc040dc50b63174b538ed16ad25a699b16d568f0f5b8dddcdf323aa)

## 0.14.0-rc.1 — 2026-11-12


Skills: ultimate-brain-skills 1.8.1 (sha256-8d2a9694c25c79ee316d235977875a66424b0b321524bb8c25fdc77c53181218)

## 0.13.0 — 2026-11-12

- CC-181 (#285): development only: the trust repair agreement is recorded as decision 0077 with 0.13.0's task plan; the weekly review moves to 0.14.0, and onboarding and the feature cutoff to 0.15.0.
- CC-176 (#295): `brain query --read <id>` gives an agent a note's full text with what you excluded, haven't approved or scoped elsewhere left out, so answers no longer need to open the brain's files; `brain query --types memory` now returns only the memories `brain recall` would. A memory that was replaced is read only with `brain query --read <id> --historical`, and a note with an excluded line is returned to agents without its title, path, tags or headings, cited by its type and id until its cleanup is done. After upgrading, run `brain link` again in each linked repo: its copy of the instructions and of brain-query changes only then.
- CC-177 (#293): A proposed change that rests on content you excluded, even beside content you kept, is no longer written to Review, and approving an older one closes it whole instead of adding any of its wording to a note; a value you type yourself is kept as your own correction.
- CC-178 (#301): Answers no longer open or grep the brain's files: the brain-query skill searches and reads through `brain`, so what you excluded, haven't approved or scoped to another project stays out of answers.
- CC-179 (#298): Every proposed change now names the passages it rests on, so a fact change, link, merge or supersession that rests on content you excluded is closed instead of applied, as is an older proposal whose input has excluded content, and each item of a Review row written before 0.8.0 is judged on its own.
- CC-180 (#301): Ingest, tidying, catch-up and the assistant read what the brain holds only through `brain`, name the passages every change they propose rests on, and never write a statement from content you excluded.
- CC-182 (#287): development only: one contract says what an answer, a summary, a citation and a proposal may rest on, and how the upgrade and the final acceptance are judged.
- CC-183 (#299, #300): A report, view or index entry that rests, directly or through another report or view, on something you excluded, haven't approved or scoped elsewhere is withheld until it is rebuilt, even after its source is cleaned.
- CC-184 (#297): `brain upgrade` updates your brain's instructions and skills and every linked project's copies in one step, keeps what each project wrote itself, and lists any project it could not finish; start fresh agent sessions afterwards.
- CC-185 (#288): development only: the memory evaluation gains cases for old reports, metadata, historical memory, project and approval boundaries, exclusions made before apply, legacy proposals and a linked project's upgrade.
- CC-147 (#241): development only: the 0.13.0 opening grill is recorded, covering weekly report history, task analysis, shared five-decision/five-target limits and targeted correction checks.
- CC-199 (#292): development only: `scripts/task.mjs start <id> --resume` makes the worktree for a task whose first part merged while its row, still `in progress`, carries the rest.
- CC-202 (#305): development only: the English retrieval-quality agreement is recorded as decision 0080, with its contract (spec/retrieval.md) and 0.13.0's retrieval tasks.
- CC-203 (#310): development only: eighty audited English retrieval cases (facts, paraphrases, unresolved subjects, unknowns) are scored separately as first-search candidates and as final answers, with latency and output tokens measured against a matched baseline.
- CC-204 (#318): development only: four small retrieval changes are measured alone and in combination on the frozen cases, and only those that help are chosen.
- CC-205 (#320): A question in everyday English now finds the fact it asks about on the first search, in a note's text or its fields (`budgets` finds a budget, money for the rest of the year answers a budget question), and when the question could mean two projects the answer asks which one.
- CC-200 (#303): development only: a harness runs every memory-evaluation case as a fresh native Claude Code or Codex session on a packaged CLI, keeps each session's trace and token use, and checks that no session read a brain file for an answer.
- CC-201 (#304): development only: the memory evaluation's scorer recognises an honest "I couldn't find it" as an abstention, and no longer takes an answer that mentions "no recorded decision" beside its facts for one.
- CC-190 (#296): `brain init` names one next step, "set up my brain"; a new brain starts with Documents, Reports and Tasks on; `brain status` shows how far setup has got and what's next; `brain upgrade` names the Notion migrations newer than your template.
- CC-217 (#313): development only: decision 0082 gates each release on a native smoke run of 15 evaluation cases per agent, and moves the complete native acceptance in Claude Code and Codex to 1.0, once beta testers are live.
- CC-218 (#317): a draft decision you reject in Review no longer appears in the project's decision log as accepted, and applying an old plan again no longer resets a revision the brain already drafted.
- CC-214 (#312): the summary at the top of a Review page now lists each item by its letter and title with what happened to it (applied, rejected, closed, deferred with a link to the row it moved to, a revision on its way, or waiting for you), so you no longer work out from counts which items still need you; the first sync after upgrading updates the summary of each Review row still in Notion once.
- CC-220 (#319): development only: CC-214's row moves to 0.13.0, the release its merged code ships in.
- CC-221 (#321): brain status no longer counts setup's first-value check as done when one of its checks failed, and shows each check's outcome so setup can resume only what is left.
- CC-222 (#322): development only: CC-221's row moves to 0.13.0, the release its merged code ships in.
- CC-223 (#323): development only: the memory evaluation's scorer no longer counts an answer that restates or denies the question ("nothing says whether the dispatchers prefer SMS") as stating the forbidden fact, and reads "I couldn't establish" as an honest unknown.
- CC-224 (#324): development only: two observations from 0.13.0's native smoke run, accepted by the user as not holding the release, are recorded in the backlog.

Skills: ultimate-brain-skills 1.6.0 (sha256-eedfe9042341a426a37bf5f93867dd148277d32ec6bb0e2cb936fde09e18bbff)

## 0.12.0 — 2026-11-09

- CC-146 (#238): development only: the 0.12.0 opening grill is recorded, covering scoped memory, work handovers, an initial 800-token hot-context budget and surgical TypeScript retrieval reuse.
- CC-162 (#268): development only: the done 0.10.2, 0.11.0 and 0.11.1 sections move to build/HISTORY.md.
- CC-163 (#269): development only: 0.12.0's first four tasks are planned, each owning separate paths so they can be built in parallel.
- CC-164 (#271): development only: the 0.5 search evaluation runs again on the current brain format, and its recall and MRR are committed as 0.12.0's retrieval baseline.
- CC-165 (#273): development only: a fixed synthetic test set for memory and recall, written before any 0.12.0 code, with its scoring rules.
- CC-166 (#270): development only: the 0.12.0 contracts define the opening context pack, the closing memory review, how a session finds where work stopped, and the recall opt-in.
- CC-167 (#276): development only: a bounded comparison of small TypeScript adaptations of claude-obsidian's BM25, chunking, prefix, snippet and freshness pieces against the 0.12.0 baseline.
- CC-168 (#272): development only: 0.12.0's build tasks are split from the merged contracts, each owning separate files.
- CC-169 (#275): `brain recall --pack` gives an agent a small opening context of your approved lessons for the repo it works in and where its work stopped, within 800 tokens, and `brain recall --search` finds the rest.
- CC-170 (#274): with opening recall turned on, `brain link` tells a linked repo's agents to load your lessons and where work stopped at the start of a session, and to run the closing review when you say "wrap up".
- CC-171 (#277): say "wrap up" at the end of a session and the agent offers at most five lessons to remember, each with its reach, and records where the work stopped; say "remember this" at any time.
- CC-172 (#278): development only: the 0.12.0 evaluation set scores `brain recall` against the trust and answer gates.
- CC-173 (#281): `brain query` and `brain recall --search` find the right note more often, using small ports of the retrieval pieces that won the 0.12.0 comparison.
- CC-174 (#280): a note or memory whose provenance names no input (another note, a session, your edit in Notion) is no longer hidden whenever any cleanup is active, and a note with nothing eligible left is no longer returned as an empty title.
- CC-175 (#282): development only: the 0.12.0 memory evaluation's committed results show both gates met on main after CC-173 and CC-174.

Skills: ultimate-brain-skills 1.5.0 (sha256-1056deccd5b1af6c199744c8c29b5a26454e213f8e271b5707f74d188f1674b2)

## 0.11.1 — 2026-11-08

- CC-161 (#267): `brain reflect --candidates` finds far fewer, truer clusters: shared ground ignores the meeting and project notes were taken from, and terms skip link targets, URLs, code, sign-offs, contractions, function words and people's names.

Skills: ultimate-brain-skills 1.4.0 (sha256-44a670b2237205b1b0aa89f7eed7b0b5c0dcf05d6fbfcf97ae8bdb228300d404)

## 0.11.0 — 2026-11-08

- CC-65 (#257): contracts for reflection: candidates, the proposal fingerprint, and three new lint warnings.
- CC-66 (#260): `brain reflect --candidates` finds likely duplicates, overtaken notes, notes that may disagree and recurring terms; proposals carry a fingerprint; lint warns on orphans, oversized notes and near-duplicate names.
- CC-67 (#262): "tidy the brain" finds contradictions, stale facts, duplicates, promotions and recurring themes, shows them in the chat and applies what you say yes to; "later" puts one in Review, and a skipped one isn't asked again until something changes.
- CC-149 (#245): development only: an optional, tool-agnostic coordination profile for the shared skills is recorded as a deferred post-1.0 idea in the backlog.
- CC-151 (#247): development only: the 2026-11-07 assessment's findings become tasks: all in 0.11.0: the linked-repo query fix (CC-152), one Inbox row per source after an interrupted publish (CC-153), the Notion build files in the package (CC-154), the release rule for a partial `main` (CC-155) and the first-hour guidance (CC-156).
- CC-152 (#249): `brain query --candidates` works again in a repo linked since 0.9.0: the `skills` entry `brain link` records in `.brain` no longer makes the query refuse with "invalid format".
- CC-153 (#251): a run that stopped between writing an Inbox row and recording it no longer creates the row a second time: the next pull recognises the row by its Brain ID, and the ingest looks a row up before creating it.
- CC-154 (#252): the Notion checklist, build prompts, module steps and migrations install with the CLI, and every message that sends you to them names the folder on your machine.
- CC-155 (#254): development only: a release is refused when no task row has its version, or when `main` already holds done tasks of a later release (unless `--allow-partial` with a reason), and docs/vision.md and synthesis/synthesis.md say which parts are history.
- CC-156 (#253): `brain init` and the README say what to do next (build the Notion space from the checklist, then connect), `brain query` without `--candidates` points to the brain-query skill as the contract says, and `brain modules list` is accepted.
- CC-157 (#255): development only: the 0.11.0 opening grill is recorded as decision 0076: reflection reports first in the chat like Ultimate Assistant, runs on demand, and leaves the weekly run to 0.13.0.
- CC-158 (#261): development only: the tests turn off Git's background maintenance and retry removing their temp folders, so `npm test` no longer fails at random with ENOTEMPTY.
- CC-159 (#263): `brain schedule install reflect` is refused: reflection runs only when you ask in 0.11.0, and its weekly run comes with 0.13.0's weekly review.
- CC-160 (#265): when you settle a contradiction with a value of your own, the brain records it as your correction; choosing one of the values the notes already claim keeps that note as its source.

Skills: ultimate-brain-skills 1.4.0 (sha256-44a670b2237205b1b0aa89f7eed7b0b5c0dcf05d6fbfcf97ae8bdb228300d404)

## 0.11.0-rc.1 — 2026-11-08


Skills: ultimate-brain-skills 1.3.0 (sha256-7c7317ffb55a13f59187533472c37a79c5d4d96915628166371ed0cec1e890fb)

## 0.10.2 — 2026-11-07

- CC-150 (#246): Ultimate Assistant's skill wording follows its contracts more closely (ultimate-brain-skills 1.2.1): a ramble keeps the session open, a delegated run carries out waiting Notion writes, and the log line and the summary count the same things.

Skills: ultimate-brain-skills 1.2.1 (sha256-e1aa1d661d5da68ff06bc8239d520b9b5c8283d85c9e44b6fbdd57227e0216a5)

## 0.10.1 — 2026-11-07


Skills: ultimate-brain-skills 1.2.0 (sha256-985c4f4b8626f6269a0864e270611b137b10e5bad9bd8352057c0b4959f1f54d)

## 0.10.0 — 2026-11-07

- CC-108 (#234): contracts for the brain assistant: what it checks in Areas, Domains, Projects and Tasks, how each finding becomes a Review row, and when it may change something directly.
- CC-142 (#235): development only: CC-109's build is split into CC-143 (findings and skips in the CLI), CC-144 (Notion-owned changes and field moves as proposals), CC-145 (the sub-agent, templates and the Review migration), with CC-109 keeping the skill, its fork release and the blind run.
- CC-143 (#240): `brain assistant findings` computes Ultimate Assistant's findings from your brain and a Notion snapshot (stalled and overdue tasks, finished or stalled projects, misplaced or duplicate projects, Areas with nothing active or no Domain), ranked, top 10 first, with your skips left out; `brain assistant dismiss` remembers a skip for 30 days.
- CC-144 (#236): a Review row can propose a change to a Notion-owned field, such as a task's Status or a project's Status, or a move of a project to another Area, and the brain applies it after your yes.
- CC-145 (#239): a brain gets the `ultimate-assistant` Claude Code sub-agent (`claude --agent ultimate-assistant`), and the Review database gains the Suggestion rows Ultimate Assistant writes when you ask it to propose a change.
- CC-109 (#237): "review my projects" finds stalled tasks, finished projects still open, misplaced projects and missing next steps, recommends what to do, and turns what you say into captures, tasks and projects, changing nothing without your yes or a Review row.
- CC-138 (#231): development only: a ruleset on `main` requires the `merge-ready` status, so a PR can't merge without its format, its ticked boxes, its `done` (#N) and a reviewer's pass at its head.
- CC-110 (#243): development only: end-to-end acceptance of the brain assistant on a synthetic brain, attended, with Review rows and chat approvals.
- CC-137 (#223): development only: the 0.10.0 opening grill is recorded as decision 0072, which names the assistant Ultimate Assistant and settles how a review session goes.
- CC-139 (#230): development only: 0.10.0 gains CC-140 (the acceptance fixtures) and CC-141 (finished releases move to HISTORY.md), built beside CC-108's contracts with CC-138.
- CC-140 (#233): development only: a synthetic brain and a synthetic Notion space with planted project-management problems, for testing Ultimate Assistant.
- CC-141 (#232): development only: the 0.8.1, 0.9.0, 0.9.1 and 0.9.2 sections move from TASKS.md to HISTORY.md, as AGENTS.md asks after each release.
- CC-148 (#242): merging two projects (or any two notes) no longer rewrites the duplicate's own Brief and Decision log to point at the survivor, so `brain views` and `brain lint` stay clean after a merge.

Skills: ultimate-brain-skills 1.2.0 (sha256-985c4f4b8626f6269a0864e270611b137b10e5bad9bd8352057c0b4959f1f54d)

## 0.9.2 — 2026-11-06

- CC-133 (#222): development only: 0.9.2 gains the fixes for dogfood #220 and #221 and takes CC-116 and CC-118 from 0.10.0, and CC-105's spec becomes its own task.
- CC-134 (#228): development only: the contract for phase B of skill delivery, where skills are written in the fork and the package ships its released snapshot.
- CC-105 (#229): the brain skills are written in the ultimate-brain-skills fork, and the ultimate-brain package ships an exact, tested snapshot of them.
- CC-135 (#225): a report or Document whose text is held for your decision still gets its Origin, Project, Area and links in Notion unless you ticked it Accepted; only its text waits.
- CC-136 (#227): `brain upgrade` also moves the links to old concept notes that sit inside proposals, so no proposal points at `knowledge/concepts/` after 0.9.1.
- CC-116 (#226): development only: `pr-format` names a PR whose own task row is missing, instead of asking for a CHANGELOG.md line.
- CC-118 (#224): a link made before kits takes its new kit, and a moved repo its new path, with `brain repo refresh`, without the brain listing the repo's files again.

Skills: ultimate-brain-skills 1.1.0 (sha256-5dadc9f250606c8b2eaabd7cbb2e57cf5886206ae66ab2a826ffb6d168687751)

## 0.9.1 — 2026-11-04

- CC-123 (#214): concepts become Documents of their own kind, "learned": the Concepts database is retired and existing concepts move to Documents with their links.
- CC-124 (#211): reports live in Documents instead of the Inbox, still one per subject, refreshed from their page; an Ask stays in the Inbox and links to its report.
- CC-125 (#210): decisions, questions and Documents appear in Notion once you approve them; until then they are in their Review row only.
- CC-126 (#209): the brain no longer files to-dos as questions: your own become tasks, other people's stay commitments you can track as Waiting On, and questions are kept for what something can answer later; a one-off tidy offers to turn existing to-do questions into tasks.
- CC-127 (#208): an Org can be your Employer, besides Client, Prospect, Partner, Supplier and Other.
- CC-130 (#219): the workflow skill publishes final artifacts without a refused lifecycle, documents its input shapes and retry path, releases an item's claim when it is done, shows an edit made after your yes again, and adoption's first progress line reads plainly.
- CC-132 (#217): `brain link` accepts a repo whose `CLAUDE.md` is a symbolic link to its own `AGENTS.md`, and refuses any other symbolic `CLAUDE.md` with `INSTRUCTIONS_SYMLINK` instead of `OUTSIDE_ROOT`.
- CC-131 (#218): the brain-sync skill reads the Domains database when Domains is on, so a Domain's Type, Archived and edits reach the brain and a Domain added in Notion is imported.

Skills: ultimate-brain 0.9.1 (sha256-1a06225fbe4a5378f5f7dfbfaf06e4f72c6d6bb7258bdac898fc2c85fa3c8db3)

## 0.9.0 — 2026-11-04

- CC-97 (#181): development only: an inventory of the skills Claude Code and Codex load today, compared with the pinned upstream, and the approved keep/adapt/isolate/retire mapping for the shared-skills fork.
- CC-98 (#182): the contract for pinned skill delivery: each brain records the skill snapshot it uses, both agents load the same version, and an incompatible or missing snapshot stops a command before it writes, with the upgrade to run.
- CC-99 (#183, #186): contracts for connected workflows, the adoption of existing projects, and linked repos with a link kit (decisions 0059, 0066).
- CC-95 (#184): decision 0064 puts a brain assistant in 0.10.0 and reflection in 0.11.0, moves Hermes after 1.0, and breaks 0.9.0 into tasks.
- CC-100 (#187): each brain uses the exact skill snapshot it recorded: Claude Code and Codex load the same version, and a missing or incompatible snapshot stops a command before it writes, with the upgrade to run.
- CC-101 (#185): development only: the public ultimate-brain-skills fork holds the skills' source, with upstream attribution, compatibility metadata in every release and reviewable upstream updates.
- CC-102 (#190): a linked repo carries a link kit saying what the brain may read, where its tasks live and how it works; the brain shows its tasks as a read-only rollup or leaves them to Notion, and can check, change or unlink it without losing knowledge; `brain workflow` keeps connected work's scope, progress and pending Notion writes as durable records in the brain.
- CC-103 (#188): Projects and Areas get Workflow settings in Notion (tracking, work type, logging level and logged artifacts), with one dated summary of progress, pending publication and decisions needed on the page; migration 0015 adds them.
- CC-104 (#200): three new skills: adopt an existing project's plans and tasks, run work as standard or Notion-connected with the logging you chose, and link, check, unlink or start a repo from the brain.
- CC-106 (#189): development only: the product checks the skills fork daily, at the start of work and before a release, keeps one open integration issue for unassessed skill changes, and blocks a release on an incompatible one.
- CC-107 (#207): development only: end-to-end acceptance of 0.9.0 in isolated installations: four adoption scenarios, rollback, and both agents loading the same skills.
- CC-129 (#212): after the first `brain upgrade` of an unpinned brain, the rollback names the version to go back to; `brain repo kit check` also returns the hash `kit write` confirms, so a kit draft formatted by hand can be written.
- CC-114 (#197): a new project is published from the space's Projects template through the API instead of being refused with `PROJECT_NOT_IN_NOTION`, and a new Review row's body is written once through Notion's markdown endpoint so its toggles stay real toggles.
- CC-112 (#198): meeting minutes split your actions into quick follow-ups, which stay in Notion as checkboxes, and tasks with an editable Scope (done when, due, project, notes) that the ingest carries into the Notion task; a long or reworded quote no longer blocks a whole meeting (#191).
- CC-113 (#195): `sync apply` creates new notes in relation order, so an Area whose Domain (or a Project whose Area or Org) is new in the same plan is created in one run, whatever the plan's order; a cycle among creates is reported as `RELATION_CYCLE`.
- CC-115 (#199): development only: CC-113's task row, dropped by a merge of main into #195, is restored, and the own-row check is planned as CC-116 in 0.10.0.
- CC-117 (#201): each catch-up rebuilds the task rollup of a repo whose tasks are tracked in the repo, and "link the repo at <path>" in an ingest goes through brain-repos, so every new link gets a kit after your yes.
- CC-119 (#205): development only: CC-105 (skills from the fork) moves to a later patch release (0.9.2 since CC-128), so 0.9.0 ships on the product's own skills (decision 0069).
- CC-128 (#206): development only: the tasks merged before 0.9.0 is released count as 0.9.0 (CC-120, CC-121, CC-122), a simpler Notion becomes 0.9.1 and skills from the fork 0.9.2, so each release's notes match what it ships.
- CC-120 (#202): Type (Personal, Entrepreneurship, Professional) moves from Areas to Domains: sync reads it into the domain note and drops the old value from area notes (migration 0016).
- CC-121 (#203): Domains, Areas, Goals, Projects and Orgs no longer have Lifecycle: they come in as reviewed, you close them with Archived (Orgs gain it), and People and the knowledge databases keep Lifecycle for Review (decision 0070).
- CC-122 (#204): development only: decision 0071 plans 0.9.1 (first numbered 0.9.2; renumbered by CC-128), a simpler Notion, and breaks it into CC-123 to CC-127.

Skills: ultimate-brain 0.9.0 (sha256-564ec7a488f801761c6ebead2edd0d7cdd4d0e5409e4e8c19a78b52035ed313e)

## 0.8.1 — 2026-11-03

- CC-91 (#176): development only: a Claude reviewer sub-agent reviews each PR and its pass turns `merge-ready` green, so PRs no longer wait for Codex (decision 0063).
- CC-92 (#177): development only: `task.mjs start --new` starts a task that has no row yet, and `task.mjs clean` removes every merged task worktree.
- CC-93 (#178): `release.mjs` checks the npm login before it commits and tags, waits for CI on the release commit, and says how to finish after a failed publish; the upgrade steps install the exact version.
- CC-94 (#179): development only: done releases move from build/TASKS.md to build/HISTORY.md, so a session reads about 24 KB of open work instead of 166 KB.
- CC-96 (#180): every Notion space gets the Domains database and the Areas · Domain relation, used or not, so turning Domains on is a switch; migration 0014 adds them to an existing space (decision 0065).

## 0.8.0 — 2026-11-03

- CC-69 (#149): decision 0054 plans buttons that run Brain Assistant in Notion (Tidy capture, Write up, Refresh report), with only accepted wording coming back to the brain.
- CC-86 (#156): decision 0056 builds the Brain Assistant buttons in 0.8.0 with Domains and editable Review; 0.7.1 becomes a small patch.
- CC-74 (#156): decision 0055 plans optional Domains, Won't Do, selected capture and editable Review for 0.8.0, moving reflection to 0.9.0.
- CC-70 (#159): contracts for the Brain Assistant buttons: what each button sends and may edit, how accepted wording is recorded and checked, and how a publish keeps what is pending in Notion.
- CC-71 (#162): Tidy capture, Write up and Refresh report run Brain Assistant from a button in Notion; Notion migration 0012 adds them.
- CC-72 (#160): the CLI reads the wording you accepted in Notion into the Git Document or report exactly, supports Related knowledge appendix proposals, and never overwrites a pending draft on publish.
- CC-73 (#164): catch-up takes in the Documents and report refreshes you accepted in Notion and proposes related knowledge to add, citing why each item helps.
- CC-75 (#163): contracts define optional Domains, source selections, exact per-item Review acceptance and the Notion interactions that support them.
- CC-76 (#165, #167): optional Domains group Areas around PARA, with onboarding support and no required reclassification of existing brains.
- CC-77 (#166): Won't Do closes Tasks without counting them as completed, removes them from due work and shows dropped scope separately.
- CC-78 (#170): subject and item selections limit canonical source extracts, and later exclusions reconcile previous contributions without silent deletion.
- CC-79 (#171): Review shows complete changes in the page body and applies independently accepted edits with source and user attribution preserved.
- CC-80 (#172): captures and meeting summaries group highlights and actions by subject, honor visible inclusion defaults and guide exact Review decisions.
- CC-81 (#173): Notion templates expose selected subjects, optional Domains and guided Review bodies, with migration 0013 preserving existing content and decisions.
- CC-82 (#174): end-to-end acceptance verifies Domains, dropped Tasks, selected source capture and exact partial Review decisions across attended and unattended runs.
- CC-87 (#161): records the agreed 0.9.0–0.14.0 roadmap, session-opening scope grills and feature cutoff before productisation, translation and the 1.0 launch.
- CC-88 (#168): records the user's Notion feasibility tests T1 to T8 for selected capture and editable Review, including that deleting a block does not move the page's edit time.
- CC-89 (#169): the brain no longer watches ingested pages for changes; a selection changes when you set the meeting back to Reviewed, and a deleted block is documented as not detected.
- CC-90 (#175): the 0.8.0 task rows are closed, so the release can run.

## 0.7.1 — 2026-10-31

- CC-83 (#154): the spec's examples use a neutral owner name and paths instead of the author's.
- CC-84 (#157): the release gate looks only at the CI workflow's checks, so an unrelated failing check no longer blocks a release.
- CC-85 (#158): the merge-ready status accepts "Review (Codex): pass at <sha>" only from the repo owner's account.

## 0.7.0 — 2026-10-31

- CC-62 (#151): contracts for unattended catch-up: the input budget, the no-op rule, the Report row, and `brain schedule`.
- CC-63 (#152): `brain schedule` installs, lists and removes a scheduled catch-up or reflection, and `brain.json` takes an input budget for unattended runs.
- CC-64 (#153): "catch up unattended" runs a catch-up with no questions, on a schedule or by hand, and "run catch-up every morning" sets the schedule.

## 0.6.1 — 2026-10-30

- CC-60 (#147): decisions 0051 (unattended catch-up and schedules) and 0052 (reflection) plan 0.7.0 and 0.8.0, from a review of two third-party vault skills.
- CC-61 (#150): the skills and the brain's agent rules drop leftover emphasis and bare rules, give the reason for each hard rule, and gain two rules for current models: edit only what changes, and search a name as written before answering from memory.
- CC-68 (#148): Home shows your areas and your Inbox as tabs, each area's counts read as one line ("4 to review · 1 meeting", or "all clear"), and buttons get a name apart from their label; Notion migration 0011.

## 0.6.0 — 2026-10-28

- CC-55 (#138): decisions 0048 (modules, three Inbox states, three kinds of Review row, buttons and page layouts), 0049 (Documents: keep a file as a page, promote a note) and 0050 (area homes) plan 0.6.0.
- CC-56 (#139): contracts for 0.6.0: modules, the New → Ready → Done Inbox, three kinds of Review row, buttons and layouts, Documents kept whole or in part, promoted notes, and area homes.
- CC-57 (#140): the CLI switches modules, takes in Ready rows only, writes Documents whole or in part and promoted ones, keeps a Kind the user chose, and gives Review rows an area.
- CC-58 (#141): the skills turn modules on and off on request, keep documents whole or in part, promote notes, and fix U-18's findings: no placeholder writes, a full pull, re-read corrections that replace the old wording.
- CC-59 (#142): Notion migration 0010 renames References to Documents, adds the buttons and page layouts, simplifies Brain Status, and turns Area pages into area homes; migration 0009's text is corrected.

## 0.5.0 — 2026-10-23

- CC-52 (#129, #130): `/Clean email` rewrites the page directly (asking only on a serious doubt) and gives each message, newest first, a heading with names and date, its own text below it and a divider before the next: no addresses, Subject, Cc, banners or Teams, Zoom and Meet blocks.
- CC-47 (#127, #128): contracts for 0.5.0: one Review row per source with Fix, the Ready gate and re-reads, living reports, and `reference` notes from a document's Keep.
- CC-48 (#133): the CLI folds fact and text changes into one Review row per source, defers excluded items, applies Fix, re-reads a corrected source, refreshes reports and writes `reference` notes.
- CC-49 (#135): catch-up asks what to keep from each document, takes in only Ready rows, re-reads corrected sources, reads Fix and What to fix, and refreshes reports.
- CC-50 (#136): research on Hermes as an always-on brain operator and on a search index (GBrain read-only or local BM25).
- CC-53 (#131): AGENTS.md says how agents launched by Orca follow the task workflow: worktrees from `task.mjs`, Claude builds, Codex reviews, TASKS.md stays the task list.
- CC-54 (#132): brain-sync writes the snapshot's `as_of` once at the top, so `sync plan` no longer refuses its rows with "unknown key".

## 0.4.1 — 2026-10-23

- CC-44 (#123): decision 0045 records the first brain's feedback: 0.4.1 starts questions as Open, adds `/Clean email`, says what approving does and clears finished Review rows; the rest is planned for 0.5.0.
- CC-51 (#124): decision 0046: a task can start from the branch of the task below it, and Codex reviews a stack of PRs in one session.
- CC-45 (#125): new questions and risks reach Notion as Open, and Review rows leave Notion 30 days after they were decided.
- CC-46 (#126): a `/Clean email` prompt for pasted threads, a Review that says what approving does, a Home count of what waits for you, and catch-ups that trash finished Review rows.

## 0.4.0 — 2026-10-21

- CC-29 (#96): decision 0039: a task's changelog line lives in its build/TASKS.md row and `release.mjs` writes the CHANGELOG section.
- CX-34 (#99): `release.mjs` writes each release's CHANGELOG section from the task rows; PRs no longer edit CHANGELOG.md.
- CC-30 (#105): AGENTS.md, the PR template and the release guide describe the `**Changelog:**` field.
- CC-34 (#110): the status banner after the 0.3.1 release: decision 0040 merging, the open 0.4.0 theme choice.
- CC-41 (#120): a script builds a blind-run brain from a fixture, with its Notion ids blanked and its first commit made.
- CC-31 (#98): OKF and GBrain reviewed and parked for v2 (reviews/06): a retrieval index over Markdown, and OKF export, then maybe alignment.
- CC-35 (#111): the 0.4.0 plan: the brain gives back (reviewed notes, answered questions, Briefs) and takes in linked repos and Notion attachments (decisions 0041, 0042).
- CC-38 (#114): decision 0043: Inbox rows show a digest or the full text, reports on request land in the Inbox, one Review row per source, a 5-minute catch-up, and the user's minutes format.
- CC-39 (#116): decision 0044: Claude Code builds every task, the CLI included, and Codex reviews every PR.
- CC-36 (#115): contracts for 0.4.0: the `review_notes` and `answer` proposals, Briefs from reviewed notes and for areas, linked repos and Notion attachments as sources.
- CC-42 (#118): the CLI applies Review notes and Answer rows, writes the backlog's rows once, builds Briefs from reviewed notes, for areas too, writes each source's digest and, when asked, its full text to the Inbox, and stores reports.
- CC-43 (#119): the CLI reads linked repos (changed files since the last ingested commit) and takes files attached in Notion as sources under their Inbox row or meeting.
- CC-37 (#121): catch-up writes Review notes and Answer rows, writes the backlog's rows on the first run, reads linked repos and Notion attachments, and the guide explains Briefs and reviewing notes.

## 0.3.2 — 2026-10-21

- CC-40 (#117): `brain sync tasks` types the Status value by `notion.tasks.status_type` (`status` for Notion's built-in Status, as in the default Tasks database; absent or `select` as before), so new tasks no longer fail on that database (#113).

## 0.3.1 — 2026-10-20

- CC-28: the 0.3.0 retro's tasks: gate fixes for lost CHANGELOG lines, done before merge and merges outside the gate (CX-32); changelog fragments (CC-29) and a blind-run setup script (CX-33) for 0.4.0.
- CC-32 (#100): loose ends: lagging task statuses closed, the guide uses the live Inbox view names, `--version` specified (built in CX-35); dogfood #101 (Concepts created by hand in migration 0005) and #102 (Tasks `source` mapped by default).
- CX-32 (#104): gate scripts: `pr-format` fails a PR that loses another task's CHANGELOG.md line, `merge.mjs` waits out GitHub's UNKNOWN mergeability, `main-guard` fails a merge without the other agent's pass or the user override, `npm run skills` and the pre-commit hook check the skill mirror.
- CX-35 (#103): `brain --version` (text, or the §3.3 envelope with `--json`); tests that a `url:` source needs `kind: document` and `converter`.
- CC-33 (#107): decision 0040: the user merges on the GitHub PR page with a `merge-ready` status in view; `main-guard` no longer checks how a PR was merged.
- CX-36 (#108): the `merge-ready` status on every PR (format, ticked boxes, task done, the other agent's pass); `main-guard` checks only that commits came from PRs (decision 0040).

## 0.3.0 — 2026-10-19

- CC-22 (#90): intake contracts: the Inbox (every source but minutes), Concepts, grouped link reviews with a Note, owner tasks from sources, `brain.json` settings, Area on Decisions and Questions; Notion migration 0005.
- CC-26 (#92): intake skills: "catch up" (one read-only pass, one batch of questions), Review Notes and grouped rows in brain-apply, Inbox rows and owner tasks in brain-ingest, identities and Notion access steps in brain-connect-notion, publish and push settings, the user guide.
- CX-22 (#93): render the brain-owned Area relation for Decisions and Questions from their projects.
- CX-24 (#94): implement grouped link reviews, Inbox and Concepts sync, source tasks, settings status and Inbox upgrade.
- CX-31 (#91): release tags are annotated so `git push --follow-tags` publishes them.

## 0.2.4 — 2026-10-19

- CC-27 (#88): real Notion ids removed from the product docs; the review verdict names the commit it covers and comes after the done commit.
- CX-28 (#86): leak checks in CI and before commits for UUIDs, non-example emails and the local denylist.
- CX-30 (#87): `merge.mjs` requires a pass from the other agent naming the PR's head commit, with an explicit user override.

## 0.2.3 — 2026-10-18

- CC-24 (#80): delivery lanes, one channel (npm) and release gates: decision 0038, the brain's read-only and findings rules, issue and PR templates, the Claude Code plugin retired; the merge gate without GitHub Pro; three real names removed from the skills and docs.
- CC-25 (#84): `merge.mjs` and `release.mjs` accept skipped check runs; a task is marked done before its PR merges.
- CX-29 (#83): refresh product-owned files for both agents, lint their drift, and safely upgrade, commit and push brains.
- CX-27: release, merge and task scripts; main-push and PR-format gates; package smoke test works after a release.
## 0.2.2 — 2026-10-18

- CC-23: new projects are created in Notion; reports grow with the input (decision 0037 amended).
- CX-26: `sync render` refuses project creates (`PROJECT_NOT_IN_NOTION`); "latest" leaves the freshness words.

## 0.2.1 — 2026-10-15

- CC-21: "process my drop folder", the three-line report, faster publish (decision 0037).
- CX-23: an Edit on a link row is a plan conflict.
- CX-25: CLI fixes from the acceptance run.

## 0.2.0 — 2026-10-15

- Sources beyond meetings, the Notion look pass, Notion AI prompts, the user guide (CC-13 to CC-20, CX-18 to CX-20).

## 0.1.x — 2026-10-13

- v1 waves 1 to 4 (build/TASKS.md).
