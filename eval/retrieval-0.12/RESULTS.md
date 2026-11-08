# Results: claude-obsidian's retrieval pieces against the 0.12.0 baseline (CC-167)

Decision [0074](../../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) §5 lets the brain adopt small TypeScript adaptations of claude-obsidian's BM25 and tokenisation, chunking, synthetic prefix, compact snippets and content freshness, but only where they improve representative cases. The adaptations must keep IDs, nested metadata, multilingual behaviour and source attribution, and add no Python, vector database, new runtime dependency, schema change or broad port. §6 says a change is compared with the existing query baseline before it is chosen. This file is that comparison.

- **Questions and brain:** eval/search-0.5's 50 questions and its generated brain of 1,982 notes and 600 sources, as CC-164 runs them. The baseline reproduces here row for row: `brain query --candidates` gets 21/25/30 of 50 at top 1/5/10 (MRR 0.46), and eval/search-0.5's BM25 gets 27/31/36 (MRR 0.59).
- **Every number below** is from [`results-0.12.txt`](results-0.12.txt), produced at commit `c052997` by the commands in the [README](README.md). The run is deterministic.
- **Tokenizer:** `gpt-tokenizer` **4.1.0**, encoding **o200k_base**, pinned in this folder's `package.json` and used for measurement only. It is the encoding of the OpenAI models Codex runs. Anthropic publishes no offline tokenizer for current Claude models, so these counts are evidence for o200k_base only. Beside each count is the CLI's estimate, ⌈UTF-8 bytes ÷ 3⌉ (spec/memory.md §5.2).
- **Upstream:** claude-obsidian at `2e545563172f97f02ecaaaab376ceea1246a0583`, files `scripts/bm25-index.py`, `scripts/contextual-prefix.py` and `scripts/retrieve.py`, under the **MIT License**, Copyright (c) 2026 AgriciDaniel. Each adaptation was written in TypeScript from reading those files. Each module's header names the file and the functions it adapts. None of the upstream code was run or copied into the repo.
- **CC-165:** its evaluation set (`eval/memory-0.12/`) was not merged on `main` when this ran, so its answerable cases are not scored here. CC-173's acceptance scores them.

## Summary

The only piece worth porting is BM25 scoring. Port it with the CLI's own tokens, prefix match and field weights; upstream's other choices don't help this brain.

| Piece | Best result on the 50 (baseline 21/25/30, MRR 0.46) | Lines | Recommendation |
|---|---|---|---|
| BM25 | 28/32/36, MRR 0.61, with the CLI's tokens, prefix match and field weights | 45 | **Adapt** |
| Tokenisation | upstream's words don't help (21/29/31 against 20/29/32 with the CLI's words); they lose accents, hyphens and prefixes | 46 (+9 for the CJK part) | **Adapt** only its CJK n-grams; drop the rest |
| Chunking | 1/13/14 alone; no note here is longer than one chunk | 36 | **Drop** |
| Synthetic prefix | 12/22/28 (upstream), 21/29/32 (from the note's metadata) | 16 | **Drop** |
| Compact snippets | same ranks; the baseline's page costs 25% more tokens (1,366 against 1,092) | 14 | **Drop** |
| Content freshness | 0 stale results today, because the CLI keeps no index | 14 | **Drop** for 0.12.0; adopt only with a persisted index |

"Lines" counts the module's lines that are neither blank nor comments. Porting a piece into `src/` would also add its tests.

## The pieces

Recall is given as top 1/5/10 of 50, then MRR. Page tokens are the mean over the 50 questions for a top-10 page. Variant names are the retriever names in `results-0.12.txt`.

### BM25 (`bm25.ts`, from `bm25-index.py`): adapt

| Retriever | Recall | MRR | Recall@10 by kind: decision / paraphrase / why / fact / person | Page tokens |
|---|---|---|---|---|
| brain (baseline) | 21/25/30 | 0.46 | 10 / 6 / 10 / 0 / 4 | 1,092 (its JSON) |
| bm25-0.5 (CC-164) | 27/31/36 | 0.59 | 10 / 6 / 10 / 0 / 10 | 882 |
| co-bm25: upstream, whole notes | 21/29/31 | 0.49 | 10 / 1 / 10 / 0 / 10 | 744 |
| co-bm25F: title ×3, summary ×2 | 27/30/34 | 0.58 | 10 / 4 / 10 / 0 / 10 | 893 |
| **co-bm25F, brain tokens + prefix** | **28/32/36** | **0.61** | 10 / 6 / 10 / 0 / 10 | 886 |

- **Gains:** +7 at top 1 and +6 at top 10. Every gain is in person-role, where recall@10 goes from 4/10 to 10/10 and MRR from 0.08 to 1.00. The CLI's fixed points (cli.md §5.13 step 3) give the role word in a person's `facts` 2 points, while each word of the project's name earns 5 in the title of every decision of that project. BM25's IDF weighs the rarer word higher.
- **Losses:** top 1 for decision-by-topic falls from 9/10 to 7/10 (MRR 0.95 to 0.85), and paraphrase MRR from 0.26 to 0.18. Recall@10 drops for no kind.
- **The variant:** it keeps the CLI's tokens (§5.13 step 1) and its prefix match (`deci` matches `decision`), with eval/search-0.5's field weights; the prefix match is the 6 lines added to upstream's formula. Without these, upstream's BM25 is worse than the CLI at top 1 (co-bm25).
- **0074 §5's conditions:** IDs are unchanged, because whole notes are indexed. Nested metadata is kept: facts and timeline values are indexed as frontmatter strings. Multilingual behaviour is kept, since the CLI's tokens stay. Source attribution is kept: the same eligible notes are indexed, with the restricted-evidence rule applied first (`corpus.ts`). There is no dependency or schema change, and nothing is persisted.
- **CC-173 needs a cli.md §5.13 change from the main session first.** Three points are open: `score` becomes a decimal (today it is an integer); step 4's project and area boost, which this set doesn't exercise, must survive; and the tie order stays `updated`, then id. Files: `src/lib/query.ts` (`rankCandidates`) and its tests; `brain recall --search` ranks the same way (memory.md §6.1).

### Tokenisation (`tokenize.ts`, from `bm25-index.py`): adapt the CJK n-grams only

On the 50 English questions the tokeniser makes no difference: co-bm25 gets 21/29/31 (MRR 0.49) with upstream's words and 20/29/32 (MRR 0.48) with the CLI's. The probe in `results-0.12.txt` shows where the two differ:

| Query → text | CLI's words | Upstream's words | CLI's words + CJK n-grams |
|---|---|---|---|
| Felix → Félix | yes | no | yes |
| decision → Decisión | yes | no | yes |
| 予算 → 東京オフィスの予算を決めた | no | yes | yes |
| sign in → Sign-in | yes | no | yes |
| deci → decision | yes | no | yes |

Upstream's words would break the CLI's accent folding, its hyphen splitting and its prefix match, which Spanish and Catalan notes rely on. That would weaken 0074 §5's "preserve multilingual behaviour", so drop them. The CLI drops CJK text entirely today, and upstream's 1-, 2- and 3-character n-grams fix that. `brainWithCjk` (9 lines) keeps the CLI's words for everything else and never strips marks inside a CJK run. Adapt it only after an evaluation set has CJK cases, because this one has none. Like BM25, it is a change to §5.13 step 1, and reflection's terms (§5.32) share those words.

### Chunking (`chunk.ts`, from `contextual-prefix.py`): drop

Upstream indexes only body chunks, so a note's title, summary and facts never reach the index. Alone, chunking gets 1/13/14 (MRR 0.09). Brain notes are atomic: the longest body in this brain is 319 characters, and no note has more than one chunk, so chunking can't help any case here. It would also add a second id space (`<note id>:<n>`). Reconsider it only if a set with long sources shows misses inside long bodies.

### Synthetic prefix (`prefix.ts`, from `contextual-prefix.py`): drop

Upstream's prefix, the title and the body's first sentence, gets 12/22/28 (MRR 0.33), below the baseline. The adapted prefix from the note's metadata gets 21/29/32 (MRR 0.50). It only gives back what chunking removed, and whole-note BM25F does better without it. A prefix is indexed but never shown, so it costs no page tokens. The model-written prefixes (Anthropic API, Ollama) were left out: they need a model call or a local model server, which this product doesn't add to retrieval.

### Compact snippets (`snippet.ts`, from `retrieve.py`): drop

The snippet changes no ranking: the baseline order stays 21/25/30 (MRR 0.46) by construction.

| Page for the baseline's top 10 | Tokens, mean (max) | Estimate, mean |
|---|---|---|
| The CLI's JSON (up to 3 matching lines per note) | 1,092 (1,246) | 1,340 |
| The CLI's JSON, one upstream snippet per note | 1,366 (1,559) | 1,742 |
| A compact text page, one upstream snippet per note | 1,007 (1,202) | 1,299 |

Upstream's rule shows a chunk's first 200 characters. That makes the page 25% dearer, because the CLI's matching lines are usually shorter and more on point. The compact text page is 8% cheaper, but the saving comes from its format, which no upstream piece defines, not from the snippet rule. It keeps the type, lifecycle, assessment, origin, date and path that the brain-query skill needs. Whether `query --candidates` should print a text page is a separate contract question (memory.md §6.1 already asks for compact results). Keeping one result per note matters only with chunks, which are dropped.

### Content freshness (`freshness.ts`, from `retrieve.py`): drop for 0.12.0

The check: after the index was built, the 10 "why" answers' files were changed.

| Retriever | Answer in top 10 | Results showing a changed file's old text |
|---|---|---|
| brain (reads the files on every call) | 10/10 | 0 |
| co-chunks + meta prefix (an index built before the change) | 10/10 | 10 |
| … + freshness | 0/10 | 0 |

The CLI keeps no cache (memory.md §7), so it can't serve stale text. Freshness protects only a persisted index, and dropping stale hits also drops the answers until a rebuild. Adopt it, all 14 lines, only together with a persisted index, which memory.md §7 already requires to be rebuildable. On a stale hit that index should rebuild the note, not drop it.

## The CLI's estimate against the measured count

Over the 550 pages (11 retrievers × 50 questions), ⌈bytes ÷ 3⌉ never counted fewer tokens than o200k_base. Its smallest margin was 8%, on co-chunks, and 17% on the CLI's own JSON. The margin depends on the text:

| Text | Measured | Estimate | Estimate ÷ measured |
|---|---|---|---|
| English prose | 20 | 31 | 1.55 |
| Spanish prose | 22 | 32 | 1.45 |
| Japanese prose | 26 | 33 | 1.27 |
| Ids and JSON | 39 | 33 | **0.85** |

So the estimate is safe for prose with this tokenizer, but **it undercounts text dense with ids and paths by 15%**. A pack's `text` (memory.md §5.3) is mostly prose, but its framing line carries ids, and a denser tokenizer could erase an 8% margin. CC-172 measures every pack. If one goes over its budget, the divisor goes down (memory.md §5.2), not the budget up.

## What no piece fixes

Paraphrases (6/10 at best) and facts stated only in a body in other words (0/10 for every retriever: the questions say "budget", the meeting says "money") are vocabulary gaps. No lexical piece here closes them. Embeddings would, but they need a model or a vector store, which 0074 §5 rules out for this work.
