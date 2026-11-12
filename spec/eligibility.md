# Eligibility: what an answer, a summary, a citation and a proposal may rest on (contract, decision 0077)

**Status:** contract for release 0.13.0, written by Claude Code in CC-182. Every 0.13.0 task conforms to it: CC-176, CC-177, CC-179 and CC-183 (CLI), CC-178 and CC-180 (skills, in the skills fork), CC-184 (the upgrade), CC-185 and CC-186 (evaluation and final acceptance).
**Decisions:** [0077](../decisions/0077-trust-repair-in-0-13-0.md) (this file's source), and the rules it keeps: [0003](../decisions/0003-proposal-review-flow.md) (approval), [0009](../decisions/0009-memory-scope-levels.md) (reach), [0055](../decisions/0055-domains-capture-and-review.md) (exclusion, corrections), [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) (memory eligibility, §6's gates), [0032](../decisions/0032-sources-beyond-meetings.md) (source versions stay).

How this file fits: it holds the one rule and where it applies. Command behaviour stays in [cli.md](cli.md), field definitions in [schema.md](schema.md), memory in [memory.md](memory.md), the exclusion algorithm in [capture-and-review.md](capture-and-review.md) §5. **Where a command section on `main` says something different, this file wins** and the task named in §13 changes that section, spec text first, then code, then a review of the new head. Each rule below cites the part of 0077 it comes from (§1 to §6 of its Decision, or "plan n" for item n of its Implementation plan) and names the task that implements it.

---

## 1. Terms

- **Evidence:** anything an agent uses for an answer, a summary it writes, a citation, or the support of a proposed change: a note's body line, fact, timeline entry, title, summary, alias, any other frontmatter value, a view's text, a memory.
- **Caller:** the folder a command runs for (memory.md §2.1): `--repo <path>`, else the current directory, with the project, area and stacks of its `.brain`.
- **Passage:** the finest unit of provenance a claim can name (capture-and-review §5.1): a passage reference `src-…#¶n:<hash>` of an extract; for an input with no paragraph identities (a URL, a file, a whole capture), the source itself (`src-…`, `mtg-…`, or a source key); an entry that names no input (a note or memory id, an `agent:<agent>/<session>` key, `notion-edit`, `user-correction:<prp id>`) is live under CC-174's rule. A passage is **live** by capture-and-review §5.1's algorithm.
- **Item:** one indivisible change, or one report (0077 §1). See §4.
- **Answer surface:** what an agent may answer, summarise, cite or propose from: `brain query --candidates`, `brain query --read`, `brain recall --pack`, `brain recall --search`, `brain reflect --candidates`. **Published surface:** what a person reads as knowledge outside the agent: `index.md`, the derived views, Notion pages and Review pages. **Administrative surface:** everything else the CLI prints (§7).
- **Withheld:** left out whole, with a reason, until rebuilt or re-proposed from eligible evidence. A withheld item is never deleted (§4.4).

## 2. The rule (normative; 0077 Decision, §1 to §3)

Evidence is **eligible** for a caller when all three hold, and an agent uses evidence only when a command on an answer surface returned it as eligible:

1. **Approval** (0003, 0074 §2), by what the evidence is:
   - a knowledge note, a source or a meeting: in the brain. A new note applies directly as `draft` (0003) and is eligible, carrying its `lifecycle` so the answer can say it is unconfirmed (today's behaviour, kept: 0077 adds no approval step for knowledge notes, and only memories need `reviewed`; settled in CC-182 under 0077 and reported to the user, 2026-11-10); `superseded` and `archived` knowledge notes are returned as history and labelled, as cli.md §5.13 orders them;
   - a memory: `reviewed` and superseded by nothing (memory.md §2 rules 1 and 2), except in the historical read (§5);
   - a proposal: **never** evidence. Its change is not in the brain until it is applied (0003), and it may propose what its evidence no longer supports;
   - a view (Brief, Decision log, area Brief, report): navigation, never evidence (schema §4); §8 decides when it may be shown at all.
2. **Reach** (0009): a memory reaches the caller by memory.md §2.1's table, default deny. Knowledge notes, sources and views have no reach: a project or area on them only ranks (cli.md §5.13 step 4).
3. **Exclusion** (0055): capture-and-review §5.1's algorithm leaves the claim in. A claim with no live passage is restricted; a note with nothing eligible left, or with unmappable text in the lineage of a changed input, is restricted whole.

**Ordinary approval never overrides an exclusion** (0077 §1). An Approve, an Accept, a `reviewed` lifecycle or a reconciled cleanup does not make an excluded passage live again; only a Restore item does (capture-and-review §5.2).

**One rule for every use** (0077 Decision, plan 1). The same three conditions decide, with no use stricter or looser than another:

| Use | Where it is applied | Task |
|---|---|---|
| Supported search | `query --candidates` (knowledge notes, sources; memories with `--types memory`), `recall --search`, `recall --pack`, `reflect --candidates`. Terms, scores and snippets are computed from each note **as the rule leaves it**, so excluded text never raises a score or appears in a snippet | CC-176 (on `main`: memory rows, §13 rows 1 to 3) |
| Full read | `query --read` | CC-176 |
| Summaries | a note's `summary` (dropped once any part is restricted); a summary an agent writes (an answer, a report, a Review `why`) rests only on evidence an answer surface returned | CC-176 (the field), CC-178 and CC-180 (the skills) |
| Citations | a citation names a note an answer surface returned as eligible; its label and path follow §6 | CC-176, CC-178 |
| A proposal's support | the passages it names, checked at creation and before apply (§9) | CC-177, CC-179 |

**Enforcement** (0077 Decision). The brain's commands apply the rule; the skills use only those commands for existing content (§10). A file opened, listed or searched directly is never evidence, whatever it holds (0077 §5: "no raw read of a brain file supplies an answer or a proposal's evidence").

## 3. Fail closed (0077 Out of scope, plan 3)

Where the CLI cannot establish that evidence is eligible (unknown lineage, an unreadable suppression record, a report whose freshness can't be read, a new proposal with no passages, a legacy proposal whose support §9.3 can't establish), it treats the evidence as not eligible and withholds the item it belongs to (§4). It never falls back to unfiltered text, and a skill never falls back to a raw read (§10). An unreadable `_suppressions/` record fails the command with `SUPPRESSIONS_UNREADABLE` (cli.md §3.5), as today.

## 4. Items and whole-item withholding (0077 §1, plan 4)

### 4.1 What an item is

| Context | One item is | Task |
|---|---|---|
| A proposal | the proposal, for every kind except `review_notes` | CC-177, CC-179 |
| A `review_notes` with `items` (0.8.0 layout) | each `it-` item: one change, one new note, one link | CC-177 |
| An older-layout `review_notes` (no `items`) | each listed note, each link and each folded change | CC-179 |
| A report | the report (`view_kind: report`), whole | CC-183 |
| Another view (Brief, Decision log, area Brief) | the view, whole | CC-176 (on `main`), CC-183 |
| A read | the note: returned with its restricted claims blanked, or withheld whole (capture-and-review §5.1, cli.md §5.13.1) | CC-176 |

An item is never the whole brain, a whole Review page or a whole ingest: items supported independently stay available.

### 4.2 When an item is withheld

An item is withheld **whole** when eligible support for it cannot be established reliably:
- **a mixed item:** it names a passage that is not live beside one that is. It is not applied whole and not applied in part: skipped by `proposal new`, held on the Review page with no wording published, closed on apply (`closed_reason: stale`, `SOURCE_EXCLUDED`). It can be re-proposed from the live passages alone (plan 4). This replaces cli.md §5.7's "only a text whose every cited line is excluded is skipped" (§13 row 6). CC-177.
- **an item with no established support:** a new item with no passages (§9.2), a legacy item §9.3 can't support, or passages the CLI cannot resolve. A legacy item that §9.3 supports is not withheld. CC-179.
- **a report or view** whose dependencies or freshness can't be shown safe (§8). CC-176, CC-183.

### 4.3 What a withheld item shows

- On a read: `{ id, status: "withheld", reason }` and nothing else (cli.md §5.13.1). A withheld report also names the refresh that rebuilds it (CC-183).
- On create: the skip and its reason in `data` and in the human output (cli.md §5.6).
- On apply: `closed` with its reason; the decision is recorded.
- On a Review page: the item is held: its wording, `why` and value are not published, and an Accept closes it.
- In the chat flow of brain-apply: as on the Review page, the held item without its wording (CC-179 marks it in `proposal list`; CC-180 shows it).

### 4.4 What is kept

Withholding removes nothing. Source files, older versions and full copies stay in Git (0032, capture-and-review §5.2); the Notion meeting stays intact; a withheld proposal's file stays with its decision recorded; a withheld report's file stays until a refresh rewrites it. Accepted text is never silently stripped (0077 §1): the brain does not cut an excluded line out of an accepted wording and apply the rest. A wording that changes needs fresh exact acceptance (§9.5).

## 5. Superseded memories: only in an explicit historical read (0077 §2, plan 2)

- **The default is current.** `recall --pack`, `recall --search`, `query --candidates --types memory` and `query --read` return current eligible memories only. `query --read` of a superseded memory without the historical mode withholds it as `not_eligible`. CC-176 (§13 row 1).
- **The historical read is explicit.** Two forms, each asked for by name: `brain recall --search "<q>" --include-superseded` (the historical search, memory.md §6.1, on `main`) and **`brain query --read <id>[,<id>…] --historical`** (the historical full read; CC-176 adds the option to cli.md §5.13.1 and memory.md §6.1). With `--historical`, a superseded memory is returned when it is not a `draft`, its reach includes the caller and the exclusion rule leaves it in (memory.md §2 rules 3 and 4; old does not mean approved). Every other id is read as without the option.
- **Labelled.** A superseded memory either form returns carries `superseded_by`, and `query --read --historical` adds `"historical": true` to it. The answer says the memory is historical and what replaced it (CC-178).
- **When.** A skill uses the historical forms only for a question about the past ("what was the rule before?", "why did we use to …"); a question about the present gets current eligible memories only (CC-178, CC-180).
- Superseded **knowledge notes** (a decision replaced by another) are unchanged: returned by the default reads, ordered after their successor and labelled (cli.md §5.13 step 5). 0077 §2 concerns memories.

## 6. Metadata carries no restricted text (plan 2)

Metadata is every part of a note other than its body lines: `title`, `summary`, `aliases`, `tags`, facts and timeline, every other frontmatter and custom field, the label a citation shows and the note's `path`. The rule on every answer surface (CC-176) and published surface (CC-183):

1. **A withheld note** (restricted whole, a memory not eligible, a proposal, an unknown id) shows nothing but the id the caller named and the reason: no title, path, alias, summary or field.
2. **A note with a restricted part:** no `summary`; no `aliases`; a timeline entry with no live passage dropped and a fact with no live accepted entry dropped (capture-and-review §5.1); the same note feeds search (§2 table), so an alias or summary that is left out of the read also adds no term to the score.
3. **Title, `path` and `tags` of a note with a restricted part are withheld; the note stays readable** (the user's choice of 2026-11-10, under 0077 §1 and its fail-closed rule). None of them carries a passage reference, so the CLI cannot tell a title that names the subject from one that states the excluded claim (a decision titled "Budget cut to 40k" whose budget line is excluded, beside a live line "Vendor stays Acme"). While the note has a restricted part, an answer surface returns it with its eligible lines and no `title`, `path` or `tags`, and without the other free-text frontmatter values the ingest wrote (ids, dates, enumerations, relations and the Notion-owned fields the user sets are kept). **Its body's headings and comments are withheld with the title**, for the same reason: a heading carries no passage reference, and an ingest often repeats the title as a heading (`# Budget cut to 40k`) or writes a heading that names the claim. They are returned as spaces of the same length, as a restricted line is (line numbers hold). The one exception is a heading that is exactly one of the fixed sections schema §4 defines for the note's type, which names no content: a decision's `## Decision`, `## Context`, `## Consequences` and `## Sources`. A meeting's sections are fixed by the ingest skill, not by the schema, and are withheld. None of the withheld parts adds a term to the note's search score or to `reflect --candidates`' names and terms. It is cited by id: `<type> <id>, title withheld: awaiting cleanup` (`decision dec-7k2m9q4x, title withheld: awaiting cleanup`). It comes back whole once it has no restricted part: its cleanup item is accepted as a removal or correction, or it is marked independent (capture-and-review §5.2, §5.3). This keeps independently supported lines available (0077 §1) and shows nothing unverifiable. A note with **no** restricted claim keeps its title: a title that restates an excluded paragraph there is the same stated limit as an uncited restatement (§9.6), closed by the ingest's writing rule (CC-180). CC-176 (`--read`, `--candidates`, citations); CC-183 (rule 5).
4. **A citation label** is built only from what the read returned: an eligible note's title and path, or, under rule 3, its type and id.
5. **Published surfaces** apply rules 1 to 3 too: `index.md`, the JSON index's text fields, the views and Notion keep no title, alias or summary of a wholly restricted note, and show a note with a restricted part by its type and id with no title, alias, summary or tags (CC-183). How a published page of a note already in Notion is rewritten is CC-183's to specify.

## 7. Administrative access versus answering (plan 2, plan 5)

- **Administrative access** reads the brain to operate it: `brain status`, `index` (`--json` included), `lint`, `log`, `proposal list`, `repo show`, `repo health`, `schedule list`, `modules`, `config`, the bookkeeping of `sync plan`, `sync render` and `sync record`, `workflow` records, and a skill's frontmatter lookups by `source_key`, `extract_of` or file hash to find an earlier version of an input (capture-and-review §4.8). It may list ids, paths, kinds, statuses and counts.
- **A listing is never answer evidence.** Nothing an administrative command prints (an id, a title, a `summary`, a memory's line in `index --json`) is used for an answer, a summary, a citation or a proposal's support, and none is a fallback when an answer surface returns nothing or withholds a note. When content is needed, the flow reads it through `query --read`; a withheld note stays withheld. CC-178, CC-180.
- **CC-176's spec question 2, settled.** `brain index --json` lists every memory, drafts included, with its title and summary (memory.md §2). It is administrative: it keeps that listing for tools and lint, no skill reads a memory from it, and memory.md §2's parenthetical already says so. It is not filtered for memories. Its knowledge-note text fields follow §6 rule 5 (CC-183).
- **An administrative lookup returns locations, not content.** A lookup by `source_key`, `extract_of` or file hash may print the matching file's path and id; reading what that file says is a read (§10).
- **A new person or org that matches a withheld one (CC-207).** `brain note new` does not write a `person` or `org` whose title or alias has the slug of a name an answer surface withholds (the title and aliases of a note left out whole or in the awaiting-cleanup form, an alias left out of a note that is otherwise shown). It skips the item `WITHHELD_MATCH` with the existing id and, when the title is withheld, the §6 rule 3 label, and nothing else (cli.md §5.5). This is an administrative lookup on the write path: it compares against a name the caller already supplied, returns an id, not content, and is never answer evidence; `brain query` is unchanged, so no answering flow can use it to confirm a withheld name. The ingest links the mention to that id instead of creating a duplicate, and the note comes back by name after its cleanup (§6 rule 3).

## 8. Derived content (plan 3)

A report, a Brief, a Decision log, an area Brief, an index entry and a Notion page are derived: they restate notes. The rule (CC-176 ships the direct case on `main`; CC-183 the rest):

1. **Direct and indirect dependencies.** A derived item rests on every note in its `generated_from` and every note its body links, and, through any view among them, on what that view rests on, to any depth (a report that links a Brief that rests on a note). If any of them is restricted in any part, not eligible, or gone, the item is withheld whole. A dependency cycle is followed once.
2. **Freshness.** A report whose `generated_at` is not later than the `captured` of an extract version that carries a suppression record is withheld (cli.md §5.13.1, on `main`), **and stays withheld after the source's cleanup is reconciled**: a cleanup does not make an older report fresh (0077 plan 3, "a stale report does not become eligible merely because its source was cleaned"). Only a refresh that reads through `query --read` and writes a new `generated_at` brings it back.
3. **Fail closed.** A derived item whose provenance (`generated_from`, its links) or freshness (`generated_at`, an extract's `captured`) can't be read is withheld whole.
4. **No navigation exception.** A view is never shown in part, and "navigation only" is never a reason to show prose that rule 1 to 3 would withhold (0077 plan 3).
5. **Canonical material stays.** A withheld report or view withholds nothing else: a note it rests on that is eligible on its own stays readable and is what an answer cites (schema §4).
6. **Withheld names its way back.** A withheld derived item names its reason and what rebuilds it: `brain views` for a Brief or Decision log once its notes are eligible, a report refresh, `brain index` for the index (CC-183).
7. **An archived note is never shown as current.** A derived item never restates an `archived` note as current, accepted or open: a draft rejected in Review or closed on excluded evidence, or a note you archived, is history at most. A view that keeps history shows it only where the history belongs (a superseded decision under the decision log's Superseded, schema §16.2), and a decision archived with no successor is in no view (CC-218).

## 9. Proposals name their passages, checked twice (0077 §3, plan 4)

### 9.1 Every change names its passages

Every proposed change carries the passages it rests on (CC-179 adds the field to schema §11): one list per proposal, and on a `review_notes` one per change and per note. It holds every passage the change rests on, the ones its framing and `^[inferred]` lines draw from included, and the passage references inside its text are among them. This holds for changes with **no text** too: `update_fact`, `contradiction` (the value), `add_link`, `merge`, `supersede`, `set_field`, `answer`, a `new_item`'s note, and a reflection finding's proposal (the passages of the input lines it read, schema §11.4). For an input with no paragraph identities, the passage is the source (§1).

### 9.2 Checked when created and immediately before applied

- **`proposal new`:** an item with no passages is refused; an item any of whose passages is not live is skipped `SOURCE_EXCLUDED` (§4.2). CC-179 (no passages), CC-177 (mixed).
- **Before apply,** on every route (`apply` in chat, `sync apply` for a Review page, an older-layout row): the same check of the named passages, with the suppression state at that moment, so an exclusion made between the first read or the proposal's creation and its apply is caught (0077 plan 7). A proposal with no passage list is not refused here: it was written before the field, and §9.3 judges it. Refusing an item with no passages is `proposal new`'s alone. CC-177, CC-179.
- **What a passage check proves:** that the evidence is allowed; not that the change is true (0077 §3). The user still judges the change.

### 9.3 Legacy proposals

A proposal written before the field exists (no passage list) is **legacy**. Its support is its `source` read as a whole-source entry, plus the passage references in its text. It has adequate passage support (0077 §3) when the input of its `source` has no suppression record (nothing of that input is excluded, so the whole input is live) **and** every passage reference in its text is live, whatever input it names (a reference that is not live makes it a mixed or unsupported item, §4.2). It then applies normally. This is the user's reading of 0077 §3's "without adequate passage support" (2026-11-10), not a narrowing of it. When the input of its `source` has a suppression record (active or reconciled), the legacy item's passages can't be established: it is withheld (held on the Review page, closed on apply with `SOURCE_EXCLUDED`), reported with the input it came from, and the next ingest of that input's current version may propose it again with passages. It is never applied on trust (0077 §3). CC-179 (the CLI), CC-180 (the ingest's re-proposal).

**Older-layout `review_notes` approved whole:** each folded change, note and link is an item (§4.1). One without established support is withheld, reported and queued for re-proposal; independent items apply. CC-179.

### 9.4 A proposal's own text carries no excluded text

A proposal's `title`, `why`, values (`after`, `answer`, `links` values, `note.title`, `note.frontmatter`) and wording rest on its passages. When the item is withheld, none of them is published or shown (§4.3). CC-177, CC-179.

### 9.5 Exact acceptance, and the user's own corrections

- **Acceptance binds the exact wording** shown (0055, capture-and-review §7.6). When the wording that would be written differs from the wording accepted (because part of it would be withheld, or it was revised or re-proposed), the earlier acceptance does not carry over: the new wording is a pending item that needs its own Accept (0077 §1). CC-177.
- **A value the user typed** (a chat `fix` or `edit` value that differs from what was proposed and cites no passage, or wording the user edited on the Review page) is the user's exact acceptance of that value; no second approval (0055). **It is applied as a separately attributed user correction even when it restates excluded content** (the user's choice of 2026-11-10; 0055's corrections, kept by 0077 §3): its provenance is `user-correction:<prp id>`, not the excluded passage, and it never claims the source said it (capture-and-review §7.7). A warning in the skill is optional (CC-180).
- **A generic Approve or an incidental edit does not launder.** An Approve of a mixed or unsupported item, or a fix that keeps the proposed wording or still cites the excluded passage, is judged as the proposal (§9.2) and closed (cli.md §5.7, "Which decisions are checked"). CC-177.

### 9.6 The uncited restatement: a stated limit, narrowed

**CC-177's spec question 4, settled.** An agent's sentence that restates an excluded paragraph without its passage reference, beside a live claim, is not something the CLI can tell from framing: if the item names only live passages, it passes the checks. This stays a **stated limit** (the user's choice of 2026-11-10). 0077 narrows it in three ways, each with its task:
1. **Passages on every change** (§9.1): the item must name the passages its uncited lines draw from. A restatement of ¶3 whose item lists ¶3 is a mixed item and is withheld whole (§4.2). CC-179 (the field), CC-177 (the mixed rule).
2. **No route to excluded text inside the brain:** the ingest and every other flow read existing content only through the filtered commands (§10), so an excluded statement already in a note can't be read back and restated. CC-180.
3. **The skills' writing rule:** the ingest never writes a statement from an excluded paragraph of the input it is reading, cited or not. CC-180; measured by CC-185's cases and CC-186's runs.

What remains: an agent that omits a passage from the list and restates text it read during intake. The CLI does not detect it; the skill rule and the evaluation do.

## 10. Skill flows that read existing brain content (plan 5)

**CC-180's list, settled.** Each flow below reads existing brain content through `query --candidates`, `query --read` (and `--historical`, §5), `recall` or `reflect --candidates`, with no raw read, listing or grep as a fallback. Skills are written in the fork and vendored (skills-delivery §9.5); `.agents/skills/` is never edited by hand.

| Skill | Flow that reads existing content | Task |
|---|---|---|
| brain-query | answers; past questions through the historical read; the report mode's gathering, refresh and What to fix | CC-178 (the fork's PR #12); CC-180 for whatever #12 leaves |
| brain-ingest | the context load of existing notes (up to eight), the search for the notes an input updates or links, duplicate checks, the proposal's `why` and passages | CC-180 |
| brain-reflect | judging a cluster: its members and its inputs | CC-180 |
| brain-catch-up | the flows it runs (ingest, apply, sync), refreshing reports and kept Documents, delegated and scheduled runs | CC-180 |
| ultimate-assistant | any note text it reads to judge a finding, beyond `assistant findings`; the brain-reflect session it loads | CC-180 |
| brain-apply | showing pending proposals in chat (a held item without its wording, §4.3) | CC-180 |
| brain-howto | a question about what the brain knows, handed to brain-query's reads; questions about how the brain works and its state use the guide and administrative commands | CC-180 |
| brain-sync | publishing (a published surface, §6 rule 5, §8) | CC-183 (the CLI); no skill change expected |

brain-repos, brain-workflow, brain-workflow-adopt, brain-connect-notion and brain-notion-change read the linked folder's own files, workflow records through `brain workflow`, Notion structure and `brain.json`: no existing brain knowledge. When one of them needs a fact from the brain, it uses brain-query's reads.

**Initial intake** is reading the new input being ingested, before it is a source of the brain: a Notion page and its transcript, a file in the drop folder, a URL, pasted text, an attachment, a linked repo's changed files, and the comparisons that place it (`source extract-plan --previous`, `source diff`, both of which restrict their output already, cli.md §5.19, §5.22). It is not retrieval and is not filtered by this rule; its selection and exclusion are 0055's (capture-and-review §4). Once written, it is existing content.

**Administrative work** is §7's list. Both stay distinct from retrieval: neither result is ever an answer's or a proposal's evidence.

**CC-180's question on `--read`'s limits for reflection, settled.** The 20-id limit stays: brain-reflect reads a cluster's members and inputs in calls of at most 20 ids, as many as the cluster needs, and never falls back to a raw read. Withholding older versions and full copies of a changed input fits: reflection never uses them (cli.md §5.32: they are no input), and comparing versions belongs to intake (`source diff`), not to reflection. A cluster member or input that `--read` withholds is not judged; the finding rests only on what was returned.

## 11. One coordinated upgrade (0077 §4, plan 6)

`brain upgrade` (CC-184; cli.md §5.15 and §5.12 change first):

1. **Scope.** The brain's managed instructions (the `AGENTS.md` rules block), its sub-agent and its skills in both trees, as today; and **each registered linked project**, every `repos` entry of `brain.json` with a `path` (linked-repos.md §5): its managed block (`<!-- ultimate-brain:start -->` … `end`) in `AGENTS.md` and, where `brain link` writes it, `CLAUDE.md`, and its skill copies in `.agents/skills/` and `.claude/skills/`, written as `brain link` writes them (cli.md §5.12) from the brain's newly pinned snapshot. Project-owned text outside the markers is kept byte for byte.
2. **Both agents.** After writing, the upgrade checks that Claude Code's definitions (`.claude/skills/<name>/`, and `CLAUDE.md` reaching the block) and Codex's (`.agents/skills/<name>/`, `AGENTS.md`) each hold the snapshot's bytes, in the brain and in each project.
3. **Unfinished, never upgraded.** A project is reported **unfinished**, with its reason, and not counted upgraded, when its path is missing or unreadable; it has duplicate or conflicting copies (two managed blocks, a block in `CLAUDE.md` that differs from `AGENTS.md`'s, a competing copy of a linked skill as skills-delivery §5 defines it); its managed block is missing or damaged (markers missing, out of order or repeated); a write fails; or the check in step 2 fails. The upgrade never deletes or rewrites a conflicting copy it did not write (skills-delivery §5). A folder linked with `brain link` but not registered in `repos` is outside the upgrade; the report says to register it or run `brain link` there.
4. **Repeatable.** A second run changes nothing more; a project reported unfinished is retried on the next run.
5. **Fresh sessions.** The output ends by asking the user to start fresh agent sessions in the brain and in every project, so that instructions loaded before the upgrade don't persist.
6. **Tested on a synthetic old installation** made with the published 0.12.0 package, with the projects CC-184's acceptance lists. This contract authorises no operation on the user's real brain or projects (0077 §4).

## 12. Final acceptance (0077 §5, plan 7)

**Timing amended by [0082](../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) (2026-11-11):** this complete run (CC-186) moves to 1.0.0, once beta testers are live; each release from 0.13.0 gates instead on 0082 §1's native smoke run of 15 cases per agent. The rules below are unchanged.

**The evidence** (CC-185 adds the cases, CC-186 runs them):
1. Synthetic unit, integration, package (`npm run test:package`), skill (the fork's checks) and leak checks pass on the head the release is cut from.
2. **One complete native run in Claude Code and one in Codex** on the final packaged CLI and the vendored skills snapshot; not three repetitions. The cases: the 77 of `eval/memory-0.12` unchanged, plus CC-185's cases for old reports and indirect derived items, restricted metadata, historical memory (past and present questions), project and approval boundaries through full reads, an exclusion made between the first read or a proposal's creation and its apply, legacy proposals, a mixed proposal, and a linked project after the upgrade.
3. **The gates:** every critical trust case passes; at least 90% of answerable cases give a correct, sufficiently complete, cited answer; unknown cases are answered honestly; 0074 §6's token accounting is reported. A critical case fails when an answer or a proposal's `why`, value or text states restricted content, with a caveat or without one.
4. **The traces** are kept: each session's tool calls, and the exact package hash, CLI version and commit, and skills snapshot name, version and integrity. A session that opens, greps or lists a note file under the brain to answer or to support a proposal fails the run (intake of a new input and administrative commands are not such reads, §10).

**The rerun rule.** A fix merged after a run invalidates the results it touches: the affected acceptance and the final gate are rerun on the new head. Results from earlier branch revisions, or from a package other than the one released, never count (0077 §5). CC-186 changes only the results files and its row; a fix is its own task.

## 13. Where text on `main` differs, and which task changes it

This file wins in every row. "On `main`" is `main` at 07e74a5 (CC-176 #283, CC-177 #284 and CC-187 #286 merged).

| # | Text on `main` | What this file says | Changes it |
|---|---|---|---|
| 1 | cli.md §5.13.1: `--read` returns a superseded memory that `recall --search --include-superseded` returns; memory.md §6.1's last sentence | only with `--historical`, labelled `historical: true` (§5) | CC-176 |
| 2 | cli.md §5.13.1 and §5.13: a partly restricted note returned with its title, path, tags, frontmatter fields, body headings and comments | no title, path, tags, ingest-written free text, or body headings and comments other than schema §4's fixed decision sections; cited by type and id (§6 rule 3) | CC-176 |
| 3 | cli.md §5.13 "Restricted evidence": a partly restricted note loses only its `summary`, and step 3 scores its title and aliases | no aliases either, and no withheld field scored (§6 rules 2 and 3) | CC-176 |
| 4 | cli.md §5.8 "Restricted evidence": a restricted note "stays listed" with its title; capture-and-review §5.1, row "Indexes" | listed without restricted metadata (§6 rule 5) | CC-183 |
| 5 | capture-and-review §5.1, row "Reports": a line resting on it is flagged and left out of a refresh | the report is withheld whole until refreshed, also after the cleanup (§8) | CC-183 |
| 6 | cli.md §5.6 (the `SOURCE_EXCLUDED` skip) and §5.7 "Excluded evidence", first bullet: only a text whose **every** cited line is excluded is skipped or closed; §5.7 "What the rule does not see": a mixed text is applied whole | a mixed item is withheld whole (§4.2) | CC-177 |
| 7 | cli.md §5.14.3 "Excluded evidence": an item only partly restricted is held and skipped | held, and an Accept closes it as a whole one (§4.2, §4.3) | CC-177 |
| 8 | cli.md §5.7 second bullet and "What the rule does not see": no-text kinds on the current version, and the folded changes of an older-layout row, are not checked | every change names passages, checked twice; legacy rule (§9) | CC-179 |
| 9 | capture-and-review §5.1, row "Pending proposals": "resting only on restricted claims" | resting on a passage that is not live, or without established support (§4.2, §9) | CC-177, CC-179 |
| 10 | schema §11: no passage field; `closed_reason: stale` "rests only on excluded evidence" | the passage list (§9.1); `stale` also covers a mixed or unsupported item | CC-179 (field), CC-177 (reason) |
| 11 | cli.md §5.7 "What the rule does not see": the uncited restatement | still a stated limit, narrowed (§9.6) | CC-177 (the wording), CC-179 |
| 12 | cli.md §5.15: "The skills a linked repo or folder carries are refreshed by running `brain link` there again" | one upgrade reaches every registered project (§11) | CC-184 (cli.md §5.15 step 9, §5.12) |
| 13 | cli.md §6.2 step 2: brain-reflect reads members and inputs by their `path`s; §1.1's table lists no `query` command for brain-ingest or brain-reflect | through `query --read` (§10) | CC-180 |
| 14 | cli.md §5.32 "Restricted evidence" (and `src/lib/reflect.ts`, through `eligibleNote`): a partly restricted member or input keeps its `title`, `path` and headings in the output, and its title and aliases give names (`near_duplicate`, "an input names a note") and terms | §6 rule 3: none of them is shown, named or tokenised while the note has a restricted part | CC-176 |

Text on `main` that already agrees: memory.md §2 (one rule for `recall` and `query`; `index --json` is not a retrieval surface), cli.md §5.13.1's view rules (§8 rules 1 and 2, direct case), cli.md §5.7 "Which decisions are checked" (§9.5).

## 14. What the rule does not claim (0077 Decision, Out of scope)

- **Not filesystem security.** The brain's files stay readable to anyone who opens them; the rule is what the brain's commands and skills use. No ACL, sandbox or encryption.
- **Not semantic truth.** A passage check proves that evidence is allowed, not that a change or an answer is true (0077 §3). New source links do not prove correctness mechanically.
- **No deletion** from Git history or from the original Notion sources (0032, 0055).
- **No new store or platform.** No provenance database, service or index: the passages live in the proposal's frontmatter and the notes' existing references; everything else is computed from the files on each run.
- **No ranking change** beyond scoring the note as the rule leaves it (§2), and no new feature, engine or connector. **Amended by [0080](../decisions/0080-english-retrieval-quality-in-0-13-0.md) (2026-11-11):** English retrieval changes ship in 0.13.0 under [retrieval.md](retrieval.md), whose §2 keeps this file's rule ahead of every term, score and snippet.

## 15. 0077 mapped to this file

| 0077 | Rule | Implemented by |
|---|---|---|
| Decision: one operational eligibility rule | §2 | CC-176, CC-177, CC-179, CC-183 |
| §1 whole item withheld; item defined; independent items stay; source and history kept | §4.1 to §4.4, §6 rule 3 | CC-176, CC-177, CC-179, CC-183 |
| §1 accepted text never silently stripped; fresh exact acceptance | §4.4, §9.5 | CC-177 |
| §1 approval never overrides exclusion | §2 | CC-177, CC-179 |
| §2 superseded memories only in an explicit, labelled historical read; current questions get current memories; old does not mean approved | §5 | CC-176, CC-178 |
| §3 passages on every change, no-text changes included, checked at creation and before apply | §9.1, §9.2 | CC-177, CC-179 |
| §3 legacy proposals withheld and re-proposed | §9.3 | CC-179, CC-180 |
| §3 a passage check proves allowance, not truth | §9.2, §14 | — |
| §3 0055's corrections kept; Approve or an incidental edit doesn't launder | §9.5 | CC-177, CC-180 |
| §4 one upgrade: brain and every linked project, project text kept, both agents verified, unfinished reported, synthetic old install, fresh sessions, no real-brain operation | §11 | CC-184 |
| §5 one native run per agent on the final package, 77 + added cases, gates, traces and identities, no raw read, rerun rule | §12 | CC-185, CC-186 |
| §6 releases | the release lines in cli.md and assistant.md (0.15.0 for the scheduled run; per-area preferences 0.14.0, 0078) | CC-182 |
| Plan 1 contracts first | this file | CC-182 |
| Plan 2 eligible read, shared memory eligibility, historical mode, metadata, administrative access apart | §2, §5, §6, §7 | CC-176 |
| Plan 3 derived content: indirect dependencies, freshness, fail closed, no navigation exception, canonical material kept | §8 | CC-183 |
| Plan 4 proposals: create and apply, mixed text, no-text changes, old bundled rows, why/value/metadata, exact re-approval | §4.2, §9 | CC-177, CC-179 |
| Plan 5 skills read through the filtered commands; intake and administrative work distinct; fork release vendored | §7, §10 | CC-178, CC-180 |
| Plan 6 the coordinated upgrade | §11 | CC-184 |
| Plan 7 final acceptance | §12 | CC-185, CC-186 |
| Out of scope | §14 | — |
