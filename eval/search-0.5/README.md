# Search evaluation (0.5, CC-50; baseline for 0.12.0, CC-164)

50 known questions on a synthetic brain of 1,982 notes, run against `brain query --candidates` and a local BM25 index, and once against GBrain. The method and the 0.5 results are in [review 07](../../reviews/07-hermes-and-search.md) §3. Since 0.12.0 it is the retrieval baseline that any retrieval change is compared with first (decision [0074](../../decisions/0074-agent-memory-and-handover.md) §6).

| File | What it is |
|---|---|
| `make-brain.mjs` | Writes the brain, seeded, and rewrites `questions.json` the same each time |
| `questions.json` | The 50 questions, 10 of each kind, and the note that answers each |
| `bm25.mjs` | The BM25 index the runner compares with, no dependency |
| `run.mjs` | Runs the questions and prints recall@1/5/10, MRR and timing per question kind |
| `results-baseline-0.12.txt` | The 0.12.0 baseline: `brain` and `bm25`, with the commit and command that produced it |
| `results-gbrain-*.txt` | The 0.5 runs with GBrain (review 07); GBrain is optional and not part of the baseline |

## The brain in today's format (CC-164)

`make-brain.mjs` runs this checkout's `brain init`, writes the notes, then runs `brain index`, so the brain has a valid `brain.json` and lints with no errors. To pass today's lint, without changing the 0.5 notes' text or the questions, it adds:
- a minutes source for each meeting (`sources/notion/`), named by the meeting's `source` and `sources`. The source has a neutral title (`Minutes <date> (Notion)`) and an empty body, so it matches none of the questions' words;
- on each decision, `decided_in` (its meeting) and `sources` (that meeting's source);
- on each person, a timeline entry for `facts.role`, learned at a meeting;
- `kind: question` on questions, and `origin: part` with a source on references;
- the 300 concepts as learned Documents (`type: reference`, `origin: learned`, in `knowledge/references/`, keeping their `con-` ids), as `brain upgrade` converts them since 0.9.1 (0071).

These additions draw from a second seeded stream, so the notes' text and `questions.json` are byte for byte the ones review 07 used. Lint still warns (no sources on people, orgs, learned Documents and questions; orphans; freshness); no retriever reads those fields.

## Rerun the baseline

From the repo root, at a clean checkout with `npm ci` done:

```sh
S=$(mktemp -d)
node eval/search-0.5/make-brain.mjs $S/big eval/search-0.5/questions.json   # {"notes":1982,"sources":600,"questions":50}
git diff --exit-code eval/search-0.5/questions.json                          # no output: the questions are unchanged
BRAIN_DIR=$S/big node src/cli.ts lint                                        # 0 errors
RUN_ROWS=1 node eval/search-0.5/run.mjs $S/big eval/search-0.5/questions.json > $S/results.txt
diff <(sed '/^## Timing/,/^## Rows/d;1d' eval/search-0.5/results-baseline-0.12.txt) <(sed '/^## Timing/,/^## Rows/d;1d' $S/results.txt)
```

The last command prints nothing when the numbers and every question's rank are the same; it leaves out the first line (the commit) and the timing table, which vary. The run takes about a minute: `brain` starts Node for every question. `results-baseline-0.12.txt` is the output of the fourth command at the commit on its first line.

GBrain stays optional: `run.mjs <brain-dir> <questions.json> gbrain` with `GBRAIN_HOME` set, as review 07 §5 describes.
