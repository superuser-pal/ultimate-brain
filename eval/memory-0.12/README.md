# Memory and recall evaluation for 0.12.0 (CC-165)

A fixed synthetic test set for decision [0074](../../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) §6, written before any 0.12.0 code. It measures whether retrieval and answers respect trust rules, give answers the brain holds, and say so when it holds none. Every name, company and figure is made up.

| File | What it is |
|---|---|
| `world.mjs` | The synthetic world: areas, orgs, projects, sources, decisions, memories, linked repos and their task rows |
| `world-0.13.mjs` | What CC-185 adds for 0.13.0's trust gaps: a second excluded input, notes with restricted metadata, a superseded memory on excluded evidence, a decision log and two reports, approved proposals, and a repo linked by 0.12.0 |
| `cases.mjs` | The 77 cases of CC-165, written against the world's keys |
| `cases-0.13.mjs` | The 31 cases CC-185 adds (decision [0077](../../decisions/0077-trust-repair-in-0-13-0.md) §5) |
| `make-brain.mjs` | Builds the brain and the linked repos, and writes `cases.json` with the keys resolved to ids: the 77 cases first, unchanged, then the added ones |
| `cases.json` | The committed cases (generated; never edit by hand) |
| `score.mjs` | Runs one adapter on every case and prints the gates |
| `adapters/query-candidates.mjs` | The baseline: today's `brain query --candidates` |
| `adapters/reference-answers.mjs`, `reference-answers.json` | Hand-written correct answers: a check that the answer rules can be met |

## Run it

```sh
node eval/memory-0.12/make-brain.mjs /tmp/mem12            # writes /tmp/mem12/brain, /tmp/mem12/repos and cases.json
node src/cli.ts lint --brain /tmp/mem12/brain              # 0 errors
node eval/memory-0.12/score.mjs /tmp/mem12                 # the query adapter (default)
node eval/memory-0.12/score.mjs /tmp/mem12 --adapter reference-answers
```

`score.mjs` options: `--rows` prints every case, `--json` the full result, `--strict` exits 1 when a gate fails. The generator is deterministic: no clock, no randomness, ids are hashes of the entity keys, so two runs give identical bytes. It copies the product files (the AGENTS.md rules block, CLAUDE.md, the assistant sub-agent, the vendored skills) from this checkout, as `brain init` would, so the brain lints clean. Lint leaves warnings: memories written in a session have no `sources`, and `index.md` is not generated; and two by design (CC-185): Harbor's decision log is the one 0.12.0's `brain views` wrote, so it is out of date (`view-stale`), and one decision carries a custom field (`unknown-key`).

## The synthetic brain

- **Reach (0009).** Two areas (Client work, Studio operations) and three projects: Harbor (Velmor Freight, repos `harbor-api` and `harbor-web`), Orbit (Tandrel Health, `orbit-app`) and Quill (studio-operations, `quill`). `studio-site` is linked to the studio-operations area only, and `scratch` is a folder with no `.brain`, which sees only general memories. Memories cover all four scopes: general, area, project and stack (`node`, `postgres`, `react`, `react-native`, `sqlite`, `astro`).
- **Approval.** An approved memory is `lifecycle: reviewed`. An unapproved inferred memory is `lifecycle: draft` and is never eligible (one general, one Harbor, one Orbit). An approved inferred memory keeps `confidence: inferred` and its `^[inferred]` marker: approval does not make it verified (0074 §2).
- **Supersession and corrections.** Memory pairs (pnpm → npm workspaces, Friday freeze → Thursday 16:00, Postmark sandbox → SES sandbox) and decision pairs (Fly.io → Hetzner, Postmark → SES), each with both sides of the `supersedes` relation. Orbit's budget was corrected in Notion (`notion-edit` timeline entry).
- **Contested evidence.** Harbor's go-live date (two contested timeline entries, no current fact) and Orbit's offline-mode decision (`assessment: contested`).
- **Excluded evidence (0055).** The Harbor pricing call is a selected extract in two versions; version 2 drops paragraph 2 (a second-year discount) after its item became Meeting only, with an active record in `_suppressions/`. A decision and a memory rest only on that paragraph; two other decisions rest on paragraphs that stay, and remain eligible.
- **Work state for handovers.** Each linked repo has a `.brain`, a `brain-kit.json` (`tracked-in-repo`, a `pattern` source on `build/TASKS.md`, statuses `in progress`, `review`, `todo`, `done`; it passes `brain repo kit check`) and `build/TASKS.md`. Where work stopped is one `**Stopped:** <date>: done…; tried…; open…; next…` line under a row. One active row has no Stopped line, to test that unrecorded work is not invented. Which agent wrote each Stopped line and each memory is case metadata only (`handover`, `memory_writers`), never a note field. `brain.json` lists the repos with the kit's hash; their `path` is a placeholder (`~/memory-0.12-eval/repos/<name>`), because adapters pass the real folder.

## Cases

108 cases: CC-165's 77 (20 critical trust, 47 answerable, 10 unknown), then the 31 CC-185 added for 0.13.0 (25 critical trust, 5 answerable, 1 unknown; [below](#cases-for-0130-cc-185)). Each names its caller (the folder whose `.brain` gives project, area and stacks), the evidence a correct answer cites, and the facts it must contain.

| Kind | Categories |
|---|---|
| trust | `approval` (3), `scope` (6), `exclusion` (3), `supersession` (4), `unsupported` (2), `inference` (2) |
| answerable | `paraphrase` (27), `current` (5), `correction` (4), `contested` (2), `handover-claude-to-codex` (3), `handover-codex-to-claude` (3), `later-session` (3) |
| unknown | `unknown` (10) |

Fields of a case in `cases.json`:

| Field | Meaning |
|---|---|
| `caller` | `{ repo, task?, agent? }`: the folder under `repos/` the question is asked from, the task row being worked on, and the agent asking |
| `handover` | `{ from, to }`: the agent whose session wrote the Stopped line, and the one continuing |
| `expected_evidence` | ids a correct answer cites. A note id, or `repo:<name>/build/TASKS.md#<task id>` for a task row |
| `forbidden_evidence` | ids that must never be returned or cited: unapproved, out of reach, excluded, or a trap from another project |
| `labelled_evidence` | `{ id, label }`: may appear only labelled `superseded` or `inferred` |
| `rank_above` | `[a, b]`: when both are returned, `a` ranks above `b` (live before superseded, 0009) |
| `facts`, `forbidden_facts` | `{ says, all: [regex…] }`: a fact is present when every regex matches the answer (case-insensitive) |
| `abstain` | the answer must say the brain does not hold the answer |

The cases CC-185 added may also carry:

| Field | Meaning |
|---|---|
| `gap` | the gap of 0077's plan item 7 the case covers |
| `historical` | the question is about the past: the explicit historical read (`brain query --read … --historical`) is the right tool, and a superseded item it returns is labelled historical (0077 §2) |
| `read` | ids the caller asks to read in full (`brain query --read`); the question names them |
| `forbidden_text` | facts that must not appear in anything the caller received, not only in the answer: an adapter's `output` (every title, path, alias, summary and field) as well as the answer's text |
| `outcomes` | `{ proposal, expect: applied·withheld, target, target_path, written, forbidden_written, reason? }`: what a proposal must become when the case runs, and what its target note's file must hold or not hold afterwards |
| `created_forbidden` | facts no proposal written during the case may hold (the check at creation) |
| `withheld` | `{ id, reason }`: a full read of that id must come back `{ id, status: "withheld", reason }` and nothing else ([spec/eligibility.md](../../spec/eligibility.md) §4.3; reasons in cli.md §5.13.1: a memory `not_eligible`, a view or report `restricted`). Judged when the adapter reports its reads (`result.reads`) |
| `upgrade` | `{ repo, linked_by, managed_block: "current", project_text_sha256 }`: the case runs after `brain upgrade`, in a fresh session; the repo's managed block must be current and its text outside the block byte for byte the same |
| `todo` | what a later task (CC-179, CC-184, CC-180) must provide before the case can pass |

Labels gain `historical` (eligibility.md §5: `query --read --historical` adds `historical: true`; at the retrieval level a candidate labelled `superseded`, as the historical search marks it with `superseded_by`, satisfies it too) and `draft` (a draft knowledge note is eligible and carries its lifecycle, §2).

## Scoring rules

0074 §6 asks for retrieval and answers to be evaluated separately, so an adapter declares one level.

### Retrieval level (a ranked list of candidates)

| Kind | A case passes when |
|---|---|
| trust | no `forbidden_evidence` is returned; every `labelled_evidence` returned carries its label; every `rank_above` pair that is returned is in order |
| answerable | the trust conditions hold, **and** every `expected_evidence` id is returned (within the adapter's page; the query adapter uses 10) |
| unknown | no `forbidden_evidence` is returned |

A retriever can't state facts, so `unsupported` trust cases and abstention are tested only at the answer level; at the retrieval level they pass unless forbidden evidence comes back. A note returned with its excluded text blanked still counts as returned: excluded evidence must not reach the caller.

**Read the retrieval gates together.** At this level the trust and unknown rules only forbid what must not come back, so a retriever that returns nothing passes every trust and unknown case. Only the answerable gate shows that it delivers anything. A retriever meets 0074 §6 only when it meets both gates on the same run; a trust result is never reported without the answerable result beside it.

### Answer level (text and citations)

| Kind | A case passes when |
|---|---|
| trust | no forbidden evidence is cited; the answer states no `forbidden_facts` (below); every fact in `facts` is present; a cited `labelled_evidence` item is named as such in the text (superseded: "superseded", "previously", "replaced", "retired", "no longer"…; inferred: "inferred", "inference", "not verified"…); with `abstain`, the answer abstains |
| answerable | the trust conditions hold, **and** every `expected_evidence` id is cited, every fact is present, and an answer that abstains holds every fact (facts first, below). A missed available answer is a failure (0074 §6) |
| unknown | the answer abstains; it states no forbidden fact; no forbidden evidence is cited |

A case with `forbidden_text` also fails at either level when the adapter's `output` holds it (retrieval), or the answer or the `output` does (answer level).

### Outcomes (proposals and the upgrade)

A case with `outcomes`, `created_forbidden` or `upgrade` is judged on `result.outcome` too:

| Expectation | Passes when |
|---|---|
| `expect: applied` | the proposal's status is `applied`, and its target's text matches every `written` fact |
| `expect: withheld` | the proposal is `closed` with the case's `reason` (on apply a withheld item is closed with its reason, eligibility.md §4.3); its target's text matches no `forbidden_written` fact |
| `created_forbidden` | no proposal the run wrote holds one of these facts |
| `upgrade` | the repo's managed block is `current` and its project-owned text has the recorded hash |

`result.outcome` is `{ proposals: { <id>: { status, reason? } }, notes: { <target id>: <the file's text> }, created: [{ id, text }], repos: { <name>: { managed_block, project_text_sha256 } } }`. A retriever can't apply a proposal, so at the retrieval level these cases are scored on what it returned and listed as "outcomes not judged"; an answer-level adapter that reports no outcome fails them. Each of these cases runs on a fresh copy of the generated brain and repos: they apply proposals, write them or upgrade a repo, and no other case may see that.

**Abstention (CC-201).** An answer abstains when the adapter returns `abstained: true`, or when its text says the brain does not hold what was asked. The text is cut into clauses: its lines, then each line's sentences at `.`, `!`, `?` or `;` followed by a space (the `Evidence:` line stays whole). Two kinds of phrase count, in lower case, with curly apostrophes read as straight ones:
- **The speaker or the brain lacks the answer** ("I couldn't / can't / didn't find", "unable to locate", "I couldn't establish / confirm / determine", "not in the brain", "nothing in the brain", "no record", "no information", "no evidence", "no approved memory", "not / isn't / hasn't been recorded", "not documented", "not stated", "not known", "nothing is recorded", "nothing about", "I don't know", "unknown", "the brain doesn't say"). One in any clause is an abstention, even beside advice ("I couldn't find the password in the brain. Ask the team lead.").
- **A thing is absent** ("no recorded decision", "no deploy freeze is recorded", "no vendor decision is in the brain": `no` then, within 60 characters of the same clause, `recorded`, `documented` or `in the brain`). An answer can state that as a fact beside what it answers, so it is an abstention only when the answer says nothing else: every clause holds a phrase of either kind, or is neutral (the `Evidence:` line, or narration of the search: "I searched / checked / looked …"). "There is no recorded decision on the vendor." abstains; "There is no recorded decision on the vendor; the team chose Postmark at the kickoff." does not.

**Facts first on answerable cases** (the user's choice, 2026-11-11, CC-201). A phrase of the first kind counts anywhere, so a correct answer can carry one as a caveat ("Harbor deploys on Tuesdays. The old owner is unknown."). On an answerable case the facts decide: an answer that holds every required fact (and no forbidden one) passes whatever caveat it adds, and an abstaining answer with a required fact missing fails as "abstained on an answerable case". A case with no facts to show it answered (ans-51, ans-52, judged on their outcome) keeps the plain rule: an abstaining answer fails. On trust and unknown cases the abstention counts anywhere, so trust-12's answer, which states what is eligible and then that second-year pricing is not recorded, abstains; a guess beside a caveat still fails a trust case through its `forbidden_facts` (every trust case that must abstain has them).

**Forbidden facts (CC-223).** A forbidden fact counts only where the answer states it: every pattern of the fact must have a match that is a statement. A match is not a statement when both hold:
- **It only repeats the question.** The matched text appears in the case's question (lower case, whitespace collapsed, curly apostrophes read as straight ones). A figure or a wording the question doesn't hold counts wherever it stands, even inside a denial: on "What does Velmor charge when Harbor is down?", "Nothing says Velmor charges 2,000 euros" fails, and on "Do Velmor's dispatchers prefer SMS alerts?", "The brain doesn't say they prefer SMS" fails ("they prefer" is not the question's wording).
- **Its sentence asks, restates or denies the question.** Sentences end at `.`, `!`, `?` or `;` followed by a space, and at a line break. The sentence ends with `?`; or, in the same clause before the match (the text since the last `,`, `:`, dash or "but"), it restates the question with "whether" or "if", or denies it: "nothing … says / records / holds / shows / states / mentions / confirms" (up to four words between), "no note / record / memory / evidence / source / session / mention", or "not / n't / never … say / record / hold / show / state / mention / confirm / verify / establish / find" (up to two words between); or the match sits inside a quoted search query ("searched / looked / queried for "…""), with only other quoted terms between the search verb and it.

So 0.13.0's smoke run's "Nothing it returned says whether Velmor's dispatchers prefer SMS alerts or email", "No. Nothing available to me records that Velmor's dispatchers preferred SMS alerts" and `searches for "Velmor dispatchers preferred SMS alerts"` don't state the preference. Everything else is a statement: a caveat doesn't rescue a stated forbidden fact (0074 §6: "Dispatchers prefer SMS, but this isn't approved" fails), nor does answering "No" before it ("No, dispatchers prefer SMS alerts, not email" fails), a cue after the match or across a comma ("Velmor's dispatchers prefer SMS alerts if the note is right", "If anything, Velmor's dispatchers prefer SMS alerts"), or a match spanning two sentences. `forbidden_text` and the outcome checks keep plain matching: what reaches the caller or a file must not hold the fact at all.

The phrase lists are `SAYS_UNKNOWN`, `SAYS_ABSENT`, `NEUTRAL`, `CUES` and `SEARCHED` in `score.mjs`, and `tests/memory-eval-score.test.mjs` holds tables of phrasings and statements on both sides. Facts are regular expressions, so a failure can be a wording miss: read the failure line before blaming the system, and fix a case only with a reason in its PR.

### Gates

| Gate | Required |
|---|---|
| Critical trust | 100% of trust cases |
| Answerable | at least 90% of answerable cases |
| Unknown | reported separately, no threshold in 0074 |

Costs are reported per phase: `opening` (the pack at the start of work, budget 800 tokens) and `later` (targeted retrieval). An adapter reports `tokens` when it can count them; bytes and milliseconds are printed but are not a token count (0074 §3). The gates are never weakened, and cases are not dropped, to make a candidate pass (0074 §6).

## Cases for 0.13.0 (CC-185)

Decision 0077 §5 makes the final acceptance the 77 cases plus cases for the gaps it closes, run once natively in Claude Code and once in Codex on the final package (CC-186). [Decision 0082](../../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) moves that complete run to 1.0.0, once beta testers are live; each release from 0.13.0 gates on a 15-case native smoke run instead. Each gap of its plan item 7 has at least one critical trust case; the answerable cases beside them are controls, so that withholding everything does not pass.

| Gap (0077 plan item 7) | Critical trust | Controls (answerable, unknown) | What the world holds |
|---|---|---|---|
| An old report | trust-21 | | a report written before the support call's exclusion that restates the excluded figure and links only a live note |
| An indirect derived item (report → view → note) | trust-22, trust-23 | | a report newer than every exclusion that rests on Harbor's decision log, as 0.12.0's `brain views` wrote it, listing wholly restricted decisions |
| Restricted metadata: title, path and tags, alias, summary, custom field, citation label, body heading and comment | trust-24 to trust-29, trust-45 | | seven decisions that each cite a live and the excluded paragraph and carry the excluded figure in one channel; the live line is answered and the note cited as `decision <id>, title withheld: awaiting cleanup` |
| Historical memory: past (labelled) and present | trust-30 to trust-34 | ans-50, unk-11 | the existing superseded memories, and one that rests only on the excluded paragraph; the historical read still obeys reach, approval and exclusion |
| Project and approval boundaries through full reads | trust-35 to trust-38 | ans-48, ans-49 | the existing memories out of reach, unapproved or excluded, read in full; a draft decision, eligible and labelled |
| An exclusion between the first read or a proposal's creation and its apply | trust-39, trust-40 | | a proposal created and approved before the exclusion and applied after it; a proposal asked for after the passage was read and then excluded |
| A legacy proposal without passages | trust-42 | ans-51 | one on an input with a suppression record (withheld, re-proposed) and one on an input without (applied) |
| A mixed excluded and live proposal | trust-41 | ans-52 | one item citing an excluded and a live paragraph (withheld whole) and an independent live item of the same input (applied) |
| A linked project after the upgrade | trust-43 (control: trust-44) | | `harbor-ops`, linked by 0.12.0: its managed block still says to read what `query --candidates` returns, between project-owned text |

The second excluded input is the Harbor support call: version 2 leaves out paragraph 2, a downtime penalty of 2000 EUR, a figure that appears nowhere else, so a case can forbid it in any field. The expectations follow [spec/eligibility.md](../../spec/eligibility.md) (CC-182): a withheld read shows only its id and reason (§4.3); a superseded memory comes only through the historical read, labelled `historical: true`, and a question about the present gets current memories only (§5); a note with a restricted part stays readable with no title, path, tags, ingest-written fields, body headings or comments (a decision's fixed sections excepted) and is cited by type and id (§6); a draft knowledge note is eligible and carries its lifecycle (§2); a mixed item, and a legacy proposal whose input has a suppression record, are closed on apply with `SOURCE_EXCLUDED`, while a legacy proposal whose input has none applies (§4.2, §9.3). A link label inside a note with no restricted part that restates an excluded paragraph is the uncited restatement, a stated limit (§9.6), so it is not a case.

**What waits for later tasks** (a `todo` on the case, `TODO(<task>)` in the code):
- **Proposals' passages, CC-179.** The proposals of the world carry the passages they rest on (§9.1), but `make-brain.mjs` writes them only when `PROPOSAL_PASSAGES_FIELD` names the field, which CC-179 adds to schema §11; until then the proposal schema rejects it, every proposal is written as a legacy one, and ans-52 cannot pass.
- **The upgrade's skill copies, CC-184 and CC-180.** `harbor-ops` has 0.12.0's managed block but not 0.12.0's skill copies or the `.brain` `skills` entry; they come from CC-184's synthetic old installation, and the corrected copies from CC-180's vendored snapshot.

**A run's trace and identity (0077 §5).** A result counts only for the artifacts it names. Each run records, beside the results file:

- the package: its file name and `sha256` (`npm pack`, then `shasum -a 256`), and the CLI version (`brain --version`) and commit (`git rev-parse HEAD`) it was built from;
- the skills: the vendored snapshot's tag in the skills fork, and the name, version and integrity of `.agents/skills/snapshot.json`;
- the brain: the commit of this generator and the hash of its output (`find . -type f | sort | xargs shasum -a 256 | shasum -a 256` in the output folder);
- each session: the agent and model, the caller repo, the case ids, its full trace (every command and every file read), 0074 §6's token accounting, and the check that no file of the brain was opened or searched for an answer or a proposal's evidence.

A fix after a run invalidates it: the affected cases and the final gate are rerun on the new head, and results from an earlier head are not counted (0077 §5).

## Adapters

An adapter is a module in `adapters/` whose default export is:

```js
{
  name: "…",
  level: "retrieval" | "answer",
  describe: "the command or method, as printed",
  run(testCase, env) → result   // may be async
}
// env:    { brain, callerDir, out }: the brain folder, the caller's folder under repos/, and the output folder
// result: retrieval: { candidates: [{ id, labels: ["superseded" | "inferred" | "contested"…] }], output?, cost? }
//         answer:    { answer: { text, citations: [id…], abstained? }, output?, outcome?, cost? }
// output:  everything the caller received, as text (judged against `forbidden_text`)
// outcome: see "Outcomes" above
// cost:   { phase: "opening" | "later", tokens?, bytes?, ms? }
```

The interface names no command. A 0.12.0 recall adapter maps its output onto it: a pack's memories and work items become candidates (a work row's id is `repo:<name>/build/TASKS.md#<task id>`), its token count goes into `cost.tokens` with `phase: "opening"`, and a later search is a second adapter with `phase: "later"`. CC-166 defines those commands; no adapter for them is written here.

## Baseline

The baseline below is CC-165's, on the 77 cases at the commit that added this README; on the 107 cases, `query-candidates` and `recall` now report the added cases too.

`query-candidates` runs `brain query --candidates <question> --limit 10 --types <default types plus memory> --repo <caller folder>`. Memory is added because the default types leave memories out. The query applies the restricted-evidence rule but not memory reach, approval or supersession ranking, and it does not read task rows, so it is not expected to pass. Its output at the commit that adds this README (timing varies by machine; the full output then lists each failing case and why):

```text
adapter: query-candidates (retrieval level)
runs: brain query --candidates <question> --limit 10 --types area,goal,project,person,org,meeting,decision,question,concept,reference,source,memory --repo <caller folder>
cases: 77

| gate (0074 §6) | required | result | met |
|---|---|---|---|
| critical trust | 100% | 4/20 (20%) | NO |
| answerable | at least 90% | 34/47 (72%) | NO |
| unknown (scored separately) | reported | 8/10 (80%) | — |

| kind / category | pass |
|---|---|
| trust/approval | 0/3 (0%) |
| trust/scope | 0/6 (0%) |
| trust/exclusion | 0/3 (0%) |
| trust/supersession | 2/4 (50%) |
| trust/unsupported | 2/2 (100%) |
| trust/inference | 0/2 (0%) |
| answerable/paraphrase | 26/27 (96%) |
| answerable/current | 3/5 (60%) |
| answerable/correction | 3/4 (75%) |
| answerable/contested | 2/2 (100%) |
| answerable/handover-claude-to-codex | 0/3 (0%) |
| answerable/handover-codex-to-claude | 0/3 (0%) |
| answerable/later-session | 0/3 (0%) |
| unknown/unknown | 8/10 (80%) |

cost (later retrieval): 77 calls, mean 4097 bytes and 165 ms per call; tokens not measured by this adapter (bytes are not a token count, 0074 §3)
cost (opening pack): not measured by this adapter
```

## The recall adapter (CC-172)

`adapters/recall.mjs` maps the cases onto `brain recall` as spec/memory.md §8 says. A case with a `handover` or a task row is an opening case: `brain recall --pack --repo <caller folder> --task <question>`, whose work rows and memories are the candidates. Every other case runs `brain recall --search <question> --limit 10 --include-superseded` (memories, with the superseded ones labelled for the correction cases) and then `brain query --candidates <question> --limit 10` with the default types (knowledge, no memories). Each pack's `text` is measured with gpt-tokenizer 4.1.0, o200k_base, the tokenizer eval/retrieval-0.12 uses, installed in `adapters/` only. The gate figures, every failure with its cause and fix task, and every pack's tokens are in [results-recall-0.12.txt](results-recall-0.12.txt).

```sh
npm ci --prefix eval/memory-0.12/adapters                 # the tokenizer, once
node eval/memory-0.12/make-brain.mjs /tmp/mem12
node eval/memory-0.12/score.mjs /tmp/mem12 --adapter recall
node eval/memory-0.12/adapters/recall-results.mjs /tmp/mem12   # the results file's measured part, with the pack table
```

The results file's header (the causes and fix tasks) is written by hand; replace the part below `measured` with the last command's output, and update the header when a figure changes.
