# English retrieval evaluation for 0.13.0 (CC-203)

Eighty audited cases for decision [0080](../../decisions/0080-english-retrieval-quality-in-0-13-0.md), built to the contract in [spec/retrieval.md](../../spec/retrieval.md) §5 to §7. They measure whether the **first** `brain query --candidates` finds supporting evidence in its first ten results, and, separately, whether a final answer is correct and cited, asks when the subject is unclear, and says so when the brain doesn't know. Every name, company and figure is made up.

| File | What it is |
|---|---|
| `world.mjs` | The retrieval layer: 3 areas, 6 client orgs, 12 projects with similar names (Harlow web shop and Harlow website, Kestrel booking app and booking site…), their people, meetings with full minutes, decisions and typed facts |
| `cases.mjs` | The 80 cases, written against the world's keys, with a hand-written correct answer each (`ref`) |
| `make-brain.mjs` | Builds the original brain of `eval/search-0.5` unchanged, a copy with the layer added, and the caller folders; writes `cases.json` and `reference-answers.json` |
| `cases.json`, `reference-answers.json` | Generated; never edit by hand |
| `lib.mjs` | The scoring rules and the audit, as pure functions (`tests/retrieval-eval.test.mjs`) |
| `score.mjs` | Audits the set, runs one adapter on the cases and prints the gates |
| `adapters/query-candidates.mjs` | The first search: one `brain query --candidates "<question>" --repo <caller> --json`, default limit and types |
| `adapters/reference-answers.mjs` | The hand-written answers: a check that every answer rule can be met, not acceptance |
| `originals.mjs` | The 50 questions of `eval/search-0.5` on the original brain, compared with `results-cc173.txt` |
| `costs.mjs` | Paired latency and output tokens, baseline against candidate (§7) |
| `results-provisional.txt` | The provisional baseline at this task's head (below) |

## Run it

From the repo root, after `npm ci` (and `npm ci --prefix eval/retrieval-0.12 --ignore-scripts` for the tokenizer of `costs.mjs`):

```sh
S=$(mktemp -d)
node eval/retrieval-0.13/make-brain.mjs $S                          # writes $S/original, $S/brain, $S/repos and cases.json
git diff --exit-code eval/retrieval-0.13/cases.json eval/retrieval-0.13/reference-answers.json   # no output: unchanged
BRAIN_DIR=$S/brain node src/cli.ts lint                              # 0 errors
node eval/retrieval-0.13/score.mjs $S --rows                         # the first search (default adapter)
node eval/retrieval-0.13/score.mjs $S --adapter reference-answers    # the answer rules can be met
node eval/retrieval-0.13/originals.mjs $S                            # the 50 originals against results-cc173.txt
node eval/retrieval-0.13/costs.mjs $S --baseline <baseline checkout> --candidate <candidate checkout>
```

`score.mjs` options: `--split dev` (only the development cases, as CC-204 chooses on), `--rows`, `--json`, `--strict` (exit 1 when a gate fails). `originals.mjs --cli <checkout>/src/cli.ts` runs another checkout. `make-brain.mjs` fails if `eval/search-0.5` would write different questions, or if a layer note would replace an original one. Two runs give identical bytes except the brain's activity log under `log/`, which `brain init` and `brain index` write with the clock.

## The brain

- **Original brain** (`<out>/original`): exactly what `eval/search-0.5/make-brain.mjs` writes, 1,982 notes and 600 sources. The 50 originals run here, and only here, so their numbers stay comparable with `results-cc173.txt`.
- **With the layer** (`<out>/brain`): the original brain plus the layer, so the cases compete with the original 2,000 notes. The audit checks that no original note changed.
- **The layer's density.** Each original project has about 25 notes that name it (8 decisions, 10 meetings, references, open questions), and that is what pushes a meeting that answers out of the first ten. Each layer project gets the same shape: besides the notes the cases rest on, 5 decisions, 8 meetings with their minutes, 4 references and 2 open questions from a seeded stream, written from neutral topics (translations, search, email delivery…) and filler that hold none of the cases' facts. Without them every subject has 4 to 6 notes, all of which fit in the first ten: on that sparse layer today's search found 20 of 20 facts and 19 of 20 paraphrases, which measures nothing a real brain shows.
- **Minutes are complete.** Each layer meeting has a minutes source whose body is the full minutes, one paragraph per line, so either the meeting or its minutes is sufficient evidence. Three minutes have a line of more than 300 characters with the fact at its end.
- **Typed facts.** Projects carry `facts` and a `timeline` (schema §5), with numeric values (`team_size: 5`, `stores: 4`, `depots_at_launch: 7`, `support_hours_per_month: 20`) and two superseded values (a launch date moved from March to April, a budget raised in March 2026).
- **No exclusions.** The layer has no suppression record; evidence text is read through `brain query --read` from each case's caller, and the audit fails if a record appears. Eligibility is measured by the trust cases of `eval/memory-0.12`, not here.
- **Callers** (`<out>/repos`): `scratch` (no `.brain`), `retail-area` and `public-area` (a `.brain` naming only an area), `bw-portal` and `timetracker` (a `.brain` naming a project).

## The cases

| Kind | What it asks | dev | held |
|---|---|---|---|
| `fact` | a value in a note's body or in a typed field; includes numeric fields, values late in long lines, time-qualified values ("for the rest of 2026", "before it was raised in March 2026") and a subject given only by the caller's `.brain` | 14 | 6 |
| `paraphrase` | the source's content in other English words ("money" for "budget", "go live" for "launch", "text message" for "SMS", "approves invoices" for "signs off every bill") | 14 | 6 |
| `clarify` | an attribute two or more subjects hold, asked from a folder that doesn't resolve which (no `.brain`, or an area holding several) | 14 | 6 |
| `unknown` | something the brain does not hold, often a near miss (the other project of the same client has it) | 14 | 6 |

Fields: those of `eval/memory-0.12` (`caller`, `facts`, `forbidden_facts`, `forbidden_evidence`), plus `kind`, `split`, `evidence_sets` (any one independently sufficient set counts), `as_of`, `subjects` (`{ id, name, value, evidence, stated? }`), `absent` (`{ about, none }`) and `audit` (one line on why the question is clear and what answers it). Facts and values are case-insensitive regular expressions; a failure can be a wording miss, so read the reason before blaming the system, and fix a case only with a reason in its PR.

**Held-back wording** (spec/retrieval.md §5.4): in each kind, 6 cases are `held`. CC-204 chooses changes with `--split dev` only; its vocabulary map is committed before it runs the held cases, and the gates count all 20.

**The audit** (`audit` in `lib.mjs`) runs before every scoring run and stops it on any problem: 20 cases and 6 held per kind; unique ids, known callers, an audit line; no question holds its own answer; each evidence set is eligible for the caller and holds every fact; each clarify case has two or more subjects, a caller that doesn't resolve them, a question that doesn't name one by title, and evidence that holds each subject's value; no note about an unknown case's subject holds what the case says is absent; no suppression record; no original note changed; `eval/search-0.5/questions.json` unchanged.

## Scoring

| Kind | Retrieval level (the first search, first ten) | Answer level |
|---|---|---|
| `fact`, `paraphrase` | every id of one evidence set is in the first ten | every fact (and `as_of`) is present, every id of one set is cited, it does not abstain |
| `clarify` | evidence of two subjects is in the first ten (reported) | it asks a question, names two subjects, states no subject's value, does not abstain |
| `unknown` | nothing forbidden returned (reported) | it abstains (`ABSTAIN`, the same pattern as `eval/memory-0.12/score.mjs`; CC-206 aligns both with CC-201's rule once that is merged) |

Gates (spec/retrieval.md §6.2): facts 18 of 20 and paraphrases 18 of 20 at the retrieval level; at the answer level 36 of the 40 answerable, 20 of 20 clarify and 20 of 20 unknown. The answer gates are met by CC-186's native runs, not by the reference answers. A retrieval number is never evidence of answer or native quality.

## Costs

`costs.mjs` measures both sides on the same machine in one session, paired and interleaved (spec/retrieval.md §7): one discarded warm-up pass, then 5 passes in which the baseline and the candidate alternate, their order swapped every pass and question. For each of the 130 questions (80 cases, 50 originals) it takes the median of the passes; the gate compares the median and the 95th percentile (nearest rank) over the questions, candidate over baseline, at most 1.25, for:
- **search latency:** one cold `node <checkout>/src/cli.ts query --candidates … --json` process;
- **in-process ranking:** each side's `rankCandidates` over the notes it has already scanned (file reading not counted; it imports each checkout's `src/lib`, so a change to those functions' signatures needs `rankerFor` updated);
- **output tokens:** the `--json` stdout, counted with `gpt-tokenizer` 4.1.0, `o200k_base`, the measurement-only package pinned in `eval/retrieval-0.12/package.json` (never a product dependency); bytes are printed beside them and are not a token count.

The cost of reading the answer in full (`query --read` of each answerable case's first evidence set) is reported, not gated. It prints the CPU, memory, OS, Node version, both commits and the load average before and after; a run under heavy load is repeated, not discounted.

## Provisional baseline (this task's head, before the trust-safe search is merged)

`results-provisional.txt` is labelled provisional: it was measured on `main`'s search code (CC-176's eligible-read changes not yet merged), so it is not the matched baseline of spec/retrieval.md §7. CC-204 and CC-205 measure against `main` once the trust-safe search is merged there. In brief, at the first search:

| | first ten |
|---|---|
| facts | 19 of 20 (gate met) |
| paraphrases | 15 of 20 (gate not met) |
| clarify, two subjects visible | 14 of 20 (reported) |
| originals | 28/32/36 of 50, MRR 0.61, as `results-cc173.txt` |

Its cost section is the baseline paired with itself, which shows the tool's noise on this machine, not a comparison.
