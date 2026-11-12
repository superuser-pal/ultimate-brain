# Retrieval quality for English questions (contract, decision 0080)

**Status:** contract for release 0.13.0, written by Claude Code in CC-202. CC-203 (the cases, scorer and baseline), CC-204 (the comparison), CC-205 (the chosen changes in `brain query --candidates`), CC-206 (the cases in the native harness) and CC-186 (final acceptance) conform to it.
**Decisions:** [0080](../decisions/0080-english-retrieval-quality-in-0-13-0.md) (this file's source); [0077](../decisions/0077-trust-repair-in-0-13-0.md) and [eligibility.md](eligibility.md) (the one eligibility rule, which this file never relaxes); [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) §5 and §6 (compare before adopting; gates; token accounting); [0009](../decisions/0009-memory-scope-levels.md) (reach).

How this file fits: the ranking itself stays in [cli.md](cli.md) §5.13, which CC-205 changes, spec first, for the changes §4 lets it adopt. This file says what any change must keep (§2, §3), which changes may be compared (§4), and how they are measured and accepted (§5 to §8). Where cli.md §5.13 and this file differ before CC-205 merges, cli.md describes the shipped behaviour and this file the target.

---

## 1. Scope (0080 §1, §2)

- **English only.** The cases and the changes concern English questions over English notes. No multilingual capability is added. §5.13 step 1's accent folding and CJK n-grams are kept and regression-tested (§7.3); other scripts are out of scope.
- **The first search.** What is measured is one `brain query --candidates "<question>" --repo <caller> --json` call: the question as the case states it, verbatim; the caller's folder; the default limit (10); no `--types`. A second search, a higher `--limit` or a retry never turns a failed retrieval case into a pass. The skills' retries may stay in operation; they are not this round's success mechanism.
- **Not changed:** `--read` and its limits, `brain recall` and the 800-token opening pack (0074 §3), the eligibility rule, filesystem access, Git history.

## 2. The trust envelope (0080 "Trust invariants"; eligibility.md §2)

Every change, compared or built, keeps all of these. A candidate that breaks one is rejected whatever it scores.

1. **One projection, first.** The searched notes are the notes as eligibility.md §2 leaves them (`eligible`, memory rows by memory.md §2), computed **before** terms, document frequencies, avgdl, ranking, subject resolution and snippets. Nothing is filtered only on the final page. A withheld note adds no term, no document frequency and no subject name.
2. **Fields as the rule leaves them.** A fact name, a typed value or a timeline entry is searched only when it survives the projection (a fact with no live accepted entry is dropped, capture-and-review §5.1). A partly restricted note adds no title, alias, summary, path, tags or other withheld free text (eligibility.md §6 rules 2 and 3).
3. **Current and historical stay apart.** A fact's current value and a timeline entry it replaced are distinguishable in the terms (§4 C1) and in a snippet; a superseded **memory** is searched only in the historical forms (eligibility.md §5).
4. **Relations by eligible names only.** When a relation (a `projects` id, `decided_in`, `area`, `org`) contributes a name, the name is the target note's eligible title or alias as the projection leaves it; a target that is withheld, partly restricted (title withheld) or unknown contributes nothing. Expansion never adds a note to the searched set, never follows a memory outside the caller's reach, and never reads a proposal.
5. **Context resolves, it never widens.** The caller's `.brain` (project, area) may decide which subject a question means (§3); it never makes a note or memory searchable that the rule withholds from that caller.
6. **Snippets from the projection.** A snippet is a line, or part of a line, of the projected note: a blanked line is never a snippet, and a fact shown in a snippet is one the projection kept.
7. **No new store, dependency or model.** Terms are computed from the files on each run, as today. No persisted index, embedding, vector store, service, production dependency, model-generated expansion or external model call (0080 §9).
8. **Deterministic.** The same brain, caller and question give the same bytes (apart from timing).

## 3. An unresolved subject (0080 §4)

- **Subject:** the project, area, org or person a requested attribute belongs to (a project's budget, a person's role).
- **Resolved** when one subject is named in the question by an eligible title or alias, or, when the question names none, by the caller's `.brain` project. An area in `.brain` resolves only when exactly one subject in that area holds the attribute. A folder with no `.brain` resolves nothing.
- **Unresolved** when the attribute is held by two or more eligible subjects and neither the question nor the caller's context picks one. Then the **answer is a short clarifying question** naming the eligible subjects it could mean (at most five; more is "which project?" with the closest ones). It does not answer for the first-ranked subject, and it does not list each subject's value as the default.
- **An org with several projects (the user's choice of 2026-11-11, option A).** A question naming an org that has several projects is answered when the evidence supports one answer for the org; it is a clarifying question only when the org's projects hold different answers. The CLI's signal (cli.md §5.13 `unresolved`) lists the org's projects that hold the attribute as a hint, without values; reading the evidence decides.
- **What the CLI owes the answer.** The first ten candidates let an agent see the ambiguity: evidence for at least two of the competing subjects, or an explicit, machine-readable signal. If CC-205 adds a signal, cli.md §5.13 defines it; it names subjects by eligible title or alias, or by type and id under eligibility.md §6 rule 3, and only subjects that are eligible notes in the searched set.
- **The skill.** The vendored brain-query skill has no clarification step today. The gates do not assume one. If the native run (CC-186) shows the answer needs skill wording, that wording goes through the skills fork in 0.13.0's one fork release, with the user's yes (0080 Consequences).

## 4. Changes that may be compared (0080 §9 item 3)

Each is compared alone, then the smallest combinations of those that help (CC-204). None is chosen in advance; an addition with no measured benefit on the development cases (§5.4) is rejected.

| | Change | Bounds |
|---|---|---|
| C1 | **Fact names and typed values are searched.** A fact's name and its string, number or boolean value (as words: `budget`, `5000`, `true`), and a timeline entry's field name, add terms. | Only fields the projection keeps (§2.2). The current fact and the replaced timeline values are told apart: e.g. the current value weighted as a fact, a replaced one only as timeline text. No field name from the schema's administrative keys (`id`, `type`, `lifecycle`, `sources`, hashes, dates as ids). |
| C2 | **English word forms and a small vocabulary map.** A deterministic suffix rule (plural, `-ed`, `-ing`, `-ies`…) so `budgets` finds `budget`; and a short list of general English equivalences (`budget` ↔ `money`, `funds`). | Written in TypeScript in this repo; the map is a committed list, printed in cli.md §5.13, of at most 40 groups of at most 6 words each, general business English only: no project, client, person or product name, no query id, no gold answer, and no word taken from a held-back case (§5.4). No semantic subsystem. Accent folding and CJK n-grams unchanged. |
| C3 | **Subject- and field-aware relevance.** A note that holds the requested attribute **for** the resolved subject ranks above a note that only names the subject; an unresolved subject is surfaced (§3). | Subject names come only from §2.4's eligible names. Context only resolves (§2.5). A note with no matching term is not returned on its context boost alone, if this change takes that up (today it can be). |
| C4 | **Match-centred snippets.** A snippet is the window around the match in a long line, and a fact held in frontmatter can be shown as a snippet line (`facts.budget: 5000`). | Still at most 3 snippets of at most 200 characters each, unless §6.2's token cap is met with a different bound; no automatic full-note expansion (0074 §3). |

**Not compared:** raising the limit, retries, embeddings, a persisted index, model expansion, any new dependency, and a map or rule that names a case's project, question or answer.

## 5. The eighty cases (0080 §5)

### 5.1 Where

`eval/retrieval-0.13/` (CC-203). Its generator builds **the original brain** of `eval/search-0.5/make-brain.mjs` (unchanged, same seeds, so its 1,982 notes and 600 sources are byte for byte the same) and then adds **the retrieval layer**: new projects, meetings, sources and facts written for the 80 cases, and caller folders with `.brain` markers. **The layer has the original brain's density:** each of its projects also gets companion decisions, meetings, references and open questions that name it (as each original project has about 25 such notes), from a seeded stream and neutral text that holds none of the cases' facts, so the note that answers competes with the subject's other notes as it does in a real brain. A layer whose subjects have only a few notes each puts all of them in the first ten and measures nothing. The 50 original questions run on the original brain only, and `eval/search-0.5/questions.json` stays byte for byte the same. The generator is deterministic (two runs give identical bytes, except the brain's own activity log, which `brain init` and `brain index` write with the clock) and its brain lints with no errors.

### 5.2 The four groups, 20 cases each

| Group | `kind` | What it asks | Includes |
|---|---|---|---|
| Body and structured facts | `fact` | a value stated in a note's body or in a typed field | numeric typed fields (`facts.budget: 5000`), a match late in a line longer than 200 characters, time-qualified facts ("for the rest of 2026") |
| English paraphrases | `paraphrase` | the source's content in other words | word forms, everyday equivalents of the source's words |
| Unresolved subject | `clarify` | an attribute two or more subjects hold, from a caller that doesn't resolve which | similar project names ("Harbor Web" and "Harbor Website"), a caller with an area holding both, a folder with no `.brain` |
| Genuinely unknown | `unknown` | something the brain does not hold | a near miss (another project holds the attribute; the asked one does not) |

### 5.3 A case

The fields of `eval/memory-0.12` (`caller`, `facts`, `forbidden_facts`, `forbidden_evidence`, `abstain`), so its scoring rules and the native harness carry over, plus:

| Field | Meaning |
|---|---|
| `kind` | `fact`, `paraphrase`, `clarify` or `unknown` |
| `evidence_sets` | for `fact` and `paraphrase`: a list of sets of ids; each set **independently sufficient** to answer (every required fact is in its notes' eligible text). Any one set counts |
| `subjects` | for `clarify`: `{ id, name, value, evidence: [ids], stated? }` for each competing subject, at least two: how an answer names it, its value of the attribute, every note that states that value, and (optional) a narrower pattern for stating the value in an answer, where the bare value ("two") would also match "which of the two" |
| `absent` | for `unknown`: `{ about: id, none: [patterns] }`: what no note about that subject holds (the audit checks it) |
| `as_of` | for a time-qualified fact: the qualification the answer must keep (also in `facts`) |
| `split` | `dev` or `held`: §5.4 |
| `subgroup` | for `fact`: `body-only` (no typed-field or title alternative), `structured` (a typed field with a prose alternative) or `decision`; frozen with the cases (7, 12, 1) |
| `audit` | one line: why the question is clear, which passage answers it, and why each other set is sufficient |

The questions are clear on their own. A "current" question asks about what the evidence calls current; a dated value is asked with its date or its period.

### 5.4 Held-back wording

In each group 6 of the 20 cases are `held`. The comparison (CC-204) chooses changes on the 14 `dev` cases per group only; the vocabulary map and every rule are committed before the held-back run, and the git history shows that order. The held-back cases are worded with words the `dev` cases do not use for the same idea. The gates count all 20.

### 5.5 The audit (CC-203)

A script check, run by the scorer before any run, fails the set when: an id in `evidence_sets` or `subjects` is unknown, or not eligible for the caller; a set's eligible text does not match every `facts` regex; a note about an `unknown` case's subject (the subject, notes that name it, its projects' notes and their minutes) holds what the case's `absent` says it lacks (the brain must truly not hold the answer); a `clarify` case's subjects are fewer than two, or its caller resolves one (§3); a question contains its own answer value; `eval/search-0.5/questions.json` or the original brain's bytes changed. Evidence text is read through `brain query --read` from the case's caller, so it is the text eligibility.md leaves; the layer has no suppression record, and the audit fails if one appears. A case is fixed only with a reason in its PR, never to make a candidate pass.

## 6. Scoring and gates (0080 §3, §6, §7)

### 6.1 Two levels, scored separately

| Kind | Retrieval level (the first search's ten candidates) | Answer level (text and citations) |
|---|---|---|
| `fact`, `paraphrase` | every id of at least one `evidence_sets` set is among the first ten; no `forbidden_evidence` | memory-0.12's answerable rule, with "every `expected_evidence` id is cited" read as "every id of one set is cited"; `as_of` kept |
| `clarify` | evidence of at least two `subjects` among the first ten, or the CLI's signal names at least two (reported; no forbidden evidence) | the answer asks a question, names at least two of `subjects` by their `name`, states no subject's value (`stated`, else `value`) and does not abstain |
| `unknown` | no `forbidden_evidence` (reported) | memory-0.12's unknown rule: abstains honestly, no forbidden fact |

### 6.2 Gates

| Gate | Set | Required |
|---|---|---|
| Facts, first search | the 20 `fact` cases, retrieval level | at least 18 of 20 |
| **Facts in prose only, first search** | the 17 existing body-only facts: `eval/search-0.5`'s 10 `fact-in-body` questions (on the original brain) and the 7 `fact` cases with `subgroup: body-only` (no typed-field or title alternative) | **at least 16 of 17** (the user's choice of 2026-11-11: the combined fact score must not hide the original 0 of 10) |
| Paraphrases, first search | the 20 `paraphrase` cases, retrieval level | at least 18 of 20 |
| Originals kept | `eval/search-0.5`, 50 questions, `brain` retriever | each of the 36 questions in the first ten on the 0.12.0 baseline still is; first-rank count at least 28 and MRR at least 0.61 (`results-cc173.txt`); recall@1, @5, @10 and MRR per kind reported |
| Trust kept | `eval/memory-0.12`, every adapter it runs at the retrieval level | no case that passes on the matched baseline fails; at CC-186, 100% of critical trust cases at both levels |
| Answers | the 40 answerable cases, answer level | at least 90% (36 of 40), each correct, sufficiently complete and cited |
| Clarify | the 20 `clarify` cases, answer level | 20 of 20 |
| Unknown | the 20 `unknown` cases, answer level | 20 of 20 honest |
| Latency | §7.1 | median and 95th percentile each at most 1.25 × the matched baseline |
| Output tokens | §7.2 | median and 95th percentile each at most 1.25 × the matched baseline |

The answer-level gates are met by the native runs of CC-186, on the final package. A reference-answers adapter (CC-203) shows that each answer rule can be met; it is not acceptance. A retrieval score is never reported as proof of answer or native performance.

## 7. Costs and the matched baseline (0080 §6, §7)

**The matched baseline** is the head of `main` the candidate is based on, once the trust-safe search is merged there (CC-176 with CC-183's follow-up, and any later merge that changes `src/lib/query.ts`, `suppressions.ts`, `eligibility.ts` or `recall.ts`). It is measured again whenever such a merge lands before CC-205 merges; numbers measured on an earlier head, other hardware or other load are not compared.

### 7.1 Latency

- **Search latency (gated):** the wall time of one cold `brain query --candidates … --json` process, as an agent runs it, from the same build form for both sides (the same `node` and the same entry point).
- **In-process ranking time (gated too):** the time of the ranking function over the already loaded notes, both sides on the same loaded notes, so file reading is not counted.
- **Design:** paired and interleaved on the same machine in one session: for each of the 130 questions (80 cases and 50 originals), 5 repetitions, baseline and candidate alternating and their order swapped every repetition, after one discarded warm-up pass; each question's time is the median of its repetitions; the statistics are the median and the 95th percentile (nearest rank) over the questions. The ratio of each statistic (candidate over baseline) is gated, for both measures.
- **Recorded:** CPU model, core count, memory, OS, Node version, the load average before and after, and the commits of both sides. A run under heavy load is repeated, not discounted.

### 7.2 Output tokens

- **Search output (gated):** the `--json` stdout of the first search, counted with `gpt-tokenizer` 4.1.0, `o200k_base`, the measurement-only package pinned in `eval/retrieval-0.12/package.json` (never a product dependency). Median and 95th percentile over the 130 questions, candidate over baseline. Bytes are reported beside tokens and are not a token count.
- **Full filtered reads (reported, not gated):** the tokens of `brain query --read` of the ids of the first sufficient set, so the cost of reading the answer is visible separately.
- **Opening recall:** `brain recall --pack` stays within 800 tokens (0074 §3); no change here.

### 7.3 Regression checks

`npm test` (the CJK and accent tests included), the typecheck, `npm run test:package` and the leak check pass; the eligibility tests at each seam §2 names (a fact or timeline value on excluded evidence adds no term and no snippet; a restricted target's title adds no relation name; an equivalence never surfaces a blanked line; a withheld note never appears as a subject).

## 8. Native acceptance (0080 §9 item 5; 0077 §5)

**Timing amended by [0082](../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) (2026-11-11):** this run, CC-206 with it, moves to 1.0.0; 0.13.0 is judged on §6.2's retrieval-level and cost gates, and the answer-level gates (answers, clarify, unknown, trust in the final answers) wait for this run.

The 80 cases join CC-186's final acceptance: **one complete native run in Claude Code and one in Codex** on the final packaged CLI and skills snapshot, through CC-200's harness as extended by CC-206, with every trace, the package hash, the CLI version and commit, and the snapshot identity kept. Not three repetitions. A code change after a run invalidates the results it touches; the affected checks are rerun on the new head (eligibility.md §12).

## 9. 0080 mapped to this file

| 0080 | Rule | Task |
|---|---|---|
| §1 English only | §1 | CC-203, CC-205 |
| §2 the first search, first ten | §1, §6.1 | CC-203, CC-204 |
| §3 gates, the 16 of 17 prose-only fact gate included | §6.2 | CC-203 (scorer), CC-204, CC-205, CC-186 |
| §4 clarifying question | §3, §6.1 | CC-205 (the CLI side), CC-186 (answers) |
| §5 eighty cases, the 50 unchanged, held-back wording, alternatives | §5 | CC-203 |
| §6 latency | §7.1 | CC-203 (the tool and baseline), CC-204, CC-205 |
| §7 output tokens | §7.2 | CC-203, CC-204, CC-205 |
| §8 0.13.0 | the task rows | CC-202 |
| §9 the plan | §4, §8 | CC-204, CC-205, CC-206, CC-186 |
| Trust invariants | §2, §7.3 | CC-204, CC-205 |
