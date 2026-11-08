# Build history

Done waves and releases, v1 to 0.10.0, moved out of [TASKS.md](TASKS.md) by CC-94 (to 0.8.0), CC-141 (0.8.1 to 0.9.2) and CC-150 (0.10.0) so a session reads only open work. Rows keep their ids, status and `**Changelog:**` lines; the scripts read both files. Add nothing here by hand except when a release's rows are moved.

---

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
| 3 | No setup steps to give the agent access to Notion (MCP or integration token) and to share Brain Data with it, for Claude Code and Codex | Checklist section "Connect your agent to Notion" per agent; `brain-connect-notion` stops with the exact fix when Notion is unreachable. Check the current Notion MCP steps first | `fixed` (#92, CC-26) |
| 4 | Ingest on an empty brain did not run or request `brain-sync` first, so Areas, Projects and People were unknown | `brain-ingest` step 1: if the brain has no notes and Notion is configured, run `brain-sync` first (or tell the user) | `fixed` (#51) |
| 5 | A meeting with no project: the skill asked instead of linking the meeting to its area only | Document in `brain-ingest`: project is optional; link area only; never invent a project; offer to create one in Notion and sync | `fixed` (#51) |
| 6 | Notion AI meeting notes use their own headings, not the minutes format | `extraction.md`: extract from any heading structure; the format is a hint, not a requirement. Say so in `notion/minutes-format.md` | `fixed` (#51) |
| 7 | A meeting that discusses several projects: the skill does not say project is per item | `extraction.md`: assign `projects` per decision, question and task from what each is about; a meeting may list several; ask only when an item is ambiguous | `fixed` (#51 decisions and questions; #60 CLI, CC-16 skill for tasks) |
| 8 | Attendee, date and name-spelling problems in the minutes are found only by the ingest | Before ingest, `brain-ingest` reports missing Date and attendee names, and spelling variants of one name, in one question | `fixed` (#51) |
| 9 | Sync create recorded the brain's Summary (the title) and Lifecycle as published although Notion had them empty, so render never sent them; Lifecycle compared "Draft" with "draft", so a Lifecycle edit in Notion became a conflict | Baseline = what Notion shows, as §5.14.2 says; Lifecycle compared normalized; emptied Lifecycle → `REQUIRED_EMPTY` (`src/lib/sync.ts`, test in `tests/sync.test.ts`). Repair the first brain: drop `Summary` and `Lifecycle` from `notion_published` on its 2 notes | `fixed` (this PR); repair not needed: later syncs, the 0.3.0 catch-up among them, ran without the conflict (CC-32) |
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

### CC-15 · Converter bake-off and real acceptance run · `done` (#72, #73; bake-off in decision 0032; acceptance run done 2026-10-15; fixes go to 0.2.1)
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

### CC-20 · Web pages by URL (decision 0036) · `done` (#72; split out of CC-15 at Codex's review)
**Output:** decision 0036; the `url:` source rule in note.schema.json and spec/schema.md (`kind: document` and `converter` required); brain-ingest sources.md and cli-inputs.md §1b (fetch, payload, title and date); the guide's "ingest this page"; eval case `eval/ingest-text/cases/04-web-page` (synthetic page, fetch simulated).
**Acceptance:** a blind run of case 04 meets expected.md; the existing CLI tests pass against the new schema rule; the skill mirror is rebuilt.
**Follow-up for Codex (CX-35, 0.3.1):** a CLI test that `note new` rejects a `url:` source without `kind: document` or `converter`.

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

### CC-18 · Notion AI user prompts · `done` (#67, #68; decision 0035)
**Output:**
- **Brain Assistant** (`notion/brain-assistant.md`): a Notion Custom Agent scoped to Brain Data, with Instructions and seven skills: Today, Review queue, Check minutes, Prep, Weekly review, Plan check, Tidy capture. Replaced the planned copy-paste prompts.
- **A decision:** user prompts only read, or write only to My notes or properties the user owns. Every prompt says "answer only from these pages; do not edit any property".
- **Placement:** the user's Business plan has Custom Agents and Skills; set up live on 2026-10-14.

**Grill outcome (2026-10-14):** keep our Spaces, borrow Easlo's arrangement (blocks with lifecycle tabs, time-first views, related blocks on every parent page, Home led by your own work). New Tasks Space with GTD statuses, Knowledge rebuilt per database, Archive page, Area pages as hubs. No brain-visible change in this pass; decision 0034 (Area on Decisions and Questions) is built in 0.3.0 (CX-22). Docs first in one PR, then the live build.

### CC-19 · User guide and how-to helper · `done` (#67; blind run 5/5 in eval/howto/RESULTS.md)
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

### CX-26 · Render refuses project creates; "latest" leaves the freshness words · `done` (#79)
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

### CX-31 · Push annotated release tags · `done` (#91)
**Release:** 0.3.0
**Output:** `release.mjs` creates each release tag as annotated (`git tag -a v<version> -m <version>`), so its existing `git push --follow-tags` publishes the tag with the release commit.
**Acceptance:** a release-script test proves the annotated tag reaches the remote through `--follow-tags`.

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

## 0.3.1 — Gate fixes from the 0.3.0 retro

Agreed with the user on 2026-10-19, after a retro on the 0.2.4 release and the 0.3.0 build. Measured: 9 of the 11 merges of `main` into a task branch since 2026-10-15 conflicted on CHANGELOG.md (2 also on build/TASKS.md), and 5 of them dropped 8 task lines from CHANGELOG.md (none reached `main`; each was found by hand); 4 of 91 merged PRs only set a task to `done`; #93 was merged outside `merge.mjs` and `main-guard` passed it; `merge.mjs` refused 3 times on GitHub's transient `UNKNOWN` merge state. Merges after the 0.3.0 release.

### CC-28 · Record the retro's tasks · `done` (#95)
**Release:** 0.3.1
**Output:** this section, CX-32, and CC-29 and CX-33 under 0.4.0.
**Acceptance:** Codex's review finds CX-32 specified well enough to build without inventing behaviour.

### CC-32 · Loose ends before the gate fixes · `done` (#100)
**Release:** 0.3.1
**Output:** agreed with the user on 2026-10-20, before CX-32:
- Statuses that lagged behind their merges: CC-15 (#72, #73), CC-18 (#67, #68), CC-19 (#67, blind run in eval/howto) and CC-20 (#72) set to `done`; CX-26 (#79) is left to Codex (CX-35); dogfood finding 3 `fixed` (#92); finding 9's repair not needed.
- The guide names the Inbox views as migration 0005 and notion/views-guide.md do ("What's in my inbox?", "What came in?"). After the release, with the user's yes, the "How it works" page in Notion is republished from it.
- spec/cli.md §3.1: `--version` (built in CX-35).
- The status banner.
- Dogfood #101: migration 0005 makes "create Concepts" a Notion AI step with its prompt, run first; the migrations README says a migration never asks the agent to create a database.
- Dogfood #102: the brain template maps Tasks `source` to "Source" like the other default names (spec/schema.md example too); migration 0005 §4 tells default-Tasks users to set it; brain-connect-notion clears it when the default database has no such relation.
**Acceptance:** `grep -n "History" skills/brain-howto/references/guide.md` finds no view name; the skill mirror check passes; Codex's review finds CX-35 buildable without a spec question; `jq .notion.tasks.properties.source templates/brain/brain.json` prints `"Source"`; migration 0005 §3 marks no database creation as an agent step.

### CX-35 · `--version` and the `url:` source test · `done` (#103; Claude Code while Codex is out; the user's choice, 2026-10-20)
**Release:** 0.3.1
**Output:** `brain --version` per spec/cli.md §3.1 and §3.3 (text: the version alone; `--json`: the success envelope with `command` "version", `brain` null and `data.version`; no brain needed); CX-26 set to `done` (#79), which shipped in 0.2.2; the CC-20 follow-up: a test that `note new` rejects a `url:` source without `kind: document` or without `converter`.
**Acceptance:** tests: `brain --version` prints `package.json`'s version and exits 0 outside any brain; `brain --version --json` prints the §3.3 envelope with `command: "version"`, `brain: null`, `data.version` and `warnings: []`; `brain status --version` also prints it; `note new` with a `url:` source lacking `kind: document`, and one lacking `converter`, each fail validation.

### CX-32 · Gate scripts: lost lines, done before merge, merges outside the gate · `done` (#104; Claude Code while Codex is out; the user's choice, 2026-10-20)
**Release:** 0.3.1
**Note:** CX-34 ships the `done` suffix check and task-row lost-heading guard; CX-32 retains its 0.3.1 CHANGELOG, mergeability, main-guard and skills-hook items.
**Output:**
- `pr-format.mjs` fails when a task id that has a line in the base branch's CHANGELOG.md (`- XX-N`) has none on the PR head, or a task heading in the base branch's build/TASKS.md (`### XX-N ·`) is missing on the head, naming each id. A reworded line or a changed status passes; only a lost id fails.
- `merge.mjs` refuses unless the PR head's build/TASKS.md shows the title's task as `` `done` (#N) `` and its CHANGELOG.md line starts `- <id> (#N)`, where N is the PR number; the refusal says what to commit. `--reviewed-by-user` does not skip this check.
- `merge.mjs`, while GitHub reports `mergeable` as `UNKNOWN`, asks again every 2 s for up to 20 s; it refuses on `CONFLICTING`, or on `UNKNOWN` after the wait with "GitHub has not computed mergeability; retry".
- `main-guard.mjs` also fails a PR merge on `main` that has neither the other agent's `Review (<agent>): pass at <sha>` naming the merged head (the same rule as `merge.mjs`, decision 0038) nor the user-override note `merge.mjs` writes into the merge commit body.
- `npm run skills` runs `scripts/build-skills.ts` and then `tests/skills.test.ts`; `.githooks/pre-commit` runs `node scripts/build-skills.ts --check` when the staged files include `skills/`.

**Acceptance:** tests: a head that drops another task's CHANGELOG line fails `pr-format` and one that adds `(#N)` to it passes; `merge.mjs --dry-run` refuses a task in `review` and passes `done (#N)`; `UNKNOWN` then `MERGEABLE` passes and `UNKNOWN` throughout refuses after the wait; `main-guard` fails a merge with no pass and passes one with the pass or the override note; a commit that stages a skill edit without the rebuilt mirror is refused.

### CC-33 · Decision 0040: web merges and the merge-ready check · `done` (#107)
**Release:** 0.3.1
**Output:** decision 0040 (agreed with the user on 2026-10-20, after `main-guard` failed on the web merges of #104 and #105 and blocked the 0.3.1 release): the user merges on the GitHub PR page; a `merge-ready` status replaces `merge.mjs` as the gate; `main-guard` checks only that each commit came from a PR. 0038 amended; AGENTS.md and docs/releasing.md say so; CX-36 below.
**Acceptance:** the user approves 0040; `grep -rn "merge.mjs" AGENTS.md docs/releasing.md` finds no line that makes it required; CX-36 is buildable without a spec question.

### CX-36 · merge-ready status and a main-guard without the review check (decision 0040) · `done` (#108; Claude Code while Codex is out; the user's choice, 2026-10-20)
**Release:** 0.3.1
**Output:**
- `scripts/common.mjs`: `readinessProblems(repo, pr, details)` returns the problems `merge.mjs` checks besides CI and mergeability: branch `(claude|codex)/<ID>-…`, title starting with the task id, no unticked box (`- [ ]`) in the body, the task row on the head `done` with the PR's number (`donePrNumbers`), and the other agent's pass naming the head (`hasOtherAgentPass`). `merge.mjs` uses it; `--reviewed-by-user` still skips only the pass.
- `scripts/merge-ready.mjs <PR>`: reads the PR, runs `readinessProblems`, and sets the commit status `merge-ready` on the head commit (`gh api repos/<repo>/statuses/<sha>`): `success` with "Ready to merge", or `failure` with the problems joined by "; ", cut to 140 characters. It exits 0 either way, so the status is the only signal; it exits 1 only when it can't read the PR or set the status.
- `.github/workflows/merge-ready.yml`: runs `merge-ready.mjs` on `pull_request` (opened, edited, synchronize, reopened), `pull_request_review` (submitted, edited, dismissed) and `issue_comment` (created, edited, only when the issue is a PR), with `statuses: write`, `pull-requests: read`, `contents: read`.
- `scripts/main-guard.mjs`: drops the merged-PR review check from CX-32; a commit that is neither from a merged PR nor a tagged release commit still fails and opens a `main-guard` issue.
**Acceptance:** tests: `merge-ready` sets `success` for a `done (#N)` PR with ticked boxes and a fresh other-agent pass, and `failure` naming each problem for a task in `review`, an unticked box and a missing pass (each with exit 0); `merge.mjs --dry-run` keeps its current results; `main-guard` passes a merged PR with no review and fails a commit from no PR.

## 0.3.2 — Tasks Status type

Found in U-13 (2026-10-20), issue #113. Ships before 0.4.0, on its own.

### CC-40 · `sync tasks` writes the Status property type the Tasks database uses (#113) (was CX-39) · `done` (#117)
**Release:** 0.3.2
**Output:** per spec/schema.md §12 and spec/cli.md §5.14.5 (settled in CC-38): `notion.tasks.status_type` (`status` | `select`, absent = `select`, today's behaviour, so an existing mapping to a select property keeps working) in config validation; `brain sync tasks` types the Status value by it: `{ "type": "select", "value": "To Do" }` when absent or `select`, `{ "type": "status", … }` when `status`. brain.schema.json carries the field; templates/brain/brain.json sets `status` explicitly for the default Tasks database, and brain-connect-notion records it for every mapping. A brain made before 0.3.2 with the default Tasks database sets it once (U-16). Its CHANGELOG.md line is written by hand (a 0.3.x task).
**Acceptance:** tests: no `status_type` and `status_type: "select"` both give a Status item of type `select` (existing `sync tasks` tests pass unchanged); `status_type: "status"` gives type `status`; `status_type: "text"` fails `brain-config` lint and `sync tasks` with `BRAIN_CONFIG_INVALID`; `brain init` writes a `brain.json` with `status_type: "status"`.

## 0.4.0 — released 2026-10-21

Moved out of 0.3.0 on 2026-10-19: the onboarding suite (docs/v2-ideas.md: the `brain-onboard` interview, converter check, drop folder asked up front) and Notion file uploads. The feature theme is chosen by the user after 0.3.1 (see the status banner).

### CC-29 · Decision: changelog lines in task rows (decision 0039) · `done` (#96)
**Release:** 0.4.0
**Changelog:** decision 0039: a task's changelog line lives in its build/TASKS.md row and `release.mjs` writes the CHANGELOG section.
**Output:** decision 0039, agreed with the user on 2026-10-19 (task-row field chosen over fragment files and a union merge driver; build/TASKS.md left as it is, with the reason); CX-34 and CC-30 below. Amends 0038.
**Acceptance:** the user approves the decision; it names the changes `pr-format.mjs`, `merge.mjs` and `release.mjs` need, so CX-34 needs no spec question.

### CX-34 · Changelog from task rows (decision 0039) · `done` (#99)
**Release:** 0.4.0
**Changelog:** `release.mjs` writes each release's CHANGELOG section from the task rows; PRs no longer edit CHANGELOG.md.
**Output:** per decision 0039: `taskEntries` also reads the optional `**Changelog:**` line after `**Release:**`; `release.mjs <version>` skips the version's `dropped` tasks before every check (all versions); for 0.4.0 and later it refuses, naming each task, one with no `**Changelog:**` line or an empty or whitespace-only one, and a done heading whose suffix isn't `(#N)` or `(#N, #M, …)`, each optionally with `; <note>` before the `)` (decision 0039 gives the grammar); it writes `## <version> — <date>` with `- <id> (#N): <text>` or `- <id> (#N, #M): <text>` per task in TASKS.md order (every number, note left out), replaces a hand-written `## <version> — unreleased` section, and commits it in the release commit; `pr-format.mjs` checks the PR's own row has a non-empty `**Changelog:**` line instead of a CHANGELOG.md addition, and its lost-heading guard also fails on a `**Changelog:**` line lost from the base; `merge.mjs` drops CX-32's CHANGELOG.md `(#N)` check and keeps the `` `done` (#N) `` one. Versions before 0.4.0 keep today's behaviour.
**Acceptance:** tests: `release.mjs 0.4.0 --dry-run` on a fixture TASKS.md prints the generated section with two tasks in order, one naming `(#60, #64)`, and a `(#58; note)` heading generating `(#58)`; a `dropped` task with no `**Changelog:**` line left out without refusing; refusals for a task with no `**Changelog:**` line, one with `**Changelog:**   `, a bare `` `done` `` and a `(PR #12)` suffix; a 0.3.x version needs its hand-written section as today; `pr-format` passes a PR that edits only its own row and fails one with an empty field; `merge.mjs --dry-run` passes `done (#N)` with no CHANGELOG.md change.

### CC-30 · Docs for changelog lines in task rows (decision 0039) · `done` (#105)
**Release:** 0.4.0
**Changelog:** AGENTS.md, the PR template and the release guide describe the `**Changelog:**` field.
**Output:** AGENTS.md ("Every task has", "PRs follow the template"), `.github/pull_request_template.md` (the CHANGELOG boxes) and docs/releasing.md say: a task carries `**Changelog:**` in its row; the done commit sets `` `done` (#N) ``; `release.mjs` writes the CHANGELOG section. Merges right after CX-34, so the docs never describe a gate that isn't there.
**Acceptance:** no file outside CHANGELOG.md's history tells an agent to edit CHANGELOG.md for a 0.4.0 or later task (`grep -rn CHANGELOG AGENTS.md docs .github`).

### CC-34 · Handoff after 0.3.1 · `done` (#110)
**Release:** 0.4.0
**Changelog:** the status banner after the 0.3.1 release: decision 0040 merging, the open 0.4.0 theme choice.
**Output:** the status banner and the 0.4.0 intro say 0.3.1 is out, how merging works now, and what the user decides next.
**Acceptance:** the banner names no open 0.3.1 work and states the 0.4.0 choice.

### CC-41 · Blind-run brain setup script (was CX-33) · `done` (#120)
**Release:** 0.4.0
**Changelog:** a script builds a blind-run brain from a fixture, with its Notion ids blanked and its first commit made.
**Output:** `scripts/blind-brain.mjs <fixture> <dir>` copies a fixture brain from `tests/fixtures/`, blanks its Notion ids in `brain.json`, runs `git init` and commits, so a skill's blind run starts from one command. A dev script; not in the npm package.
**Acceptance:** a test builds a brain from `brain-acme` that `brain status --json` reads with `ok: true` and no Notion ids.

### CC-31 · OKF and GBrain parked for v2 · `done` (#98)
**Release:** 0.4.0
**Changelog:** OKF and GBrain reviewed and parked for v2 (reviews/06): a retrieval index over Markdown, and OKF export, then maybe alignment.
**Output:** reviews/06-okf-and-gbrain.md (OKF vs our schema, three adoption levels, standard-or-not evidence, GBrain fit); docs/v2-ideas.md "Retrieval index over Markdown" (replaces "Long-term memory provider") and "OKF: export, then maybe alignment", each with revisit triggers; the docs/vision.md summary line. Docs only; no spec or decision change.
**Acceptance:** Codex's review finds the OKF mapping in reviews/06 §2 consistent with spec/schema.md and SPEC v0.2, and no binding decision changed.

### CC-35 · 0.4.0 plan: decisions 0041 and 0042 and their tasks · `done` (#111)
**Release:** 0.4.0
**Changelog:** the 0.4.0 plan: the brain gives back (reviewed notes, answered questions, Briefs) and takes in linked repos and Notion attachments (decisions 0041, 0042).
**Output:** agreed with the user in a grill on 2026-10-20, after a look at the first brain's use (every note still `draft`, 23 of 24 proposals approved, no question ever asked of the brain). Theme: payback before a second user. Decision 0041 (a Review notes row per ingest, the backlog's rows once, Answer rows, Briefs from reviewed notes only, area Briefs; amends 0005 and 0026) and decision 0042 (linked repos as read-only sources, the product repo as the pilot area; files attached to Inbox rows and meetings). Tasks CC-36, CX-37, CX-38, CC-37 and U-15. Out of 0.4.0: the onboarding suite (no second user yet); the agency brain moves in after 0.4.0. Habit bar for the two weeks after the release: every real meeting ingested within 2 working days, and at least one question a week answered better by Notion or the brain than by memory, logged as a capture.
**Acceptance:** the user approves both decisions; each task below names its decisions and its acceptance; Codex's review finds CX-37 and CX-38 scoped so that CC-36 can answer every spec question before they start.

### CC-38 · U-13 findings: decision 0043 and the 0.4.0 tasks · `done` (#114)
**Release:** 0.4.0
**Changelog:** decision 0043: Inbox rows show a digest or the full text, reports on request land in the Inbox, one Review row per source, a 5-minute catch-up, and the user's minutes format.
**Output:** decision 0043, agreed with the user in a grill on 2026-10-21 after U-13's two catch-ups (amends 0026 and 0041, refines 0024 and 0037); its work folded into CC-36, CX-37 and CC-37 below, and into U-15; CX-39 under 0.3.2 for #113; docs/v2-ideas.md "Owners on Tasks"; U-13 closed with notion/templates.md pulled again after migration 0005 (Areas' two new views, the Inbox "Capture" template).
**Acceptance:** the user approves decision 0043; each of CC-36, CX-37 and CC-37 names what 0043 adds to it and its acceptance; Codex's review finds CX-37's 0043 part and CX-39 scoped so that a spec question, if any, can be answered before they start. **Spec settled here (from Codex's review of #114):** `status_type` (absent = `select`) in spec/schema.md §12, spec/cli.md §5.14.5, brain.schema.json, the template brain.json (`status`) and brain-connect-notion; the full-text fields, part ranges and write-once rule in CC-36.

### CC-39 · Claude Code builds, Codex reviews (decision 0044) · `done` (#116)
**Release:** 0.4.0
**Changelog:** decision 0044: Claude Code builds every task, the CLI included, and Codex reviews every PR.
**Output:** decision 0044, at the user's request on 2026-10-21 after CC-36 (#115); AGENTS.md (current phase, multi-agent rules, layout owners); this file: the owners line, the status note, and the open Codex tasks renumbered as CC-40, CC-41, CC-42 and CC-43, each title saying which id it was; references to them in open rows follow. Done rows keep their ids.
CC-35 set to `done` (#111), its merged state. **Acceptance:** the user approves decision 0044; `node scripts/task.mjs start CC-40` would create `claude/CC-40-…` (the id gives the prefix); no open row names a CX id except as "was CX-n"; `npm test` passes.

### CC-36 · Contracts for 0.4.0 (decisions 0041–0043) · `done` (#115)
**Release:** 0.4.0
**Changelog:** contracts for 0.4.0: the `review_notes` and `answer` proposals, Briefs from reviewed notes and for areas, linked repos and Notion attachments as sources.
**Output:** spec/schema.md: §8 (an applied `review_notes` sets `reviewed` or `archived`), §11 and §11.1–11.2 (`review_notes` with `notes`, `answer` with `answer` and `answer_note`, their apply rules, `EDIT_NOT_ALLOWED`, notes no longer `draft` skipped and reported), §16.1 (reviewed-only items, answered questions left out, the "Nothing reviewed yet" line), a new §16.3 `area_brief`, the source fields `repo`, `repo_path`, `commit`, `attached_to` and the `verbatim` converter, §12 `repos` in `brain.json`, §7 and §14 (question Status written only from an approved `answer`); spec/schemas; spec/cli.md (the backlog rows command, the repo commands that list changed files and record the ingested commit, `sync render` for `area_brief` and for a source with `attached_to`); Notion migration 0006 (Review Kinds "Review notes" and "Answer", run through the API; no step by hand); notion design §5 and the views guide. **From 0043:** `sync render` for the Inbox row bodies the brain writes (the digest, the "Full text" toggle, a Report row's body and its link from the Ask row), the full-text choice as source system fields (see below), the Full text checkbox read by `sync plan`, link and alias items in `review_notes` with their apply rules; notion/minutes-format.md in the new section order; migration 0006 also adds the Inbox Kinds Ask and Report, the Full text checkbox, the "What came in?" and "What do we know?" views on the Projects and Areas templates, the Brain feed on Home and the muted line on Review rows; notion design §3.11 and §5 follow.
- **Full text, settled here so the contract doesn't invent it:** two source system fields, `notion_text` (`digest` | `full`; absent = `digest`) and `notion_parts` (a list of 1-based inclusive ranges as strings, `"3-9"` or `"12"`; absent = all). Parts count **slides** when the body has the converter's slide markers (`<!-- Slide number: N -->`), else the body's **sections**: the headings at the highest level present, numbered in order (text before the first heading is always kept). `note new` writes them at ingest; a new command `brain source full-text <src-id> [--parts <ranges>]` sets `notion_text: full` later. `--parts` is one comma-separated list (`--parts 2,4-5`); without `--parts` the command sets all parts (it removes `notion_parts`, replacing an earlier partial choice); each run also sets `notion_text_requested` to the current time. An overlapping, reversed or out-of-range part, or `--parts` with an empty item, fails with `INPUT_INVALID`. `notion_text`, `notion_parts` and `notion_text_requested` join the source fields that change after creation (§7).
- **Written once:** `sync record` stores what it published as the `@full_text` key of `notion_published` (the `notion_text`, `notion_parts` and `notion_text_requested` it rendered; spec/cli.md §5.14.4). For a brain-created Inbox row, `sync render` emits the Full text body only when `notion_text` or `notion_parts` differs from `@full_text`, and sets the row's Full text checkbox to false whenever `notion_text_requested` differs from it, with or without a body. So a box ticked again on a row already in full is cleared with no body written. The digest is emitted once, before the first record.
**Acceptance:** Codex's review finds CX-37 and CX-38 buildable from the contracts with no spec question; a schema example for each new proposal kind and source field validates, including a `review_notes` with a link and an alias item and a source with the full-text choice; migration 0006 gives every Notion change as an agent step through the API, except only these, which it marks by hand or Notion AI because the API can't do them: the linked views of the Projects and Areas templates and of the Home Brain feed (Notion AI prompts), dragging the Review gray line above the tabs when the tabs block is the first in its column, and the optional paste of the minutes format into the user's own meeting-notes prompt. (Amended in #115 with the user: the API can't create linked views.)

### CC-42 · Review notes, answers, Briefs and Inbox bodies in the CLI (decisions 0041, 0043) (was CX-37) · `done` (#118)
**Release:** 0.4.0
**Changelog:** the CLI applies Review notes and Answer rows, writes the backlog's rows once, builds Briefs from reviewed notes, for areas too, writes each source's digest and, when asked, its full text to the Inbox, and stores reports.
**Output:** per CC-36: `review_notes` and `answer` in proposal validation, `brain apply` (approve, approve with `exclude`, reject, edit refused on `review_notes`, a note no longer `draft` skipped) and `sync plan` (Review Kinds); the backlog command (one `review_notes` per source over its `draft` notes; a second run writes nothing); `brain views` (reviewed-only Brief sections, the waiting line, `area_brief`); `sync render` (area Briefs, an approved answer's Status = Answered). **From 0043:** link and alias items in `review_notes` (approve applies them, an excluded or rejected item is closed); `sync render` writes the digest and, when chosen, the Full text body once for a brain-created Inbox row, never a body for a capture or an Ask row, and a Report row with its link from the Ask row; `sync plan` reports a ticked Full text box (row and source id); `brain source full-text` and the `notion_text`, `notion_parts`, `notion_text_requested` fields and the `@full_text` record per CC-36, with rendering of only the requested parts; `brain report new` (spec/cli.md §5.18), which the Report row needs and no other task held.
**Acceptance:** tests on the fixture brain: approving a 3-note row with one excluded leaves 2 `reviewed` and 1 `draft`; rejecting archives the `draft` ones with no successor; an edit on `review_notes` gives `EDIT_NOT_ALLOWED`; the backlog command on a brain with 2 sources writes 2 rows, then 0 on a second run; an approved `answer` sets the question's `answer` and renders Status = Answered; a Brief lists a `reviewed` decision, leaves out a `draft` one and prints the waiting line; an area Brief renders; a `review_notes` row with 2 notes, 1 link and 1 alias, approved with the alias excluded, leaves 2 notes `reviewed`, the link applied and the alias closed; a document source renders a digest body and no Full text toggle, an email source renders both, a second render writes neither again, and a capture renders no body; a 12-slide deck source with `notion_parts: ["3-9"]` renders slides 3 to 9 only, in order, under a line "Slides 3–9 of 12", and a 5-section document with `["2", "4-5"]` renders sections 2, 4 and 5; `"9-3"`, `"2-4", "3-5"` and `"13"` on the deck fail with `INPUT_INVALID`; a document source rendered and recorded as `digest`, then `brain source full-text` on it, renders its Full text body once with Full text = false, and after `sync record` a third render emits no body; `brain source full-text` run again on that recorded source (a re-tick) renders a checkbox-only item (Full text = false, no body), and after its record nothing; on the deck, `--parts 3-9` then `full-text` without `--parts` renders all 12 slides; `--parts 2,4-5` stores `["2", "4-5"]`, and `--parts 2,,4` fails with `INPUT_INVALID`; `brain lint` passes on every result; `note new` with an `email` and a `document` source and no `notion_text` writes `full` and `digest`, and the render gives the email a Full text body and the document only its digest.

### CC-43 · Linked repos and attachments in the CLI (decision 0042) (was CX-38) · `done` (#119)
**Release:** 0.4.0
**Changelog:** the CLI reads linked repos (changed files since the last ingested commit) and takes files attached in Notion as sources under their Inbox row or meeting.
**Output:** per CC-36: `repos` in `brain.json` and `brain status`; the repo commands (add a repo with its area and patterns; list added and modified files matching the patterns since the recorded commit, deleted files apart; record the ingested commit), refusing a path that is the brain itself; source validation for `repo`, `repo_path`, `commit`, `attached_to` and `verbatim`; `sync render` gives an attached source no Inbox row of its own and links its notes to the parent's row or meeting. The `attached_to` check in `note new` and the attachment rendering were built in CC-42 (#118), in answer to its review; this task tests them with the rest.
**Acceptance:** tests with a temporary Git repo: two commits after the recorded one list the right files (a non-matching file and a deleted one left out, the deleted one reported); recording the commit makes the next listing empty; a source with `attached_to` renders no Inbox row and its decision's Sources relation points at the parent row; the brain itself as a repo path is refused.

### CC-37 · Skills for 0.4.0 (decisions 0041–0043) · `done` (#121)
**Release:** 0.4.0
**Changelog:** catch-up writes Review notes and Answer rows, writes the backlog's rows on the first run, reads linked repos and Notion attachments, and the guide explains Briefs and reviewing notes.
**Output:** brain-ingest (the Review notes row after each ingest; Answer rows from open questions; attachments: download, convert, `attached_to`; repo files as documents), brain-apply (the two new Kinds, "all except" on Review notes), brain-catch-up (the backlog's rows once; changed repo files and attachments in the read-only pass and the one batch, more than 10 repo files asked; publish order with area Briefs), brain-sync (area Brief toggle appended when missing), brain-notion-change (migration 0006), the user guide and brain-howto. **From 0043:** brain-ingest (the digest and full-text choice per input, extraction for the new minutes sections with Projects used when the property is empty, link and alias items in the Review notes row, the pronoun rule, a repeated capture named and linked and "duplicate" kept for `DUPLICATE_SOURCE`); brain-catch-up (each input analysed in its own sub-agent, Notion written in one batch, Ask rows and ticked Full text boxes in the read-only pass and the batch, a ticked box fulfilled with `brain source full-text`, then render, publish and record, the batch line saying what each choice puts in Notion); brain-query (the report mode: in chat or from an Ask row, the six sections, drafts marked *(not reviewed)*, never ingested); brain-sync (project sections through the block API only).
**Acceptance:** a blind catch-up on a synthetic brain built with CC-41 writes one Review notes row per ingest, with its links and aliases inside it, and one Answer row for a question the input answers, asks once, then finishes; a blind run with a synthetic linked repo ingests only the files changed since the recorded commit; a blind report run on a synthetic project writes a report with the six sections, its timeline oldest first and each draft marked; the skills match the CC-36 contracts; the skill mirror check passes. **Checked in U-15 instead** (they need a real Notion space; the user's choice, 2026-10-21): a catch-up over two meetings and one capture from "go" to the report in under 5 minutes without a context summary; a ticked Full text box gets the text and the box cleared, the next catch-up writes nothing for that row, and a box ticked again is cleared with no second body; an Ask row gets a Report row, linked from it, and becomes Processed.
## 0.4.1 — U-15 quick fixes (decision 0045)

The small part of the U-15 feedback, ahead of 0.5.0. U-15's two-week habit run continues on 0.4.0 meanwhile.

### CC-44 · U-15 feedback: decision 0045 and the 0.4.1 and 0.5.0 tasks · `done` (#123)
**Release:** 0.4.1
**Changelog:** decision 0045 records the first brain's feedback: 0.4.1 starts questions as Open, adds `/Clean email`, says what approving does and clears finished Review rows; the rest is planned for 0.5.0.
**Output:** decision 0045, agreed with the user in a grill on 2026-10-22 after the first days of U-15 (amends 0003, 0026, 0041 and 0043; refines 0007, 0032 and 0035); tasks CC-45 and CC-46 for 0.4.1, CC-47 to CC-50 for 0.5.0, U-17 and U-18; U-15's note; docs/v2-ideas.md "Area homes" (0.6.0, before the agency brain moves in), "Hermes as an always-on brain operator" and the search index's new revisit trigger; the status banner.
**Acceptance:** the user approves decision 0045; each task below names its part of 0045 and its acceptance; Codex's review finds CC-45 and CC-48 scoped so that their contracts can be written without a new question to the user.

### CC-51 · Stacked task branches (decision 0046) · `done` (#124)
**Release:** 0.4.1
**Changelog:** decision 0046: a task can start from the branch of the task below it, and Codex reviews a stack of PRs in one session.
**Output:** decision 0046, at the user's request on 2026-10-22 (amends 0038 and 0044); `scripts/task.mjs start <id> --from <branch>` reads the row from that branch on `origin` and creates the worktree from it, with no upstream; `readinessProblems` reports a PR whose base isn't `main`, so `merge-ready` stays red until the PR below is merged and this one retargeted; AGENTS.md (one branch per task, Review).
**Acceptance:** the user approves decision 0046; tests: `task start CC-2 --from <branch>` creates the worktree from that branch with CC-2 `in progress`, CC-2 unknown without `--from`, a missing branch refused, `--from` refused on `done`; `merge-ready` on a PR whose base is another task's branch sets failure naming that base; `npm test` passes.

### CC-45 · Open questions and leaving Review rows in the CLI (decision 0045) · `done` (#125)
**Release:** 0.4.1
**Changelog:** new questions and risks reach Notion as Open, and Review rows leave Notion 30 days after they were decided.
**Output:** spec first, in the same PR: spec/cli.md §5.14.4 and spec/schema.md §7 and §14 (question Status: Open in the create properties; Open once on a published question with no Status in its snapshot and no `answer`; Answered once after an approved `answer`, as today); `sync render` emits a trash item for each published Review row whose proposal is `applied` or `closed` with `decision.decided_at` (or, for a stale close, its `updated`) more than 30 days before the run, and `sync record` stores `@trashed` in its `notion_published`, so the row is never rendered again (the `notion` id stays, so `--changed` doesn't create the row again); the code and tests.
**Acceptance:** tests on the fixture brain: a new question renders Status = Open; a published question with no Status in the snapshot and no `answer` renders Open once and, after `sync record`, nothing; one with Status = Done in the snapshot renders no Status; an approved `answer` still renders Answered; an applied proposal decided 31 days ago renders a trash item, one decided 29 days ago and a pending one render none, and after `sync record` the trashed one renders nothing; `brain lint` passes on every result.

### CC-46 · Clean email, the promise line and the Home count (decision 0045) · `done` (#126)
**Release:** 0.4.1
**Changelog:** a `/Clean email` prompt for pasted threads, a Review that says what approving does, a Home count of what waits for you, and catch-ups that trash finished Review rows.
**Output:** notion/brain-assistant.md: the skill `/Clean email` (clean, never summarize: signatures, disclaimers, quoted copies, "Sent from" lines and tracking links out; one header per message, oldest first; text word for word; an optional "Why I saved this" line; rewrites the page only after the user confirms) and the same text as a plain prompt for plans without Custom Agents; the Instructions' list of skills that may edit text; Notion migration 0007 (the promise line at the top of Review and in the Decision property's description, shown on every row on hover; Home's pending Review rows grouped by Kind with counts, each Review notes row's Target Page opening its meeting or Inbox row); brain-catch-up and brain-sync (CC-45's trash items through MCP, after the publish); the user guide and brain-howto ("How do I paste an email?", "What does approving do?").
**Acceptance:** a blind run of the `/Clean email` text on a synthetic three-message thread with signatures, a disclaimer and quoted copies keeps each message's text word for word, oldest first, with its header, and drops the rest; migration 0007 gives every Notion change as an agent step through the API, or marks it by hand with the reason; the skill mirror check passes.

## Clean email from U-17 (decision 0047; released with 0.5.0)

### CC-52 · Clean email keeps names and bodies only (decision 0047) · `done` (#129, #130)
**Release:** 0.5.0
**Changelog:** `/Clean email` rewrites the page directly (asking only on a serious doubt) and gives each message, newest first, a heading with names and date, its own text below it and a divider before the next: no addresses, Subject, Cc, banners or Teams, Zoom and Meet blocks.
**Output:** decision 0047 (amends 0045, from the user's U-17 feedback on 2026-10-23); notion/brain-assistant.md (the Clean email text); Notion migration 0008 (the new text in Brain Assistant Skills and How it works), with 0.5.0's migration renumbered 0009; brain-ingest reading the new message lines as an email; the user guide; eval/clean-email (the thread with addresses, Cc, a banner and a Teams block; the blind runs).
**Acceptance:** the user approves decision 0047; a blind run of the Clean email text on the synthetic thread gives one heading 3 `<sender> → <recipients> · <date>` per message, newest first, with names only and nothing guessed, the body in normal paragraphs below it and a divider between messages, keeps every sentence the senders wrote (the one about the call included), and removes the Teams block, the banner, the Cc, the Subject and the addresses, replacing the page without asking; on a thread whose two copies of a message disagree on a figure it changes nothing and asks one question; migration 0008 marks each step agent or by hand with the reason; the skill mirror check passes.

## 0.5.0 — Review in one row, fix before ingest, living reports, kept notes (decision 0045)

The rest of decision 0045. The agency brain moves in at 0.6.0, after area homes (docs/v2-ideas.md).

### CC-47 · Contracts for 0.5.0 (decision 0045) · `done` (#127, #128)
**Release:** 0.5.0
**Changelog:** contracts for 0.5.0: one Review row per source with Fix, the Ready gate and re-reads, living reports, and `reference` notes from a document's Keep.
**Output:** spec/schema.md: §11 and §11.1–11.2 (`update_fact` and `add_to_note` items in `review_notes`, fact changes first; `exclude` defers an item to a new pending proposal; one stale item closed alone; `fix` replacing `edit`, on every kind, with the user's text recorded and the corrected values the skill derives); a new type `reference` (fields, folder, Notion mapping, how a new source version proposes changes to it); source versions (a re-read source links the one it replaces; how "only what changed" is computed); §16.4 living reports (rewritten in place, `as_of`, Refresh, What to fix → proposals); spec/cli.md (`review_notes` input and apply for the new items, `DUPLICATE_SOURCE` allowing a declared re-read, `report` refresh, Keep and What to fix read back, the Inbox Ready gate and the capture's 1-day rule as a skill rule in the workflows (§6; `sync plan` doesn't filter Inbox rows), the new Review property names); Notion migration 0009 (Review properties About, Now, Proposed, Your call, What to fix; Inbox Status Ready, Keep, Refresh, What to fix; the Ask row's Refresh relation; a References database; the Reports tab on Projects and Areas; the meeting template's "check, fix, then Reviewed" line); notion design and the views guide.
**Acceptance:** Codex's review finds CC-48 buildable from the contracts with no spec question; a schema example validates for a `review_notes` with fact, text, note and link items, a deferred item, a `fix` decision, a `reference` note and a re-read source; migration 0009 gives each Notion change as an agent step, or marks it by hand with the reason.

### CC-48 · One Review row, re-reads, living reports and references in the CLI (decision 0045) · `done` (#133)
**Release:** 0.5.0
**Changelog:** the CLI folds fact and text changes into one Review row per source, defers excluded items, applies Fix, re-reads a corrected source, refreshes reports and writes `reference` notes.
**Output:** per CC-47 (spec/cli.md §5.5–5.7, §5.14, §5.18–5.19; spec/schema.md §4, §11.3, §16.4): `proposal new` folds `update_fact`, `update_body` and `add_to_note` into the source's `review_notes` as `changes`, with the new title rule; `brain apply` (`fix` with `fixes` on every kind, `edit` still read; excluded items deferred into one new pending `review_notes` with `deferred_from`; a stale change dropped alone, the rest applied; `FIX_UNKNOWN`); `note new` and the source checks for `replaces` and `keep`; `brain source diff`; `brain report new` with `refresh` in its input, rewriting a report in place, and `brain report fix`; the `reference` type in validation, `index`, `status`, `views`, the `references` database and `sync render`; `sync plan` reading Your call and What to fix (Edit read as Fix), `FIX_TO_READ`, `FIX_WITHOUT_TEXT`, `refresh_requests` and `report_fixes`; `sync render` with the new Review property names, lettered Proposed and `@fixes`; the code and tests.
**Acceptance:** tests on the fixture brain: one ingest with a new decision, a link, an `update_fact` and an `add_to_note` writes one `review_notes` with the fact item first; approving "all except" the fact applies the rest and leaves the fact as a new pending proposal; a Fix with a corrected value applies the corrected value; a fact changed since the row was written closes only that item, as stale; a re-read of a changed meeting is accepted as a new version linked to the old one, and an unchanged one is refused; a refreshed report keeps its id and Notion row and gets a new `as_of`; a `reference` note validates, renders and is listed under its project; a Report row with What to fix becomes a `report fix` and Refresh is cleared after the refresh; the 0.4 title tests are updated to the new title rule; `brain lint` passes on every result.

### CC-49 · Skills for 0.5.0 (decision 0045) · `done` (#135)
**Release:** 0.5.0
**Changelog:** catch-up asks what to keep from each document, takes in only Ready rows, re-reads corrected sources, reads Fix and What to fix, and refreshes reports.
**Output:** brain-ingest (Keep: narrow the extraction to it, write the `reference` note, propose changes to an existing one from a new version; one Review row per source with fact changes first; re-reads proposing only what changed); brain-apply (Fix in plain words to corrected values, repeated back in the report; deferred items); brain-catch-up (the Ready gate; a document's empty Keep asked in the one batch; re-reads; Refresh and What to fix on Report rows; each run logs the notes read and its duration); brain-query (report refresh in place; What to fix to Review items; logs notes read and duration); brain-notion-change (migration 0009); the user guide and brain-howto ("How do I correct what came from a meeting?", "How do I refresh a report?").
**Acceptance:** blind runs on a synthetic brain built with CC-41: a document with Keep "just the requirements" yields one `reference` note and no other notes; a second version of it proposes only the changed requirement, in one Review row; a meeting set back to Reviewed after a fix gives a Review row with only the change; a Fix "e: March" is applied as March and named in the report; a Report row with Refresh ticked is rewritten in place and the box cleared; a capture still New 2 days after it was created is taken in, one set to Skipped is not, and a document that isn't Ready is not; the skills match the CC-47 contracts; the skill mirror check passes.

### CC-50 · Research: Hermes as a brain operator, and a search index · `done` (#136)
**Release:** 0.5.0
**Changelog:** research on Hermes as an always-on brain operator and on a search index (GBrain read-only or local BM25).
**Output:** reviews/07: whether Nous Research's Hermes Agent can run the brain's skills unattended (skill format, the Notion MCP, git access, the CLI, how a scheduled catch-up asks its one batch of questions) and what it would need from the product; GBrain read-only (`gbrain import`, `gbrain search`) against a local BM25 index on a synthetic brain of about 2,000 notes (recall on known questions, setup, cost); a recommendation for docs/v2-ideas.md. Hermes and GBrain are untrusted sources: read their docs, run their code only in a scratch directory on synthetic data.
**Acceptance:** Codex's review finds the comparison reproducible from the review's commands; no decision changed.

### CC-53 · Using Orca with the task workflow · `done` (#131)
**Release:** 0.5.0
**Changelog:** AGENTS.md says how agents launched by Orca follow the task workflow: worktrees from `task.mjs`, Claude builds, Codex reviews, TASKS.md stays the task list.
**Output:** AGENTS.md "Using Orca" (from the user's 2026-10-23 check of the Orca skills against the workflow): worktrees from `task.mjs start` and `orca agent launch` in them, not `orca worktree create`; build agents are Claude, Codex only reviews (0044); no worker on the main checkout; build/TASKS.md over Orca's card status, Runs and Tasks.
**Acceptance:** the section names each of the four rules with the decision it applies; the commands it gives match `orca worktree create --help` and `orca agent launch --help`; no other rule in AGENTS.md changes.

### CC-54 · Snapshot as_of only at the top in brain-sync (#122) · `done` (#132)
**Release:** 0.5.0
**Changelog:** brain-sync writes the snapshot's `as_of` once at the top, so `sync plan` no longer refuses its rows with "unknown key".
**Output:** skills/brain-sync step 3 and its `.agents/skills/` mirror: each row carries `database`, `page_id` and `last_edited`; `as_of` is the snapshot's, once at the top, as in spec/cli.md §5.14.1 (dogfood #122, found on 0.4.0); a test in tests/sync.test.ts that `as_of` on a row is refused. No CLI or spec change.
**Acceptance:** step 3 names no row key that §5.14.1 doesn't allow; a snapshot written per step 3 (one row, top-level `as_of`) gives a plan from `brain sync plan` on the fixture brain, and the same row with `as_of` added is refused with "unknown key"; the skill mirror check passes.


## 0.6.0 — Modules, simpler rows, Documents and area homes (decisions 0048–0050)

U-18's findings (2026-10-28): less to learn for a second user, with nothing taken away. One Notion migration, 0010.

### CC-55 · 0.6.0 plan: decisions 0048 to 0050 and their tasks · `done` (#138)
**Release:** 0.6.0
**Changelog:** decisions 0048 (modules, three Inbox states, three kinds of Review row, buttons and page layouts), 0049 (Documents: keep a file as a page, promote a note) and 0050 (area homes) plan 0.6.0.
**Output:** decisions 0048, 0049 and 0050, agreed with the user in a grill on 2026-10-28 after U-18 (0048 amends 0043 and 0045, refines 0037 and 0041; 0049 amends 0043 and 0045); tasks CC-56 to CC-59 and U-19; U-18 closed with its findings; dogfood #137 triaged into CC-59; docs/v2-ideas.md "Area homes" closed by 0050, and the two CLI loose ends noted; the status banner.
**Acceptance:** the user approves decisions 0048, 0049 and 0050; each task below names its part of them and its acceptance; Codex's review finds CC-56 scoped so that its contracts can be written without a new question to the user.

### CC-56 · Contracts for 0.6.0 (decisions 0048–0050) · `done` (#139)
**Release:** 0.6.0
**Changelog:** contracts for 0.6.0: modules, the New → Ready → Done Inbox, three kinds of Review row, buttons and layouts, Documents kept whole or in part, promoted notes, and area homes.
**Output:** spec/schema.md: the `modules` block in `brain.json` (names, defaults, what a module off means for each database); the `reference` type shown as Document (a whole-text Document from a source with no proposal; a narrowed one as a `review_notes` item; a promoted one seeded from a decision or concept, owned by the user, linked both ways, never rewritten); `only_keep` replacing `keep`, an empty value meaning the whole input; Brain Status New, Ready, Done (Processed and Skipped read as Done); the Review row's area. spec/cli.md: `brain modules` (list, on, off; JSON output; what each switch writes); `sync plan` reading Keep as document, Promote and Refresh and leaving out the databases of modules that are off; `sync render` writing Kind only when empty, Done for Processed and Skipped, clearing the action checkboxes, the Review row's area; the removal of Full text requests and the Refresh report relation (rows that still carry them are read without error). docs/notion-space-design.md: the module table, each database's properties (Keep as document, Only keep, Promote, the buttons), the page-layout rule with the pinned properties per database, Documents, the Areas template tabs and the Home counts, with the tabs and counts left out per module, and the Review row's Area relation and rule (0050). Find out and write down whether the Notion API can create a button property and read a page layout; where it can't, the migration step is by hand.
**Found (2026-10-28):** the Notion API's property schema reference says button properties are response-only: schema writes ignore them, and the API exposes no button actions; it has no endpoint for page layouts. Buttons and layouts are by-hand steps (design §3.15).
**Acceptance:** Codex's review finds CC-57 buildable from the contracts with no spec question; schema examples validate for a `brain.json` with modules, a whole-text Document, a narrowed one inside a `review_notes`, and a promoted one; the design gives every button its checkbox and every database its pinned properties.

### CC-57 · Modules, the simpler Inbox, Documents and area homes in the CLI (decisions 0048–0050) · `done` (#140)
**Release:** 0.6.0
**Changelog:** the CLI switches modules, takes in Ready rows only, writes Documents whole or in part and promoted ones, keeps a Kind the user chose, and gives Review rows an area.
**Output:** per CC-56 (spec/cli.md §5.2, §5.5, §5.6, §5.14, §5.15, §5.17, §5.20; spec/schema.md §4, §12–§15): `brain modules`; `brain upgrade` renaming `references` to `documents` and writing the `modules` block; `source full-text` failing with `RETIRED`; the `## Documents` index heading; the prefixed Review Name; `MODULE_OFF`, `ALREADY_KEPT`, `RETIRED`; `document_requests` and `promote_requests` in `sync plan`; the template brain's `brain.json` with the onboarding defaults; `brain.json` validation and `brain status` with modules; `sync plan` and `sync render` per module, with the action checkboxes and their clearing, Brain Status Done, Kind written only when empty (U-18: a Document row became Capture), Review rows' area; `note new` for a whole-text Document with no proposal and a promoted one; `apply` for a narrowed Document item; `brain lint` for the promoted Document's ownership; the code and tests.
**Acceptance:** tests on the fixture brain: with Planning off, `sync plan` reads no Goals or Key Results and `sync render` writes none; switching a module off and on again loses no note; an Inbox row with Keep as document ticked and Only keep empty gives a Document with the source's whole text and no proposal, and the box is cleared on publish; with Only keep set it gives a `review_notes` item; Promote on a decision gives a Document linked both ways, and a later publish never rewrites its body; a row whose Kind the user set keeps it after publish; a Review row from a project's meeting carries the project's area; Processed and Skipped rows read as Done; `brain lint` passes on every result.

### CC-58 · Skills for 0.6.0, with the U-18 fixes (decisions 0048–0050) · `done` (#141)
**Release:** 0.6.0
**Changelog:** the skills turn modules on and off on request, keep documents whole or in part, promote notes, and fix U-18's findings: no placeholder writes, a full pull, re-read corrections that replace the old wording.
**Output:** a skill (or brain-connect-notion mode) that lists and switches modules when the user asks ("turn on documents", "turn planning off"), running a module's Notion steps with the user when it is turned on, and the onboarding checklist in brain-connect-notion; brain-catch-up and brain-ingest (only Ready rows; Keep as document and Only keep; the drop folder's "keep as document? no / all / only …"; "also keep the budget from …"; Promote; steps skipped for modules that are off); brain-sync (the action checkboxes; the databases per module). The U-18 fixes: never write a placeholder to Notion, a body is written whole in one call; the pull reads every configured database, References/Documents, Goals and Key Results included; a re-read whose diff corrects a statement proposes to replace it, not to add the new wording next to the old one; the exact snapshot row shape for Review rows in brain-sync, and no `sed` edits of proposal files. The user guide and brain-howto (modules, the three Inbox states, the three kinds of Review row, buttons, Documents).
**Acceptance:** blind runs on a synthetic brain built with CC-41: "turn planning off" switches it and the next catch-up reads no Goals; an Inbox row with an attached file and Keep as document gives a whole-text Document and no Review item for it; Only keep "just the requirements" gives one narrowed Document in the source's Review row; Promote on a concept gives a linked Document; a meeting re-read whose fixed minutes change "launch in February" to "launch in March" proposes to replace the statement; a catch-up's Notion writes contain no placeholder text; a Fix "a: …" is repeated back in the report; the skills match the CC-56 contracts; the skill mirror check passes.

### CC-59 · Notion design, build prompts and migration 0010 (decisions 0048–0050; #137) · `done` (#142)
**Release:** 0.6.0
**Changelog:** Notion migration 0010 renames References to Documents, adds the buttons and page layouts, simplifies Brain Status, and turns Area pages into area homes; migration 0009's text is corrected.
**Output:** notion/modules/<module>.md for each optional module (its Notion steps when it is turned on: Notion AI prompts for its databases, its buttons and layouts by hand, its views, then `config set`); notion/prompts (the build creates only the chosen modules; Documents; the buttons and layouts; the Areas template tabs; Home's per-area counts); notion/migrations/0010: References → Documents (id, relations and views kept), Keep → Only keep, Kind Document → File, Brain Status Processed → Done and Skipped retired (rows moved to Done), the Document asked and Promote asked checkboxes, Refresh renamed to Refresh asked, and the three buttons (Keep as document, Refresh, Promote to document), Refresh report and Full text left unused for the user to delete, the page layout of each database as by-hand steps listed property by property, the Areas template and Home (0050), Brain Assistant and How it works; each step marked agent, Notion AI or by hand with the reason. Dogfood #137, in migration 0009 and its sources: the Reports view sorted by Created (Inbox has no Last edited time), References' Created time and Last edited time "Owner: system. Do not edit.", the Review queue step marked by hand (Brain Assistant Skills is outside the integration's reach), About's description set to "Owner: brain.". The views guide.
**Acceptance:** migration 0010 names every change with who does it, and every layout change database by database; its Verify list covers each; a new space built from the prompts with only Core and Knowledge has no Documents, Tasks, Goals or Key Results database; #137's four points are fixed in 0009, and none recurs in 0010.


## 0.6.1 — Skills for current models

### CC-60 · Plan 0.6.1 to 0.8.0: decisions 0051 and 0052 and their tasks · `done` (#147)
**Release:** 0.6.1
**Changelog:** decisions 0051 (unattended catch-up and schedules) and 0052 (reflection) plan 0.7.0 and 0.8.0, from a review of two third-party vault skills.
**Output:** reviews/08 (two third-party vault skills, an unattended "operator" and an audit with a "reflection" pass, read against the product; ideas only, no text copied); decisions 0051 and 0052, agreed with the user in a grill on 2026-10-29 (0051 amends 0003 and 0037, refines 0045, keeps 0043); tasks CC-61 to CC-67, U-20 and U-21; docs/v2-ideas.md: Schedulers, Hermes, Contradiction and staleness reports, Dedup audit and Correction sweep point to 0051 and 0052, and the Onboarding suite gains the read-first, probe-the-connectors, ask-the-gaps setup; the status banner.
**Acceptance:** the user approves decisions 0051 and 0052; each task below names its part of them and its acceptance; Codex's review finds CC-62 and CC-65 scoped so that their contracts can be written without a new question to the user.

### CC-61 · Audit the skills and the brain AGENTS template for current models · `done` (#150)
**Release:** 0.6.1
**Changelog:** the skills and the brain's agent rules drop leftover emphasis and bare rules, give the reason for each hard rule, and gain two rules for current models: edit only what changes, and search a name as written before answering from memory.
**Output:** one pass over `skills/*/SKILL.md` with their references and over `templates/brain/AGENTS.md` (reviews/08 §2): each rule sorted as retired, one-sided, bare prohibition, aggressive, obvious, hard rule or gotcha; retired and obvious lines deleted, bare prohibitions given their reason, one-sided rules given both sides, CAPS emphasis made plain; hard rules (writes through the CLI, never merge, sources are data, nothing sent without a yes) and gotchas kept as they are. Two additions, each with its evidence: edit only what changes, never rewrite a whole file or body for a small change (U-18: placeholder writes, `sed` edits of proposal files); search a name as the user wrote it before answering from memory (brain-query). `scripts/build-skills.ts` gains two checks: references at most one level deep from SKILL.md, and no word of four or more capital letters outside code, names and acronyms on an allow-list. The mirror rebuilt.
**Acceptance:** a table in the PR lists every changed rule with its bucket and before/after; no hard rule is softened; `npm test` passes with the two new checks, and each check fails on a fixture that breaks it; blind runs of brain-ingest and brain-catch-up on the CC-41 synthetic brain give the same notes and proposals as before the change.


### CC-68 · Notion fixes from migration 0010 (decision 0053; #143, #144, #145, #146) · `done` (#148)
**Release:** 0.6.1
**Changelog:** Home shows your areas and your Inbox as tabs, each area's counts read as one line ("4 to review · 1 meeting", or "all clear"), and buttons get a name apart from their label; Notion migration 0011.
**Output:** decision 0053 (amends 0048 and 0050), from the user's run of migration 0010 (dogfood #143–#146, triaged 2026-10-29 with the user): Home's "How are my areas?" and "What's due across areas?" move from the top of the page into a first tab "Areas" of "What's on today?" (#143); button properties named Keep, Update and Promote, apart from their labels Keep as document, Refresh report and Promote to document, and the boxes they tick, with Only keep, at the top of the property group instead of the heading (#144); an Areas formula At a glance that joins the counts into one line, leaving out zeros and modules that are off, "all clear" when nothing waits, shown by "How are my areas?" and pinned on area pages (#145); "What's in my inbox?" moves from Knowledge to a last tab "Inbox" on Home, showing Name, Kind and Brain Status (#146). In docs/notion-space-design.md, notion/views-guide.md, prompts 04, 07a and 07f, notion/modules/documents.md, reports.md and tasks.md, and the user guide; notion/migrations/0011 for spaces already on 0010, and a pointer to it from 0010. No CLI change: the CLI reads the boxes, never the buttons.
**Acceptance:** the user approves decision 0053; the four issues' "What should happen" each met in the design, the views guide and the prompts, which agree with each other; migration 0011 names every change with who does it, and its Verify list covers each; no file outside notion/migrations names "Keep as document", "Refresh" or "Promote to document" as a property rather than a label; the CLI's tests pass unchanged; the skill mirror check passes.

## 0.7.0 — The brain runs itself (decision 0051)

Catch-up on a schedule, with no one there: a budget per run, nothing written when nothing waits, a Report row (with Reports on) only when the user is needed. Building doesn't wait for U-19: the user runs the acceptance tasks (U-19 to U-22) at the end (2026-10-29).

### CC-62 · Contracts for unattended catch-up and schedules (decision 0051) · `done` (#151)
**Release:** 0.7.0
**Changelog:** contracts for unattended catch-up: the input budget, the no-op rule, the Report row, and `brain schedule`.
**Output:** spec/schema.md: `settings.unattended.max_inputs` (default 10) in `brain.json`. spec/cli.md: `brain schedule install | list | remove` (the job, catch-up or reflect; the times; the prompt and model it runs; the launchd agent on macOS, the printed cron line elsewhere; JSON output; errors); the log line an unattended run writes, with inputs done and left over, from which the backlog warning reads the last three runs; §6's catch-up sequence in unattended mode: which batch questions take their default and which skip their input (0051), which decided rows it applies (Approve, Reject, Edit with a value, corrections) and which wait (a Fix or an Approve with a What to fix to read: `FIX_TO_READ`, `NOTE_TO_READ`) and the flags that give that (`--record-only` or not, and any CLI change it needs, then part of CC-63), publish only with `settings.publish: auto`, the no-op rule, the Report row's text and when it is written (Reports on only), and the summary of unattended runs that opens the next attended catch-up, read from the log.
**Acceptance:** Codex's review finds CC-63 and CC-64 buildable from the contracts with no spec question; every question in brain-catch-up's batch is listed as default or skip; every kind of decided Review row and correction is listed as applied or waiting.

### CC-63 · `brain schedule` and the unattended settings in the CLI (decision 0051) · `done` (#152)
**Release:** 0.7.0
**Changelog:** `brain schedule` installs, lists and removes a scheduled catch-up or reflection, and `brain.json` takes an input budget for unattended runs.
**Output:** per CC-62 (spec/cli.md §3.9, §5.2, §5.14.2, §5.21, §6.1; spec/schema.md §12): `settings.unattended.max_inputs` validated (the JSON Schema and its examples come with CC-62) and shown by `brain status`, with its `unattended` summary of the runs since the last attended catch-up and the `backlog` flag; `NOT_A_REPORT` for a Report row with no Brain ID in `sync plan`; `--skip-conflicted` on `sync apply` and `sync render` (`ROW_CONFLICTED`; on render also `FIX_WAITING` for a report with a `report_fixes` item, tested with a failed publish followed by a new What to fix); `brain schedule install | list | remove` writing and removing a launchd agent in `~/Library/LaunchAgents/` (a path given by an environment variable in tests) and printing a cron line elsewhere; the unattended log line; the code and tests.
**Acceptance:** tests: `install` writes a plist that runs `claude -p` in the brain folder at the given times with the pinned model, and a second `install` for the same job replaces it; `list` shows it; `remove` deletes it and a second `remove` is a no-op; on a non-macOS platform `install` prints the cron line and writes nothing; a `max_inputs` of 0 or a non-integer is refused by `brain.json` validation; `brain lint` passes on the fixture brain.

### CC-64 · Unattended catch-up in the skills (decision 0051) · `done` (#153)
**Release:** 0.7.0
**Changelog:** "catch up unattended" runs a catch-up with no questions, on a schedule or by hand, and "run catch-up every morning" sets the schedule.
**Output:** brain-catch-up: the unattended mode per CC-62 (blockers skip their input, defaults taken, explicit decisions applied and What to fix left for an attended run, the budget oldest first, the backlog warning, publish only with `auto`, the no-op rule, the Report row with Reports on, the opening summary of unattended runs); a "Run on a schedule" section that writes the settings, offers Reports once when it is off, and runs `brain schedule install`, with the lines for Hermes (reviews/07) as an alternative; brain-ingest references/sources.md: a linked repo of more than 10 files is taken unattended within the budget (spec/cli.md §6.1); brain-howto and the user guide.
**Acceptance:** blind runs on a synthetic brain built with CC-41: with three meetings, one carrying a pre-check blocker, an unattended run ingests two, lists the third under Needs you and writes one Report row with Reports on and none with Reports off, and the next attended catch-up opens with the summary of that run; with nothing waiting (found by the read-only pass, which reads Notion) it writes no commit, no Notion write and no log line, in a brain with Notion not configured and in a connected, empty workspace; with 12 inputs and the default budget it takes the 10 oldest and names 2 left; a Review row set to Approve is applied and a Fix with text waits, named in the report; a correction in Notion is applied, and a change the brain can't take is named under Check; a Promote request on a page with a conflict makes no Document, and a report with a What to fix waiting is not refreshed; with Reports off and `publish: auto` no Report row is written; with `publish: ask` nothing is published; the skill mirror check passes.


## 0.7.1 — Neutral spec examples and release-gate fixes (decision 0056)

A small patch before the larger 0.8.0: the process fixes land first. The Brain Assistant buttons (decision 0054) moved to 0.8.0.

### CC-83 · Neutral examples in the spec ahead of making the repo public · `done` (#154)
**Release:** 0.7.1
**Changelog:** the spec's examples use a neutral owner name and paths instead of the author's.
**Output:** spec/cli.md and spec/schema.md: the example owner name becomes the fixture's "Alex", and the example home-folder paths become `/Users/alex/…` (the `brain init` example and output, the `brain status` example, the `brain.json` example, the `brain schedule` cron line and plist path). The LICENSE's copyright line stays. The audit behind it (full history, every PR, issue and comment, 2026-10-31) found no secrets and no personal identifiers beyond those examples, the author's commit email on every commit, and two old history lines with a local path; history is not rewritten (the user's decision on 2026-10-31).
**Acceptance:** a case-insensitive search of the tracked files (not `node_modules`, not the lockfile) for the author's first name and for the local username finds only the LICENSE's copyright line (the PR body gives the command, so this row doesn't repeat the strings); `npm test` passes (the spec examples still validate); the leak check passes.

### CC-84 · The release gate counts only the CI workflow's checks · `done` (#157)
**Release:** 0.7.1
**Changelog:** the release gate looks only at the CI workflow's checks, so an unrelated failing check no longer blocks a release.
**Output:** scripts/release.mjs and `ciWorkflowPassed` in scripts/common.mjs: the gate read every check run on HEAD, and `merge-ready` runs on PR comments attach to main's HEAD, so a red one blocked a release. It now asks the Actions API for the workflow runs of HEAD and requires the newest `push` run named `CI` **on the `main` branch** to be completed and successful (a run for a tag or another branch at the same SHA skips `main-guard`, which runs only for `refs/heads/main`, so it must not stand in for main's run: on the 0.7.0 commit a newer green `CI` run for tag `v0.7.0` sat above a failed one for `main`); docs/releasing.md says so. `merge.mjs` keeps `checksPassed` (it reads a PR head's own checks).
**Acceptance:** `ciWorkflowPassed` tests: a green CI push run passes even next to a failed `merge-ready` run; a failed or running CI run blocks; a newer green `CI` push run for a tag or another branch above a failed `main` run blocks (regression); a `merge-ready` run alone, or no run, blocks; `npm test` passes.

### CC-85 · merge-ready accepts the Codex pass only from the owner's account · `done` (#158)
**Release:** 0.7.1
**Changelog:** the merge-ready status accepts "Review (Codex): pass at <sha>" only from the repo owner's account.
**Output:** `hasOtherAgentPass` in scripts/common.mjs (used by merge-ready and merge): the `Review (<agent>): pass at <sha>` text counts only when the review or comment's `user.login` is the repo owner's (both agents post through that account); docs/releasing.md says so. Evidence it holds today: Codex's pass on PR #154 and Claude Code's passes on PRs #91, #94 and #99 were all posted by the owner's account (`superuser-pal`, association OWNER). This is an operational assumption: if an agent ever posts through its own account, the gate must be changed by a new task, not worked around.
**Acceptance:** a pass posted by another account, or by no recorded user, leaves merge and merge-ready refusing; the owner's pass at the current head is accepted; a pass naming an older head is still refused; `npm test` passes.

## 0.8.0 — Buttons, Domains, selection and Review (decisions 0054, 0055, 0056)

Optional Domains around PARA; Won't Do closes work without claiming completion; voice captures and subject-based minutes expose what will enter the brain; Review shows editable, attributable changes with independent decisions. Builds the buttons' exact accepted-wording mechanism (CC-72) first within this release (decision 0056), and the Review flow (CC-79) reuses it. Decision 0055 records the agreed behavior; contracts and Notion feasibility come before implementation.

### CC-69 · Plan the buttons: decision 0054 and its tasks · `done` (#149)
**Release:** 0.8.0
**Changelog:** decision 0054 plans buttons that run Brain Assistant in Notion (Tidy capture, Write up, Refresh report), with only accepted wording coming back to the brain.
**Output:** decision 0054, accepted by the user in a grill with Codex on 2026-10-29 and handed to Claude Code to record (amends 0035, 0049, 0043 and 0045; refines 0048, 0053 and 0051; keeps 0003, 0015 and 0052); tasks CC-70 to CC-73 and U-22; docs/vision.md's runner line; docs/v2-ideas.md "Notion-triggered runs"; the status banner. U-19 and CC-61 unchanged.
**Acceptance:** each task below names its part of 0054 and its acceptance; 0054's Evidence separates what official docs verify, what is inferred and what the user confirmed; Codex's review finds CC-70 scoped so that its contracts can be written without a new question to the user.

### CC-86 · Plan the buttons' move into 0.8.0 (decision 0056) · `done` (#156)
**Release:** 0.8.0
**Changelog:** decision 0056 builds the Brain Assistant buttons in 0.8.0 with Domains and editable Review; 0.7.1 becomes a small patch.
**Output:** decision 0056, accepted by the user on 2026-10-31; CC-70 to CC-73 and CC-69 retargeted to 0.8.0; CC-84 and CC-85 written up under 0.7.1; the 0.8.0 order below; amendment pointers in 0054 and 0055. No code and no live Notion edits.
**Acceptance:** 0054's and 0055's scopes and acceptance are unchanged apart from release placement; 0.7.1 holds only CC-83 to CC-85 and every task of 0.8.0 names its prerequisite; no personal brain data.

### CC-74 · Plan 0.8.0 capture and Review, move reflection to 0.9.0 (decision 0055) · `done` (#156)
**Release:** 0.8.0
**Changelog:** decision 0055 plans optional Domains, Won't Do, selected capture and editable Review for 0.8.0, moving reflection to 0.9.0.
**Output:** decision 0055, accepted in the user's grill on 2026-10-30 and recorded by Codex at the user's explicit request as a one-task exception to 0044; tasks CC-75 to CC-82 and U-23; CC-65 to CC-67 and U-21 retargeted to 0.9.0; current roadmap references and pointers from 0052 and 0054, retaining their historical text. No implementation, live Notion edits or change to the scope of 0.7.0/0.7.1 as of 2026-10-30 (decision 0056 later moved CC-70 to CC-73 from 0.7.1 into 0.8.0).
**Acceptance:** independent review finds all agreed defaults and safeguards in 0055, with no personal brain data; each implementation task names its output and evidence; reflection's task IDs and changelog lines remain intact at release 0.9.0; 0.7.0 and 0.7.1 task definitions remain unchanged as of 2026-10-30 (decision 0056 later retargeted CC-69 to CC-73). Codex does not self-review this authorship exception.

**Order (0056):** CC-70, then CC-75 (contracts) and CC-71/CC-72 in parallel, then CC-73 (after CC-72), CC-76 to CC-78, CC-79 (after CC-72), CC-80, CC-81, CC-82. Notion migrations: 0012 (buttons), then 0013.

### CC-70 · Contracts for the Brain Assistant buttons (decision 0054) · `done` (#159)
**Release:** 0.8.0
**Changelog:** contracts for the Brain Assistant buttons: what each button sends and may edit, how accepted wording is recorded and checked, and how a publish keeps what is pending in Notion.
**Output:** first, verify on a test page what a button's "send message to agent" action passes to Brain Assistant (the page, the database, the text) and how the skill it should run is named; record the result, marked verified, in docs/notion-space-design.md. Then docs/notion-space-design.md: the Tidy capture, Write up and Refresh report buttons, which databases and rows each appears on, and the Brain Assistant edit permissions (0035 as amended); the Write up format and its proposed-revision block; how acceptance is recorded against the exact accepted text (an Accept write-up or accept-refresh control, its property, and what invalidates it), and how a pending revision blocks it. spec/cli.md and spec/schema.md: what `sync plan` reads for an accepted promoted Document and an accepted refresh, the stale and conflict cases (body changed after acceptance, Git Document changed since), the Notion-blocks-to-Markdown conversion for the accepted text, the Related knowledge appendix proposal and its apply rule (appends, keeps the accepted wording), `sync render` keeping pending drafts, revisions and proposed refreshes, Refresh report never queuing the old full refresh, and unattended runs (0051) importing only exact, explicit, current acceptance.
**Acceptance:** Codex's review finds CC-71, CC-72 and CC-73 buildable from the contracts with no spec question; every case of a Document or report body (seeded, drafted, revision pending, accepted, edited after acceptance, changed in Git) has its outcome in a table.

### CC-71 · Brain Assistant skills, buttons, layouts and Notion migration 0012 (decision 0054) · `done` (#162)
**Release:** 0.8.0
**Changelog:** Tidy capture, Write up and Refresh report run Brain Assistant from a button in Notion; Notion migration 0012 adds them.
**Output:** per CC-70: notion/brain-assistant.md (the Write up skill; Tidy capture and Refresh report as button-run skills; the Instructions' edit rule as amended); the build prompts, notion/modules/ and the views guide (the buttons, the accept control, the layouts); notion/migrations/0012 for spaces on 0011; the user guide (each button, accepting wording, what the catch-up does with it).
**Acceptance:** migration 0012 names every change with who does it, and its Verify list covers each; on a test space, Write up on a promoted Document gives Purpose, Main content, Open questions and Sources and touches no property; a second Write up keeps the user's edit and appends a marked revision; Refresh report appends one "Proposed refresh · based on Notion" section and a second click replaces only it; Tidy capture leaves the row New and its properties unchanged.

### CC-72 · Accepted wording and appendices in the CLI (decision 0054) · `done` (#160)
**Release:** 0.8.0
**Changelog:** the CLI reads the wording you accepted in Notion into the Git Document or report exactly, supports Related knowledge appendix proposals, and never overwrites a pending draft on publish.
**Output:** per CC-70 (spec/cli.md, spec/schema.md): `sync plan` items for accepted promoted Documents and accepted refreshes, with the stale and conflict cases; the conversion of the accepted blocks; the appendix proposal and its apply; `sync render` keeping pending drafts, revisions and proposed refreshes; the code and tests.
**Acceptance:** tests on the fixture brain: an accepted Write up goes into the Git Document byte for byte; a body edited after acceptance gives no import and a stale item; a pending revision blocks the import; an approved appendix is appended after the accepted wording, which stays unchanged; a publish over a row with a pending proposed refresh keeps it; a Refresh report click queues no full refresh; `brain lint` passes on every result.

### CC-73 · Catch-up imports accepted wording and proposes related knowledge (decision 0054) · `done` (#164)
**Release:** 0.8.0
**Changelog:** catch-up takes in the Documents and report refreshes you accepted in Notion and proposes related knowledge to add, citing why each item helps.
**Output:** needs CC-70 (contracts) and CC-72 (the CLI that reads accepted wording), per CC-70, with the harness eval/wording-0.8.0 (blind runs and RESULTS.md) and the fixes they found (a report import no longer adds `sources`; lint declares a Document's own keys): brain-catch-up and brain-sync (read accepted wording, import it, search canonical knowledge for a Related knowledge appendix and propose it with a citation and a reason per item, propose changes to other notes separately, unattended per 0051 as refined); brain-query (reports stay derived, never evidence); the skill mirror.
**Acceptance:** blind runs on a synthetic brain built with CC-41: an accepted Write up is imported exactly and one Related knowledge proposal follows with a reason per item; an edited-after-acceptance Document is listed under Needs you, not imported; an accepted refresh replaces the report's text exactly and knowledge only Git has is named to the user with no proposal (decision 0057: reports are not proposal targets); an unattended run imports an accepted Document and leaves an unaccepted one alone; the skill mirror check passes.

### CC-75 · Contracts and Notion feasibility for Domains, selection and Review (decision 0055) · `done` (#163)
**Release:** 0.8.0
**Changelog:** contracts define optional Domains, source selections, exact per-item Review acceptance and the Notion interactions that support them.
**Output:** after CC-70, spec/schema.md, spec/cli.md, JSON schemas and docs/notion-space-design.md: Domain note/config/module/Area relation, optional Org link and navigation; Won't Do mappings, progress and zero-active-scope behavior; stable subject/item and source-passage identities, inheritance/explicit overrides, confirmation, selected-extract versions, repeat ingestion, re-inclusion and unmappable selections; exclusions across evidence, retrieval, reflection, pending proposals, Documents and derived outputs; reconciliation with independently supported knowledge and affected Tasks; Review body layout, target links, per-item decisions, exact acceptance and base checks, partial/reject/defer outcomes, correction attribution, request-revision state, missing sections, pending-edit preservation and legacy Fix migration; owner-only tasks and explicit Waiting On; module-off and unattended tables. Verify on synthetic Notion pages what recording/transcription and editable per-item controls actually support, and document a supported fallback; do not assume native per-section buttons or tooltip capabilities. Specify migration 0013 after 0012.
**Acceptance:** CC-76 to CC-82 are buildable from the contracts without inventing product behavior; tables cover untouched defaults, parent and item overrides, unconfirmed/confirmed inputs, excluded shared context, stale selections, source/base changes, exclusion after ingestion, partial Review decisions and unattended handling; feasibility distinguishes verified behavior from planned mechanisms. A material Notion limitation that changes the agreed experience returns to the user before dependent implementation.

### CC-76 · Optional Domains in the CLI and onboarding (decision 0055) · `done` (#165, #167)
**Release:** 0.8.0
**Changelog:** optional Domains group Areas around PARA, with onboarding support and no required reclassification of existing brains.
**Output:** per CC-75: Domain schema/CLI support, config and module defaults, import/publish/index/query links, at most one optional Domain per Area, consistent Document/Project grouping through Areas and optional Org link; brain-connect-notion module checklist and switching steps; tests and skill mirror. Notion database creation and layouts follow CC-81.
**Acceptance:** synthetic new and upgraded brains leave Domains off by default; enabling creates the agreed grouping without requiring Orgs or Documents; an Area can have one Domain or none and contradictory assignments are refused; shared knowledge remains reusable; disabling preserves notes and databases and stops Domain operations; lint and skill mirror checks pass.

### CC-77 · Won't Do in Tasks, due views and progress (decision 0055) · `done` (#166)
**Release:** 0.8.0
**Changelog:** Won't Do closes Tasks without counting them as completed, removes them from due work and shows dropped scope separately.
**Output:** per CC-75: Tasks status mapping and connection checks, default and external-database guidance, Notion design/build/module prompts, all relevant active/overdue/reminder filters and formulas, completion/dropped counts and non-dropped progress denominator; migration 0013's task-status steps, user guide and appropriate fixture checks. Retain the task reference model of 0018.
**Spec decision:** The user chose a skill-supplied Notion schema snapshot for the offline status diagnostic; see spec/cli.md §5.2. **CC-81 input:** migration 0013 must add the status by hand, replace the existing Task Progress rollup with the text formula, and update existing due views; warn that user-created numeric filters or sorts on the old rollup need adjustment.
**Acceptance:** synthetic due and overdue Won't Do tasks contribute no active count or reminder; eight Done and two Won't Do display eight completed and two dropped with no false achievement from dropped work; zero-active-scope follows the contract; reopening restores active behavior; an external Tasks database is handled without a forced unrelated status rename.

### CC-78 · Selected source extracts and exclusion reconciliation in the CLI (decision 0055) · `done` (#170)
**Release:** 0.8.0
**Changelog:** subject and item selections limit canonical source extracts, and later exclusions reconcile previous contributions without silent deletion.
**Output:** **the user's two decisions are recorded in spec/capture-and-review.md (2026-11-01): paragraph granularity, fail closed; the read-to-write window accepted with the top-summary mitigation**; per CC-75: selection metadata and confirmation, stable passage mapping, selected-extract source versions, deterministic defaults/overrides, dedup and re-read behavior, evidence eligibility in query/index/derived outputs and the future reflection contract; exclusion reconciliation candidates, affected task references and suppression of older excluded evidence; tests. No rewriting immutable historical sources or full-transcript fallback for an unmappable selection.
**Acceptance:** synthetic inputs with included and excluded subjects/items store and retrieve only eligible passages; changing a global summary cannot leak an excluded subject; an unmappable selection blocks its input; repeat ingestion is idempotent; exclusions after ingestion suppress evidence immediately, propose affected corrections and preserve independently supported claims; affected Tasks are surfaced without silent cancellation; old source versions remain immutable and re-inclusion follows the contract.
**Known gaps (stated in the PR):** the Review row for the cleanup, with Remove/Keep/Restore decisions and their apply, is CC-79 (this task builds `brain source cleanup-plan`); the Notion rendering is CC-81.

### CC-79 · Editable Review bodies and exact per-item acceptance in the CLI (decision 0055) · `done` (#171)
**Release:** 0.8.0
**Changelog:** Review shows complete changes in the page body and applies independently accepted edits with source and user attribution preserved.
**Output:** **the user's two decisions are recorded in spec/capture-and-review.md (2026-11-01): paragraph granularity, fail closed; the read-to-write window accepted with the top-summary mitigation**; after CC-72 and per CC-75: Review rendering with stable sections, target/source links and current/proposed content; exact per-item acceptance and canonical base checks; partial decisions, lifecycle effects for new drafts, explicit reject/defer, Request revision, pending-edit preservation, correction attribution, missing-section handling, legacy decisions/instructions and deterministic unattended application; tests.
**Acceptance:** one accepted edited section applies exactly while another remains pending; new draft acceptance reviews the draft and existing-note acceptance applies its proposal; a requested revision cannot apply before acceptance; later proposal edits or canonical base changes invalidate acceptance; publish preserves pending edits; source and user-corrected values retain separate attribution; missing sections never delete targets or imply approval; legacy Fix instructions survive upgrade; repeated application is a no-op.
**Also (from CC-78's independent review):** the pending-proposal check (`source_excluded`) and the "(source excluded)" flag on report lines, §5.1; the cleanup Review row's Remove/Keep/Restore decisions write Restore records (cli §5.23).

### CC-80 · Voice capture, subject summaries and the new Review flow in skills (decision 0055) · `done` (#172)
**Release:** 0.8.0
**Changelog:** captures and meeting summaries group highlights and actions by subject, honor visible inclusion defaults and guide exact Review decisions.
**Output:** per CC-75 and implementations CC-78/CC-79: brain-ingest, brain-apply, brain-catch-up, brain-sync, brain-query and relevant references; the minutes prompt, Brain Assistant capture behavior, user guide/howto and skill mirror. Owner identities stay configured; only explicit owner commitments become Tasks, with an explicit Waiting On choice for others. Preserve transcript wording, meaningful subject detail, source references, confirmation gates and exact-vs-instruction distinctions. Follow 0054's accepted-wording boundaries rather than granting general Review editing to Brain Assistant.
**Acceptance:** blind synthetic runs preserve highlights, subjects, decisions and commitments without empty or invented risk sections; an ambiguous owner or tentative idea creates no Task; another person's commitment creates Waiting On only on request; untouched defaults wait for Reviewed/Ready, then ingest without per-item questions; subject/item exclusions reach every output; no durable knowledge is a valid no-op; unattended runs never confirm sources or interpret revision instructions; mirror checks pass.

### CC-81 · Notion templates, guidance and migration 0013 (decision 0055) · `done` (#173)
**Release:** 0.8.0
**Changelog:** Notion templates expose selected subjects, optional Domains and guided Review bodies, with migration 0013 preserving existing content and decisions.
**Output:** needs CC-75 and CC-71 (migration 0012), per CC-75: docs/notion-space-design.md, templates, build/module prompts, Brain Assistant guidance and migration 0013 after 0012; optional Domain database/navigation and Area relation; voice capture and minutes subject layouts with inclusion controls, visible inherited defaults and Ready/Reviewed notices; Review target/evidence sections, Creates/Changes/action assistance and supported explanatory descriptions; integrate CC-77 task changes. Document by-hand steps and verified recording/transcription fallback. Preserve existing pending bodies, decisions and legacy correction instructions.
**Acceptance:** migration lists who performs each step and verifies it on synthetic pages; Domains remain optional; the voice template starts New and leaves ingestion to Ready; meeting summaries show the agreed default notice and editable subject/item selection without a second confirmation dialog; Review explains each action without relying on hover text; pending old rows survive; module-off pages omit unavailable sections; both fresh setup and upgrade use supported Notion controls.
**Also (from CC-78's independent review):** `sync plan` / `sync render` publish notes to Notion and must use the eligible form of a restricted note (capture-and-review §5.1); a note published before an exclusion keeps its Notion copy until re-rendered.

### CC-82 · End-to-end acceptance for selected capture and editable Review (decision 0055) · `done` (#174)
**Release:** 0.8.0
**Changelog:** end-to-end acceptance verifies Domains, dropped Tasks, selected source capture and exact partial Review decisions across attended and unattended runs.
**Output:** after CC-76 to CC-81: a synthetic CC-41 brain and acceptance evidence covering a mixed-subject meeting, a voice/transcript capture, optional Domains, owner/other commitments, Won't Do progress, partial accepted edits, revision requests, stale acceptance, post-ingest exclusions, legacy rows and module-off behavior; package/type/skill checks and documented remaining human recording/layout checks for U-23. Use synthetic inputs only.
**Acceptance:** the full flow confirms defaults once, stores no excluded passages in new active brain material, creates only authorized Tasks and applies only exact current decisions; reconciliation preserves independent claims and surfaces task impacts; pending edits survive publish and no-op reruns duplicate nothing; all automated checks pass and U-23 has reproducible human checks rather than unverified capability claims.

### CC-87 · Record the shared-skills, Hermes and launch roadmap · `done` (#161; user review override)
**Release:** 0.8.0
**Changelog:** records the agreed 0.9.0–0.14.0 roadmap, session-opening scope grills and feature cutoff before productisation, translation and the 1.0 launch.
**Output:** decisions 0059 (shared skills and connected workflows), 0060 (Hermes) and 0061 (roadmap/launch boundary); detailed skills migration guidance; the release sequence, reflection moved to 0.10.0, current vision/backlog dispositions and the agent scope-review instruction. Planning-only Codex authorship at the user's explicit request, following CC-74's exception; all implementation ownership remains with Claude Code. No worker launches, fork creation, product implementation or live Notion changes. The user subsequently explicitly authorised the user-review override for merge; no self-issued agent pass.
**Acceptance:** independent review finds the accepted scope, defaults, migration, lean acceptance, update/learning safeguards and launch boundary represented without personal data; every 0.9.0+ human-led development session requires a scope grill and shared understanding; dogfood fixes remain possible without implicit feature expansion; CC-65 to CC-67/U-21 move to 0.10.0 without lost task/changelog identities; 0.8.0 implementation tasks remain unchanged. No self-issued review pass.

### CC-88 · Record Notion tests T1 to T8 as verified (decision 0055) · `done` (#168)
**Release:** 0.8.0
**Changelog:** records the user's Notion feasibility tests T1 to T8 for selected capture and editable Review, including that deleting a block does not move the page's edit time.
**Output:** spec/capture-and-review.md §9 (status, mechanism table, new §9.4 results) and docs/notion-space-design.md (§3.18, the by-hand Won't Do note, the per-block-times note) updated with the user's 2026-11-02 results on synthetic pages. No code. It also specifies the parser tolerance for the formats T6 observed (unnumbered lines block the input) and records check T3b as passed (user-reported). The T4 failure contradicts cli §5.14.7 and decision 0058; they are not edited here and CC-89 handles it.
**Acceptance:** each of T1 to T8 has its result and consequence recorded; no mechanism is left described as unverified that was tested; no unverified claim is added; the T4 contradiction is stated; no personal data or Notion ids from a real brain.

### CC-89 · Changes reach the brain only when you say so (T4, decision 0062) · `done` (#169)
**Release:** 0.8.0
**Changelog:** the brain no longer watches ingested pages for changes; a selection changes when you set the meeting back to Reviewed, and a deleted block is documented as not detected.
**Output:** decision 0062 (accepted by the user, 2026-11-02, replacing the earlier hash proposal); capture-and-review §4.8 rewritten as explicit re-reads (no drift scan, no stored `SELECTION_STALE`), §4.6, §7.10 and M3 aligned; cli §5.14.7 stops claiming that a deleted block moves the page time; 0058 gets an "Amended by" pointer; docs/notion-space-design.md §3.17 says it. CC-78 drops the drift scan, the stale confirmation and `page_fingerprint`; `brain source extract-plan` is specified in cli §5.22 by this task; a render re-checks the page body by hash; CC-79 and CC-80 are no longer blocked by T4.
**Acceptance:** no spec or doc claims that a deletion is detected through the page time; selection changes after ingestion happen only through an explicit re-read (Reviewed/Ready again or an assistant request); 0058's same-minute limit and the verify-before-apply re-read stay; no personal data.

### CC-90 · Close the 0.8.0 task rows · `done` (#175)
**Release:** 0.8.0
**Changelog:** the 0.8.0 task rows are closed, so the release can run.
**Output:** CC-78, CC-80, CC-81 and CC-82 set to `done` with their PR numbers (#170, #172, #173, #174): those PRs merged on the user's review while their rows still said `review`, as CC-79's did (#171, closed in #172). No code.
**Acceptance:** every task with `**Release:** 0.8.0` is `done (#N)`, so `scripts/release.mjs 0.8.0` passes its task check.

## 0.8.1 — Review inside the building session (decision 0063)

### CC-91 · A Claude sub-agent reviews in place of Codex · `done` (#176)
**Release:** 0.8.1
**Changelog:** development only: a Claude reviewer sub-agent reviews each PR and its pass turns `merge-ready` green, so PRs no longer wait for Codex (decision 0063).
**Output:** decision 0063 (accepted by the user, 2026-11-03); `.claude/agents/pr-reviewer.md` (Sonnet, read-only, fixed method, posts its findings and verdict); `"model": "opus"` in `.claude/settings.json`; `merge-ready` and `merge.mjs` accept `Review (Claude reviewer): pass at <sha>` on `claude/` PRs (`reviewersFor` in scripts/common.mjs); AGENTS.md, the PR template, README and this file say who reviews; 0044 gets an "Amended by" pointer. No CLI change.
**Acceptance:** on a `claude/` PR a pass from `Claude reviewer` or `Codex` naming the head is accepted and one from `Claude Code` is refused; on a `codex/` PR only `Claude Code` passes; existing release-script tests pass; this PR is itself reviewed by the `pr-reviewer` agent and merges with `merge-ready` green, without `--reviewed-by-user`.

### CC-92 · task.mjs starts new tasks and cleans merged worktrees · `done` (#177)
**Release:** 0.8.1
**Changelog:** development only: `task.mjs start --new` starts a task that has no row yet, and `task.mjs clean` removes every merged task worktree.
**Output:** `scripts/task.mjs`: `start <id> --new "<title>" --release <x.y.z>` refuses an id that exists on the base and writes the row (`in progress`, empty Changelog, Output and Acceptance) at the end of its `## <release>` section, creating that section in version order; `clean` fetches, then removes each task worktree whose branch is merged into origin/main (reachable, not on its first-parent line) and keeps one with uncommitted changes; a merged branch goes with `-D` (local `main` may lag `origin/main`) and a failure keeps that worktree and goes on with the next. `--new` refuses a title with `·`, a backtick or a line break, and an id used by a remote task branch; a prerelease section sorts before its release. `worktree remove` also deletes the worktree's gitignored files (`node_modules`), as `done` always did. AGENTS.md says when to use them. CC-90 and CC-91 were started by hand because their rows were on no branch; five merged worktrees were found left over on 2026-11-03.
**Acceptance:** tests cover the row's place in an existing and a missing section (before a later release and after the last), refusal of an existing id and of incomplete or repeated flags, and `clean` removing a merged worktree while keeping an open, a fresh (no commits) and a dirty one; existing task tests pass.

### CC-93 · Release preflight and exact-version upgrade · `done` (#178)
**Release:** 0.8.1
**Changelog:** `release.mjs` checks the npm login before it commits and tags, waits for CI on the release commit, and says how to finish after a failed publish; the upgrade steps install the exact version.
**Output:** `scripts/release.mjs`: refuses unless `npm whoami` names an owner from `npm owner ls` (a never-published package passes); waits up to 10 minutes for a queued, running or not-yet-created CI run on HEAD unless another check already refuses (`ciWorkflowState` in scripts/common.mjs); a failed `npm publish` leaves the commit and tag local, pushes nothing and prints the recovery command; a version already tagged here or on origin, or already on npm, is refused first; a failed commit or tag says nothing was published and how to undo, a failed push after the publish says how to push; a failed CI read is retried. docs/releasing.md (the checks, the recovery, `npm install -g ultimate-brain@<version>` then `brain --version` before `brain upgrade`) and README (`brain --version` check). The 0.8.0 release hit all three: a refusal while CI ran, an E404 publish from a non-owner account after the commit and tag, and `@latest` serving 0.7.1 so `brain upgrade` changed nothing.
**Acceptance:** tests: refusal with no npm login and with a non-owner, before any file changes; a never-published package passes; a running CI run is waited for and then passes; the wait gives up after its polls; no wait when another check already refuses; a failed publish keeps the tag local, pushes nothing and prints the recovery; an existing tag (here, on origin) or npm version is refused with no change; a failed push after the publish prints how to push, no stack trace; a failed CI read is retried; `ciWorkflowState` cases. Existing release tests pass.

### CC-94 · Move done releases out of TASKS.md · `done` (#179)
**Release:** 0.8.1
**Changelog:** development only: done releases move from build/TASKS.md to build/HISTORY.md, so a session reads about 24 KB of open work instead of 166 KB.
**Output:** "Waves at a glance" through the 0.8.0 section moved verbatim to build/HISTORY.md; the obsolete "How to start Codex on a task" section removed; `taskEntries` reads both files (`taskFiles`), so `release.mjs`, `task.mjs` and `merge-ready` see moved rows; `pr-format.mjs` compares base and head rows over both files (`optionalContentAt`: a missing HISTORY.md is empty, any other read error fails); `readinessProblems` (merge-ready, merge.mjs) reads the PR's row from both files; only a GitHub `(HTTP 404)` counts as a missing HISTORY.md; `task.mjs start --new` refuses an id used in HISTORY.md and a release whose section is there, and fails if HISTORY.md can't be read for another reason. AGENTS.md: read HISTORY.md only when pointed there, and move a release's section after it ships.
**Acceptance:** no row is lost or changed by the move (every base row's id, status, suffix, release and Changelog line are in TASKS.md or HISTORY.md on the head) and the moved text is byte-identical; tests: pr-format accepts a row moved to HISTORY.md and rejects one dropped from both or one that lost its Changelog line, and fails on an unreadable HISTORY.md; release, merge-ready and `task.mjs --new` read HISTORY.md rows; an error that merely contains "404" is not taken as a missing file; existing tests pass.

### CC-96 · Domains database in every Notion space · `done` (#180)
**Release:** 0.8.1
**Changelog:** every Notion space gets the Domains database and the Areas · Domain relation, used or not, so turning Domains on is a switch; migration 0014 adds them to an existing space (decision 0065).
**Output:** decision 0065 (amends 0055; asked for in the 2026-11-03 scope review, accepted by the user the same day); notion/prompts/02 and 03 create the Domains database and Areas · Domain untagged, Domains · Org with `[Orgs]`; notion/migrations/0014 (the database through the REST API or Notion AI, the relations and the id by the agent, the 1-page limit by hand) and its README row; notion/modules/domains.md (turning on builds nothing) and its row in notion/modules/README.md; notion/CHECKLIST.md; docs/notion-space-design.md (modules table, Areas · Domain, Domains database); spec/schema.md §12 (one line); brain-connect-notion expects Domains in every space and names 0014 when it's missing, with its mirror. Prompts 06 and 07a keep `[Domains]`: what pages show still follows the module. No CLI change.
**Acceptance:** prompts 02 and 03 have no `[Domains]` tag and their Verify counts say 15 and 7 databases; migration 0014 lists who does each step and has a Verify list; the skill mirror check, `npm test`, typecheck, `test:package` and the leak check pass.

## 0.9.0 — Shared skills and connected workflows (decision 0059)

Scoped in the 2026-11-03 grill (CC-95, [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)). Follow [the detailed migration plan](../docs/skills-migration-plan.md). Order: inventory (CC-97) and contracts (CC-98, CC-99) first; then the CLI (CC-100, CC-102), the fork (CC-101) and Notion (CC-103) in parallel; then the skills (CC-104) and update awareness (CC-106); then acceptance (CC-107) and your switch (U-24). The move of skill authorship (CC-105) is in 0.9.2 (decision [0069](../decisions/0069-skills-from-the-fork-in-0-9-2.md)). Each task owns its files; shared files (this one, spec/schema.md, spec/cli.md) are edited only in the task's own row or section.

### CC-97 · Inventory the installed skills and approve their mapping (decision 0059) · `done` (#181)
**Release:** 0.9.0
**Changelog:** development only: an inventory of the skills Claude Code and Codex load today, compared with the pinned upstream, and the approved keep/adapt/isolate/retire mapping for the shared-skills fork.
**Output:** steps 1–2 of docs/skills-migration-plan.md. docs/skills-inventory.md: every active skill by channel (user, project, plugin, account-synced, agent system) with its source, revision, precedence and duplicates, compared with upstream at `a496f551`, each classified as upstream as-is, reusable customisation, Sentina-specific, SEO pack, duplicate, local-only or unresolved; and the mapping the user approved, with the single future source of each retained behaviour. Sanitised: no personal paths, names, client text or credentials. A private rollback manifest (exact paths, hashes, which agent loads what) stays outside the repo. No installation changes; Sentina and SEO skills stay outside the fork (0.9.0 grill, 2026-11-03).
**Acceptance:** every skill in the private manifest appears in the inventory with a source or an explicit unresolved origin; each retained behaviour in the mapping has one future source and no Sentina assumption is copied wholesale; the mapping records the user's approval and date; the leak check passes; no file outside the repo changes except the private manifest.

### CC-98 · Contracts for pinned skill delivery · `done` (#182)
**Release:** 0.9.0
**Changelog:** the contract for pinned skill delivery: each brain records the skill snapshot it uses, both agents load the same version, and an incompatible or missing snapshot stops a command before it writes, with the upgrade to run.
**Output:** spec/skills-delivery.md (decision 0059; spec only, no CLI code): the snapshot format and its compatibility metadata (declared CLI range, upstream base, integrity hash); the brain's pin in `skills.lock.json`; how Claude Code and Codex resolve the same version; duplicate and competing copies; global general skills vs brain-pinned operational skills; the changes to init, link, upgrade, lint and the package check; stop-before-write messages; rollback; the transition that keeps today's delivery working; the fork's release, impact declaration and upstream sync; update awareness (tested vs assessed revision, daily, start-of-work and pre-release checks, one integration issue, credentials). spec/cli.md §5.28 (the pin guard, its error codes and messages, `status` `data.skills`). JSON Schemas `skills-snapshot`, `skills-lock` and `skills-integration` under spec/schemas, with valid and invalid examples in spec/examples/skills/ and tests/skills-delivery-schemas.test.ts.
**Acceptance:** a Sonnet sub-agent given only spec/skills-delivery.md, spec/cli.md §5.28 and the three schemas lists every question it would need answered to build CC-100 (pinned skill snapshots in the CLI) and CC-101 (the public skills fork); the spec answers each until the list is empty; tests: every valid example passes its schema and every invalid one fails, each schema has both, the valid snapshots carry the integrity §2.2 computes; existing tests pass.

### CC-99 · Contracts for connected workflows and linked repos · `done` (#183, #186)
**Release:** 0.9.0
**Changelog:** contracts for connected workflows, the adoption of existing projects, and linked repos with a link kit (decisions 0059, 0066).
**Output:** decisions/0066-linked-repos-and-the-link-kit.md (amends 0042; accepted by the user on 2026-11-03). spec/connected-workflows.md: standard and connected tracking, the opt-in record and the folder's pointer, Workflow settings on the Project and Area (property design only; the migration is CC-103), logging levels and per-task and per-artifact overrides, publication status kept apart from work status, durable records of scope, acceptance, destinations and progress, reconciliation, retries without duplicates, several writers, interruption and uncertain outcomes, the dated summary, completion for software and general work, adoption (inspect, preview, mappings, reruns without duplicates; Markdown plans, GitHub and GitLab issues, Notion tasks) and the `brain workflow` commands. spec/linked-repos.md and spec/cli.md §5.29: the link kit (`brain-kit.json`: knowledge patterns and never-read paths, task source and mode `connected`/`tracked-in-repo` with a status mapping, methodology summary, Area/Domain/Project placement), the one permitted write with the user's yes, the read-only task rollup, unlinking that keeps the knowledge, the health check, the generic starter, offering `brain link` the other way. spec/schema.md §12: the `repos` lines only. spec/schemas/link-kit.schema.json, spec/schemas/workflow.schema.json, `never_read`, `project` and `kit` in brain.schema.json `repos`, with examples in spec/examples/link-kit/, spec/examples/workflow/ and spec/examples/brain/.
**Acceptance:** a context-free Sonnet sub-agent that reads only these specs lists its questions for building CC-102, CC-103 and CC-104, and the round ends with none open; tests/link-kit-and-workflow-schemas.test.ts: every link kit and workflow example passes or fails as labelled, and the JSON examples written in the specs and the starter's default kit validate; the brain.json examples with kit-linked repos pass or fail as labelled (tests/lint.test.ts); the user accepts decision 0066.

### CC-95 · Plan 0.9.0 to 0.11.0 and the roadmap change · `done` (#184)
**Release:** 0.9.0
**Changelog:** decision 0064 puts a brain assistant in 0.10.0 and reflection in 0.11.0, moves Hermes after 1.0, and breaks 0.9.0 into tasks.
**Output:** decision 0064 (from the user's 2026-11-03 scope review, accepted by the user the same day; amends 0061 and 0060's release); this file: the release table, the 0.9.0 order and rows CC-100 to CC-107 and U-24, the 0.10.0 assistant rows CC-108 to CC-110 and U-25, CC-65 to CC-67 and U-21 moved to 0.11.0 with their identities, the Hermes section removed, CC-111 in 0.13.0; "Amended by" pointers on 0061 and 0060; docs/v2-ideas.md's disposition table. CC-96 (0065), CC-97, CC-98 and CC-99 (0066) recorded their own rows and decisions, so this PR leaves them alone. No code.
**Acceptance:** every 0.9.0 work package of 0059 and every multi-repo item agreed in the grill has a task; no existing task id or Changelog line is lost or renamed (pr-format passes); the leak check passes.

### CC-100 · Pinned skill snapshots in the CLI (decision 0059) · `done` (#187)
**Release:** 0.9.0
**Changelog:** each brain uses the exact skill snapshot it recorded: Claude Code and Codex load the same version, and a missing or incompatible snapshot stops a command before it writes, with the upgrade to run.
**Output:** per spec/skills-delivery.md and spec/cli.md §5.28 (CC-98): `skills.lock.json` written by init, link and upgrade; the pin guard and its error codes and messages; lint and `status` `data.skills`; detection of duplicate and competing copies; rollback to the previous snapshot; the package check; the transition that keeps today's delivery working for a brain with no lock. Built and tested against a local fixture snapshot, so it doesn't wait for the fork (CC-101). Owns `src/lib/skills-*` and its commands.
**Acceptance:** tests for each case the spec lists: a compatible pin runs; a missing, tampered (integrity mismatch) or incompatible snapshot stops before any write with the spec's message; both agents' locations resolve the same version and a duplicate copy is reported; upgrade moves the pin and rollback restores the previous one; a brain with no lock behaves as on 0.8.x; existing tests and `test:package` pass.

### CC-101 · The public skills fork ultimate-brain-skills (decision 0059) · `done` (#185)
**Release:** 0.9.0
**Changelog:** development only: the public ultimate-brain-skills fork holds the skills' source, with upstream attribution, compatibility metadata in every release and reviewable upstream updates.
**Output:** step 3 of docs/skills-migration-plan.md, per spec/skills-delivery.md: the fork, created only after the user's yes at that moment (public, upstream attribution and licence, the recorded upstream base, local additions distinguishable); a release workflow that produces immutable snapshots with the compatibility metadata and integrity hash; the impact declaration CI requires on every skills PR (no brain impact, compatible, or coordinated with links); upstream-change detection that opens reviewable update PRs and never merges. Uses the mapping approved in CC-97. Works in the fork; this repo gets the row and a link. No personal configuration in either. **Fork:** [ultimate-brain-skills](https://github.com/superuser-pal/ultimate-brain-skills), created 2026-11-03 after the user's yes: a standalone public repository with upstream's history (the account's one GitHub fork of upstream is taken), base `a496f551`, bootstrapped through a PR; spec §10 records these choices.
**Acceptance:** a released snapshot is reproduced from its tag and validates against `spec/schemas/skills-snapshot` with its integrity; a skills PR without an impact declaration fails CI, and a coordinated one without links fails; a simulated upstream change opens one update PR and merges nothing; no credential or personal path in the fork.

### CC-102 · Linked repos with the link kit in the CLI (decisions 0042, 0066) · `done` (#190)
**Release:** 0.9.0
**Changelog:** a linked repo carries a link kit saying what the brain may read, where its tasks live and how it works; the brain shows its tasks as a read-only rollup or leaves them to Notion, and can check, change or unlink it without losing knowledge; `brain workflow` keeps connected work's scope, progress and pending Notion writes as durable records in the brain.
**Output:** per spec/linked-repos.md and spec/cli.md §5.29 (CC-99): reading and validating the kit; the one permitted write of the kit, only after the user's yes; the task modes (connected, tracked in the repo) and the read-only rollup; changing patterns or mode; unlinking with the repo's knowledge kept; the health check (repo moved or missing, kit out of date, stale rollup); the `repos` changes in brain.json; the generic starter in `templates/`. Owns `src/commands/repo*`, its lib files and `templates/repo/`.
**Acceptance:** tests on synthetic repos: the kit's valid and invalid examples; a repo with no kit behaves as under 0042; the kit is written only with the confirmation the spec names, and never by a read; tracked-in-repo tasks produce the rollup and connected ones don't; unlinking keeps the repo's sources and notes; the health check reports each of its three cases; the starter passes its own kit validation; existing tests pass.
**Spec note (CC-99, #186):** on 2026-11-03 the user chose that CC-102 also builds the `brain workflow` commands of spec/connected-workflows.md §12, and its schema changes (§6.3): `src/commands/workflow*` and their tests, per that spec, are part of this task.
**Built:** `brain repo` kit check and write (confirmed by hash), add `--kit`, refresh, show, health, tasks, unlink and new (templates/repo/generic/, in the package); `brain workflow` new, find, show, set, resolve, item put and claim, artifact put, render, op state, reconcile, summary, adopt preview and apply, publish-history, journaled under `_workflows/`; `origin: workflow` Documents; lint's `workflow-record`. Tests: tests/repo-kit.test.ts, tests/workflow.test.ts, tests/workflow-reconcile.test.ts.

### CC-103 · Workflow settings in Notion and migration 0015 (decision 0059) · `done` (#188)
**Release:** 0.9.0
**Changelog:** Projects and Areas get Workflow settings in Notion (tracking, work type, logging level and logged artifacts), with one dated summary of progress, pending publication and decisions needed on the page; migration 0015 adds them.
**Output:** per spec/connected-workflows.md (CC-99): docs/notion-space-design.md, the build prompts and templates, notion/migrations/0015 (who does each step, a Verify list), brain-connect-notion where it must find them. Product files only; never the user's space. Built: docs/notion-space-design.md §2 (ownership and the Workflow, Work record and `Repo tasks · <repo>` toggles), §3.1, §3.4, §3.15, §3.19 and §4; Prompts 2, 5 and 6; notion/views-guide.md §9; notion/migrations/0015-workflow-settings-on-projects-and-areas.md and its README row; brain-connect-notion step 3; tests/notion-workflow-settings.test.ts holds the spec, design, prompts, layouts, migration and skill to the same names and options.
**Acceptance:** migration 0015 lists who does each step and has a Verify list; the prompts, templates and design agree on every property name and option; the skill mirror check and the leak check pass.

### CC-104 · Adoption, connected-workflow and repo-linking skills (decisions 0059, 0066) · `done` (#200)
**Release:** 0.9.0
**Changelog:** three new skills: adopt an existing project's plans and tasks, run work as standard or Notion-connected with the logging you chose, and link, check, unlink or start a repo from the brain.
**Output:** per spec/connected-workflows.md and spec/linked-repos.md, on CC-102's CLI: the three skills, authored in `skills/` until CC-105 moves authorship to the fork; templates/brain/AGENTS.md lists them; brain-howto and the user guide. Blind runs in eval/.
**Acceptance:** blind runs by fresh Sonnet sub-agents with no answer keys, on synthetic projects: adopting a Markdown plan shows one preview before applying and a rerun duplicates nothing; a failed publication of a connected task is kept and retried without a duplicate; linking writes the kit only after a yes and offers `brain link` the other way; standard tracking needs no brain or Notion; the skill mirror check passes.
**Spec questions (CC-104, for the user):**
1. A legacy link (`NO_KIT`) can get a kit file (`repo kit write`), but no command applies it to the existing entry: `repo refresh` refuses `NO_KIT` and `repo add --kit` refuses a taken name. brain-repos uses the defined path, `repo unlink` then `repo add --kit` after the user's yes, which resets `commit` so the next read lists the files again (already-ingested ones are skipped as duplicates). Should `repo refresh` adopt a kit for a legacy entry and keep its `commit`?
2. A moved repo (`PATH_MISSING`) has no command to change an entry's `path`. brain-repos offers unlink and link again (the same reset). Should `repo refresh` (or a new option) take a new path?
3. linked-repos.md §4 says each catch-up that reads a tracked-in-repo repo rebuilds its rollup, and brain-ingest still links with `repo add --pattern` ("link the repo at <path>"). Neither brain-catch-up nor brain-ingest is CC-104's to change beyond a hand-over line, so both still need their step: a hand-over to brain-repos in each.
**Answers (the user, 2026-11-04):** 1 and 2: unlink and link again stays the way in 0.9.0, and `repo refresh` options that keep `commit` come in CC-118 (0.10.0); 3: CC-117.

### CC-106 · Update awareness in the product (decision 0059) · `done` (#189)
**Release:** 0.9.0
**Changelog:** development only: the product checks the skills fork daily, at the start of work and before a release, keeps one open integration issue for unassessed skill changes, and blocks a release on an incompatible one.
**Output:** per spec/skills-delivery.md §11: the scheduled check and its credentials; the tested and the assessed revision; the single integration issue and its classification (ready to upgrade, linked brain work required, reviewed with no action); `release.mjs` refusing while an incompatible change is unassessed; "status unknown" when a check fails.
**Acceptance:** tests or recorded dry runs against a compatible change, an incompatible change, an unreleased change and an unavailable source: at most one open issue, the release blocked only for the incompatible change, a failed check reported as status unknown; existing release-script tests pass.

### CC-107 · 0.9.0 acceptance (decisions 0059, 0066) · `done` (#207)
**Release:** 0.9.0
**Changelog:** development only: end-to-end acceptance of 0.9.0 in isolated installations: four adoption scenarios, rollback, and both agents loading the same skills.
**Output:** steps 5 and 7 of docs/skills-migration-plan.md: isolated agent skill locations; the scenarios standard software, connected software with a PR, general work directly under an Area, and a hub with one connected and one tracked-in-repo linked repo; interruption, retry, conflict, version and update behaviours tested once; rollback exercised; brief Claude Code and Codex smoke checks; evidence in docs/acceptance-0.9.0.md.
**Acceptance:** each scenario passes with its evidence; rollback restores the previous package and installation manifest with knowledge and configuration intact; the effective skill source is identified in each agent (accepted by the user on 2026-11-04 as identified through the CLI, with each live agent checked in U-24); no real brain is the first integration test.
**Run (2026-11-04, phase A):** evidence in docs/acceptance-0.9.0.md; harness, blind runs and reports in eval/acceptance-0.9.0. All four scenarios and every shared check pass; rollback passes. The Claude Code and Codex smoke checks were not run: neither is logged in under the isolated HOME, and the user chose to record that (the live agent load moves to U-24); the effective source is identified through the CLI (pinned `ultimate-brain 0.9.0`, both trees, no competing copies).
**Findings (no scenario failed; none fixed here, for the planning session):** (1) rollback after the first pin: the upgrade reports `previous_cli: null`, so the documented rollback names no version; (2) `repo kit check` hashes a hand-formatted draft that `kit write` can never confirm, with no hint; (3)–(7) brain-workflow: `lifecycle: reviewed` refused by `note new`, commits needed before the next workflow command, undocumented input shapes and the `failed → pending` retry path, the claim not released on `done`, an edit after the yes not shown again, and the raw "Adopted from … as /" progress line; (8) a runner that misses the sandbox env reaches the user's own brain (read-only, once); (9) brain-workflow and brain-workflow-adopt reach working folders only from the brain or a global install in phase A, a question for 0.9.1. Proposed tasks: (a) findings 1–2, spec first; (b) findings 3–7. **Triage (the user, 2026-11-04):** (a) is CC-129 (0.9.0), (b) is CC-130 (0.9.1), finding 9 goes to CC-105.
**Rerun after merging main (CC-120, CC-121, CC-128):** install, rollback (7/7), the five sandboxes and the shared checks (9/9) pass on the merged head; the blind runs were not repeated, since they never create or read what CC-120 and CC-121 change (docs/acceptance-0.9.0.md).


### CC-129 · The rollback names the version, and kit check says when a draft can't be confirmed · `done` (#212)
**Release:** 0.9.0
**Changelog:** after the first `brain upgrade` of an unpinned brain, the rollback names the version to go back to; `brain repo kit check` also returns the hash `kit write` confirms, so a kit draft formatted by hand can be written.
**Output:** from CC-107's findings 1 and 2 (docs/acceptance-0.9.0.md). Spec first: spec/skills-delivery.md §8 and spec/cli.md (where `brain upgrade` reports `previous_cli`, and §5.29 `repo kit check`), docs/releasing.md and the brain's AGENTS.md block: what the first upgrade of an unpinned brain reports as the previous version (the CLI that wrote the brain, from its `brain.json` or the package that ran before, as the spec decides), and what `kit check` says about a draft whose bytes differ from the form `kit write` writes; then the CLI test-first, and brain-repos's wording if it changes.
**Acceptance:** tests: the first upgrade of an unpinned 0.8.1 brain reports a non-null previous version, and the rollback text names it; `kit check` on a hand-formatted valid draft says it must be written in the canonical form (or returns the hash `kit write` confirms, as the spec decides); `npm test`, typecheck, `test:package`, the skill mirror check and the leak check pass.
**Spec decided (CC-129):** the first pin's `previous_cli` comes from the brain's newest `upgrade: ultimate brain <version>` commit other than the running version (skills-delivery §7), else `null` with the §8 fallback; `kit check` adds `confirm_sha256` (the hash of the bytes `kit write` writes, the `--confirm` value) and `canonical` (cli §5.29), and brain-repos confirms with it.

### CC-114 · Projects from the Notion template and Review bodies by markdown · `done` (#197)
**Release:** 0.9.0
**Changelog:** a new project is published from the space's Projects template through the API instead of being refused with `PROJECT_NOT_IN_NOTION`, and a new Review row's body is written once through Notion's markdown endpoint so its toggles stay real toggles.
**Output:** decision 0068 (retires the `PROJECT_NOT_IN_NOTION` rule of 0037's 2026-10-18 amendment and CX-26; sets the markdown-on-create rule for Review bodies); spec/cli.md §5.14.4 (a project `create` carries `template`; the Review body write) and spec/capture-and-review.md §9; `sync render` returns a `create` with `"template": { "type": "default" }` for a project without `notion`; brain-sync step 10, brain-ingest references/notion.md, sources.md and SKILL.md (create from the template, wait for its toggles, the New project fallback when the space has no default template; the Review body by markdown on create, the block API for every other section); dogfood #193 and #194; dogfood #196: `sync render` lists no `item_updates` for a proposal decided the 0045 way (applied or closed with no `item_decisions`), as spec/cli.md §5.14 already says, so such a row leaves `--changed` once published.
**Acceptance:** tests: a project without `notion` renders as a `create` with every property, `sections` and the template, and a project with `notion` still renders without one; a Review body as Notion's markdown returns it (toggle children indented) parses back to each item's `proposed_hash`; the old `PROJECT_NOT_IN_NOTION` test is replaced; a Review notes proposal with items, approved from chat (`decided_by: chat`) and applied, renders no `item_updates`, and once recorded `sync render --changed` no longer returns it (#196); `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.
### CC-112 · Quick follow-ups and scoped tasks in the minutes (decision 0067) · `done` (#198)
**Release:** 0.9.0
**Changelog:** meeting minutes split your actions into quick follow-ups, which stay in Notion as checkboxes, and tasks with an editable Scope (done when, due, project, notes) that the ingest carries into the Notion task; a long or reworded quote no longer blocks a whole meeting (#191).
**Output:** decision 0067 (amends 0055); spec/capture-and-review.md §3–§4 and §6 and spec/cli.md §5.22 (the Quick follow-ups and Tasks groups, the Scope toggle, which quote problems block and how the rest are reported); the parser in src/lib/selection.ts and the extract-plan output in src/lib/extract.ts, test-first; notion/minutes-format.md (prompt and "What you do with it"), a note in notion/ on pasting the new prompt; the brain-ingest references (selection, extraction, cli-inputs) and their mirror; a blind run of the new prompt on a synthetic transcript.
**Acceptance:** tests: quick follow-up checkboxes, with or without an id, are listed and never imported, never a Task and never a blocker, while a checkbox outside a Quick follow-ups group still blocks; a Scope toggle is read into Done when, Due, Project and Notes, and a Due that is not a date or a stray Scope is reported without blocking; a long exact quote and a reworded quote with a unique 6–12-word stretch are placed; an unplaceable quote of an included item is reported and the item not imported, while the same quote on an excluded item still blocks; the 0.8 minutes fixture gives the same plan as before; a fresh Sonnet agent given only a synthetic transcript and the new prompt writes minutes that extract-plan accepts; `npm test`, typecheck, `test:package`, the skill mirror check and the leak check pass.

### CC-113 · sync apply creates notes in relation order · `done` (#195)
**Release:** 0.9.0
**Changelog:** `sync apply` creates new notes in relation order, so an Area whose Domain (or a Project whose Area or Org) is new in the same plan is created in one run, whatever the plan's order; a cycle among creates is reported as `RELATION_CYCLE`.
**Output:** spec/cli.md §5.14.3 states that creates run in relation order (the referenced create first, otherwise plan order), that results stay in plan order, and what a cycle does; `applyPlan` in src/lib/sync.ts orders the creates accordingly; sync apply tests. From dogfood #192.
**Acceptance:**
- [ ] A plan with a new Area before its new Domain applies both in one `sync apply`, with no failure.
- [ ] The same for a new Project before its new Org (`client`) and a new Project before its new Area.
- [ ] Creates in a relation cycle fail `RELATION_CYCLE`, a create that depends on one fails `DEPENDENCY_FAILED`, the other creates and the rest of the plan are still applied, and the command ends (exit 1).
- [ ] `data.create` stays in the plan's order; every existing sync apply test passes unchanged.

### CC-115 · Restore CC-113's lost row and plan the own-row check · `done` (#199)
**Release:** 0.9.0
**Changelog:** development only: CC-113's task row, dropped by a merge of main into #195, is restored, and the own-row check is planned as CC-116 in 0.10.0.
**Output:** this file: the CC-113 row restored verbatim from 47a4743; the CC-116 row in 0.10.0.
**Acceptance:** the CC-113 row matches `git show 47a4743:build/TASKS.md`; CC-116 has Release 0.10.0, a Changelog, Output, Acceptance and status `todo`; no other row or Changelog line changes.

### CC-117 · Catch-up and ingest hand over to brain-repos · `done` (#201)
**Release:** 0.9.0
**Changelog:** each catch-up rebuilds the task rollup of a repo whose tasks are tracked in the repo, and "link the repo at <path>" in an ingest goes through brain-repos, so every new link gets a kit after your yes.
**Output:** CC-104's spec question 3 (answered 2026-11-04): brain-catch-up rebuilds the `Repo tasks · <name>` rollup of each tracked-in-repo linked repo per spec/linked-repos.md §4, with `brain repo tasks` through brain-repos "The rollup", written in the publish and counted in the short report; brain-ingest (SKILL.md and references/sources.md) hands repo linking to brain-repos instead of `repo add --pattern`; the skill mirror; a blind run in eval/handover-0.9.0; notion/migrations/0015 points to pasting the new minutes prompt (one line, the user's 2026-11-04 addition). This file: the answer line under CC-104's spec questions and the CC-118 row in 0.10.0.
**Acceptance:** a blind run by a fresh Sonnet sub-agent with no answer key, on a synthetic brain with one tracked-in-repo linked repo: the catch-up rebuilds the rollup on the target page; "link the repo at <path>" given to brain-ingest ends in brain-repos asking for a yes on the kit, with nothing written before it; no skill still tells the agent to link with `repo add --pattern`; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

### CC-119 · Move CC-105 to 0.9.3 · `done` (#205)
**Release:** 0.9.0
**Changelog:** development only: CC-105 (skills from the fork) moves to a later patch release (0.9.2 since CC-128), so 0.9.0 ships on the product's own skills (decision 0069).
**Output:** decision 0069 (amends 0064); one-line 0069 pointers in docs/skills-migration-plan.md (§4) and spec/skills-delivery.md (Status); this file: the 0.9.3 row of the release table, the 0.9.0 order, and CC-105 moved to a new 0.9.3 section with release 0.9.3 and its spec-first Output; an "Amended by" pointer on 0064.
**Acceptance:** CC-105 keeps its title, Changelog and Acceptance, with Release 0.9.3; no other row or Changelog line changes; the user accepts decision 0069; the leak check passes.

### CC-128 · Renumber 0.9.x: CC-120 and CC-121 in 0.9.0 · `done` (#206)
**Release:** 0.9.0
**Changelog:** development only: the tasks merged before 0.9.0 is released count as 0.9.0 (CC-120, CC-121, CC-122), a simpler Notion becomes 0.9.1 and skills from the fork 0.9.2, so each release's notes match what it ships.
**Output:** from the user's choice on 2026-11-04 (option A): this file (the release table, CC-120 to CC-122 moved into 0.9.0 with Release 0.9.0, CC-123 to CC-127 in 0.9.1, CC-105 in 0.9.2); decisions 0069 (renamed to `…-in-0-9-2.md`), 0070 and 0071 and the pointer in 0064; migrations 0016 and 0017 and their README rows; the version notes in spec/schema.md, spec/capture-and-review.md, docs/notion-space-design.md, notion/modules/domains.md, docs/skills-migration-plan.md. Test fixtures that use these numbers as sample versions are unchanged.
**Acceptance:** no task row, Changelog line or reference other than release numbers changes; `git grep` finds no 0.9.3 outside tests and no remaining claim that CC-120/CC-121 are 0.9.1; tests, typecheck, `test:package` and the leak check pass.

### CC-120 · Type moves from Areas to Domains · `done` (#202)
**Release:** 0.9.0
**Changelog:** Type (Personal, Entrepreneurship, Professional) moves from Areas to Domains: sync reads it into the domain note and drops the old value from area notes (migration 0016).
**Output:** the user's 2026-11-04 change in their space, recorded in the product: Domains · Type (select: Personal, Entrepreneurship, Professional, yours) and no Areas · Type in docs/notion-space-design.md, spec/schema.md (§3 area and domain, §14), spec/cli.md §5.14, spec/capture-and-review.md §1, note.schema.json and the examples; `sync plan` maps Domains · Type to `notion_fields.type` and no longer reads Areas · Type, so an area note's old `type` is dropped at the next sync and is still valid until then; Prompt 2, Prompts 7b and 7h and the views guide; notion/modules/domains.md; notion/migrations/0016 for spaces built before 0.9.0.
**Acceptance:** a test shows `sync plan` taking Type from a Domains row into the domain note and dropping `type` from an area note that held one, with lint passing after apply; no product file still lists Areas · Type outside the history of migrations 0001–0015; `npm test`, `npm run typecheck` and the leak check pass.

### CC-121 · Lifecycle only where the brain creates the row · `done` (#203)
**Release:** 0.9.0
**Changelog:** Domains, Areas, Goals, Projects and Orgs no longer have Lifecycle: they come in as reviewed, you close them with Archived (Orgs gain it), and People and the knowledge databases keep Lifecycle for Review (decision 0070).
**Output:** decision 0070 (amends 0005; from the user's 2026-11-04 review, People keeps Lifecycle); `sync plan` reads no Lifecycle on the five and creates their rows as `reviewed`, `note new` writes them as `reviewed`, render sends no Lifecycle there and ticks Archived once on a note the brain retired; Orgs · Archived → `notion_fields.archived`; spec/schema.md §3, §4, §8, §14, spec/cli.md §5.5 and §5.14, spec/capture-and-review.md §1.4, note.schema.json; docs/notion-space-design.md, Prompt 2, Prompts 7f and 7h, the views guide, the Planning and Orgs modules, the brain-howto guide; notion/migrations/0017.
**Acceptance:** tests show rows of the five databases created as `reviewed` with no Lifecycle published while People stays `draft` and publishes it; a stale Lifecycle on Projects is ignored with no conflict; a retired project ticks Archived once and not again after you untick it; `note new` writes a project as `reviewed`; Orgs · Archived is pulled; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

### CC-122 · Plan 0.9.1: a simpler Notion · `done` (#204)
**Release:** 0.9.0
**Changelog:** development only: decision 0071 plans 0.9.1 (first numbered 0.9.2; renumbered by CC-128), a simpler Notion, and breaks it into CC-123 to CC-127.
**Output:** decision 0071 (from the user's 2026-11-04 scope review of Review, Inbox, Decisions, Questions, Concepts, Documents and Orgs; accepted the same day); this file: the 0.9.1 row of the release table and rows CC-123 to CC-127. No code.
**Acceptance:** every point of 0071 has a task; no other row or Changelog line changes; the leak check passes.

## 0.9.1 — A simpler Notion (decision 0071)

Right after 0.9.0. Fewer databases and only reviewed knowledge in Notion; the brain in Git keeps everything. Each task writes its spec first.

### CC-123 · Concepts become Documents (decision 0071) · `done` (#214)
**Release:** 0.9.1
**Changelog:** concepts become Documents of their own kind, "learned": the Concepts database is retired and existing concepts move to Documents with their links.
**Output:** spec first: `origin: learned` on `reference` notes in spec/schema.md and note.schema.json, what replaces the `concept` type (a `brain upgrade` step that rewrites existing concept notes and every reference to them, or the type kept as an alias: the spec decides), ingest's extraction (an idea or method → a learned Document), query, Review sections and Promote (decisions only); then the CLI, the skills, the Notion design (no Concepts database, Documents views by origin, "What do we know?" with Decisions and Documents), the Knowledge and Documents modules, Prompts 2/4/6/7, and a migration that moves Concepts rows to Documents and retires the database after a yes.
**Spec answers (the user, 2026-11-04):** 1. The `concept` type is replaced, not aliased: `brain upgrade` rewrites each concept into a `reference` with `origin: learned` in `knowledge/references/`, keeping its `con-` id, and rewrites the links to it; a concept left behind is lint `concept-retired`. 2. Notion: the upgrade clears the former concept's page link, the next sync creates its page in Documents, and migration 0018 trashes the Concepts database after a yes (no page moves). 3. Learned Documents follow the Documents module: with it off they stay in Git and in `brain query`, unpublished. Also (CC-123's own choices): a learned Document keeps the concept's rule that `sources` is optional; CC-124 owns the Documents · Origin property, CC-123 adds its Learned value and view.
**Acceptance:** a synthetic brain with concepts upgrades with no lint error and every former concept is a learned Document reachable from its project, area and source; a fresh ingest of an idea writes a learned Document; `brain query` finds it; the migration's verify list passes on the design; `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

### CC-124 · Reports move to Documents (decision 0071) · `done` (#211)
**Release:** 0.9.1
**Changelog:** reports live in Documents instead of the Inbox, still one per subject, refreshed from their page; an Ask stays in the Inbox and links to its report.
**Output:** spec first: a report as a `reference` note with `origin: report` (or the report shape moved under Documents: the spec decides), the Ask ↔ Report relation between Inbox and Documents, Refresh asked and What to fix on Documents, render and sync for them, 0057 kept (never ingested, not a proposal target); then the CLI, brain-query's report mode, the Refresh report button and Brain Assistant's skill, the Notion design and views ("Reports" on project and area pages read Documents), and a migration that moves existing Report rows.
**Acceptance:** a test publishes a new report to Documents and refreshes it in place; an Ask row links to it; existing Report rows have a migration path with a verify list; a report still never becomes a source or a proposal target; checks as CC-123.
**Spec answers (the user, 2026-11-04):** 1. A report stays a `view` (`vw-`, `reports/`, `view_kind: report`) in Git; only its Notion home changes, to a Documents row with Origin = Report, so 0057 holds unchanged and nothing in a brain is rewritten. 2. Existing Report rows are moved by hand (Move to → Documents), keeping their page ids, bodies, comments and any proposed or accepted refresh; the next publish fills Origin, Project, Area and Asked in. 3. Reports needs Documents: `brain modules on reports` also turns Documents on, `off documents` also turns Reports off, and each says so. 4. One **Accept** button on Documents (Accept write-up renamed) for a write-up and a refreshed report alike. 5. The unattended catch-up's run summary stays an Inbox row, with a new Kind **Catch-up**; the Inbox Kind Report is retired. CC-124 owns the Documents · Origin select (Kept, Learned, Report, Promoted, Workflow); CC-123 maps `learned` (agreed with CC-123's session).

### CC-125 · Notion shows reviewed knowledge (decision 0071) · `done` (#210)
**Release:** 0.9.1
**Changelog:** decisions, questions and Documents appear in Notion once you approve them; until then they are in their Review row only.
**Output:** spec first (spec/cli.md §5.14): render publishes a decision, question or Document only when its lifecycle is `reviewed`, `disputed` or `archived` (a whole Document is reviewed from creation), and a person whatever its lifecycle; the relations that point at an unpublished note (Inbox Produced, Meeting Decisions and Questions, Supersedes) wait as pending relations; approving a Review Notes row publishes its notes in the same run; a rejected draft never gets a page; what happens to existing Draft pages (left until decided, or trashed after a yes); Briefs, reports and Review pages unchanged; then the CLI, brain-sync/catch-up wording, the Notion design and views (drop "Which concepts are drafts?" and other Draft views), and a migration.
**Acceptance:** tests: a draft decision gets no page and its meeting's Decisions relation fills in when it is approved; a rejected draft never renders; a draft person still renders; a disputed decision keeps its page; checks as CC-123.
**Answers (the user, 2026-11-04):** 1. Existing Draft pages: moved to Notion's trash after a yes (migration 0020, `sync render --unpublish-drafts`), only those a pending Review notes row holds, so approving brings each back as a new page. 2. A decision a connected workflow publishes arrives `reviewed` (the approval in the session is the review, as for a workflow Document), with `workflow: {id, artifact}` on the note. Following 0071 §3 without a new question: an approved `new_item` writes its note `reviewed`.

### CC-126 · A to-do becomes a task, not a question (decision 0071) · `done` (#209)
**Release:** 0.9.1
**Changelog:** the brain no longer files to-dos as questions: your own become tasks, other people's stay commitments you can track as Waiting On, and questions are kept for what something can answer later; a one-off tidy offers to turn existing to-do questions into tasks.
**Output:** spec first, in the contracts that hold the rule today: spec/capture-and-review.md §4.1 and §6 and spec/cli.md §5.14.5 (unchanged for other people's commitments: Waiting On only through `Track: Waiting On —`, decision 0055), then skills/brain-ingest/references/extraction.md, sources.md and selection.md (answerable later → question; the owner's explicit to-do → task; someone else's → a commitment in the text; ambiguous owner or tentative idea → no task and no question; risk → Kind Risk), the minutes format's Open Questions and Risks guidance (notion/minutes-format.md), and a tidy (in brain-tidy or a cleanup row: the spec decides) that lists existing questions that read as the owner's to-dos and converts each after a yes, dropping the question; then the skills and their mirror, and a blind run on synthetic minutes.
**Spec questions (from the review of PR #204):** 1. Old-format minutes (Open Questions as plain lines, no item ids): does the rule apply to them, and how is a converted line tied to its task without an item id? 2. Idempotence: a re-ingest must not create a second task for a line that was a question before; is `task_items` enough for an item that changes kind? 3. The tidy: does dropping a converted question archive it with a successor link to the task, or simply archive it?
**Answers (the user, 2026-11-04):** 1. The rule applies to old-format minutes too: a line is classified by what it says, whatever its heading; an old-format Task goes through `sync tasks --meeting`, is recorded in the meeting's `tasks` and needs no item id, and a corrected re-read reads only the changed lines (`source diff`), so an unchanged line never makes a second Task. 2. A re-ingest never reclassifies a line the brain already holds as a question (open, answered or dropped): it creates no Task for it, and only the tidy converts it; a line the user edited is a corrected line, its Task is made once (`task_items`), and the old question is named under Check to drop. 3. A converted question is archived with `task` (the Task's page id), the meeting or source records the Task, and Notion gets Lifecycle Archived and Status Dropped, each sent once. 4. The tidy is a chat step of brain-ingest, run when the user asks ("turn my to-do questions into tasks"), each item after a yes, through a new `brain question drop`; a question that reads as someone else's commitment is offered as a drop with no Task (never Waiting On, 0055).
**Acceptance:** a blind run by a fresh Sonnet sub-agent on synthetic minutes with one real question, one owner to-do, one to-do for someone else (unmarked, then marked `Track: Waiting On —`), one ambiguous-owner line and one risk produces one question, one task, no task then one Waiting On task, nothing for the ambiguous line, and one risk; with Tasks off the owner's to-do stays in the text and is not a question; a re-ingest creates no second task; the tidy converts a to-do question only after a yes; the skill mirror check and the leak check pass.

### CC-127 · Orgs · Relationship gains Employer (decision 0071) · `done` (#208)
**Release:** 0.9.1
**Changelog:** an Org can be your Employer, besides Client, Prospect, Partner, Supplier and Other.
**Output:** the Employer option in spec/schema.md §4 (org `notion_fields.relationship`), note.schema.json, docs/notion-space-design.md §3.7, Prompt 2, the Orgs module, the Orgs views (unchanged filters: "Which clients do I have?" stays Client), and a migration step that adds the option (with the existing options' ids sent first).
**Acceptance:** an org note with `relationship: Employer` lints clean and syncs; the migration adds the option without dropping the others; `npm test` and the leak check pass.
**Migration number:** 0021, fixed when 0.9.1 was split across parallel windows so no two tasks collide: CC-123 0018, CC-124 0019, CC-125 0020, CC-127 0021, CC-126 0022 (only if it needs one). Until those merge, the README goes from 0017 to 0021; run them in number order once they exist.
**Scope (user, 2026-11-04):** no blind run; the tests and the leak check are enough.

### CC-130 · brain-workflow polish from the 0.9.0 acceptance · `done` (#219)
**Release:** 0.9.1
**Changelog:** the workflow skill publishes final artifacts without a refused lifecycle, documents its input shapes and retry path, releases an item's claim when it is done, shows an edit made after your yes again, and adoption's first progress line reads plainly.
**Output:** from CC-107's findings 3 to 7 (docs/acceptance-0.9.0.md): skills/brain-workflow (references/notion.md and the input shapes: `acceptance` entries, artifact `format`, `location`, the `failed → pending` retry), the claim released on `done`, the approval rule (an edit after the yes is shown again), and `workflow adopt apply`'s progress text (src/lib/workflow-adopt.ts, spec first in spec/connected-workflows.md if the text is specified). Also U-24 marked done in "Your tasks". Evidence: eval/acceptance-0.9.0/RESULTS.md, "CC-130 rerun".
**Acceptance:** a blind run by a fresh Sonnet sub-agent on CC-107's connected-pr and general-area sandboxes (eval/acceptance-0.9.0/harness) publishes a final artifact with no refused command, leaves no claim on a done item and shows an edited artifact again; a test shows the adoption progress line without the raw key; the skill mirror check, `npm test` and the leak check pass.

### CC-132 · brain link writes through a CLAUDE.md symlink to the repo's AGENTS.md · `done` (#217)
**Release:** 0.9.1
**Changelog:** `brain link` accepts a repo whose `CLAUDE.md` is a symbolic link to its own `AGENTS.md`, and refuses any other symbolic `CLAUDE.md` with `INSTRUCTIONS_SYMLINK` instead of `OUTSIDE_ROOT`.
**Output:** `spec/cli.md` §5.12 step 2 and the error table; `src/commands/link.ts`, `src/lib/errors.ts`; `tests/link.test.ts`; brain-repos step 5 (and its mirrors). From dogfood #215.
**Acceptance:**
- [ ] A repo whose `CLAUDE.md` is a symbolic link to its `AGENTS.md` links: the block goes into AGENTS.md, `CLAUDE.md` stays a link and is reported `unchanged`, and a second run changes nothing.
- [ ] A `CLAUDE.md` symlink to another file, outside the repo, or dangling is refused with `INSTRUCTIONS_SYMLINK` (exit 4) before any write; the message says how to fix it.
- [ ] A symbolic `AGENTS.md` is still refused with `OUTSIDE_ROOT`; every other link test passes unchanged.
- [ ] brain-repos step 5 names the case and the fix; `npm run skills` leaves the mirrors in sync.

### CC-131 · brain-sync reads the Domains database · `done` (#218)
**Release:** 0.9.1
**Changelog:** the brain-sync skill reads the Domains database when Domains is on, so a Domain's Type, Archived and edits reach the brain and a Domain added in Notion is imported.
**Output:** brain-sync step 2's table and `references/formats.md`; `spec/cli.md` §5.2 and §5.14.1 name `domains` where the CLI already accepts it; `tests/brain-sync-databases.test.ts` ties the skill and spec lists to `sync plan`'s databases. From dogfood #216.
**Acceptance:**
- [ ] brain-sync step 2's table has a Domains row, read when Domains is on; `formats.md` lists `domains` among the `database` keys.
- [ ] `spec/cli.md` names `domains` in the status keys, the snapshot `database` keys and the creatable databases, matching the CLI.
- [ ] A test fails when a database `sync plan` accepts is missing from step 2's table, `formats.md` or the spec's `database` list.
- [ ] `npm test`, `npm run typecheck`, `npm run test:package`, the skill mirror check and the leak check pass.

## 0.9.2 — Skills from the fork (decision 0069)

After 0.9.1. Scope checked with the user on 2026-11-05 (CC-133): CC-105 as decision 0069 placed it, its spec first (CC-134), plus the dogfood fixes #221 (CC-135) and #220 (CC-136), and CC-116 and CC-118 taken from 0.10.0. 0.9.2 is released when CC-105 is done. CC-134, CC-135, CC-136, CC-116 and CC-118 can be built in parallel; CC-105 starts once CC-134 is on `main`.

### CC-133 · Plan 0.9.2: dogfood fixes, CC-116 and CC-118 join, CC-105 spec first · `done` (#222)
**Release:** 0.9.2
**Changelog:** development only: 0.9.2 gains the fixes for dogfood #220 and #221 and takes CC-116 and CC-118 from 0.10.0, and CC-105's spec becomes its own task.
**Output:** the 0.9.2 scope check of 2026-11-05 with the user: one 0.9.2 release that ships when CC-105 is done (decision 0069 kept); the fixes for #221 (CC-135) and #220 (CC-136) join it; CC-116 and CC-118 move from 0.10.0 so they can be built now; CC-105's phase B spec becomes CC-134, ahead of its build, and CC-105's Output points to it; the 0.10.0 opening grill runs while 0.9.2 is built. TASKS.md only: the release table, the status notes, the 0.9.2 rows.
**Acceptance:** each of CC-134, CC-135 and CC-136 has a Release, Changelog, Output and Acceptance line; CC-116 and CC-118 keep their rows word for word except their Release; CC-105 changes only its Output, which leaves the spec to CC-134; no other task's row changes; `pr-format` and the leak check pass.

### CC-134 · The phase B spec: skills written in the fork (decision 0069) · `done` (#228)
**Release:** 0.9.2
**Changelog:** development only: the contract for phase B of skill delivery, where skills are written in the fork and the package ships its released snapshot.
**Output:** spec/skills-delivery.md §9 (and the sections it touches: §6 init, link, upgrade and lint, §10 the fork, §12 acceptance) and spec/cli.md where a command changes: where a skill is written once CC-105 lands, how the product build takes an exact released fork snapshot and refuses an edited generated copy, what `brain init`, `link`, `upgrade` and `lint` do differently, how a brain on 0.8.1 or 0.9.x upgrades without both repos changing at once, CC-107's finding 9 (brain-workflow and brain-workflow-adopt reach any working folder, not only the brain), and how skill changes made in `skills/` since brain-v1.0.0 (0.9.0 and 0.9.1) reach the fork. Classify the open change of the skills-integration issue #213.
**Acceptance:** a context-free Sonnet sub-agent reading only the spec lists no question it would need answered to build CC-105; every skill change since brain-v1.0.0 is named with how it reaches the fork; #213 has no unclassified change; the leak check passes.
**Spec questions (asked and answered 2026-11-05):** (1) How do brain-workflow and brain-workflow-adopt reach a working folder that isn't the brain (CC-107's finding 9): through `brain link`, a global install from the fork, or a new install command? **The user: `brain link` installs them next to brain-query, pinned to the brain's version** (skills-delivery §9.7). (2) The fork release for 0.9.2 needs the 0.9.2 CLI, but `main`'s `package.json` says 0.9.1 until the release, so `npm test` and `test:package` would refuse the vendored skills: should `main` carry the next version, or the fork's range start at the last release? **The user: the vendoring PR sets `package.json` to the release it lands in** (§9.4). (3, asked 2026-11-06 after seven fresh readers each found new, smaller points) How is the first acceptance criterion judged? **The user: one more fresh reader on the final head; the reviewer ticks it when none of the remaining points would make CC-105 build something the user would reject, and any real blocker is fixed first. Leftover points go to CC-105, which fixes the spec in its own PR.** (4, asked 2026-11-06 by a fresh reader's point) Can a release candidate be cut once `main` holds the next version (`0.9.2-rc.1` is lower than `0.9.2`)? **The user: yes, `release.mjs` also accepts a prerelease of the version `package.json` holds** (§9.4).

### CC-105 · Brain skills authored in the fork, a pinned snapshot in the package (decision 0059) · `done` (#229)
**Release:** 0.9.2
**Changelog:** the brain skills are written in the ultimate-brain-skills fork, and the ultimate-brain package ships an exact, tested snapshot of them.
**Output:** step 4 of docs/skills-migration-plan.md, built from CC-134's spec once it is on `main` (decision 0069; CC-133 split the spec out): a fork release that carries every skill change since brain-v1.0.0 and whose range includes the CLI being released; canonical skill authorship moves to the fork; the product build consumes an exact released snapshot and never edits generated copies; AGENTS.md, templates/brain/AGENTS.md and the docs say where skills are written; brains on older versions keep working until they upgrade.
**Acceptance:** the package delivers a snapshot whose integrity matches the fork's release; editing a generated copy fails a check; a synthetic brain on 0.8.1 upgrades without both repos changing at the same moment; `test:package` and the skill checks pass.

### CC-135 · A held report still gets its properties (dogfood #221) · `done` (#225)
**Release:** 0.9.2
**Changelog:** a report or Document whose text is held for your decision still gets its Origin, Project, Area and links in Notion unless you ticked it Accepted; only its text waits.
**Output:** #221: `sync render` leaves a note named by `wording_waiting`, `wording_held` or `accepted_wording` out of `items` whole (`WORDING_PENDING`), so reports moved by migration 0019 with no baseline kept an empty Origin, Project, Area and Asked in. Spec first (spec/cli.md §5.14.6 and the row 9 text in §5.14.7): such a note is rendered with its properties and with `body` and `sections` null, and `skipped` still names it for its body; then `src/commands/sync.ts` (the render) test-first; brain-sync and brain-catch-up say that only the text waits; migration 0019's text notes that moved pages keep hidden leftover Inbox properties (Kind, Brain Status). Also notion/brain-assistant.md: the Instructions say "a report's body" instead of "a Report row's body" (0.9.1 moved reports to Documents).
**Acceptance:** tests on a synthetic brain: a report with no baseline renders its properties with a null body and is listed as held for its body; a promoted Document with a pending revision does the same; a note with no hold renders as before; the existing sync tests pass; the skill mirror check and the leak check pass.

### CC-136 · brain upgrade rewrites concept links inside proposals (dogfood #220) · `done` (#227)
**Release:** 0.9.2
**Changelog:** `brain upgrade` also moves the links to old concept notes that sit inside proposals, so no proposal points at `knowledge/concepts/` after 0.9.1.
**Output:** #220: the 0.9.1 concept conversion (spec/cli.md §5.15 step 5a, `planConceptConversion` in src/commands/upgrade.ts) rewrites links in note bodies but not inside the frontmatter strings of proposals in `_proposals/` (`content:` and the other text fields). Spec first: whether applied proposals are rewritten too or kept as history (pending ones must be, or they fail on apply); then the CLI test-first; an upgrade run on an already-converted brain fixes the links it missed (the step is safe to run again).
**Acceptance:** tests on a synthetic brain: a pending proposal whose `content:` links a concept points at its Document after the upgrade and still applies; applied proposals follow the spec's rule; running the upgrade again on a converted brain fixes missed links and changes nothing else; `brain lint` is clean; the existing upgrade tests pass.
**Spec questions (CC-136, for the user):** 1. Applied and closed proposals: are their links rewritten too, or kept as history? 2. A pending `update_body` whose target's body the conversion rewrites: does its `before_hash` follow, or does it go stale? 3. On a brain already converted the old paths are not recorded: how does a second upgrade find where a dead `knowledge/concepts/` link points? 4. A pending `new_item` whose note is a concept fails on apply: is it converted too?
**Answers (the user, 2026-11-05):** 1. Every proposal is rewritten, whatever its status (Git keeps the old text). 2. `before_hash` follows the rewritten body when it matched the old one; a proposal already stale stays stale. 3. By file name: the learned Document with a `con-` id at `knowledge/references/<name>.md`, else the only one at `<name>-<n>.md`; none or several leaves the link with warning `CONCEPT_LINK_UNRESOLVED`; the repair reads note bodies too. 4. Yes: a `new_item` not yet applied whose note is a concept becomes a learned Document.

### CC-116 · CI catches a PR that drops its own task row · `done` (#226)
**Release:** 0.9.2
**Changelog:** development only: `pr-format` names a PR whose own task row is missing, instead of asking for a CHANGELOG.md line.
**Output:** found on #195: merging main into the branch dropped the task's own row, and `pr-format` failed with "PR must add its task line to CHANGELOG.md", because a task with no row falls to the 0.3.x path; `merge-ready` was red but the PR was merged, and CC-115 (#199) restored the row. scripts/pr-format.mjs fails first with "PR has no row for its task CC-N" when the head has no row for the branch's task; scripts tests; a line in docs/releasing.md or AGENTS.md on merging main into a branch (keep every row on both sides). Ask the user whether `main` should require `merge-ready` (branch protection is off today; decision 0040).
**Acceptance:** a scripts test: a PR head without its own task's row fails with the new message, and a 0.3.x task with no row-level Changelog still gets the old message; the user's answer on requiring `merge-ready` is recorded; `npm run test:scripts` and the leak check pass.
**Answer (user, 2026-11-05):** yes, `main` should require `merge-ready`: the repo is public now, so a free ruleset can enforce it. It changes decision 0040, so it is its own task, CC-138 in 0.10.0; CC-116 doesn't change the repo's settings.

### CC-118 · `brain repo refresh` adopts a kit for a legacy link and takes a new path · `done` (#224)
**Release:** 0.9.2
**Changelog:** a link made before kits takes its new kit, and a moved repo its new path, with `brain repo refresh`, without the brain listing the repo's files again.
**Output:** CC-104's spec questions 1 and 2 (answered 2026-11-04): spec/linked-repos.md and spec/cli.md §5.29 first (`repo refresh` applies a written kit to a legacy entry, and takes `--path` for a moved repo, both keeping `commit`; their checks and errors), then the CLI test-first in `src/commands/repo*`; brain-repos stops unlinking and linking again for these two cases, and its mirror.
**Acceptance:** tests on synthetic repos: a refresh of a legacy entry with a kit written applies the kit and keeps `commit`, and the next `repo changes` lists nothing again; a refresh with `--path` of a moved repo does the same; the existing repo tests pass; the skill mirror check passes.
**Spec decided (CC-118):** `repo refresh` never changes `commit`; a legacy entry adopts the kit in its repo, and stays `NO_KIT` when there is none and no `--path`; `--path` takes the checks of `repo add` plus the recorded commit, which must be in the repo at the new path and an ancestor of its `HEAD` (`REPO_COMMIT_UNKNOWN`), so a wrong repo is refused; `data` keeps its shape, `changed` also true for a new path; the log adds `path=` (cli §5.29, linked-repos §1, §5, §6, §9, §10).

## 0.10.0 — The brain assistant (decision 0064)

An assistant you ask, from the CLI, about the structure of your work: Areas, Domains, Projects and Tasks. It finds what's stalled, misplaced or missing, recommends, turns your thinking into captures, tasks and projects, and makes changes through Review rows, or directly after your yes in a live chat. On demand; the weekly scheduled run is CC-111 in 0.13.0. Starts after 0.9.0 is released, with its opening scope grill. The grill ran on 2026-11-05 (CC-137): decision [0072](../decisions/0072-ultimate-assistant.md) names it **Ultimate Assistant**, shows a report first and applies what you say yes to, with Review rows only when you ask.

**Plan (2026-11-06, CC-139):** the main session writes CC-108; beside it, build agents take CC-140 (fixtures), CC-141 (history move) and CC-138 (`main` requires `merge-ready`). Once CC-108 is on `main`, CC-109 is split into slices along its contracts and built in parallel; CC-110 runs on CC-140's fixtures.

### CC-108 · Contracts for the brain assistant (decision 0064) · `done` (#234)
**Release:** 0.10.0
**Changelog:** contracts for the brain assistant: what it checks in Areas, Domains, Projects and Tasks, how each finding becomes a Review row, and when it may change something directly.
**Output:** per decision 0072's six answers (the opening grill, 2026-11-05): a spec for the checks (signals and thresholds: stalled and overdue tasks, tasks without a project, active projects with no recent work or no next step, finished but open projects, misplaced or duplicate projects, empty Areas, Areas without a Domain), the proposal each finding makes (including how a Review row changes a Notion-owned field such as a project's Status), the direct-apply rule in a live chat, reading Notion live and linked repos' rollups, the report, the sub-agent file, any CLI helper (`brain` commands the skill needs).
**Acceptance:** a context-free Sonnet sub-agent reading only the contracts lists no question it would need answered to build CC-109; schema examples validate for each new proposal shape.

### CC-142 · Split CC-109 into four parallel tasks along spec/assistant.md §12 · `done` (#235)
**Release:** 0.10.0
**Changelog:** development only: CC-109's build is split into CC-143 (findings and skips in the CLI), CC-144 (Notion-owned changes and field moves as proposals), CC-145 (the sub-agent, templates and the Review migration), with CC-109 keeping the skill, its fork release and the blind run.
**Output:** spec/assistant.md §12 (merged in CC-108, #234) split along its seams, so four agents can build at once: CC-143, CC-144 and CC-145 start from `main` in parallel; CC-109 writes the skill in the fork alongside them and vendors and blind-runs it once the three are on `main`. This file only: the four rows.
**Acceptance:** every item of spec/assistant.md §12 belongs to exactly one of CC-109, CC-143, CC-144, CC-145; each new row has a Release, Changelog, Output and Acceptance line; CC-109 changes only its Output and Acceptance; no other task's row changes; `pr-format` and the leak check pass.

### CC-143 · `brain assistant findings` and `brain assistant dismiss` (spec/assistant.md §3, §8) · `done` (#240)
**Release:** 0.10.0
**Changelog:** `brain assistant findings` computes Ultimate Assistant's findings from your brain and a Notion snapshot (stalled and overdue tasks, finished or stalled projects, misplaced or duplicate projects, Areas with nothing active or no Domain), ranked, top 10 first, with your skips left out; `brain assistant dismiss` remembers a skip for 30 days.
**Output:** per spec/assistant.md §3 (terms, thresholds, signals, recommendations, scope, ranking and the cap), §8 (skips) and spec/cli.md §5.31: `brain assistant findings` and `brain assistant dismiss` (add and remove), the dismissal store `_assistant/dismissals.json` and the lint rule `assistant-dismissals`, test-first in `src/commands/assistant*` with synthetic fixtures; the test that validates `spec/examples/assistant/` against assistant.schema.json. No skill, no proposal kind, no template. A spec gap goes into the spec first, in the same PR.
**Acceptance:** tests per signal (fires at its threshold, not one day before), ranking and the cap with `--number-from`, scope filters, dismissals (active, expired, removed) and the rejected-Suggestion skip; `brain assistant findings` on a sandbox from `eval/acceptance-0.10.0` returns exactly planted.json's `planted` and none of `not_flagged`; the examples test passes; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-144 · Notion-owned changes and field moves as proposals (spec/assistant.md §6) · `done` (#236)
**Release:** 0.10.0
**Changelog:** a Review row can propose a change to a Notion-owned field, such as a task's Status or a project's Status, or a move of a project to another Area, and the brain applies it after your yes.
**Output:** per spec/assistant.md §6 and §7 and the schema §11, §14 and spec/cli.md sections it names: the proposal kinds `notion_change` and `set_field` in `proposal new`, `apply` (with `data.notion_writes`), `sync apply` and `sync render` (the Suggestion row: Kind `Notion Change` or `Set Field`); `brain proposal settle`; `sync tasks --direct` for a task created from a chat; test-first, synthetic fixtures. No skill text, no template, no Notion migration. A spec gap goes into the spec first, in the same PR.
**Acceptance:** tests: each `notion_change` property (task status, due, project, area; project status; area archived) proposed, applied to `notion_writes` and settled `applied`, `stale` and left `approved` on a failed write; `set_field` for a project's `area` (its open tasks follow, as §6.1 says) and an Area's `domain`, then rendered; a decided Suggestion row read by `sync plan` and applied by `sync apply`; `DUPLICATE_PENDING`; `sync tasks --direct` renders a task with no meeting or source; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-145 · The ultimate-assistant sub-agent, the brain templates and the Review migration (spec/assistant.md §10) · `done` (#239)
**Release:** 0.10.0
**Changelog:** a brain gets the `ultimate-assistant` Claude Code sub-agent (`claude --agent ultimate-assistant`), and the Review database gains the Suggestion rows Ultimate Assistant writes when you ask it to propose a change.
**Output:** per spec/assistant.md §10 and §12: `templates/brain/.claude/agents/ultimate-assistant.md`; `brain init` and `brain upgrade` write it, and its `product-file` check; `templates/brain/AGENTS.md`'s operations row (with the `report only` hand-off); the next Notion migration (`notion/migrations/0022-…`): Review · Kind gains `Notion Change` and `Set Field`, the Type formula gains **Suggestion** (docs/notion-space-design.md §3.10), with the agent and by-hand split and a Verify list as earlier migrations have; docs/notion-space-design.md and notion/prompts as they follow. No CLI proposal logic, no skill text.
**Acceptance:** tests: `init` writes the sub-agent file, `upgrade` writes and updates it, and the `product-file` check flags an edited copy; the migration says which steps the agent does through the API and which you do by hand, and its Verify list names the Kind options and the formula result; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-109 · The brain-assistant skill and its Claude sub-agent (decision 0064) · `done` (#237)
**Release:** 0.10.0
**Changelog:** "review my projects" finds stalled tasks, finished projects still open, misplaced projects and missing next steps, recommends what to do, and turns what you say into captures, tasks and projects, changing nothing without your yes or a Review row.
**Output:** per spec/assistant.md §1 to §9 and §12 (CC-142 split the CLI, templates and migration into CC-143, CC-144 and CC-145): the skill `ultimate-assistant` in the fork, with the `notion_writes` step in brain-apply, brain-sync and brain-catch-up, brain-howto and the guide, in one fork PR and the release ultimate-brain-skills 1.2.0 (`cli` `>=0.10.0-0 <0.11.0`); the skill is written in the fork beside CC-143 to CC-145, and the product PR vendors the release once those three are on `main` (skills-delivery §9.5). Ask the user before creating the fork release.
**Acceptance:** CC-109's blind run passes as spec/assistant.md §12 defines it, in a sandbox from eval/acceptance-0.10.0 with the fork branch's skill installed: the report's findings over the first page and "more" are exactly planted.json's `planted` and none of `not_flagged`; a yes on a Notion-owned change, a brain-owned move and a merge, a "propose N", a skip with a status offer and one without, and a ramble with a task, a project and a capture each land as §6 to §8 say; a write changed first in notion-sim settles `stale`; an injected failed write stays `approved` and is carried out first next session; a `report only` run writes nothing; `brain lint` is clean; the vendored snapshot's integrity matches the fork release; the skill checks and the leak check pass.

### CC-138 · `main` requires `merge-ready` · `done` (#231)
**Release:** 0.10.0
**Changelog:** development only: a ruleset on `main` requires the `merge-ready` status, so a PR can't merge without its format, its ticked boxes, its `done` (#N) and a reviewer's pass at its head.
**Output:** the user's answer on CC-116 (2026-11-05): a decision amending 0040's "it informs, it doesn't block" now that the repo is public (a free ruleset can require a status); the ruleset requiring the `merge-ready` commit status on `main`, with the repo admin as bypass actor so `release.mjs` can still push its release commit; what the user does when no reviewer can run; AGENTS.md and docs/releasing.md. The user turns the ruleset on; agents don't change repo settings.
**Acceptance:** the decision names the bypass and the case of an unavailable reviewer; on a test PR the Merge button stays disabled while `merge-ready` is red and enables once it is green; the next `release.mjs` push to `main` goes through the bypass; the leak check passes.

### CC-110 · 0.10.0 acceptance (decision 0064) · `done` (#243)
**Release:** 0.10.0
**Changelog:** development only: end-to-end acceptance of the brain assistant on a synthetic brain, attended, with Review rows and chat approvals.
**Output:** docs/acceptance-0.10.0.md: a scenario per finding kind, the Review-row path and the chat-yes path, a linked repo's rollup reviewed, Notion unreachable. eval/acceptance-0.10.0/RESULTS.md: the blind runs of every scenario (CLI 0.10.0, skills 1.2.0) and their findings. Two small fixes they found, in this repo: a move's label says "1 open task that names" (spec/assistant.md §4.1 first, then the CLI), and the fixture maps Tasks · Status as a select; every sandbox gets a `gh` that always fails. The fork's findings go to the user.
**Acceptance:** every scenario passes with its evidence; no change happens without a Review row or a yes; the Review workload of one run stays within the cap the contracts set.

### CC-137 · Record the 0.10.0 opening grill: Ultimate Assistant (decision 0072) · `done` (#223)
**Release:** 0.10.0
**Changelog:** development only: the 0.10.0 opening grill is recorded as decision 0072, which names the assistant Ultimate Assistant and settles how a review session goes.
**Output:** decision 0072 from the user's answers of 2026-11-05 (name, report first, fixed thresholds, where a ramble lands, whole brain top 10, dismissals); an "Amended by" pointer on 0064; this file: the 0.10.0 intro and CC-108's Output point to 0072, and the 1.0.0 section notes the Notion agent's rename. No code, no spec.
**Acceptance:** 0072 records each of the six answers as the user gave them; 0064 points to it; no other task's row changes except CC-108's Output; the 1.0.0 section notes the Notion agent's rename; the leak check passes.

### CC-139 · Plan 0.10.0: acceptance fixtures and the history move beside the contracts · `done` (#230)
**Release:** 0.10.0
**Changelog:** development only: 0.10.0 gains CC-140 (the acceptance fixtures) and CC-141 (finished releases move to HISTORY.md), built beside CC-108's contracts with CC-138.
**Output:** the user's plan of 2026-11-06 for 0.10.0: CC-108 written by the main session; in parallel, CC-140, CC-141 and CC-138 by build agents; CC-109 split into slices once CC-108 is on `main`; CC-110 runs on CC-140's fixtures. This file only: the 0.10.0 intro and the two new rows.
**Acceptance:** CC-140 and CC-141 each have a Release, Changelog, Output and Acceptance line; no other task's row changes; `pr-format` and the leak check pass.

### CC-140 · Acceptance fixtures for Ultimate Assistant (decision 0072) · `done` (#233)
**Release:** 0.10.0
**Changelog:** development only: a synthetic brain and a synthetic Notion space with planted project-management problems, for testing Ultimate Assistant.
**Output:** eval/acceptance-0.10.0/harness/, reusing the 0.9.0 harness (eval/acceptance-0.9.0/harness: install.sh, make-sandbox.sh, the notion-sim stand-in; copy or call, don't change 0.9.0's files): a fixture brain (synthetic names only, every module on, Domains on) and a notion-sim state with Areas, Domains, Projects and Tasks holding, each findable: a task with no edit for 20 days; a task 5 days overdue; a task with no project; an Active project with no task done and no brain mention for 30 days; an Active project with no open task; an Active project whose tasks are all done; a project under the wrong Area (its notes and meetings all belong to another Area); two projects that look like duplicates; an Area with nothing active; an Area without a Domain; a task already Waiting (not to be flagged); plus enough healthy rows that the planted ones aren't all there is, and more than 10 findings in total so the top-10 cap and "more" can be tested. A manifest (eval/acceptance-0.10.0/planted.json) lists each planted problem with its page ids and the signal that should find it; dates are relative to a fixed `as_of`, so the fixtures don't age. A README says how to make a sandbox. No CLI or skill change: signal names follow decision 0072 and the task text above; CC-108 may rename them, and a later commit follows.
**Acceptance:** `make-sandbox.sh` builds a sandbox whose `brain lint` is clean and whose notion-sim state loads; a check script confirms that every row in planted.json exists in the state with the dates and relations that make it a finding at `as_of`, and that the healthy rows trip none of 0072's thresholds; the leak check passes.

### CC-141 · Move the finished 0.9.x releases to HISTORY.md · `done` (#232)
**Release:** 0.10.0
**Changelog:** development only: the 0.8.1, 0.9.0, 0.9.1 and 0.9.2 sections move from TASKS.md to HISTORY.md, as AGENTS.md asks after each release.
**Output:** the 0.8.1, 0.9.0, 0.9.1 and 0.9.2 sections of build/TASKS.md moved verbatim to the end of build/HISTORY.md, in release order (0.8.1 added at the user's answer of 2026-11-06, so HISTORY.md stays in release order); the "v1 to 0.8.0" lines in both files say 0.9.2; TASKS.md keeps the release table, the status notes and the open releases; any link in docs or decisions that points at those sections still resolves; release.mjs and pr-format still find every done task (they read both files).
**Acceptance:** `git diff` shows the sections removed from TASKS.md and added to HISTORY.md with identical text; `npm run test:scripts` passes; `node scripts/release.mjs 0.10.0 --dry-run` lists no 0.9.x task; the leak check passes.

### CC-148 · A merge leaves the duplicate's generated views alone (schema §11.2) · `done` (#242)
**Release:** 0.10.0
**Changelog:** merging two projects (or any two notes) no longer rewrites the duplicate's own Brief and Decision log to point at the survivor, so `brain views` and `brain lint` stay clean after a merge.
**Output:** found by CC-109's blind run (PR #237), the user's choice of 2026-11-07 to fix it beside CC-109: schema §11.2's `merge` step 1 rewrites references "in every note except X, Y, sources and proposals", which includes views; after Ultimate Assistant merged two projects, the duplicate's `brief.md` and `decision-log.md` named the survivor, `brain views` failed with `MARKERS_INVALID` on both and lint warned `view-stale`. Spec first: step 1 also leaves views alone (they are regenerated by `brain views`: the duplicate's stay with the archived duplicate, other views follow their sources), then the merge apply, test-first with a synthetic fixture. Before CC-110.
**Acceptance:** a test merges two projects that each have a Brief and a Decision log, and the duplicate's views still name the duplicate, `brain views` writes no error and `brain lint` reports no `view-stale`; the other notes' references are still rewritten as before; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

## 0.10.2

### CC-150 · Skills 1.2.1: the CC-110 wording fixes, vendored · `done` (#246)
**Release:** 0.10.2
**Changelog:** Ultimate Assistant's skill wording follows its contracts more closely (ultimate-brain-skills 1.2.1): a ramble keeps the session open, a delegated run carries out waiting Notion writes, and the log line and the summary count the same things.
**Output:** the skill findings of CC-110's blind runs (eval/acceptance-0.10.0/RESULTS.md §4: 2, 3, 4, 7, 8, 10) fixed in the fork (ultimate-brain-skills PR, `compatible`), released as brain-v1.2.1 after the user's yes, and vendored in `.agents/skills/` (spec/skills-delivery.md §9.5); `.agents/skills/` is not edited by hand. Also: the 0.10.0 section moves verbatim to build/HISTORY.md, and `src/cli.ts` lists `proposalReviseCommand` once in COMMANDS.
**Acceptance:** the vendored snapshot is ultimate-brain-skills 1.2.1 and passes the snapshot check; the six findings each have their fix in the vendored text; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass; the skills-integration check reports 0 unclassified.
**Spec decided (CC-150 review, 2026-11-07):** skills-delivery §9.5 step 2 contradicted §10.4 (a vendored fork PR was always `coordinated`); the user chose §10.4's rule: `coordinated` only when the skill needs the product PR's change, otherwise `compatible`, with a `Product:` line either way. Fork PR #6 (`compatible`, no `Product:` line) predates the fix; §10.4 ignores the line for `compatible`.

## 0.11.0 — The brain tidies itself (decisions 0052, 0061, 0064, 0076)

Reflection across notes: contradictions, stale facts, duplicates, promotions and recurring themes, shown first in the chat; what the user says yes to is applied, "later" becomes a Review row, and nothing changes silently (0076). On demand only; the weekly run is 0.13.0's brief (CC-111). Candidates follow `brain query`'s restricted-evidence rule (0055). The agency brain's move-in comes after 1.0 and no longer gates it (0076).

### CC-65 · Contracts for reflection (decision 0052) · `done` (#257)
**Release:** 0.11.0
**Changelog:** contracts for reflection: candidates, the proposal fingerprint, and three new lint warnings.
**Output:** spec/cli.md: `brain reflect --candidates` (its four signals, the window, which lifecycles each signal reads, the cluster JSON, how fingerprints already on rejected or pending proposals are left out); the `orphan`, `note-size` and `near-duplicate` warnings in §5.10, with the name-matching rule; §6's reflection sequence: each finding's proposal kind, the cap of 10 rows and its order, a theme's draft and its Review notes row, the report, unattended. spec/schema.md: `fingerprint` on proposals and how it is formed. The unattended table of cli.md §6.1 becomes the one authority for what an unattended run may do: capture-and-review §8's selected-input rows move into it (§8 keeps a pointer), and the skills' tables are renderings of it (assessment finding F-0007). Per decision 0076: the chat flow (findings ranked top 10 then "more", the yes, later and skip answers and the proposal each records, a contradiction asking which value holds), the skip rule per kind and how the fingerprint records it (a merge stays skipped; a fact, contradiction or promotion returns on a newer source; a theme on a higher source count), the restricted-evidence rule of §5.13 in `reflect --candidates`, a theme as a draft learned Document, and the `note-size` scope; no unattended reflection rows (on demand only in 0.11.0), so §6's reflection sequence is the attended one.
**Acceptance:** the reviewer (or Codex) finds CC-66 and CC-67 buildable from the contracts with no spec question; every point of 0076 has its place in the contracts; schema examples validate for a `merge` and a `contradiction` proposal carrying a fingerprint.

### CC-66 · `brain reflect --candidates`, fingerprints and the new lint warnings (decision 0052) · `done` (#260)
**Release:** 0.11.0
**Changelog:** `brain reflect --candidates` finds likely duplicates, overtaken notes, notes that may disagree and recurring terms; proposals carry a fingerprint; lint warns on orphans, oversized notes and near-duplicate names.
**Output:** per CC-65: the command (with `brain query`'s restricted-evidence rule), `fingerprint` in `brain proposal new` and its validation, the skip rule per kind, the three lint warnings (`note-size` checks `learned` and `promoted` Documents and skips sources and `whole`, `part` and `workflow` ones, 0076), the code and tests.
**Acceptance:** tests on the fixture brain: two people "María López" and "M. Lopez" give a near-duplicate candidate and a `near-duplicate` warning; once a `merge` with their fingerprint is rejected, `--candidates` no longer gives the pair; a reviewed person note older than two meetings naming her gives an overtaken candidate; a term in three sources with no note gives a recurring-term candidate, and in two it doesn't; a 12 KB learned Document gives `note-size`, a 12 KB source or `whole` Document doesn't; a skipped contradiction stays held (in its cluster's `held`) until an input not in its `evidence`, created on or after the skip, names its note (spec/schema.md §11.4; whether that input bears on the field is the skill's check, CC-67); a restricted note is neither evidence nor a target; a learned Document nothing references and with no project or area gives `orphan`.

### CC-67 · The brain-reflect skill (decision 0052) · `done` (#262)
**Release:** 0.11.0
**Changelog:** "tidy the brain" finds contradictions, stale facts, duplicates, promotions and recurring themes, shows them in the chat and applies what you say yes to; "later" puts one in Review, and a skipped one isn't asked again until something changes.
**Output:** skills/brain-reflect: the candidates, the judgment per finding kind (reviews/08 §1: contradiction or evolution, merge or cross-link, stale or still valid, theme or chatter, promote or keep), report first per CC-65 and 0076 (yes, later and skip, top 10 then "more"), the proposals and drafts, the report; no schedule section (on demand only in 0.11.0); the Ultimate Assistant sub-agent loads the skill too; templates/brain/AGENTS.md lists the skill; brain-howto and the user guide.
**Acceptance:** blind runs on a synthetic brain built with CC-41 with planted problems: a duplicate person is shown as one merge finding naming the survivor, and a yes merges it; a launch date that a later decision moved is shown as a contradiction or stale fact, and the brain asks which value holds before applying; a theme in four meetings is shown, and a yes writes a draft learned Document in a Review notes row, while one in two meetings shows nothing; "later" writes one Review row and changes nothing else; 15 planted problems show 10, contradictions first, and say 5 more, which "more" shows; a second run after the user skips the duplicate doesn't show it again; with nothing found, nothing is written; from the Ultimate Assistant sub-agent, "tidy the brain" runs the skill; the skill mirror check passes.
**Spec question (answered):** `brain schedule install reflect` (cli.md §5.21) still wrote a `tidy the brain unattended` job, against 0076 §5. Answered by 0076 itself: the job goes, in CC-159 (§5.21 loses the `reflect` row, `schedule.ts` refuses it with `USAGE`). brain-reflect never calls `brain schedule` and names no schedule.

### CC-149 · Record tool-agnostic coordination as a future backlog idea · `done` (#245)
**Release:** 0.11.0
**Changelog:** development only: an optional, tool-agnostic coordination profile for the shared skills is recorded as a deferred post-1.0 idea in the backlog.
**Output:** docs/v2-ideas.md: a self-contained entry under "Automation and platform", next to the Hermes operator idea, with the goal, the portability requirement (no dependence on Orca or any one tool), scope, the working preferences from the user's 2026-11-07 discussion, guardrails, what to measure and the inspiration links; a pointer in the post-1.0 disposition row. Documentation only, on the user's instruction to save the idea for the future: 0.11.0 is this recording task's bookkeeping release and schedules nothing; no implementation, decision, spec, config, skill or CHANGELOG change, and the profile's file name and keys stay undecided.
**Acceptance:** the entry reads on its own (no links to temporary files) and says it is deferred, post-1.0, with no promised release and revisited only on an explicit request; it keeps tool independence (Orca optional, missing capabilities surfaced, portability evidence from more than one environment including one without Orca) and every working preference and guardrail from the discussion, framed as a sketch to revalidate rather than a binding contract; no task, release or roadmap commitment changes and no file other than docs/v2-ideas.md and this row changes (`git diff --stat main`); the leak check and PR format check pass.

### CC-151 · Plan the assessment fixes as 0.11.0 tasks · `done` (#247)
**Release:** 0.11.0
**Changelog:** development only: the 2026-11-07 assessment's findings become tasks: all in 0.11.0: the linked-repo query fix (CC-152), one Inbox row per source after an interrupted publish (CC-153), the Notion build files in the package (CC-154), the release rule for a partial `main` (CC-155) and the first-hour guidance (CC-156).
**Output:** the user's decisions of 2026-11-07 on the independent assessment of `1eedf6c` (its run records live outside this repo): F-0008 ships in 0.11.0 (0.10.0 was published on 2026-11-07 before this plan; the user chose 0.11.0 over a 0.10.1 patch); the Notion files ship in the npm package; the partial-`main` rule is enforced in `release.mjs`; a drifted pinned skill keeps reporting without blocking (no task). This file only: the five rows, one sentence in CC-65's Output (the unattended table's one authority), one sentence in the 0.12.0 work packages (the retrieval baseline), one sentence in the 1.0.0 note (Clean email on Ready rows), the release table and a status line.
**Acceptance:** CC-152 to CC-156 each have a Release, Changelog, Output and Acceptance line; CC-152 to CC-156 sit under 0.11.0; no other task's row changes except CC-65's Output sentence; `pr-format` and the leak check pass.

### CC-152 · `brain query` reads the `.brain` marker `brain link` writes (one reader for both) · `done` (#249)
**Release:** 0.11.0
**Changelog:** `brain query --candidates` works again in a repo linked since 0.9.0: the `skills` entry `brain link` records in `.brain` no longer makes the query refuse with "invalid format".
**Output:** assessment finding F-0008 (P1): `link` writes `skills` into `.brain` (skills-delivery §6.2) and `query`'s own validator (`src/lib/query.ts`) rejects any key but `repo`, `project`, `area`, `stacks`, so every repo `brain link` wrote since 0.9.0 answers `USAGE` to its first query. One `.brain` reader in `src/lib/` (the validation `link` has today) used by `link`, `query` and `repo-health`; spec/cli.md §5.13 says `query` reads the marker as §5.12 defines it and ignores nothing it doesn't know about silently: an unknown key is still `USAGE`; the brain-query skill's "Where the brain is" names what to do on exit 2 (a fork PR, vendored by CC-150 or the next skills release). Test-first.
**Acceptance:** a test links the fixture brain to a temp repo with `brain link` (plain, and with `--project`) and runs `query --candidates` from that repo and with `--repo`: candidates return, with the project's +3 boost in the second case; a `.brain` with an unknown key is still refused; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-153 · One Inbox row per source after an interrupted publish (cli.md §5.14.1, §5.14.2) · `done` (#251)
**Release:** 0.11.0
**Changelog:** a run that stopped between writing an Inbox row and recording it no longer creates the row a second time: the next pull recognises the row by its Brain ID, and the ingest looks a row up before creating it.
**Output:** assessment finding F-0005 (P2), both layers: spec first (cli.md §5.14.1: the sync skill passes every Inbox row's `page_id` and Brain ID, ids only; §5.14.2: a row whose Brain ID names a source with no `notion` sets it in `updates`, as Review rows and knowledge databases do today), then `src/lib/sync.ts` test-first; in the fork, brain-sync "Pull" step 2 passes those rows and brain-ingest references/notion.md "Publish" looks an Inbox row up by Brain ID before a `create` and rewords "If Notion fails partway" to match; one fork release, vendored here.
**Acceptance:** tests: `sync plan` with an `inbox` row carrying a source's Brain ID and no `notion` on the source returns an `updates` entry, and `sync apply` sets `notion`, so the next `render --changed` no longer creates it; a `capture` source is unaffected; the skill checks pass in the fork; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-154 · The Notion build files ship in the package · `done` (#252)
**Release:** 0.11.0
**Changelog:** the Notion checklist, build prompts, module steps and migrations install with the CLI, and every message that sends you to them names the folder on your machine.
**Output:** assessment finding F-0009 (P2): the npm tarball has no `notion/` and no `docs/notion-space-design.md`, yet brain-connect-notion, brain-notion-change, the brain's AGENTS.md and the `upgrade` warning `DOCUMENTS_TURNED_ON` point at them. `package.json` `files` gains `notion/` and the design doc; `brain status --json` reports the installed package root (`data.product.path`, spec/cli.md §5.2) so skills and warnings can name `<root>/notion/…`; README "Install" says where the files are; the skill wording in the fork (brain-connect-notion, brain-notion-change, brain-howto's guide) names the path through `brain status`, one fork release; `scripts/test-package.mjs` checks the files are in the tarball.
**Acceptance:** `npm pack` lists `notion/CHECKLIST.md`, every `notion/prompts/*.md`, `notion/modules/*.md`, `notion/migrations/*.md` and `docs/notion-space-design.md`; `brain status --json` has `data.product.path` and `test-package.mjs` asserts the files exist under it; the `DOCUMENTS_TURNED_ON` warning names a path that exists in the packed install; the leak check passes.

### CC-155 · `release.mjs` refuses a version below the work already on `main`; the docs say what is current · `done` (#254)
**Release:** 0.11.0
**Changelog:** development only: a release is refused when no task row has its version, or when `main` already holds done tasks of a later release (unless `--allow-partial` with a reason), and docs/vision.md and synthesis/synthesis.md say which parts are history.
**Output:** assessment findings F-0001 and F-0002, as the user decided on 2026-11-07: rule 10 in docs/releasing.md and `scripts/release.mjs` ("the version is not lower than the highest `**Release:**` of a `done` task on `main` that is not yet in CHANGELOG.md; `--allow-partial "<reason>"` overrides and is written into the release commit message"), test-first in `tests/release-scripts.test.mjs`; docs/releasing.md says how a patch ships when `main` is partial (the user, 2026-11-08: today's route, since `release.mjs` releases only `main`: `--allow-partial` from `main`, or wait for the later release; a patch from the last release tag has no tooling and becomes a task if needed); as built, "not yet in CHANGELOG.md" means the task's release has no dated CHANGELOG section, and a row whose **Changelog:** starts `development only` ships nothing and doesn't count (CC-146 and CC-147 are such rows on `main`); docs/vision.md "Planned in 0.8.0" becomes "Since 0.8.0"; synthesis/synthesis.md gets a top line pointing to spec/schema.md §2 for the current layout. Issue #250 joins it: rule 11 in docs/releasing.md and `release.mjs`, `--dry-run` included, refuse a version that no task row on HEAD has (TASKS.md or HISTORY.md, a `dropped` row not counted): `no task has **Release:** <version>; merge its PR first`, as 0.10.1 was published empty on 2026-11-07.
**Acceptance:** `release.mjs 0.10.1 --dry-run` on a tree with no 0.10.1 row, or only a `dropped` one, is refused with that message; `release.mjs 0.9.3 --dry-run` on a tree whose TASKS.md holds a `done` 0.10.0 task is refused naming that task, and passes with `--allow-partial "<reason>"`; the existing release-script tests still pass; the two docs read as described; the leak check passes.

### CC-156 · The first hour: the next step after `brain init`, and two error messages · `done` (#253)
**Release:** 0.11.0
**Changelog:** `brain init` and the README say what to do next (build the Notion space from the checklist, then connect), `brain query` without `--candidates` points to the brain-query skill as the contract says, and `brain modules list` is accepted.
**Output:** the assessment's fresh-user walk (stage 05): after `init` nothing names notion/CHECKLIST.md or "connect the brain to Notion"; `brain query "<q>"` answers "Unexpected argument" where spec/cli.md §5.13 promises a usage error that points to the skill; `brain modules list` is a natural guess the contract doesn't take. `init`'s human output and README "Install" gain the two next steps (naming CC-154's installed path once it exists, else the repo folder); `query` without `--candidates` prints the §5.13 message; `modules list` becomes an accepted alias of `brain modules` (cli.md §5.20). Test-first; no new command.
**Acceptance:** tests for the three behaviours; `init`'s human output names the checklist and the connect step; `npm test`, `npm run typecheck`, `npm run test:package` and the leak check pass.

### CC-157 · Record the 0.11.0 reflection grill: chat first (decision 0076) · `done` (#255)
**Release:** 0.11.0
**Changelog:** development only: the 0.11.0 opening grill is recorded as decision 0076: reflection reports first in the chat like Ultimate Assistant, runs on demand, and leaves the weekly run to 0.13.0.
**Output:** decision 0076 from the user's answers of 2026-11-08 (report first with yes, later and skip; a yes per kind; top 10 then more; skips by kind; themes as learned Documents; on demand only, the weekly run in CC-111; query's restricted-evidence rule; the `note-size` scope; one skill loaded by the assistant's sub-agent; no move-in gate on U-21); an "Amended by" pointer on 0052; this file: the 0.11.0 table line, heading and intro, CC-65, CC-66 and CC-67's Output and Acceptance, CC-67's Changelog, CC-111's Output and Acceptance, and U-21. Planning only: no code, spec or skill change.
**Acceptance:** 0076 records each of the thirteen answers as the user gave them; 0052 points to it; no task row other than CC-65, CC-66, CC-67, CC-111, U-21 and this one changes (`git diff main -- build/TASKS.md`); no Changelog line is lost; the leak check and PR format check pass.

### CC-158 · Test temp folders are removed without ENOTEMPTY flakes · `done` (#261)
**Release:** 0.11.0
**Changelog:** development only: the tests turn off Git's background maintenance and retry removing their temp folders, so `npm test` no longer fails at random with ENOTEMPTY.
**Output:** on 2026-11-08 `npm test` failed three times with `ENOTEMPTY` while removing a temp brain's `.git/objects` (tests/review-apply.test.ts twice in a release run, tests/workflow.test.ts in #259's review, also on a copy of `main`). The cause: since Git 2.5x every commit starts a detached `git maintenance run --auto --detach` (seen with `GIT_TRACE`), which can still write into `.git` while the test removes the folder. tests/helpers.ts sets `maintenance.auto=false` and `gc.auto=0` through `GIT_CONFIG_*` for the test process, after any entries already set, so every git a test starts, directly or through the in-process CLI, inherits it; `fixtureCopy` and the package root's removal retry (`maxRetries`). Tests only: no product code.
**Acceptance:** tests/test-git-env.test.ts: a commit traced with `GIT_TRACE` starts no `maintenance run`, and the settings land after existing `GIT_CONFIG_*` entries; the full `npm test` passes three runs in a row; `npm run typecheck` and the leak check pass.

### CC-159 · `brain schedule` has no reflect job in 0.11.0 (decision 0076) · `done` (#263)
**Release:** 0.11.0
**Changelog:** `brain schedule install reflect` is refused: reflection runs only when you ask in 0.11.0, and its weekly run comes with 0.13.0's weekly review.
**Output:** the spec question CC-67 raised: spec/cli.md §5.21 and `src/commands/schedule.ts` still offered a `reflect` job (`tidy the brain unattended`, from 0052) that would start brain-reflect unattended once CC-67 ships it, while 0076 §5 gives reflection no schedule and no unattended mode in 0.11.0. The job leaves §5.21's table and the code (an unknown job is `USAGE`), §5.21's opening says why and where the weekly run goes (CC-111), and `SKILL_MISSING`'s example in §3 names `catch-up`. Test-first.
**Acceptance:** tests/unattended.test.ts: `schedule install reflect …` is `USAGE`, and `catch-up` in a brain without brain-catch-up is still `SKILL_MISSING`; no file in the repo outside build/HISTORY.md names a `reflect` schedule job (`git grep`); `npm test`, `npm run typecheck` and the leak check pass.

### CC-160 · A contradiction resolved to a value a claim holds keeps that claim's source (wording, decision 0076) · `done` (#265)
**Release:** 0.11.0
**Changelog:** when you settle a contradiction with a value of your own, the brain records it as your correction; choosing one of the values the notes already claim keeps that note as its source.
**Output:** CC-67's review (#262, finding 2) and the user's answer of 2026-11-08: keep the attribution of a chosen claim and fix the wording. Writing it showed the other half missing: `resolveContradiction` (src/lib/apply.ts) gave every new entry the proposal's `source`, even a value the user typed, where schema §11.2 (CC-65) says `user-correction:<proposal id>`. Now a new entry keeps the proposal's `source` when its value is the proposal's `after`, and is `user-correction:<id>` otherwise; schema §11.2 says so, and 0076 gets a "Clarified" line for §1's table. Test-first.
**Acceptance:** tests/apply.test.ts goldens: `contradiction-edit` to a value no claim holds appends it with `source: user-correction:prp-0a1b2c3d`; the new `contradiction-edit-to-claim` to the proposal's `after` keeps `source: mtg-8c4n2p7w`; `npm test`, `npm run typecheck` and the leak check pass.

## 0.11.1

### CC-161 · reflect --candidates gives fewer, truer clusters: shared ground without one ingest's context, terms without boilerplate (#266) · `done` (#267)
**Release:** 0.11.1
**Changelog:** `brain reflect --candidates` finds far fewer, truer clusters: shared ground ignores the meeting and project notes were taken from, and terms skip link targets, URLs, code, sign-offs, contractions, function words and people's names.
**Output:** spec/cli.md §5.32 (common ground, prose of a line, term stopwords, boilerplate, the person-name rule); `src/lib/reflect.ts`; two tests in `tests/reflect.test.ts`. Dogfood #266: on the real brain the run went from 387 clusters to 53 (13 shared ground, 2 overtaken, 38 terms; counts only, nothing from the brain in this repo).
**Acceptance:**
- [ ] Two notes whose only common references are a meeting, a source, a domain, an area, a goal or a project, plus one other reference, are no `shared_ground` cluster; with two other references in common they are, and `shared` lists only those (test `common ground leaves out the meeting and the project…`).
- [ ] A term is never built from a link target, a URL, an email, a domain or file name, inline code, a line repeated in two or more window inputs, a one-character token, a contraction or term stopword at its edge, or a token of a person's name; a true term still clusters (test `a term never comes from link targets…`).
- [ ] spec/cli.md §5.32 defines every rule above, and its term stopword list equals the code's.
- [ ] `npm test`, `npm run typecheck` and the leak check pass.
