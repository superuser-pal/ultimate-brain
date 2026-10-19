# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked`.
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

> **2026-10-19 — Status: 0.2.3 is released and in the brain. 0.2.4 is merged: CC-27 (#88), CX-28 (#86), CX-30 (#87); release it with U-14. 0.3.0 work starts now but merges only after 0.2.4 is released.**
> - **0.3.0 scope agreed 2026-10-19:** the intake experience (decision 0037) and Area on Decisions and Questions (0034), in CC-22 (contracts), CC-26 (skills), CX-24, CX-22, then U-13 (Notion migration, upgrade, real catch-up). The onboarding suite and Notion file uploads move to 0.4.0.
> - **Review order (CC-27):** the done commit comes before the verdict; the reviewer posts `Review (<agent>): pass at <sha>` last.
> - **Untriaged `dogfood` issues:** 0.
> - **Earlier:** v1 waves 1–4 below; dogfood findings 1–24 in the Wave 4 table.

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
| 1 | Views sorted and filtered on Created/Last edited time, but §3 never listed those properties. Views were written from §5 without checking §3 | Properties added to the design, prompts 2 and 5, migration 0002 (#47). Add a test that every property a view uses exists in §3 | `fixed` (#47 design, #63 test) |
| 2 | The plugin ships skills but nothing puts `brain` on PATH; npm package not published | `prepare` script and install hint in skills and AGENTS.md (#48). Publishing to npm is the user's call | `fixed` (#48) |
| 3 | No setup steps to give the agent access to Notion (MCP or integration token) and to share Brain Data with it, for Claude Code and Codex | Checklist section "Connect your agent to Notion" per agent; `brain-connect-notion` stops with the exact fix when Notion is unreachable. Check the current Notion MCP steps first | `todo` (0.3.0) |
| 4 | Ingest on an empty brain did not run or request `brain-sync` first, so Areas, Projects and People were unknown | `brain-ingest` step 1: if the brain has no notes and Notion is configured, run `brain-sync` first (or tell the user) | `fixed` (#51) |
| 5 | A meeting with no project: the skill asked instead of linking the meeting to its area only | Document in `brain-ingest`: project is optional; link area only; never invent a project; offer to create one in Notion and sync | `fixed` (#51) |
| 6 | Notion AI meeting notes use their own headings, not the minutes format | `extraction.md`: extract from any heading structure; the format is a hint, not a requirement. Say so in `notion/minutes-format.md` | `fixed` (#51) |
| 7 | A meeting that discusses several projects: the skill does not say project is per item | `extraction.md`: assign `projects` per decision, question and task from what each is about; a meeting may list several; ask only when an item is ambiguous | `fixed` (#51 decisions and questions; #60 CLI, CC-16 skill for tasks) |
| 8 | Attendee, date and name-spelling problems in the minutes are found only by the ingest | Before ingest, `brain-ingest` reports missing Date and attendee names, and spelling variants of one name, in one question | `fixed` (#51) |
| 9 | Sync create recorded the brain's Summary (the title) and Lifecycle as published although Notion had them empty, so render never sent them; Lifecycle compared "Draft" with "draft", so a Lifecycle edit in Notion became a conflict | Baseline = what Notion shows, as §5.14.2 says; Lifecycle compared normalized; emptied Lifecycle → `REQUIRED_EMPTY` (`src/lib/sync.ts`, test in `tests/sync.test.ts`). Repair the first brain: drop `Summary` and `Lifecycle` from `notion_published` on its 2 notes | `fixed` (this PR); repair `todo` |
| 10 | `brain-ingest` queried the Meetings database id; Notion queries need the data source id (404) | `brain-ingest` step 2: retrieve the database, query `data_sources[0].id`, as `brain-sync` says | `fixed` (#51) |
| 11 | `brain-sync` needs the snapshot format of spec/cli.md §5.14.1, which lives outside the brain; reading it was denied. The `sync record` input (`{records: [...]}`) was guessed wrong | Copy the snapshot, plan and record formats into `skills/brain-sync/references/` | `fixed` (#51) |
| 12 | A project created in Notion through the API has no Brief and Decision log toggles, so publish skips them (SECTION_NOT_FOUND) | `brain sync render` or the skill creates the missing toggles; or the Projects template is applied on create. Decide which | `fixed` (decision 0033, CC-16) |
| 13 | `sync plan` makes new ids each run, so the plan shown can differ from the one applied | `brain-sync`: apply the saved `plan.json` that was shown, never a re-run plan | `fixed` (#51) |
| 14 | The meeting page holds the Notion AI summary and the user's own "My notes" toggle, and they disagree ("connected data consent" vs "Connect Consent") | `extraction.md`: read both; the user's notes win on conflict, or ask; flag contradictions | `fixed` (#51, decision 0031) |
| 15 | Page template text (the "Before marking Reviewed" checklist, inline Decisions/Questions/Tasks databases) and Notion AI footnote links `[^/p/…]` would go into the verbatim source | Source = meeting-notes summary + user notes only; strip footnote links before hashing. Spec it in `cli-inputs.md` §1 | `fixed` (#51) |
| 16 | Notion AI minutes say "I" and "the new team member" for the owner | `extraction.md`: map first person and role descriptions of the owner to the owner's person note | `fixed` (#51) |
| 17 | Sync compares Notion's converted values (brain ids, `YYYY-MM-DD`) with the baseline stored in Notion's form (page ids, `{start,end}`): Area, Client and Org give a `BOTH_CHANGED` conflict on every sync; People, Deadline and an empty Key Facts are resent every sync. Assessment and Kind edits in Notion are never reported as `NOT_CORRECTABLE` (0027). Found in the review of #50; predates it | Compare N and S in one form in `planExisting`; one round-trip test per database (goal, project, person). The first brain's project will hit the Area conflict on its next sync | `fixed` (#52) |
| 18 | The ingest's final report ran to ~50 lines (every note, every alias, dogfood notes). Too long for a real user | Every skill ends with a short report: counts, what needs the user (approvals, one question at a time), the next action. Details only on request; dogfood notes only when asked for | `fixed` (#51) |
| 19 | The owner ruled on two points in chat ("Connected Data Consent"; ePrivacy and GDPR as separate clusters). They became a project proposal, no decision note was made, and the meeting note still marks the name `^[ambiguous]`. Provenance has no marker for "stated by the owner outside the minutes" | Decide: an owner ruling is its own source (a chat note) that can back decisions. Add the provenance form to the schema and `extraction.md` | `fixed`: decision 0031 (A), #51 |
| 20 | People mentioned in the minutes: notes were made for three of the people mentioned, not for the other five. No rule says which mentioned people get a note | `extraction.md`: rule for mentioned people (e.g. a note when they own something or have an action item; otherwise name only) | `fixed` (#51) |
| 21 | Step 3 runs the source dry run without an id, step 7 needs one from `id new`; `source_key` handling had to be reconciled by the agent | `brain-ingest` steps 3 and 7 and `cli-inputs.md` §1: one way to build the source item | `fixed` (#51) |
| 22 | No way to bring product updates into an existing brain. The Claude Code plugin updates itself, but the brain's product-owned `AGENTS.md` block and its `.agents/skills/` (Codex) are written once by `brain init`; the fence says "upgrades replace", yet no command does it | `brain upgrade`: rewrite the fenced AGENTS.md block and `.agents/skills/` from the installed version, report what changed; skills and AGENTS.md tell the agent to run it after updating | `fixed` (#53) |
| 23 | `npm install -g github:superuser-pal/ultimate-brain` fails for everyone: the git install builds in a temporary clone, and with `-g` npm installs the build tools globally, so `tsc` is missing. An earlier `npm link` also hid it on the author's machine | Publish to npm as `ultimate-brain`, MIT (user's choice). Install docs, README and docs/releasing.md updated; `prepare` removed | `fixed` (#54); first `npm publish` by the user |
| 24 | The first `npm publish` would have shipped no `brain` command: npm 11 checks `bin` paths before `prepack` builds `dist/`, so on a clean checkout it drops them. `test:package` missed it (it packs with `dist/` present, and `npm run -s` silenced the warning), and CI never ran it | Committed launcher `bin/brain.js` → `dist/cli.js`; `test:package` packs from a clean state and fails on the warning; CI runs `test:package`; version 0.1.1 | `fixed` (bin launcher PR) |

---

## 0.2.0 — Smooth daily use and more ways in

Agreed with the user on 2026-10-14 (grill session). **Goal:** daily use is smooth for the one user, and the brain ingests more than meetings. Medium size.

**Two tracks:**
- **npm 0.2.0:** CLI and skills. It ships when CC-13, CC-14, CC-16 and CX-18 to CX-20 are done. CC-15 runs on the released version (agreed 2026-10-15); its fixes go to 0.2.1.
- **Notion:** CC-17 to CC-18, in the user's workspace and the design docs. It runs alongside and never blocks the npm release.

**Out of scope (0.3.0 list, docs/v2-ideas.md):** finding 3 (Notion setup steps per agent), a Sources database in Notion (now the Inbox, decision 0037), Notion file uploads, Docling or Marker unless the bake-off (CC-15) asks for them.

**Dependencies:**
- CC-13 blocks CX-18, CX-19 and CC-14.
- CX-18 blocks the CC-15 acceptance run.
- U-06 blocks CC-15; U-07 blocks CC-17.
- CX-20 has no blocker.

### CC-13 · Contracts for 0.2.0 · `done` (#58; decisions 0032, 0033)
**Output:** one spec PR covering everything Codex builds in this release:
- **A decision "Sources beyond meetings":**
  - source kinds `document`, `email`, `chat`, `note`, `capture`;
  - the original file stays outside the brain and the source note keeps its name and SHA-256;
  - converters run as external tools: MarkItDown, plus Claude Code's native PDF and image reading;
  - converted text is untrusted input.
- **spec/schema.md and note.schema.json:**
  - a `file:<sha256>` source key;
  - a source `kind`;
  - original file name and hash fields.
- **spec/cli.md:**
  - `note new` duplicate detection by file hash (`DUPLICATE_SOURCE`);
  - `sync tasks` accepts `projects` per item (finding 7);
  - `sync render` reports a missing project section so the skill can create the toggle (finding 12; settle where the toggle is created);
  - Capture Inbox rows: how a row is marked Processed (a render item, or skill-side through the MCP).

**Acceptance:** Codex can build CX-18 and CX-19 from the spec alone.

### CC-14 · Ingest-text skill · `done` (#61)
**Output:** one ingest path for everything that isn't a Notion meeting. It is a new mode of `brain-ingest` or a sibling skill; decide in the PR, keeping one source of truth for extraction.
- **Documents:** given as a file path; routed to native reading (Claude Code: PDF and images; Codex: images with its image tool, since MarkItDown has no OCR) or MarkItDown (Office, HTML, and PDFs in Codex). Native reading records the model id as the converter version.
- **Pasted text:** emails, chat and notes.
- **Capture Inbox:** New rows are processed and set to Processed.
- **Extraction rules per kind:** documents have no attendees or action items by default.
- **Also:** the transcript fallback for thin meeting summaries (dogfood), and the short-report rule.
- **Written for Claude Code and Codex.**

**Acceptance:** a blind run on synthetic fixtures (one document, one email, one capture) passes; the skill mirror is rebuilt.

### CC-15 · Converter bake-off and real acceptance run · `review` (bake-off in decision 0032; acceptance run done 2026-10-15; fixes go to 0.2.1)
**Acceptance run, part 1 (2026-10-15, 0.2.0):** a Word file (MarkItDown) and a PDF (native read) ingested end to end and published to Notion. The run's specifics stay in the user's brain; only product findings are recorded here. Captures and an email are next. Findings for 0.2.1:
- **Review rows show relative file links** in After (`../../knowledge/…`), meaningless in Notion. `sync render` should drop or rewrite links in proposal text.
- **Concept notes aren't published**, so what a document teaches is visible in Notion only through proposals. Candidate: publish concepts, or say so in the report.
- **Lint `freshness` false positive** on "latest" in a sentence that isn't about time (a sentence where "latest" means most recent in a sequence, not a date).
- **A project created through the API had an empty page;** the 0033 rule (append Brief and Decision log) worked as written.
**Acceptance run, part 2 (2026-10-15, 0.2.0):** a Notion-mode apply (9 Review decisions) and three Capture Inbox rows, each a pasted email thread, ingested end to end, published, and marked Processed. The email-in-capture rule (#70) worked: senders, sent dates and quoted replies were read with the email rules. Findings for 0.2.1:
- **`sync plan` rejects Notion's own timestamps** (`2026-10-15T18:11:00.000Z`) as not ISO 8601 UTC. The skill had to strip the milliseconds. The CLI should accept them (Codex).
- **`sync plan` passes an Edit on an `add_link`** through as a decision, so `apply` would fail with `EDIT_NOT_ALLOWED`. It should be a plan conflict that the user sees before anything is applied (Codex). In this run the user's Edited Value was really a role; the skill asked, and it became a separate `update_fact`.
- **`sync render` types `Name` as `rich_text`**; in Notion it is the title property. The skill had to map it (Codex, or say so in the skill).
- **Project sections:** the Notion MCP's markdown update can't target a toggle block inside a page. When the page holds only the two generated toggles, rewriting the page in toggle markdown works; otherwise the block API is needed. Write this into references/notion.md "Publish".
- **A capture whose top email has no header** (the latest reply pasted without From/Date) falls back to the capture's Created date. Worked as written; worth one line in sources.md.
**Output:** run the user's 5–10 documents through MarkItDown and native Read, compare against the originals, and decide whether Docling or Marker is added. Write the result into the decision from CC-13.

**Acceptance (with the user):** 1 PDF, 1 Word or PowerPoint file, 1 pasted email and 2 Capture Inbox rows ingest end to end in the real brain, with correct sources, drafts and proposals.

### CC-20 · Web pages by URL (decision 0036) · `review` (#72; split out of CC-15 at Codex's review)
**Output:** decision 0036; the `url:` source rule in note.schema.json and spec/schema.md (`kind: document` and `converter` required); brain-ingest sources.md and cli-inputs.md §1b (fetch, payload, title and date); the guide's "ingest this page"; eval case `eval/ingest-text/cases/04-web-page` (synthetic page, fetch simulated).
**Acceptance:** a blind run of case 04 meets expected.md; the existing CLI tests pass against the new schema rule; the skill mirror is rebuilt.
**Follow-up for Codex (0.2.1):** a CLI test that `note new` rejects a `url:` source without `kind: document` or `converter`.

### CC-16 · Skill updates for findings 7 and 12 · `done` (#62)
**Output:**
- `brain-ingest` passes a project per task;
- `brain-sync` creates a missing Brief or Decision log toggle (or asks), as the CC-13 contract says.

### CX-18 · Sources beyond meetings in the CLI · `done` (#59)
**Output:** the CLI side of decision 0032, as spec/cli.md now says:
- `src/lib/paths.ts`: source folder by key (§3.6.5): `notion:` → `sources/notion/`, `file:` → `sources/files/`, `url:` and `agent:` → `sources/text/`;
- `note new` source dedupe also by `file:` key and by `capture` key (§5.5);
- `src/lib/frontmatter.ts`: key order for the new source fields `kind`, `file_name`, `converter`;
- lint `wrong-folder` for sources (§5.10).

The schema (note.schema.json) and examples are already in place from CC-13. **Acceptance:** tests for each bullet; the existing tests still pass.

### CX-19 · Per-task project in `sync tasks` (finding 7) · `done` (#60, #64)
**Output:** spec/cli.md §5.14.5: `sync tasks` items take optional `projects` (project ids; anything else is `INPUT_INVALID` with a pointer to the item); absent or empty falls back to the meeting's projects; an unpublished project goes to the item's `pending_relations`. **Acceptance:** tests for per-item projects, the fallback, an invalid id and an unpublished project.

### CX-20 · View properties test (finding 1) · `done` (#63)
**Output:** a test that every property a view or page layout in docs/notion-space-design.md (§5, §6 and notion/prompts/) sorts, filters, groups or shows exists in §3. **Acceptance:** it fails on a deliberately broken copy and passes on main.

### CX-21 · ~~Missing project sections and Capture Inbox in the CLI~~ · `dropped` (CC-13)
Both are skill-side: the toggles because the CLI can't see Notion page content (0033), the Capture Inbox because the CLI's duplicate check by `capture` key (CX-18) already makes the skill's MCP write safe to retry (0032).

### CC-17 · Notion look pass, Easlo-referenced · `done` (#65, #66; live build 2026-10-14)
**Output:**
- **A grill session with the user** on the Easlo template: what to take, what to leave.
- **The look pass, applied with brain-notion-change.** Notion-only structure (formulas, buttons, dashboards, Notion-only properties) is free to use. At most one brain-visible change, with its own decision; anything more goes to the 0.3.0 list.
- **The 9 template improvements** on branch `claude/notion-page-layouts` (notion/templates.md): each decided in the same session; the branch is merged.
- **Docs:** design doc §4–§6, the prompts and the snapshot updated, plus the view list in `tests/notion-view-properties.test.ts` (CX-20), which is hand-written.

### CC-18 · Notion AI user prompts · `review` (decision 0035)
**Output:**
- **Brain Assistant** (`notion/brain-assistant.md`): a Notion Custom Agent scoped to Brain Data, with Instructions and seven skills: Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture. Replaced the planned copy-paste prompts.
- **A decision:** user prompts only read, or write only to My notes or properties the user owns. Every prompt says "answer only from these pages; do not edit any property".
- **Placement:** the user's Business plan has Custom Agents and Skills; set up live on 2026-10-14.

**Grill outcome (2026-10-14):** keep our Spaces, borrow Easlo's arrangement (blocks with lifecycle tabs, time-first views, related blocks on every parent page, Home led by your own work). New Tasks Space with GTD statuses, Knowledge rebuilt per database, Archive page, Area pages as hubs. No brain-visible change in this pass; decision 0034 (Area on Decisions and Questions) is built in 0.3.0 (CX-22). Docs first in one PR, then the live build.

### CC-19 · User guide and how-to helper · `review`
**Output:**
- **The user guide** ("How your brain works") in `skills/brain-howto/references/guide.md`, so it ships with the skill (`docs/guide.md` points to it), written for the user: each Space, the meeting flow, deciding in Review, which fields you edit and which the brain overwrites, what to say to the agent for each job.
- **Notion:** the guide published as a "How it works" page under System, which Brain Assistant reads for how-to questions.
- **Agents:** a small `brain-howto` skill (Claude Code and Codex) that answers from the guide and checks the brain's live state. It reaches the user's brain with the next npm release, through `brain upgrade`.

**Acceptance:** a blind run answers five how-to questions correctly from the guide alone.

## 0.2.1 — Fixes from the acceptance run

Agreed with the user on 2026-10-15 (grill session, decision 0037): the CC-15 findings plus the small intake fixes. Skills and CLI only, with no Notion schema change. **Ships when** CC-21, CX-23 and CX-25 are merged; then U-09 publishes it.

### CC-21 · Drop folder, report shape and faster publish (decision 0037) · `done` (#75; first real run 2026-10-18)
**Output:** brain-ingest "process my drop folder" (list the files, one question, all selected by default) and the `processed/` and `skipped/` subfolders; the three-line report template in brain-ingest, brain-apply and brain-sync; parallel MCP writes with no read-backs in "Publish"; the user guide's drop-folder row.
**Acceptance:** a blind run on a synthetic drop folder of 3 files ingests the chosen ones, moves them, and leaves the rest at the top level; every report follows the template.

### CX-25 · CLI fixes from the acceptance run (CC-15 findings) · `done` (#77)
**Output:**
- `sync plan` accepts Notion's own timestamps with milliseconds (`2026-10-15T18:11:00.000Z`) and every other timestamp input, truncated to seconds (spec/cli.md, global options, `--now` row).
- `sync render` types each database's title property (`Name`) as `title`, not `rich_text`.
- `sync render` never emits Markdown links in Review text (Before, After, Why are rich-text properties, where Notion shows Markdown literally): every link becomes its text. Links in proposal text are relative to the **target** note's folder (extraction.md), not to `_proposals/` (spec/schema.md, Review row).
- Lint `freshness` doesn't flag "latest" when it means the most recent in a sequence rather than a date (a fixture sentence such as "the latest version of the template").
- The CC-20 follow-up: a test that `note new` rejects a `url:` source without `kind: document` or `converter`.

**Acceptance:** one test per item; the existing tests pass.

### CX-23 · Edit on a link row is a plan conflict (decision 0037) · `done` (#76)
**Output:** `sync plan` returns an Edit on a kind that forbids it (`add_link`, `supersede`, `merge`, `new_item`; spec/cli.md §5.14.2, schema §11.1) as an `EDIT_NOT_ALLOWED` conflict, not a decision. **Acceptance:** a test with an Edited `add_link` row and one other non-editable kind; `apply` is never reached with them.

## 0.2.2 — Fixes from the first drop-folder run

The user's first real "process my drop folder" (2026-10-18, 0.2.1) worked end to end. Three findings:
- **A project created from a document got a bare Notion page.** The agent wrote the project note and created the page through the API, which can't apply the Projects template, so the page had no views and no "My notes". The meeting stop condition already says to create projects in Notion (0021); the document path didn't.
- **The report rule was too tight for big inputs.** The user wants the report to grow with what came in, not to miss key details. The three lines stay at the top.
- **Lint `freshness` false positive** on "latest" again ("the retailer of the latest maintenance").

### CC-23 · Projects created in Notion, reports that scale (decision 0037 amended) · `done` (#78)
**Output:** brain-ingest sources.md pre-check and the SKILL.md stop condition (new projects go through **New project** in Notion, then sync); the report rule in brain-ingest and brain-apply (three lines, then What came in · Check · Action items, uncapped); spec/cli.md §5.14.4 (`PROJECT_NOT_IN_NOTION`); decision 0037 amended.

### CX-26 · Render refuses project creates; "latest" leaves the freshness words · `todo`
**Output:** `sync render` returns a project without `notion` as item error `PROJECT_NOT_IN_NOTION` instead of a `create` (spec/cli.md §5.14.4); lint drops "latest" from the freshness words (the CX-25 sequence patterns go with it). **Acceptance:** a test for each.

## 0.2.3 — Delivery lanes and release gates (decision 0038)

Agreed with the user on 2026-10-18 (grill session). npm becomes the only channel, so Claude Code and Codex run the same skills in a brain; the brain's product files become read-only and findings come back as `dogfood` issues; merges, releases and upgrades get gates that refuse instead of relying on care. **Ships when** CC-24, CC-25, CX-27 and CX-29 are done (CX-28 moved to 0.2.4); then U-12 publishes it with `scripts/release.mjs`.

### CC-24 · Decision 0038, rules, templates and docs · `done` (#80)
**Release:** 0.2.3
**Output:** decision 0038 (0029 and 0037 marked amended); spec/cli.md §3.5 (`UNRELEASED_BUILD`, `BRAIN_DIRTY`), §5.1 and §5.12 (`.claude/skills/`), §5.15 (`brain upgrade` checks, retired plugin, lint, commit and push), §5.10 rule `product-file`, schema §15; the brain AGENTS.md block (product files read-only, findings, push); push after the last commit in brain-ingest, brain-apply and brain-sync; `.github/ISSUE_TEMPLATE/dogfood.md`, `.github/pull_request_template.md`; `CHANGELOG.md`; docs/releasing.md; AGENTS.md multi-agent rules; README and skills/README without the plugin; `.claude-plugin/` removed.
**Acceptance:** Codex's review finds §5.15 and the `product-file` rule complete enough to build CX-29 without inventing behaviour; no remaining reference to installing the plugin outside decisions and reviews.

### CX-27 · Release, merge and task scripts, PR-format and main-guard checks · `done`
**Release:** 0.2.3
**Output:**
- `scripts/release.mjs <version> [--dry-run]`: the gate in docs/releasing.md. It refuses unless it runs in the main worktree (not a linked worktree) on `main`, clean and level with `origin/main`; CI passed on `HEAD` (`gh api …/commits/<sha>/check-runs`, all `success`); `CHANGELOG.md` has `## <version>`; `npm test`, `npm run typecheck`, `npm run test:package` pass; every TASKS.md task with `**Release:** <version>` is `done`. Then: `npm version <version> --no-git-tag-version`, dates the CHANGELOG heading (`## 0.2.3 — YYYY-MM-DD`), commits `<version>`, tags `v<version>`, `npm publish` (`--tag next` for a prerelease), pushes commit and tag. `--dry-run` runs every check and prints what it would do. Each refusal names the failed check; nothing is changed before all checks pass.
- `scripts/task.mjs start <ID>`: refuses if the task is not in TASKS.md or not `todo`; creates `../ub-<ID>` on `claude/<ID>-<slug>` or `codex/<ID>-<slug>` from `origin/main` (the owner from the id prefix, the slug from the task title), runs `npm ci`, sets `core.hooksPath` to `.githooks`, sets the task's status to `in progress` in that worktree, and warns when `~/.config/ultimate-brain/denylist` is missing. `task.mjs done <ID>`: refuses unless the branch is merged into `origin/main`, then removes the worktree and the local branch.
- `scripts/merge.mjs <PR>`: refuses unless CI passed on the PR's head commit, every `- [ ]` box in the body is ticked, the branch and title follow the format below, and GitHub reports it mergeable; then `gh pr merge <PR> --merge --match-head-commit <sha>`. `--dry-run` prints the checks.
- `.githooks/pre-push`: refuses a push whose remote ref is `refs/heads/main`, unless `UB_RELEASE=1` (set only by `release.mjs`).
- A CI job `main-guard` on push to `main`: each new commit must be the merge commit of a merged PR (`gh api repos/{repo}/commits/<sha>/pulls`) or a release commit whose subject is its version and that carries the tag `v<version>`; otherwise the job fails and opens an issue labelled `main-guard` naming the commits.
- A CI job on pull requests that fails unless the branch matches `^(claude|codex)/(CC|CX)-[0-9]+-`, the title starts with the same id followed by `:`, and the PR adds a `CHANGELOG.md` line containing that id.
- `test:package` passes on a version that is already published: today it runs `npm publish --dry-run`, which fails locally with "cannot publish over the previously published versions" right after every release (found while building CC-24; CI passes). Use `npm pack --dry-run`, or have `release.mjs` run it after setting the new version.
- Codex adds `**Release:**` to its own open rows (CX-22, CX-24: 0.3.0).
**Acceptance:** tests run `release.mjs --dry-run`, `merge.mjs --dry-run` (with `gh` stubbed) and `task.mjs` against a temporary repo, one test per refusal; the pre-push hook refuses `main` and allows a task branch; the PR-format job passes on this task's own PR and fails on a test branch named without an id.

### CX-29 · One channel in the CLI: upgrade, init, link, lint · `done` (#83)
**Release:** 0.2.3
**Output:** spec/cli.md §5.15 in full (`UNRELEASED_BUILD`, `BRAIN_DIRTY`, both skill folders, the retired plugin in `.claude/settings.json`, lint counts, commit and push with `PUSH_SKIPPED`, `PUSH_FAILED`, `GIT_COMMIT_SKIPPED`); §5.1 and §5.12 write `.claude/skills/` too; lint rule `product-file` (§5.10).
**Acceptance:** a test per check and per warning in §5.15, including a push to a local bare remote and a failing push; a settings file with other keys kept in order; `product-file` reports each case in §5.10 (a missing skill folder, a missing, changed or extra file, a missing or changed rules block) and is silent on a fresh `brain init`; `--dry-run` lints the planned tree; the commit stages only created, updated and removed paths plus the log; package resolution works from the compiled entry through a symbolic link. Fixture brains linted as whole brains get the product files at test time (copy the fixture, write the shipped files), so fixtures never hold copies of the skills. The existing tests pass.

### CC-25 · Gate fixes: skipped checks, done before merge, CX-28 moved · `done` (#84)
**Release:** 0.2.3
**Output:** `merge.mjs` and `release.mjs` accept check runs that completed as `skipped` or `neutral` (a job that doesn't apply to the event: `main-guard` on a PR, `pr-format` on a push) and still need at least one `success`; until now neither gate could pass. The "done before merge" rule in AGENTS.md, docs/releasing.md and the PR template; the reviewer's verdict line `Review (<agent>): pass`. CX-28 moved to 0.2.4 and CX-30 added, with the user's approval while Codex is out of tokens. Code in `scripts/` is Codex's; written by Claude Code at the user's request.
**Acceptance:** tests for `checksPassed` (skipped and neutral pass; a failure, a running job, only skipped, or no runs fail) and a merge dry run with a skipped job; `npm test` passes.

## 0.2.4 — Leak check and the review gate

Moved out of 0.2.3 on 2026-10-18 so 0.2.3 could ship while Codex was out of tokens.

### CC-27 · Real Notion ids out, review verdict names its commit · `done` (#88)
**Release:** 0.2.4
**Output:** the template, page and view ids in notion/templates.md and the two `*-factual-architecture-appendix.md` files replaced with `<id>` (they came from a live workspace; none were in the npm package). The review order in AGENTS.md, docs/releasing.md, the PR template and a 0038 amendment: the author's done commit first, then the reviewer's `Review (<agent>): pass at <sha>` for the head commit (the contract for CX-30). The 0.3.0 scope agreed on 2026-10-19 recorded below.
**Acceptance:** CX-28's `node scripts/leak-check.mjs` passes on this tree with no allowlist entry for those three files; the denylist matches no tracked file except LICENSE; `npm test` passes.

### CX-28 · Leak check in CI and a pre-commit hook · `done` (#86)
**Release:** 0.2.4
**Output:** `scripts/leak-check.mjs [--staged]` scans tracked files (or the staged diff) for a UUID, dashed or 32 hex characters, outside `tests/`, and for an email address whose domain is not `example` or does not end in `.example`; `scripts/leak-allow.txt` lists exceptions as `path:pattern`. With `--staged` it also reads `~/.config/ultimate-brain/denylist` (one term per line, `#` comments, matched case-insensitively as whole words) when it exists. A CI step runs it on every push; `.githooks/pre-commit` runs it with `--staged`. `LICENSE` (the copyright holder) is allowed for the denylist. A finding prints file, line and the rule, never the denylist term's neighbours beyond the line.
**Acceptance:** tests with a synthetic UUID, a non-example email and a denylist term, each caught; the current tree passes; `sources/` and `node_modules/` are not scanned.

### CX-30 · `merge.mjs` requires the other agent's pass · `done` (#87)
**Release:** 0.2.4
**Output:** `merge.mjs` refuses unless the PR has a review or comment whose body starts with `Review (Claude Code): pass at <sha>` on a `codex/` branch, or `Review (Codex): pass at <sha>` on a `claude/` branch. `<sha>` has at least seven hexadecimal characters and is a prefix of the head SHA, so the verdict covers the exact head commit. Both agents post through one GitHub account, so the line is the only way to tell them apart (decision 0038). A user override: `--reviewed-by-user`, which prints a warning and is noted in the merge commit body.
**Acceptance:** dry-run tests: a pass from the other agent naming the head passes; a pass from the same agent, a pass naming another SHA, and no pass each refuse; the override passes with its warning.

## 0.3.0 — Intake experience

Agreed with the user on 2026-10-19. **Goal:** one "catch up" handles everything that's waiting; every input and everything the brain learns is visible in Notion; routine reviews take one click; the user's Notion space changes once. Decisions 0037 and 0034.

**Order:** CC-22 → Codex reviews the contracts → CX-24, CX-22 and CC-26 in parallel → release 0.3.0 → U-13. Nothing merges before 0.2.4 is released. The Notion space is migrated after the release, not before: 0.2.3 still expects the Capture Inbox.

### CC-22 · Intake contracts (decisions 0037, 0034) · `done` (#90)
**Release:** 0.3.0
**Output:** spec/schema.md and note.schema.json (concepts published; Inbox properties); spec/cli.md (grouped `add_link` proposals and their apply with a Note, `brain.json` `publish: ask | auto` and `push: auto` (0038), Inbox and Concepts in `sync render` and `sync record`, the derived Area on Decisions and Questions); notion-space-design: §3.11 rewritten as Inbox (Kind, Summary, Produced, Project, Area; views Inbox and History), a Concepts section, Knowledge tabs, the Review Note replacing Edited Value, Area on Decisions and Questions with Area page views; the matching Prompts and a Notion migration. The migration sets Kind = Capture on existing rows, copies any Edited Value on a pending Review row into Note before removing the property, and backfills Inbox rows (Processed) for the documents and emails already ingested.
**Acceptance:** Codex's review finds the contracts complete enough to build CX-24 and CX-22 without inventing behaviour.
**Delegated (Codex, review of #90):** the reference list in `tests/notion-view-properties.test.ts` (Codex's file) is updated here, because the new prompts would otherwise fail it; Codex reviewed the change as mechanically correct.

### CC-26 · Intake skills (decision 0037) · `done` (#92)
**Release:** 0.3.0
**Output:** the "catch up" skill (read-only pass, every blocking question in one batch, then apply → Reviewed meetings → New Inbox rows → drop folder → publish → push, one report; blocked items skipped and listed); brain-apply (Notes, grouped rows, Check skips notes with nothing to publish); brain-ingest (Inbox rows, Project or Area taken from the capture, owner tasks from non-meeting sources in extraction.md and sources.md); the owner's names and work emails asked once and stored as aliases (at setup, and once by catch-up in an existing brain); dogfood finding 3 (connect your agent to Notion, per agent; brain-connect-notion stops with the exact fix); the user guide.
**Acceptance:** a blind catch-up run on a synthetic brain asks once, then finishes; the skills match the CC-22 contracts.

### CX-24 · Intake in the CLI (decision 0037) · `done` (#94)
**Release:** 0.3.0
**Output:** per the CC-22 contracts (spec/cli.md, spec/schema.md, the three JSON schemas): `proposal new` groups `add_link` items into one proposal with `links` (§5.6); `apply` with `note` and `exclude` (§5.7); `sync plan` reads Review **Note** (Edit value, `NOTE_TO_READ`) and the `concepts` snapshot database (§5.14.2); `sync render` and `sync record` for Concepts and the Inbox (sources), including the capture update and the first-run backfill (§5.14.4, §5.14.6); `sync tasks --source` (§5.14.5); `status` with `inbox`, `concepts` and `settings` (§5.2); `upgrade` renames `capture_inbox` (§5.15); lint knows the new source fields. **Acceptance:** tests per the contract, including a grouped proposal's title, an `exclude` that applies all but one link, a Note on Approve as `NOTE_TO_READ`, a capture rendered as `update` from its key, a document rendered as `create` with its produced relations, and the upgrade rename.

### CX-22 · Area on Decisions and Questions (decision 0034) · `done` (#93)
**Release:** 0.3.0
**Output:** the sync fills a brain-owned Area relation on Decisions and Questions from their projects' areas (spec/cli.md, CC-22). **Acceptance:** tests for one area, several projects in different areas, and a project with no area.

## 0.4.0 — queued

Moved out of 0.3.0 on 2026-10-19: the onboarding suite (docs/v2-ideas.md: the `brain-onboard` interview, converter check, drop folder asked up front) and Notion file uploads. Planned after U-13.
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
| U-06 | Put 5–10 real documents in one folder for the bake-off: a long PDF with tables, a deck, a Word file, a scan if you have one | Before CC-15 |
| U-07 | Connect the Easlo template to the Notion integration (read-only use) | Before CC-17 |
| U-08 | Publish 0.2.0 (`npm version minor`, `npm publish`, push tags; docs/releasing.md) | Now: agreed 2026-10-15 to release before CC-15, so the acceptance run uses the released version |
| U-09 | Publish 0.2.1 (`npm version patch`, `npm publish`, push tags; docs/releasing.md), then `brain upgrade` in your brain | When CC-21, CX-23 and CX-25 are merged |
| U-10 | Publish 0.2.2 the same way, then `brain upgrade` in your brain | When CC-23 and CX-26 are merged |
| U-11 | Setup for 0.2.3: from CX-27 on, merge only with `node scripts/merge.mjs <PR>`. GitHub Pro is deferred (decision 0038). Done by Claude on 2026-10-18: the `dogfood` label and the denylist. `/plugin update` found no match in the brain, so its Claude Code keeps the 2026-10-12 skills until 0.2.3 or a manual copy | Now |
| U-12 | Publish 0.2.3 with `node scripts/release.mjs 0.2.3` from the main checkout, then `brain upgrade` in your brain, then `npm deprecate ultimate-brain@0.2.2 "Superseded. Install the latest version."` (0.2.2 still has a real name in a skill example) | When CC-24, CC-25, CX-27 and CX-29 are done |
| U-13 | 0.3.0 in your brain, one session with Claude: migrate your Notion space with brain-notion-change (your yes at each step), `brain upgrade`, then one real "catch up" as the acceptance run | After 0.3.0 is released |
| U-14 | Publish 0.2.4 with `node scripts/release.mjs 0.2.4` from the main checkout, then `brain upgrade` in your brain | When CC-27, CX-28 and CX-30 are merged |

## How to start Codex on a task

Paste into Codex:

```text
Read AGENTS.md, then build/TASKS.md. Work on task CX-27 only.
Run `node scripts/task.mjs start CX-27` from the main checkout and work only in ../ub-CX-27
(until CX-27 exists: git worktree add -b codex/CX-27-<slug> ../ub-CX-27 origin/main, then npm ci).
Implement it to its acceptance criteria, add its CHANGELOG line, run the tests, then set the
status to "review", open the PR with the template, and summarize any spec questions.
```

For 0.2.0, Codex can start CX-20 now; CX-18 and CX-19 wait for CC-13.
