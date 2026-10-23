# Review 07: Hermes as a brain operator, and a search index

**Focus:** whether Nous Research's Hermes Agent can run the brain's skills unattended, and which search index (GBrain read-only or a local BM25 index) would serve a brain of about 2,000 notes (CC-50, decision 0045)
**Reviewed:** Hermes Agent v0.21.5 (upstream 98d8ea79, 2026-10-03), its docs in `website/docs/` and the code they cite; GBrain 0.46.30.0 (installed from npm; 0.60.411.0 was available)
**Date:** 2026-10-23
**Method:** Hermes: its docs and code read, plus `hermes skills` in a scratch `HERMES_HOME` on a synthetic brain; no model call, no cron job, no Notion. Search: a synthetic brain of 1,982 notes and 50 known questions, run against `brain query --candidates`, a local BM25 index and `gbrain search`, with GBrain in a scratch `GBRAIN_HOME` on a copy of the brain. Commands in §5.

Claims are **Verified** (seen in docs, code or a run here) or **Inferred**.

## 1. Summary

- **Hermes can run the brain.** It loads the brain's skills from `.agents/skills/` as they are, runs scheduled jobs inside the brain folder with `AGENTS.md` loaded, reaches Notion through the same MCP server, and none of the commands the skills run hits its approval list. What it lacks comes from our side: catch-up has no unattended mode, and the skills were only tested with Claude models. §2.
- **No search index yet.** At 2,000 notes, BM25 found the right note in the top 5 for 31 of 50 questions, `brain query` for 25, GBrain for 20 (keyword only) or 19 (with local embeddings). No retriever found a fact stated in other words than the question. GBrain adds a database, Bun and a fast-moving schema, and in this test it did worse than what we have. §3.
- **Recommendation:** when decision 0045's signals fire, change the scoring of `brain query --candidates` to BM25 inside the CLI (no dependency, no store), and have brain-query retry with other words before an index is considered again. Hermes as operator: a decision on an unattended catch-up first, then a trial. §4.

## 2. Hermes Agent as an operator

| Question | Finding | |
|---|---|---|
| Skill format | `SKILL.md` with `name` and `description` frontmatter, the agentskills.io standard (`website/docs/user-guide/features/skills.md` §SKILL.md Format). Ours load as they are | **Verified** |
| Finding the brain's skills | `hermes skills trust <brain>` makes a repo's `.agents/skills/` and `.hermes/skills/` load in sessions started inside it (`agent/skill_utils.py`, `PROJECT_SKILLS_SUBDIRS`). On a blind brain, `hermes skills list` showed all eight `brain-*` skills | **Verified** (§5, step H2) |
| Scheduled runs | The gateway ticks every 60 s and starts a fresh session per due job; a job takes `skills=[…]`, a prompt and a `workdir`. With `workdir` = the brain, `AGENTS.md` is loaded and the terminal and file tools run there; trusted project skills resolve from that workdir (`cron.md` §Running a job inside a project directory; `skill_utils.find_project_root`) | **Verified** (docs, code) |
| Notion | MCP servers go under `mcp_servers` in `~/.hermes/config.yaml`; stdio or HTTP; `hermes import-agent claude-code` copies Claude Code's servers. Cron sessions discover MCP tools before they run (`cron/scheduler_preflight.py`) | **Verified** (docs, code) |
| The CLI and git | The terminal tool runs `brain …` and `git …`. The approval list (`security.md` §What Triggers Approval: recursive `rm`, `bash -c`, `node -c`, writes to `/etc/`…) contains no command the skills run. In cron, a command that needs approval is denied (`approvals.cron_mode: deny`) | **Verified** (docs) |
| Pushing | Child processes get a sanitised environment; a push needs credentials the terminal can reach (ssh agent or keychain). Untested | **Inferred** |
| Asking the one batch of questions | A cron delivery goes to a chat (Telegram, Slack…). With `cron.mirror_delivery: true` or `attach_to_session: true` the delivery opens a thread, and a reply in it continues with the run's context (`cron.md` §Continuable jobs). So a scheduled catch-up could post its batch and pick up the answers in a second turn | **Verified** (docs); the flow is untested |
| Sub-agents | `delegate_task`, 3 at a time by default (`features/delegation.md`); catch-up says "up to 4", which still holds | **Verified** (docs) |
| Model | A job runs on its pinned model, else `cron.model`, else the main model. Any provider works | **Verified** (docs) |
| Skills it rewrites | Hermes can patch any skill it can write, `external_dirs` and project skills included (`skills.md` §External Skill Directories). The brain's lint already flags a changed product file (`product-file`) | **Verified** (docs, lint) |

**What the product would need:**
1. **An unattended catch-up** (a decision): today brain-catch-up asks one batch and waits; brain-sync and brain-apply have `--record-only` for unattended runs, catch-up has nothing. Two shapes: (a) two turns: the scheduled run does the read-only pass, posts the batch, and the reply runs the rest; (b) one turn on defaults: everything that needs an answer is skipped and listed under Needs you. (a) fits Hermes's continuable deliveries; (b) works with any scheduler.
2. **Model pinning in the docs:** the skills and blind runs were tested on Claude models only. A Hermes job should pin a Claude model (`hermes cron create --model … --pin`) until the skills are tried on another.
3. **Setup lines in brain-connect-notion** for Hermes next to Claude Code and Codex: `mcp_servers` in `config.yaml`, or `hermes import-agent claude-code`.
4. **Tell the operator not to edit skills:** one line in the brain's `AGENTS.md` (Hermes loads it in a workdir job). The lint catches it after the fact.

**Not checked here:** a real scheduled run with a model, the Notion MCP inside a cron session, a push from cron, Telegram delivery. They need the user's Hermes profile, model keys and Notion, so they belong in an attended trial.

## 3. Search: `brain query`, BM25 and GBrain at 2,000 notes

**The brain** (`eval/search-0.5/make-brain.mjs`, seeded): 20 made-up client orgs, 60 projects, 300 people, 480 decisions, 600 meetings, 300 concepts, 151 references, 70 questions, an area: 1,982 notes, 8.5 MB. Notes are short and on purpose alike: every project picks a technology for 8 of 10 topics, so most decisions share words with dozens of others. Lint reports only missing provenance fields (`sources`, `source`, `kind`), which no retriever reads.

**The questions** (`eval/search-0.5/questions.json`, written by the same script before any retriever ran), 10 of each kind:
- *decision-by-topic*: "What did we decide about translations for Lumdun CRM migration?"
- *paraphrase*: the user's word, not the note's: "How do we handle where it runs on the Ostvik CRM migration?" for a *hosting* decision.
- *why*: "Why did Vikkip pick Resend for the mobile app?"
- *fact-in-body*: "What is the budget for the Marzel shop?" when one meeting's body says "confirmed the money for the rest of the year: €142k".
- *person-role*: "Who is the designer on the Quokip CRM migration?"

**The retrievers:**
- `brain`: `brain query --candidates --limit 10` from this checkout (cli.md §5.13: prefix matching, fixed field weights, no IDF).
- `bm25`: `eval/search-0.5/bm25.mjs`, 71 lines, no dependency: the same tokens and stopwords, title ×3, summary ×2, other frontmatter and body ×1, k1 = 1.2, b = 0.75.
- `gbrain`: `gbrain search --limit 30`, read back to note ids and cut to 10. Once keyword-only (no key), once with local embeddings (`ollama:nomic-embed-text`, 768 dimensions). No reranker and no query expansion: both need a hosted key (Voyage, Anthropic) or a local chat model.

**Results** (`eval/search-0.5/results-gbrain-keyword.txt`, `results-gbrain-hybrid.txt`; `brain` and `bm25` are the same in both):

| retriever | recall@1 | recall@5 | recall@10 | MRR | ms per query |
|---|---|---|---|---|---|
| brain | 21/50 | 25/50 | 30/50 | 0.46 | ~380 (node start included) |
| bm25 | 27/50 | **31/50** | **36/50** | **0.59** | < 1 (in memory; build 73–218 ms) |
| gbrain, keyword | 9/50 | 20/50 | 29/50 | 0.28 | ~670 |
| gbrain, + embeddings | 9/50 | 19/50 | 23/50 | 0.27 | ~830 |

| recall@5 by kind | brain | bm25 | gbrain keyword | gbrain + embeddings |
|---|---|---|---|---|
| decision-by-topic | 10/10 | 10/10 | 6/10 | 2/10 |
| paraphrase | 3/10 | 1/10 | 1/10 | 0/10 |
| why | 10/10 | 10/10 | 9/10 | 8/10 |
| fact-in-body | 0/10 | 0/10 | 0/10 | 0/10 |
| person-role | 2/10 | 10/10 | 4/10 | 9/10 |

**Reading them:**
- **BM25 beats our ranking where a word is rare.** Person-role goes from 2 to 10: "designer" and the project's name are rare, and IDF rewards them, where `brain query` scores every match the same and lets common words like "on the website" fill the top 10. **Verified.**
- **No retriever finds a fact said in other words.** The budget questions fail everywhere: the meeting says "money", the question "budget". Paraphrases mostly fail too. Embeddings were expected to help here and did not, with this model on these short notes. **Verified** for this setup; a larger embedding model or the reranker might. **Inferred.**
- **GBrain ranks decisions low.** Its results are chunks of the body; the project's name is in our frontmatter (`title`, `summary`, `projects`), and GBrain's keyword index weights only `title` among those (`src/core/pglite-schema.ts`, `setweight`). A decision body that says "Use Postmark for email delivery" doesn't name the project. **Inferred** from its schema.
- **The test favours keywords.** Synthetic notes are short and formulaic; real minutes are longer and vary their words more, which helps embeddings. The ranking order could change on a real brain. **Inferred.**

**Setup and cost:**

| | brain query | BM25 in the CLI | GBrain read-only |
|---|---|---|---|
| Install | nothing | nothing (code in `src/`) | Bun, `gbrain` (npm), a PGLite database; Ollama and a model for embeddings |
| Build | none | in memory, under 0.3 s | `init` 1.7 s; `import` 9 s keyword-only, 86 s with local embeddings |
| Size | none | none on disk | 68 MB for an 8.5 MB brain (keyword-only) |
| Keeps up with edits | always | always (rebuilt per query) | `gbrain import` again after each change (`gbrain sync` exists) |
| Money | 0 | 0 | 0 locally; a hosted embedder costs cents for 2,000 short notes (**Inferred**) |
| Fit with decisions | — | 0008, 0016 | 0008 only read-only; the import warned that `decision`, `question`, `area` are not in its schema pack; it left the files unchanged (diff empty) |

## 4. Recommendation for docs/v2-ideas.md

1. **Search: no index now.** Decision 0045's signals haven't fired; the first brain is under 100 notes, where all three are instant.
2. **When they fire:** change `brain query --candidates` scoring to BM25 with the same tokens and field weights, built in memory per call (§3: +6 top-5 hits at 2,000 notes, 0 dependencies, no store; a CLI spec change). Keep prefix matching as a tie-breaker.
3. **Then words, not vectors:** have brain-query retry with the user's question reworded (synonyms, the note types' words) when the first candidates don't answer it. It targets the misses no retriever fixed here. Untested. **Inferred.**
4. **GBrain: drop it as the index candidate.** It was worse here in both modes, and keeps its own database and schema pack. Look again only if embeddings with a reranker beat BM25 on the user's real brain.
5. **Hermes:** keep "Hermes as an always-on brain operator" in v2 ideas, with next step "decide the unattended catch-up (§2, need 1), then an attended trial on the user's brain: one scheduled catch-up, a Claude model pinned, the batch delivered to a chat".

## 5. Commands

Everything runs on synthetic data in a scratch folder; `$S` is that folder, `$UB` this repo. Hermes and GBrain run from their own installs with `HERMES_HOME` and `GBRAIN_HOME` pointing into `$S`, so the user's own settings are not read or written.

**Hermes**
```sh
# H1. A blind brain with the 0.5.0 skills
node $UB/scripts/blind-brain.mjs brain-acme $S/brain
# H2. Load its skills in a scratch Hermes home (no model call)
mkdir -p $S/hh && cd $S/brain
HERMES_HOME=$S/hh hermes skills opt-out
HERMES_HOME=$S/hh hermes skills trust $S/brain
HERMES_HOME=$S/hh hermes skills list     # brain-apply … brain-sync, Source local, enabled
```

**Search**
```sh
# S1. The synthetic brain and its questions (questions.json is committed; the script rewrites it the same)
node $UB/src/cli.ts init $S/big --owner "Test Owner" --no-git
node $UB/eval/search-0.5/make-brain.mjs $S/big $UB/eval/search-0.5/questions.json
BRAIN_DIR=$S/big node $UB/src/cli.ts index
# S2. GBrain, keyword only, on a copy
export GBRAIN_HOME=$S/gh && mkdir -p $GBRAIN_HOME && cd $S
gbrain init --pglite --non-interactive --no-embedding --path $S/gh/db
cp -R $S/big $S/big-gb && gbrain import $S/big-gb --no-embed
diff -rq $S/big $S/big-gb                # empty: import wrote nothing into the files
# S3. The three retrievers
cd $UB && GBRAIN_HOME=$S/gh RUN_ROWS=1 node eval/search-0.5/run.mjs $S/big eval/search-0.5/questions.json gbrain
# S4. GBrain with local embeddings
ollama pull nomic-embed-text
export GBRAIN_HOME=$S/gh2 && mkdir -p $GBRAIN_HOME && cd $S
gbrain init --pglite --non-interactive --embedding-model ollama:nomic-embed-text --path $S/gh2/db
cp -R $S/big $S/big-gb2 && gbrain import $S/big-gb2
gbrain stats                             # Embedded: 1987 of 1987 chunks
cd $UB && GBRAIN_HOME=$S/gh2 RUN_ROWS=1 node eval/search-0.5/run.mjs $S/big eval/search-0.5/questions.json gbrain
```

The `brain` and `bm25` numbers are deterministic. GBrain's may move by a question or two with its auto-detected recency and salience boosts. **Inferred.**
