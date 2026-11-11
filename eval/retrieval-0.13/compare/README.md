# Comparing retrieval changes on the frozen cases (CC-204)

Decision [0080](../../../decisions/0080-english-retrieval-quality-in-0-13-0.md) lets four small changes to `brain query --candidates` be compared (spec/retrieval.md §4). This folder measures them, each alone and then in combinations, on CC-203's 80 cases. The product's `src/` is not changed here. CC-205 built the chosen set into `src/lib/query.ts`, spec first (`searchCandidates`; its results are in `../results-cc205.txt`). Since then `run.mjs`, which compares each variant with the product before CC-205, runs only in a checkout of the commit `results-cc204.txt` names (4f94b40), and stops elsewhere; `checkout.mjs` and the test of the variant still run at any commit.

| File | What it is |
|---|---|
| `query-variant.ts` | `src/lib/query.ts` plus the changes, each off unless `UB_RETRIEVAL_VARIANT` names it |
| `vocabulary.ts` | C2v's vocabulary map: 12 groups of general business English |
| `query-command.ts` | `src/commands/query.ts` as CC-204 measured it, before CC-205 made it call `searchCandidates`; the checkout uses it with the variant |
| `checkout.mjs` | A temporary checkout (this repo's tracked files, with the variant as `src/lib/query.ts`) in a git repository of its own |
| `run.mjs` | Runs today's search and each variant; prints the kinds, the prose-only facts, the facts the snippets show, the originals, memory-0.12 at the retrieval level and the output tokens |
| `results-dev.txt` | The development runs (dev cases only), before any held-back case ran |
| `results-cc204.txt` | The chosen set on all 80 cases (the one held-back run), the scorer's gates, the originals and the paired costs |
| `../../../tests/retrieval-compare.test.mjs` | The variant at spec/retrieval.md §2's trust seams, with a mutation-checked subject guard |

## The changes

`UB_RETRIEVAL_VARIANT` takes a comma list:

| Name | Change (spec/retrieval.md §4) |
|---|---|
| `C1` | A kept fact's name and its number or boolean value are searched; a timeline's number or boolean value as text, without its field name |
| `C2w` | An English suffix rule (`budgets`, `launching`, `copies`…) applied alike to the notes' words and the question's |
| `C2v` | The vocabulary map: a question word in a group also searches the group's other words, as one BM25 term (its frequency is the sum, its df the documents with any) |
| `C2` | `C2w` and `C2v` |
| `C3` | The subject the question names (every word of an eligible project, area, org or person title or alias; the most specific wins), else the caller's `.brain` project. Its notes (itself, the notes linking it, an org's or area's projects' notes, and their sources, all in the searched set) rank on the question's other terms twice |
| `C3d` | A note with no matching term is not returned on its context boost alone |
| `C3a` | With no subject resolved and two or more projects named in part (or in the caller's area), the best attribute-matching note of each of up to five stays in the first ten |
| `C4` | Snippets: a kept fact that matches (`facts.budget: 65000 EUR`), then the body lines matching the most query terms, three in all, each the 200-character window around its first match |
| `C0` | The variant path with every change off. `run.mjs` stops unless its output is the product's, byte for byte, on all 130 questions |

The variant takes its notes only from the `eligible` projection the command passes, as the product does (spec/retrieval.md §2). Recall's memory-only ranking always takes the unchanged path. Within one search it builds one BM25 index, stems each distinct word once, and writes snippets for the first 50 candidates, the most `--limit` returns. Nothing is cached across searches.

## Run it

```sh
S=$(mktemp -d); M=$(mktemp -d)
node eval/retrieval-0.13/make-brain.mjs $S && node eval/memory-0.12/make-brain.mjs $M
npm ci --prefix eval/retrieval-0.12 --ignore-scripts                     # the pinned, measurement-only tokenizer
node eval/retrieval-0.13/compare/run.mjs $S $M --variants "C1;C2w;C3"    # dev cases (the default)
node eval/retrieval-0.13/compare/run.mjs $S $M --split all --variants "C2,C3,C4"   # the held-back run, once
CK=$(node eval/retrieval-0.13/compare/checkout.mjs)
UB_RETRIEVAL_VARIANT=C2,C3,C4 node $CK/eval/retrieval-0.13/score.mjs $S --rows
UB_RETRIEVAL_VARIANT=C2,C3,C4 node eval/retrieval-0.13/costs.mjs $S --baseline . --candidate $CK --reps 5
```

The candidate `results-cc204.txt` measured is rebuilt from the commit its provenance names (4f94b40) with `checkout.mjs`; its checkout commit id differs on every build, so the two sha256 it records identify it.

Before any run, `run.mjs` checks the vocabulary map's bounds: at most 40 groups of at most 6 words, and every word found in a `dev` case's question or evidence, or in `eval/search-0.5`'s questions or answer notes.
