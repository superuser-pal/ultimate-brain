# 0080 — English retrieval quality in 0.13.0: the first search finds the fact, and an unclear subject is asked about

**Status:** Accepted
**Date:** 2026-11-11
**Release:** 0.13.0
**Amends:** [0077](0077-trust-repair-in-0-13-0.md) (Out of scope only: "ranking or retrieval-quality changes not needed for eligibility" no longer excludes the English retrieval work below; every other exclusion and every 0077 rule stays)
**Refines:** [0074](0074-scoped-memory-handovers-and-bounded-recall.md) §5 and §6 (which retrieval changes may be adopted, and how they are measured)
**Keeps:** 0077's eligibility rule, release order and gates; [0078](0078-onboarding-and-early-access-in-0-14-0.md)'s order (onboarding and early access 0.14.0, the weekly review 0.15.0, the feature cutoff 0.15.0); 0074's 800-token opening recall, compact search and no automatic full-note expansion; [0016](0016-typescript-on-node.md)'s minimal dependencies; Markdown + Git canonical, no required vector database

## Context

The 0.12.0 search baseline (`eval/search-0.5`, rerun on `main` at 9cf6d26 on 2026-11-11 with every rank equal to `results-cc173.txt`) finds the answering note in its first ten results for 36 of 50 questions (28 first, MRR 0.61), but for **0 of 10 facts written in a note's body** and **6 of 10 paraphrases**. The causes were measured on that brain, not guessed:
- every answering note is searched and in the right project, but the question's words are not the source's words (no note says "budget"; the minutes say "money for the rest of the year"), so notes whose titles name the subject rank above the meeting that answers;
- a fact's name and a numeric or boolean value are not searched (`facts: {budget: 5000}` adds neither word), and a project link adds an opaque id, not the project's name;
- matching is by word start only: "budgets" does not find "budget";
- a snippet is the first three matching lines, each cut at 200 characters, so a match late in a long line is cut off, and a fact held only in frontmatter has no snippet;
- the context boost ranks a project's notes higher but does not tell which project a question means, and can return a note with no matching word.

The benchmark has its own limits: its 600 minutes sources are empty, it credits one note when equivalent meetings also support the answer, some "current budget" questions ask about a dated allocation, and it has no unknown, ambiguous or long-document question. A diagnostic substitution of the answer's own words put 20 target notes at rank 1 or 2: that proves the cause, not an improvement, and is not used as one.

On 2026-11-11 the user ran a focused grill on retrieval quality, chose each option below and accepted the final plan. 0077 had excluded ranking work from 0.13.0; under 0061 a scope change needs an explicit decision, and this is it.

## Decision

### 1. English only

This round improves retrieval for English questions over English notes. It adds no multilingual capability. The supported accent folding and CJK n-grams keep working and are regression-tested; known losses in other scripts (Cyrillic, Arabic) are out of scope.

### 2. The first search must be sufficient

A retrieval case passes only when the **first** `brain query --candidates` call, with the question as asked, the caller's context and the default limit, returns supporting evidence in its **first ten results**. A follow-up search does not rescue a failed case, and neither a higher limit nor a retry is used to claim a pass. Retries the skills already do may stay in operation; they are not how this round succeeds.

### 3. Gates

- **Body and structured facts:** at least 90% (18 of 20) in the first ten. **Paraphrases:** at least 90% (18 of 20), judged separately.
- **Nothing that passes today fails:** every original question found in the first ten stays there, and the original set's first-rank count and MRR do not fall.
- **Critical trust: 100%,** at the retrieval level and in the final answers.
- **Final answers:** at least 90% of answerable cases get a correct, sufficiently complete, cited answer. Candidates and final answers are scored separately.

### 4. An unclear subject is asked about

When the question and the caller's authorised context don't identify one subject (two projects with a budget, and nothing says which), the answer is a **short clarifying question**. It never silently answers for the first-ranked subject, and it does not list every subject's value as the default. Subject resolution never widens what a caller may reach (0009, 0077).

### 5. Eighty new audited cases; the original 50 unchanged

Twenty each of: facts in a body or a structured field, English paraphrases, questions whose subject the context leaves unresolved, and questions the brain genuinely cannot answer. They include time-qualified facts, similar project names, numeric typed fields and matches late in long lines. Every case's source evidence is complete synthetic text; any independently sufficient set of evidence counts; part of the wording is held back while improvements are chosen. The original 50 stay byte for byte the same for comparison. No case is weakened or dropped to reach a target.

### 6. Latency: at most 25% more

The median **and** the 95th percentile of search latency stay at or below **1.25 times** a matched baseline: the completed trust-safe code, measured on the same machine under the same conditions, after the eligibility changes are merged. Earlier timings on other hardware or load are not comparable.

### 7. Output size: at most 25% more

The median **and** the 95th percentile of the search output's **tokens** stay at or below 1.25 times the matched baseline: ten candidates, bounded snippets. The cost of a full filtered read is reported separately. The 800-token opening recall budget does not change.

### 8. In 0.13.0

The work ships in **0.13.0**, not 0.13.1. Onboarding and early access stay 0.14.0, the weekly review 0.15.0, and the feature cutoff 0.15.0 (0078). No other architecture or roadmap change.

### 9. The plan (accepted)

1. Record this decision and the contracts: what may change, how the cases are built, how candidates and answers are scored, and the cost budgets.
2. Build, audit and freeze the 80 cases and measure the baseline.
3. Compare small deterministic changes one at a time, then in combination. The candidates, none chosen in advance:
   - search a note's eligible fact names and typed numeric values, keeping current and historical facts apart;
   - English word forms and a small, transparent, general vocabulary map, checked against the held-back wording (no map of query ids, project names or gold answers, and no large semantic subsystem);
   - relevance that matches both the attribute asked for and the resolved subject, from eligible names and relations only, with an unresolved subject surfaced;
   - snippets centred on the match, within the bounded output, showing the useful facts; no automatic full-note expansion.
   An addition with no measured benefit is rejected. No embeddings, vector store, new runtime, model-generated expansion, persisted index, production dependency or external model call.
4. Build only the changes that qualify, with tests.
5. Extend 0.13.0's final packaged and native acceptance (0077 §5), reusing its harness: **one complete native run in each agent** on the final combined package, not three, with traces and the package and snapshot identities kept. A result invalidated by a later code change is rerun as it applies.

If the gates cannot be met within this scope and these budgets, the findings and the options go to the user; the scope does not grow, and the gates and cases do not weaken.

### Trust invariants

The one eligibility rule ([spec/eligibility.md](../spec/eligibility.md)) is applied **before** terms, document frequencies, ranking and snippets are computed, never only to the final page. Typed fields, relation names, vocabulary expansion, snippets and any helper see only what that rule leaves: exclusions, approvals, reach and supersession hold; metadata stays protected; superseded memories appear only in the explicit historical read; unknown answers stay honest. There is no raw Markdown fallback in answering or proposals. Source and proposal lineage and exact acceptance stay as 0077 set them. Filesystem access and Git history are unchanged.

### Out of scope

Languages other than English; embeddings, a vector store, a persisted index or any new service; model calls during search; raising the result limit or adding retries as the success mechanism; new skill behaviour assumed for the gates; any change to 0077's eligibility rule, the release order or the cutoff; any operation on the user's brain.

## Consequences

- [spec/retrieval.md](../spec/retrieval.md) holds the contract: the trust envelope every candidate keeps, the ambiguity rule, the case format, the two scoring levels, the gates and the cost method. cli.md §5.13 changes only when the chosen changes are built, spec first in the same PR.
- [build/TASKS.md](../build/TASKS.md)'s 0.13.0 section gains CC-202 (this record), CC-203 (the cases, scorer and baseline), CC-204 (the comparison), CC-205 (the chosen changes in the CLI) and CC-206 (the cases in the native harness); CC-186's final acceptance adds the retrieval gates.
- 0077 and 0074 get header pointers; [spec/eligibility.md](../spec/eligibility.md) §14 points here. Their bodies stay as recorded.
- If the final answers need skill wording (asking for the subject), it goes through the skills fork in 0.13.0's one fork release with the user's yes; this decision does not assume it.
- This is a planning record: no CLI, schema or skill change starts with it.

## Evidence

- The user's grill and acceptance, 2026-11-11: English only; the first search, first ten; 90% per group with 20 cases each, nothing passing today failing, critical trust 100%, answers 90%; a clarifying question for an unresolved subject; eighty new cases, the 50 unchanged; latency and output tokens each at most 25% more at the median and 95th percentile; 0.13.0; the plan above.
- The rerun of `eval/search-0.5` on `main` at 9cf6d26 (ranks identical to `results-cc173.txt`) and the read-only diagnosis of its misses (kept outside the repo).
- [0074](0074-scoped-memory-handovers-and-bounded-recall.md) §5 and §6, [0077](0077-trust-repair-in-0-13-0.md), [0078](0078-onboarding-and-early-access-in-0-14-0.md), [eval/retrieval-0.12/RESULTS.md](../eval/retrieval-0.12/RESULTS.md).
