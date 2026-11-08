# Retrieval pieces from claude-obsidian, against the 0.12.0 baseline (CC-167)

Decision [0074](../../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) §5 prefers small TypeScript adaptations of claude-obsidian's deterministic retrieval pieces, on condition that a bounded comparison with the existing query baseline shows they help (§6). This folder is that comparison. The findings and a recommendation per piece are in [RESULTS.md](RESULTS.md).

Each piece was written here in TypeScript from reading claude-obsidian at commit `2e545563172f97f02ecaaaab376ceea1246a0583` (MIT License). None of its code is run or copied into the repo, and nothing in `sources/` is used.

| File | What it is |
|---|---|
| `retriever.ts` | The one interface: a query in, ranked note ids and the result page's text out |
| `corpus.ts` | The brain's own parsed notes (`src/lib` readers, by import), filtered as `brain query --candidates` filters them |
| `tokenize.ts` | Piece: upstream's BM25 tokenisation; and `brainWithCjk`, the CLI's words plus upstream's CJK n-grams |
| `bm25.ts` | Piece: Okapi BM25 (k1 1.5, b 0.75), with an optional prefix match |
| `chunk.ts` | Piece: paragraph-aware chunking |
| `prefix.ts` | Piece: the synthetic contextual prefix, and a variant made from the note's metadata |
| `snippet.ts` | Piece: compact snippets, one result per note |
| `freshness.ts` | Piece: content freshness, a hit from a changed file is dropped |
| `retrievers.ts` | The retrievers compared: the baseline, eval/search-0.5's BM25, and the pieces alone and combined |
| `run.ts` | Scores them on eval/search-0.5's 50 questions and prints `results-0.12.txt` |
| `package.json` | The measurement-only tokenizer, `gpt-tokenizer` 4.1.0; not a product dependency |

## Rerun

From the repo root, at a clean checkout:

```sh
npm ci
npm ci --prefix eval/retrieval-0.12 --ignore-scripts                     # the tokenizer, nothing else
npx tsc -p eval/retrieval-0.12                                           # no output: the adaptations typecheck
S=$(mktemp -d)
node eval/search-0.5/make-brain.mjs $S/big eval/search-0.5/questions.json  # {"notes":1982,"sources":600,"questions":50}
git diff --exit-code eval/search-0.5/questions.json                        # no output: CC-164's questions, unchanged
RUN_ROWS=1 node --experimental-strip-types eval/retrieval-0.12/run.ts $S/big eval/search-0.5/questions.json > $S/results.txt
diff <(sed 1d eval/retrieval-0.12/results-0.12.txt) <(sed 1d $S/results.txt)
```

The last command prints nothing when every number and every question's rank match. It leaves out only the first line, the commit. The run takes about a minute, because the baseline starts `brain` once per question. It prints no timing, so the whole output is deterministic. The baseline rows match eval/search-0.5's `results-baseline-0.12.txt` (21/25/30 of 50 at top 1/5/10, MRR 0.46).
