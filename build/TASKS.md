# Build Plan v1

**Owners:** `CC` = Claude Code · `CX` = Codex · `U` = you (the user).
**Status values:** `todo` · `in progress` · `review` · `done` · `blocked`.
**Rules:** see "Multi-agent rules" in [AGENTS.md](../AGENTS.md). Update only your own rows.

> **2026-10-11 — Codex out of tokens.** Claude Code has taken over every open CX task, on `claude/<task-id>-<slug>` branches. Until Codex is back, each PR is reviewed by a fresh-context Claude reviewer that posts its findings on the PR; the author fixes them and the user merges. Build order: CX-09 → CX-04 → CX-05 → CX-06 → CX-03 → CX-07 → CX-08, then CC-05/CC-06.

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

### CX-03 · `brain init`, `status`, `config`, `id new` · `todo` (needs CC-01, CC-02, CC-03)
Also `brain status`, `brain config get/set`, `brain id new` (spec/cli.md §5.2–5.4), and the CX-02 alignment items from the #4 review (error codes, `BRAIN_NOT_FOUND`, contained mkdir, non-brain roots). Create a new brain from `templates/brain/` at a given path; initialize git; write `schema_version` into `brain.json`; never overwrite an existing non-empty folder without `--force`. **Acceptance:** per CC-03; test creates a brain in a temp dir and lint passes on it.

### CX-04 · Index builder · `done` (PR #10)
`brain index` regenerates `index.md` from frontmatter (0013): one line per note with id, title, summary, type, area/project, status, aliases, grouped by type; deterministic ordering; computes relation inverses. Also `brain log` and the shared log append helper (`log/YYYY-MM.md`, spec/cli.md §3.9, §5.11). **Acceptance:** identical output on repeated runs; fixture test against an expected file.

### CX-05 · Lint · `done` (PR #11; `view-stale` lands with CX-07)
`brain lint`: validate frontmatter against the JSON schemas; IDs present, well-formed, unique; links resolve (relative Markdown links and relation targets); no `[[wikilinks]]`; provenance markers well-formed; freshness warnings (0011, warnings only in v1); derived views not cited as sources. JSON output with severity, file, line. **Acceptance:** one fixture per rule, passing and failing.

### CX-06 · Notes, proposals and apply · `todo` (needs CC-01, CC-03)
`brain note new` (spec/cli.md §5.5) and `brain proposal list`. `brain proposal new` writes a proposal file from JSON input. `brain apply --input <file.json>` applies decisions (`approve`, `reject`, `edit` with value) to target notes: append `timeline:` entries, change assessment, set supersedes/superseded_by on both notes, mark proposals applied/closed. Also applies user corrections from Notion edits (0023, 0027). Pure and deterministic; each proposal writes only its kind's write set (spec/schema.md §11.2). Also brings `src/lib/frontmatter.ts` in line with spec/cli.md §3.6.5 (flow-style scalar lists, key positions). **Acceptance:** golden-file tests for each proposal kind; re-applying the same decisions is a no-op.

### CX-07 · Derived views · `todo` (needs CC-01, CC-03)
`brain views` regenerates `projects/<slug>/brief.md` and `decision-log.md` from canonical notes inside `@generated` markers, preserving `@user` blocks (synthesis §4.5). Also adds the `view-stale` lint warning (spec/cli.md §5.10). **Acceptance:** user block survives regeneration; every item line links to its source note (spec/schema.md §16).

### CX-08 · `brain link` · `todo` (needs CC-03)
Write `.brain` (project, area, stacks) in a target repo and insert or update a fenced "consult the brain" block in its `CLAUDE.md` / `AGENTS.md` (0006, 0009). Idempotent. **Acceptance:** running twice yields the same files; existing content outside the fence untouched.

### CX-09 · Fixture brain · `done` (PR #9)
`tests/fixtures/brain-acme/`: a small synthetic brain (fictional client Acme, people, a project with key-fact timelines, decisions incl. one superseded, open questions, one goal) that passes lint. Used by all tests and by CC-07. **Acceptance:** fictional data only; covers every v1 note type.

### CC-05 · Skill packaging · `todo`
One source per skill in `skills/<name>/SKILL.md` (frontmatter: `name`, `description` only), packaged as a Claude Code plugin and mirrored to `.agents/skills/` for Codex. Document the build step.

### CC-06 · Ingest skill · `todo` (needs CC-01, CC-03)
`skills/brain-ingest/`: fetch Reviewed meetings (MCP), snapshot source, match via index, load ≤8 notes (0013), two-step analyse → generate, decision gate, subject-boundary and verbatim rules, output new notes + proposals + tasks through the CLI, fill Meeting relations, set Ingested (0007, 0012). **Acceptance:** runs end to end on the fixture brain with synthetic minutes, Markdown-only mode first.

### CC-07 · Ingest evaluation · `todo` (needs CX-09)
Five synthetic meetings with expected extractions (decisions, fact changes, contradictions, people, questions, tasks), a scoring script spec for Codex to implement if useful, then the dry run on your real minutes (U-03) in Markdown-only mode.

---

## Wave 3 — Notion and query

- **CC-08 · connect-notion + sync skills:** find databases via MCP and write `brain.json`; import new rows (0021), read Notion-owned fields, detect your edits to brain-owned values (0023), publish brain records.
- **CC-09 · apply skill:** read Review decisions via MCP → `brain apply` → update Review rows and pages.
- **CC-10 · query skill:** retrieval ladder, cited answers separating accepted / contested / superseded facts.
- **CC-11 · notion-change skill:** spec diff → Notion AI prompts → drift check via MCP (0022).
- **CX-10 · sync helpers:** CLI functions the sync skill calls (diff Notion snapshot JSON vs notes, produce correction and creation plans).
- **CX-11 · query helpers:** `brain query --candidates "<q>"` returning ranked notes from index + grep with snippets.
- **CX-12 · packaging:** publishable npm package so `npx ultimate-brain init` works; plugin bundle includes skills. Publish **compiled JavaScript** (Node won't strip types inside `node_modules`); development in the repo stays build-free. Until then, run the CLI with `node src/cli.ts` (answers CX-01's spec questions).

## Wave 4 — Dogfood
- **CC-12 · end-to-end run with you;** **CX-13 · fixes;** **U-05 · two weeks of real use** against the v1 success criterion in vision.md.

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
