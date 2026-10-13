# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked`.
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

> **2026-10-12 — Status: v1 is built; wave 4 (dogfood) is next. Codex is out of tokens, so Claude Code takes the open CX work again (fresh-context Claude reviewer per PR; the user merges).**
> - **Done:** every CLI command in spec/cli.md, all six skills (ingest, apply, query, connect-notion, sync, notion-change), the plugin and Codex mirror, the eval (passes blind, eval/ingest/RESULTS.md), and the Notion space (built, connected, and checked live with brain-notion-change).
> - **Next, in order:** (1) CC-12, setting up the user's real brain together (choose its folder and a private GitHub repo, `brain init`, connect-notion, install the plugin, link 1–2 code repos, ingest the first reviewed meetings: this is U-03); (2) U-05, two weeks of real use; (3) CX-13 fixes from dogfooding.
> - **Open with the user:** U-03 (pick 3–5 reviewed meetings) is deferred to CC-12. The live Notion write test (one "TEST · delete me" project page) has not been approved yet, so don't run it without a yes.
> - **Earlier:** Claude took over CX-04 to CX-06 and CX-09 while Codex was out; Codex did CX-03, CX-07, CX-08 and CX-10 to CX-15.

## Why this split

- **Claude Code** has the full design context from the research and grilling sessions, so it owns the things that encode judgment: the schema and CLI contracts, the agent skills and prompts (ingest, apply, sync, query), the Notion design, and the evaluation of meeting extraction.
- **Codex** gets well-specified, testable engineering: the TypeScript CLI that does the deterministic work (IDs, frontmatter, index, lint, proposals, apply, views, link, init), its tests and fixtures.
- **Contracts come first** (wave 1) so both can then work in parallel without guessing.
- Every task is reviewed by the other agent.

## Waves at a glance

| Wave | Claude Code | Codex | You |
|---|---|---|---|
| 1 Foundations | CC-01 schema spec · CC-02 brain template · CC-03 CLI contract · CC-04 Notion prompts | CX-01 project scaffold · CX-02 core library | U-01 build Notion space · U-02 move recent meetings |
| 2 Core | CC-05 skill packaging · CC-06 ingest skill · CC-07 ingest evaluation | CX-03 init · CX-04 index · CX-05 lint · CX-06 proposals + apply · CX-07 derived views · CX-08 link · CX-09 fixture brain | U-03 provide 3–5 reviewed minutes |
| 3 Notion + query | CC-08 connect-notion + sync · CC-09 apply skill · CC-10 query skill · CC-11 notion-change skill | CX-10 sync helpers · CX-11 query helpers · CX-12 packaging + `npx` | U-04 dry run and feedback |
| 4 Dogfood | CC-12 end-to-end test with you | CX-13 hardening from dogfood issues | U-05 two weeks of real use |

---

## Wave 1 — Foundations

### CC-01 · Schema spec · `done` (PRs #1, #2)
**Output:** `spec/schema.md` and `spec/schemas/*.schema.json` (JSON Schema, draft 2020-12).
**Covers:** common frontmatter; v1 note types (area, goal, project, person, org, meeting, decision, question, concept, source, view, memory); `timeline:` entries (0010); assessment and lifecycle (0005); relations vocabulary; proposal file (synthesis §4.6); `brain.json` including the Notion section and Tasks mapping (0018); ID format (0017); provenance markers (0004); freshness forms (0011); folder layout (synthesis §4.1).
**Decisions:** 0001–0005, 0008–0011, 0017, 0018, 0020, 0021, 0023.
**Acceptance:** every field named in synthesis §4 and docs/notion-space-design.md §3 has a type and owner; one valid and one invalid example per note type in `spec/examples/`; names match the Notion property names exactly.
**Blocks:** CX-03 to CX-09.

### CC-02 · Brain template · `done` (PR #6)
**Output:** `templates/brain/`: folder skeleton, brain `AGENTS.md` (+ `CLAUDE.md` importing it) with the operating rules (synthesis §3.1), default `brain.json`, `.gitignore`, empty generated files.
**Decisions:** 0006, 0014, 0022.
**Acceptance:** product-owned sections in the brain AGENTS.md are fenced so upgrades can replace them without touching user content.
**Blocks:** CX-03.

### CC-03 · CLI contract · `done` (PRs #5, #2)
**Output:** `spec/cli.md`: every command (`init`, `index`, `lint`, `proposal new`, `apply`, `views`, `link`, `sync` helpers, `query` helpers), flags, inputs/outputs (JSON on stdout for agent use), exit codes, brain resolution order.
**Acceptance:** each command has an example invocation and example JSON output; error cases listed.
**Blocks:** CX-03 to CX-11.

### CC-04 · Notion AI prompts · `done` (PR #7)
**Output:** `notion/prompts/01-pages.md` … `08-navigation.md` and `notion/minutes-format.md`, extracted from docs/notion-space-design.md §6 and §9, plus `notion/CHECKLIST.md`.
**Acceptance:** names identical to CC-01; each prompt has its Verify list.
**Unblocks:** U-01.

### CX-01 · Project scaffold · `done` (PR #3)
**Output:** `package.json` (name `ultimate-brain`, `bin: { "brain": … }`, `type: module`, Node ≥ 22), `tsconfig.json`, `src/cli.ts` entry with subcommand routing and `--help`, tests with `node:test`, `npm test` and `npm run typecheck`, a GitHub Actions workflow running both.
**Constraints:** run TypeScript directly with Node type stripping where possible (0016); dependencies limited to a YAML parser and, if needed, a JSON Schema validator. Justify any other dependency in the PR.
**Acceptance:** `npx brain --help` works from the repo; `npm test` passes with a smoke test; no build step needed to run.

**Spec questions:**
- `npx brain --help` resolves the unrelated npm package named `brain`; npm does not expose the current root package's `brain` bin to `npx`. Should this acceptance command be `node src/cli.ts --help` for CX-01, with `npx ultimate-brain --help` deferred to CX-12 packaging as decision 0016 specifies?
- Node refuses native TypeScript type stripping for installed files under `node_modules`. Should CX-12 compile a JavaScript distribution while keeping repository development build-free?

### CX-02 · Core library · `done` (PR #8)
**Output:** `src/lib/`:
- `ids.ts`: generate `<prefix>-<8 chars>` from Crockford base32 lowercase (`0123456789abcdefghjkmnpqrstvwxyz`), with collision check against a provided set and re-roll (0017).
- `frontmatter.ts`: parse and serialize YAML frontmatter + body; preserve key order and unknown keys; round-trip a file without changes when nothing was edited.
- `brain-path.ts`: resolve the brain directory in order: `--brain` flag, `BRAIN_DIR` env var, `~/.config/ultimate-brain/config.json` (`{"brain": "<path>"}`); fail with a clear error if none, or if the path is this product repo (contains `spec/cli.md` and `src/cli.ts`).
- `fs-safe.ts`: atomic writes (temp file + rename); refuse writes outside the brain directory.
**Decisions:** 0014, 0017.
**Acceptance:** unit tests for each: ID format and collision re-roll; frontmatter round-trip on 5 sample files including unicode and multi-line values; resolution order and refusal cases; write containment.

---

## Wave 2 — Core

### CX-03 · `brain init`, `status`, `config`, `id new` · `done` (PR #19) (needs CC-01, CC-02, CC-03)
Also `brain status`, `brain config get/set`, `brain id new` (spec/cli.md §5.2–5.4), and the CX-02 alignment items from the #4 review (error codes, `BRAIN_NOT_FOUND`, contained mkdir, non-brain roots). Create a new brain from `templates/brain/` at a given path; initialize git; write `schema_version` into `brain.json`; never overwrite an existing non-empty folder without `--force`. **Acceptance:** per CC-03; test creates a brain in a temp dir and lint passes on it.

### CX-04 · Index builder · `done` (PR #10)
`brain index` regenerates `index.md` from frontmatter (0013): one line per note with id, title, summary, type, area/project, status, aliases, grouped by type; deterministic ordering; computes relation inverses. Also `brain log` and the shared log append helper (`log/YYYY-MM.md`, spec/cli.md §3.9, §5.11). **Acceptance:** identical output on repeated runs; fixture test against an expected file.

### CX-05 · Lint · `done` (PR #11; `view-stale` lands with CX-07)
`brain lint`: validate frontmatter against the JSON schemas; IDs present, well-formed, unique; links resolve (relative Markdown links and relation targets); no `[[wikilinks]]`; provenance markers well-formed; freshness warnings (0011, warnings only in v1); derived views not cited as sources. JSON output with severity, file, line. **Acceptance:** one fixture per rule, passing and failing.

### CX-06 · Notes, proposals and apply · `done` (Claude Code; #13 `note new` and #14 proposals merged, #16 `apply` merged)
`brain note new` (spec/cli.md §5.5) and `brain proposal list`. `brain proposal new` writes a proposal file from JSON input. `brain apply --input <file.json>` applies decisions (`approve`, `reject`, `edit` with value) to target notes: append `timeline:` entries, change assessment, set supersedes/superseded_by on both notes, mark proposals applied/closed. Also applies user corrections from Notion edits (0023, 0027). Pure and deterministic; each proposal writes only its kind's write set (spec/schema.md §11.2). Also brings `src/lib/frontmatter.ts` in line with spec/cli.md §3.6.5 (flow-style scalar lists, key positions). **Acceptance:** golden-file tests for each proposal kind; re-applying the same decisions is a no-op.

### CX-07 · Derived views · `done` (PR #20) (needs CC-01, CC-03)
`brain views` regenerates `projects/<slug>/brief.md` and `decision-log.md` from canonical notes inside `@generated` markers, preserving `@user` blocks (synthesis §4.5). Also adds the `view-stale` lint warning (spec/cli.md §5.10). **Acceptance:** user block survives regeneration; every item line links to its source note (spec/schema.md §16).

### CX-08 · `brain link` · `done` (PR #21) (needs CC-03)
Write `.brain` (project, area, stacks) in a target repo and insert or update a fenced "consult the brain" block in its `CLAUDE.md` / `AGENTS.md` (0006, 0009). Idempotent. **Acceptance:** running twice yields the same files; existing content outside the fence untouched.

### CX-14 · `add_link` proposals · `done` (PRs #32, #36) (Codex; needs decision 0028)
Implement the `add_link` kind (spec/schema.md §11, §11.2; spec/cli.md §5.6, §5.14.4): `proposal new` checks (field allowed for the target's type, id prefix, `ALREADY_LINKED` skip), `apply` (append if absent, no edit, write set = target), and the Review render (Kind "Add Link", After = `<Field>: <title>`). **Acceptance:** golden file for an approved `add_link`; a re-run after approval skips with `ALREADY_LINKED`; the spec examples pass.

### CX-15 · Ingest scorer · `done` (PR #38) (Codex; needs CC-07 cases)
Implement the scorer specified in `eval/ingest/README.md` ("Scoring spec"): compare a run folder with the base fixture against a case's `expected.json`, report per-category recall and precision, `must_not` failures and a verdict; support `--skip-kinds add_link` until CX-14. **Acceptance:** unit tests with a hand-made run folder per verdict path (pass, low recall, `must_not` hit, stop case modified).

### CX-16 · Ship and install the Codex skills · `done` (PR #43) (Claude Code while Codex is out; decision 0029)
Include `.agents/skills/` in the npm package. `brain init` copies every skill into the new brain (spec/cli.md §5.1 step 3), and `brain link` writes and refreshes `.agents/skills/brain-query/` in the linked repo (§5.12 step 3; every skill file listed in `files` with its action, stale files `removed`). **Acceptance:** from the packed tarball, `init` creates `.agents/skills/<name>/SKILL.md` for every skill in `skills/`; running `link` twice changes no bytes; a stale file in `.agents/skills/brain-query/` is removed; other `.agents/` content is untouched.

### CX-09 · Fixture brain · `done` (PR #9)
`tests/fixtures/brain-acme/`: a small synthetic brain (fictional client Acme, people, a project with key-fact timelines, decisions incl. one superseded, open questions, one goal) that passes lint. Used by all tests and by CC-07. **Acceptance:** fictional data only; covers every v1 note type.

### CC-05 · Skill packaging · `done` (PR #25)
One source per skill in `skills/<name>/SKILL.md` (frontmatter: `name`, `description` only), packaged as a Claude Code plugin and mirrored to `.agents/skills/` for Codex. Document the build step.

### CC-06 · Ingest skill · `done` (#29) (needs CC-01, CC-03)
`skills/brain-ingest/`: fetch Reviewed meetings (MCP), snapshot source, match via index, load ≤8 notes (0013), two-step analyse → generate, decision gate, subject-boundary and verbatim rules, output new notes + proposals + tasks through the CLI, fill Meeting relations, set Ingested (0007, 0012). **Acceptance:** runs end to end on the fixture brain with synthetic minutes, Markdown-only mode first.

### CC-07 · Ingest evaluation · `done` for the synthetic cases (#31, #40; they pass blind, eval/ingest/RESULTS.md); the real-minutes dry run (U-03) happens in CC-12
Five synthetic meetings with expected extractions (decisions, fact changes, contradictions, people, questions, tasks), a scoring script spec for Codex to implement if useful, then the dry run on your real minutes (U-03) in Markdown-only mode.

---

## Wave 3 — Notion and query

- **CC-08 · connect-notion + sync skills · `done` (#39, Claude Code):** find databases via MCP and write `brain.json`; import new rows (0021), read Notion-owned fields, detect your edits to brain-owned values (0023), publish brain records.
- **CC-09 · apply skill · `done` (#35, Claude Code):** read Review decisions via MCP → `brain apply` → update Review rows and pages.
- **CC-10 · query skill · `done` (#33, Claude Code):** retrieval ladder, cited answers separating accepted / contested / superseded facts.
- **CC-11 · notion-change skill · `done` (#41, Claude Code):** spec diff → Notion AI prompts → drift check via MCP (0022).
- **CX-10 · sync helpers · `done` (#18, Codex):** CLI functions the sync skill calls (diff Notion snapshot JSON vs notes, produce correction and creation plans).
- **CX-11 · query helpers · `done` (#22, Codex):** `brain query --candidates "<q>"` returning ranked notes from index + grep with snippets.
- **CX-12 · packaging · `done` (#27; skills install is CX-16):** publishable npm package so `npx ultimate-brain init` works. Publish **compiled JavaScript** (Node won't strip types inside `node_modules`); development in the repo stays build-free. The plugin/skills bundle remains out of the npm tarball until the product specifies how `.agents/skills/` reaches a user brain for Codex.

**Spec question:** Should `brain init` copy the generated `.agents/skills/` mirror into a user brain, should Codex install it globally, or should it stay in the product/plugin checkout? This determines whether those assets belong in the npm package.

## Wave 4 — Dogfood
- **CC-12 · end-to-end run with you;** **CX-13 · hardening · `done` for the review findings (#26, #37), open for dogfood fixes;** **U-05 · two weeks of real use** against the v1 success criterion in vision.md.

### Dogfood findings (CC-12, 2026-10-13)
Found while setting up the first real brain. Fix them before the next new user; `fixed` ones list the PR.

| # | Finding | Fix | Status |
|---|---|---|---|
| 1 | Views sorted and filtered on Created/Last edited time, but §3 never listed those properties. Views were written from §5 without checking §3 | Properties added to the design, prompts 2 and 5, migration 0002 (#47). Add a test that every property a view uses exists in §3 | design `fixed` (#47); test `todo` |
| 2 | The plugin ships skills but nothing puts `brain` on PATH; npm package not published | `prepare` script and install hint in skills and AGENTS.md (#48). Publishing to npm is the user's call | `fixed` (#48) |
| 3 | No setup steps to give the agent access to Notion (MCP or integration token) and to share Brain Data with it, for Claude Code and Codex | Checklist section "Connect your agent to Notion" per agent; `brain-connect-notion` stops with the exact fix when Notion is unreachable. Check the current Notion MCP steps first | `todo` |
| 4 | Ingest on an empty brain did not run or request `brain-sync` first, so Areas, Projects and People were unknown | `brain-ingest` step 1: if the brain has no notes and Notion is configured, run `brain-sync` first (or tell the user) | `todo` |
| 5 | A meeting with no project: the skill asked instead of linking the meeting to its area only | Document in `brain-ingest`: project is optional; link area only; never invent a project; offer to create one in Notion and sync | `todo` |
| 6 | Notion AI meeting notes use their own headings, not the minutes format | `extraction.md`: extract from any heading structure; the format is a hint, not a requirement. Say so in `notion/minutes-format.md` | `todo` |
| 7 | A meeting that discusses several projects: the skill does not say project is per item | `extraction.md`: assign `projects` per decision, question and task from what each is about; a meeting may list several; ask only when an item is ambiguous | `todo` |
| 8 | Attendee, date and name-spelling problems in the minutes are found only by the ingest | Before ingest, `brain-ingest` reports missing Date and attendee names, and spelling variants of one name, in one question | `todo` |
| 9 | Sync create recorded the brain's Summary (the title) and Lifecycle as published although Notion had them empty, so render never sent them; Lifecycle compared "Draft" with "draft", so a Lifecycle edit in Notion became a conflict | Baseline = what Notion shows, as §5.14.2 says; Lifecycle compared normalized; emptied Lifecycle → `REQUIRED_EMPTY` (`src/lib/sync.ts`, test in `tests/sync.test.ts`). Repair the first brain: drop `Summary` and `Lifecycle` from `notion_published` on its 2 notes | `fixed` (this PR); repair `todo` |
| 10 | `brain-ingest` queried the Meetings database id; Notion queries need the data source id (404) | `brain-ingest` step 2: retrieve the database, query `data_sources[0].id`, as `brain-sync` says | `todo` |
| 11 | `brain-sync` needs the snapshot format of spec/cli.md §5.14.1, which lives outside the brain; reading it was denied. The `sync record` input (`{records: [...]}`) was guessed wrong | Copy the snapshot, plan and record formats into `skills/brain-sync/references/` | `todo` |
| 12 | A project created in Notion through the API has no Brief and Decision log toggles, so publish skips them (SECTION_NOT_FOUND) | `brain sync render` or the skill creates the missing toggles; or the Projects template is applied on create. Decide which | `todo` |
| 13 | `sync plan` makes new ids each run, so the plan shown can differ from the one applied | `brain-sync`: apply the saved `plan.json` that was shown, never a re-run plan | `todo` |
| 14 | The meeting page holds the Notion AI summary and the user's own "My notes" toggle, and they disagree ("connected data consent" vs "Connect Consent") | `extraction.md`: read both; the user's notes win on conflict, or ask; flag contradictions | `todo` |
| 15 | Page template text (the "Before marking Reviewed" checklist, inline Decisions/Questions/Tasks databases) and Notion AI footnote links `[^/p/…]` would go into the verbatim source | Source = meeting-notes summary + user notes only; strip footnote links before hashing. Spec it in `cli-inputs.md` §1 | `todo` |
| 16 | Notion AI minutes say "I" and "the new team member" for the owner | `extraction.md`: map first person and role descriptions of the owner to the owner's person note | `todo` |
| 17 | Sync compares Notion's converted values (brain ids, `YYYY-MM-DD`) with the baseline stored in Notion's form (page ids, `{start,end}`): Area, Client and Org give a `BOTH_CHANGED` conflict on every sync; People, Deadline and an empty Key Facts are resent every sync. Assessment and Kind edits in Notion are never reported as `NOT_CORRECTABLE` (0027). Found in the review of #50; predates it | Compare N and S in one form in `planExisting`; one round-trip test per database (goal, project, person). The first brain's project will hit the Area conflict on its next sync | `todo` |
| 18 | The ingest's final report ran to ~50 lines (every note, every alias, dogfood notes). Too long for a real user | Every skill ends with a short report: counts, what needs the user (approvals, one question at a time), the next action. Details only on request; dogfood notes only when asked for | `todo` |
| 19 | The owner ruled on two points in chat ("Connected Data Consent"; ePrivacy and GDPR as separate clusters). They became a project proposal, no decision note was made, and the meeting note still marks the name `^[ambiguous]`. Provenance has no marker for "stated by the owner outside the minutes" | Decide: an owner ruling is its own source (a chat note) that can back decisions. Add the provenance form to the schema and `extraction.md` | `todo` |
| 20 | People mentioned in the minutes: notes were made for Pete, Roland and Mikhailis, not for Charles, Manuela, Katerina, Mehmet or Albert. No rule says which mentioned people get a note | `extraction.md`: rule for mentioned people (e.g. a note when they own something or have an action item; otherwise name only) | `todo` |
| 21 | Step 3 runs the source dry run without an id, step 7 needs one from `id new`; `source_key` handling had to be reconciled by the agent | `brain-ingest` steps 3 and 7 and `cli-inputs.md` §1: one way to build the source item | `todo` |

---

## Your tasks

| Id | Task | When |
|---|---|---|
| U-00 | Approve the baseline commit and create a private GitHub repo for the product (needed for branches, reviews and Codex cloud) | Now |
| U-01 | Build the Notion space with the prompts (CC-04) | Wave 1 |
| U-02 | Move the last 1–2 months of meeting pages into Meetings, mark the ones you trust as Reviewed | Wave 1 |
| U-03 | Pick 3–5 reviewed minutes for the dry run | Wave 2 |
| U-04 | Review dry-run output and give feedback | Wave 3 |
| U-05 | Two weeks of daily use | Wave 4 |

## How to start Codex on a task

Paste into Codex:

```text
Read AGENTS.md, then build/TASKS.md. Work on task CX-01 only.
Create branch codex/CX-01-scaffold from main, set the task status to "in progress",
implement it to its acceptance criteria, run the tests, then set the status to "review"
and summarize what you did and any spec questions.
```

Codex can start CX-01 and CX-02 immediately; CX-03 onward wait for CC-01 and CC-03.
