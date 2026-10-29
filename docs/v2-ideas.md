# v2 Backlog

Everything deliberately deferred from v1, in one place. Each entry names what it would change and, where known, when to revisit it. Nothing here is scheduled; pick from it after the v1 dogfood (U-05).

Sources folded in: docs/vision.md "v2", synthesis/synthesis.md §3.3, decisions 0008, 0010, 0011, 0015, 0028, 0030, the CC-12 dogfood (2026-10-13), and reviews/06-okf-and-gbrain.md (2026-10-19). Open v1 fixes stay in build/TASKS.md (dogfood table); rejected ideas stay in synthesis §3.4.

## Onboarding and getting knowledge in

### Onboarding suite
**Not scheduled:** moved out of 0.4.0 on 2026-10-20 (no second user yet; 0.4.0 is about payback, CC-35). The owner's identities and finding 3 shipped in 0.3.0 (CC-26).

**Adds:** a `brain-onboard` skill (or agent) that interviews a new user and populates the brain and Notion, so a new brain is useful on day one instead of empty.

It would orchestrate the existing skills in one guided flow:
1. **Install and connect:** check `brain`, give the agent access to Notion (dogfood finding 3), run `brain init` and brain-connect-notion.
   - **Converters:** check `markitdown --version`. If it's missing, explain that it turns Word, PowerPoint, Excel and saved HTML files into text the brain can read (PDFs and images are read natively in Claude Code), and offer `pipx install 'markitdown[all]'` (installing `pipx` first if needed). Codex also needs it for PDFs. Raised by the user on 2026-10-15, when the first Word file failed for lack of it.
2. **Interview:** who the user is and their work; their areas, goals and active projects; the people and organisations they work with; what they want to track. One topic at a time, with examples, and it suggests answers from what's already in Notion.
3. **Populate:** create the answers as rows in Notion (Areas, Goals, Projects, People, Orgs), then run brain-sync, so Notion and the brain start identical and the first ingest has something to match.
4. **Seed from existing material:** offer to import documents the user already has (see "Document ingestion" below) and recent meeting notes.
   - **Drop folder, asked up front:** ask which folder the user will drop documents into for ingest (e.g. `~/Documents/brain-dropbox/`) and explain why it lives **outside both repos**: originals stay where they are and the brain keeps only the converted text, the file name and its hash (decision 0032), so private files never enter Git history, and the product repo never holds personal data (0014). Store the path in the brain's personal rules (or a `brain.json` setting, if one is added), so "ingest my drop folder" works without asking again. Raised by the user on 2026-10-15.
5. **Personal rules:** write names, language and confidential clients into the user section of the brain's AGENTS.md.
6. **First run:** walk through one real ingest and one query, end to end, and show where to review.
7. **Link code repos** with `brain link`.

**Setup pattern (reviews/08, 2026-10-29):** read what the brain and Notion already know first and show it for overrides; check each connector (Notion MCP, converters, Hermes) with a read-only call instead of asking whether it is set up, reporting found and working / found but failing / not found; ask only the gaps; end by scheduling the catch-up (0051) rather than telling the user to.
**Ties to:** capability profiles (decision 0030) choose the interview questions, examples and views; findings 3 and 4 from the dogfood.
**Why:** the first real setup took a long session of manual steps (init, MCP access, sync before ingest, filling Date and Attendees). A second user won't get through that alone.
**Revisit:** before the second user.

### Document ingestion (file → Markdown)
**Adds:** ingest documents beyond meeting notes: PDF, Word, PowerPoint, Excel, HTML, images. A converter turns each file into Markdown, then the ingest treats it like minutes: source snapshot, extraction, new notes as drafts, proposals for changes.

Candidate converters, to evaluate on the user's real files:
- **MarkItDown** (Microsoft, Python, MIT): PDF, DOCX, PPTX, XLSX, HTML, images, audio; LLM-friendly output; simplest to start with.
- **Docling** (IBM, Python, MIT): stronger PDF layout and table extraction, OCR.
- **Pandoc**: mature for DOCX and HTML; weak on PDF.
- **Marker**: high-quality PDF to Markdown; check its licence before shipping it.

**Design notes:**
- The converter runs as an external tool the skill calls, not a CLI dependency, so the CLI stays small (0016). The skill checks it is installed and says how to install it.
- The source note stores the converted text verbatim, plus the original file name and hash. The original file stays outside the brain, or in a sources folder if the user wants it in Git.
- Needs a source key form for files (the schema has `notion:`, `url:` and `agent:` today); for example `file:<sha256>`.
- Extraction rules for documents differ from meetings: no attendees or action items by default; facts, decisions and people still apply.

**Revisit:** with the onboarding suite (seeding), or when the user wants to ingest contracts, briefs or reports.

Document ingestion from local files, pasted emails and chat, and the Capture Inbox is **planned for 0.2.0** (build/TASKS.md). Left here for later:
- **Notion file uploads:** the agent fetches files attached to Inbox rows and meeting pages. In 0.4.0 (decision 0042).
- ~~**A Sources database in Notion**~~: decided in 0037 as the Inbox (every input with Kind, Summary and Produced), for 0.3.0.
- **Docling or Marker** as a second converter: the 0.2.0 bake-off (decision 0032) found them not needed. Revisit for scanned documents, or for Codex users with table-heavy PDFs.
- ~~**Agent setup steps for Notion**~~ (dogfood finding 3): in 0.3.0 (CC-26).
- **Leak check for binary files:** `.pdf`, `.docx` and other binaries are skipped by the leak check (CX-28), so their metadata (author names) and compressed text are never checked. A check would unpack them first. Found in the CX-28 review, 2026-10-19.

### Email, Slack and Teams ingestion (connected)
Pulling threads directly instead of pasting them (pasting is in 0.2.0). **Source:** vision.

### Ingest from the meeting transcript
When the Notion AI summary is thin, read the transcript too (today it is excluded). **Source:** dogfood 2026-10-13.

## Knowledge model

### Key facts as separate records
**Changes:** decisions/0010 (timeline inside the note).

Each key fact becomes its own small file (e.g. `facts/acme-budget.md`) with its value history, several sources per value, and an assessment, linked from the parent note. Origins: claude-obsidian claim ledger (Review 1), obsidian-wiki page-level `valid_from/valid_until` (Review 2).

**Why later:** easier to show `contested` facts as Notion database rows, attach multiple sources, and query facts across notes. **Cost:** more files, more links to maintain.

**Trigger to revisit:** facts frequently contested, or a need to query facts across clients ("all budgets above €50k").

### Typed relations
Relations such as `about` and `related_to` as reviewable links. **Changes:** decision 0028, which limits `add_link` to fixed fields. **Revisit:** when notes need links beyond project, people and meeting.

### Per-area "What to track" (purpose) sections
**Changes:** extraction in the meeting ingest (v1 uses the generic list from the schema for every meeting).

Optional small section inside each area note (e.g. `areas/clients.md`: "budget, deadlines, decisions, owners, risks, scope changes"), editable in Notion. If present, the ingest focuses extraction on those fields; if absent, the generic list applies. Origin: llm_wiki `purpose.md` (Review 5).

**Why later:** only pays off for long, noisy meetings, area-specific facts (health follow-ups, sales objections), or fields the generic list doesn't cover. **Target:** v2 or v3. **Trigger to revisit:** an area's meetings repeatedly produce trivial review rows or miss facts you care about.

### Capability profiles
Composable profiles (client work, meeting-heavy work, research, writing, learning, personal planning) that tailor onboarding, extraction, views and optional note types on top of the same core schema. **Source:** decision 0030. **Revisit:** with the onboarding suite.

## Maintenance and quality

### Contradiction and staleness reports
A semantic lint across notes. **Source:** vision, synthesis §3.3 (Review 5). **Decided in 0052 (2026-10-29), planned for 0.8.0:** `brain-reflect` writes contradictions and stale facts as Review rows.

### Correction sweep command
One correction propagated to every restatement of the fact. **Source:** synthesis §3.2 (v1 has the manual correction flow). **Partly in 0052 (0.8.0):** reflection proposes a fix for a stale restatement it finds; a sweep run right after one correction stays here.

### Dedup audit
Finds likely duplicate notes and people and writes `merge` proposals. **Source:** synthesis §3.3. **Decided in 0052 (2026-10-29), planned for 0.8.0:** reflection's near-duplicate candidates and the `near-duplicate` lint warning.

### Two CLI loose ends
Noted on 2026-10-23, left out of 0.6.0 by the user: an applied fact doesn't refresh a summary that states it, and `brain report --help` with no subcommand exits 2 instead of showing help. **Target:** the next patch that touches the CLI.

### Freshness rule as a hard lint
**Changes:** decisions/0011. Promote the warning to a failing check once the note format is stable.

## New flows and outputs

- **Owners on Tasks:** an optional owner mapping on the user's Tasks database, so other people's action items become tasks too; today they stay in the meeting text, because a task with no owner would show as the user's. The Tasks database is the user's (0018). **Source:** U-13, decision 0043.
- **Weekly digest:** decisions, open questions and what changed. **Source:** vision, synthesis.
- **Person and client profiles,** generated from the notes. **Source:** vision.
- **Topic research dossiers:** draft, then merge into the brain. **Source:** vision, synthesis (Review 1).
- **Agent-memory loop:** agents propose memories and the user promotes them to knowledge. `memories/` already exists. Includes Stop-hook memory capture. **Source:** vision, 0008, 0009.

### Area homes
**Decided in 0050 (2026-10-28), built in 0.6.0 (CC-56 to CC-59).** **Target: 0.6.0, designed before the agency brain moves in** (raised by the user on 2026-10-22). With one area, the Spaces work unfiltered. The agency brain and the product repo (0042) bring at least three areas: the user's day-job area, the agency and Ultimate Brain. Every view would then need an area filter. **Shape agreed:** each Area page becomes that area's home. Its template gains the missing tabs (today's tasks, meetings, Review waiting, Inbox), next to its existing "What do we know?" and "What's still open here?" tabs. Today's Home becomes the top level: one line per area with its counts, plus everything due across areas. A new area is one page from the template, with no copy of the Spaces and no migration per area. **Resolved in 0050:** Review stays one queue with a per-area tab; Home shows per-area counts first.

## Retrieval and access

### MCP server
`search`, `expand`, `recall` and `remember` for other repos and tools, next to or in place of the CLI and query skill. **Source:** vision, synthesis §3.3. **Revisit:** when several agents or tools need the brain.

### Retrieval index over Markdown
**Changes:** decisions/0008. A search index over the Markdown memory and knowledge files, rebuildable from them and never a second store. **Candidates** (reviews/06-okf-and-gbrain.md §5): GBrain in read-only use (`gbrain import` + `gbrain search`; its database-as-canonical model, `[[wikilink]]` auto-linking and overnight enrichment conflict with 0008, 0002 and synthesis §3.4), a local BM25 index like reviews/01's, or extending the query ladder. OKF is not a candidate: it is a file format with no retrieval. **Revisit:** with "BM25, graph or vector search" below. **Signals (decision 0045, 2026-10-22):** each catch-up and report logs the notes it read and its duration; revisit when a report or answer misses a note the user knows exists, or the 5-minute catch-up bar breaks twice. The first brain had 58 notes then. **CC-50 (reviews/07-hermes-and-search.md, 2026-10-23):** on a synthetic brain of 1,982 notes and 50 known questions, a local BM25 index put the right note in the top 5 for 31, `brain query` for 25, GBrain for 20 keyword-only and 19 with local embeddings; none found a fact said in other words. **Recommendation:** no index now; when a signal fires, change `brain query --candidates` scoring to BM25 in the CLI (no dependency, no store), then have brain-query retry with reworded questions. GBrain is dropped as the candidate unless embeddings with a reranker beat BM25 on the user's real brain.

### OKF: export, then maybe alignment
**Changes:** spec/schema.md, possibly decisions 0001–0005 field names. The Open Knowledge Format (Google Cloud, v0.2) is Markdown + frontmatter with provenance (`sources`), trust (`generated`, `verified`) and lifecycle (`status`, `stale_after`), close to our schema. Three levels, each optional (reviews/06-okf-and-gbrain.md §3):
1. **Export:** `brain export --okf <dir>` writes a conformant bundle; the brain doesn't change. About one CC + one CX task.
2. **Align:** rename our `sources` (ids) so `sources` can hold OKF objects; write `generated` and `verified` (from the Notion review); derive `status` from `lifecycle`. A migration and a release-sized change.
3. **Profile:** our spec becomes "OKF + required extensions". OKF can never replace the spec: it has no proposals, assessment, timeline or Notion mapping.

**Until then:** when `sources` changes for any other reason, take the OKF shape at the same time; it is the one field that collides.
**Revisit when** any of: OKF reaches v0.3 or 1.0 with the maintainer merging again (one contributor, no commits since 2026-08-21 as of 2026-10-19); it gets a governance home or a second vendor; Notion, Claude Code, Codex or another tool we use reads OKF bundles; or the user wants to share part of the brain with an OKF consumer.

### BM25, graph or vector search
**Source:** vision, synthesis. **Revisit:** when the query ladder gets slow or misses notes.

## Automation and platform

### Direct Notion API client
**Changes:** decisions/0015 (Notion via MCP only). Add a small API client for bulk publishing and for unattended runs where MCP auth is not available headless. **Trigger:** publishing becomes slow or costly through agent turns, or schedulers need Notion access. **Evidence (2026-10-15, CC-15):** one publish took 35 MCP calls and about 4 minutes. Decision 0037 batches MCP writes first; a CLI that holds a Notion token changes how credentials are trusted and needs its own grill.

### Schedulers
Unattended ingest and sync with n8n or Hermes. **Source:** vision. **Decided in 0051 (2026-10-29), planned for 0.7.0:** catch-up runs unattended on defaults with a budget per run, and `brain schedule install` sets a local `claude -p` schedule. Still here: n8n, and Claude Code's cloud schedules (no drop folder, linked repos or local Notion MCP on a fresh clone; unchecked).

### Notion-triggered runs
**Raised 2026-10-29 (decision 0054).** 0.7.1 uses Notion's "send message to agent" only from deliberate button clicks, running Brain Assistant inside Notion. Left here: a bridge from a Notion button or automation to a local or Hermes catch-up (a webhook action, https://www.notion.com/help/webhook-actions); event-driven triggers (a property change, a new row, a schedule), which official docs didn't confirm for that action; and replacing the 0.7.0 schedules with Notion triggers. **Revisit:** after U-22 measures what the buttons cost.

### Hermes as an always-on brain operator
**Raised by the user on 2026-10-22 (U-15 grill).** Hermes (Nous Research's Hermes Agent) would run the brain next to Claude Code and Codex: scheduled catch-ups, captures and answers from a phone. It would not build the product (0044). **Why:** the brain pays back only when it runs regularly; an operator that runs on its own makes the habit bar ("every meeting ingested within 2 working days") automatic. **Open:** whether it can run the shared skills and the CLI unattended, its Notion access, how a scheduled catch-up asks its one batch of questions, and how it answers short questions fast (see "Retrieval index over Markdown"). **CC-50 (reviews/07-hermes-and-search.md, 2026-10-23):** Hermes loads the brain's skills from `.agents/skills/` after `hermes skills trust`, runs scheduled jobs in the brain folder with `AGENTS.md`, reaches Notion through MCP, and no command the skills run needs its approval; a reply to a scheduled delivery can continue the run. Missing on our side: catch-up has no unattended mode, the skills were tested only on Claude models, and brain-connect-notion has no Hermes setup lines. **Decided in 0051 (2026-10-29):** one turn on defaults, which works with any scheduler; local `claude -p` is supported first and Hermes is documented as possible. **Next step:** a trial of Hermes on the user's brain with a Claude model pinned, after 0.7.0; the two-turn shape (post the batch, run on the reply) stays here for it. Ties to "Schedulers" and "Adapters for more agent platforms".

### ~~Public source for the Claude Code plugin~~
Resolved by decision 0038: the plugin is retired, and the skills reach Claude Code through the npm package (`brain init`, `brain upgrade`). Still open for other users: findings go to the private product repo's issues. **Revisit:** before the second user.

### Automated releases
A GitHub Action that publishes to npm on a version tag (npm trusted publishing), replacing the manual `npm publish` in docs/releasing.md. **Source:** dogfood 2026-10-13.

### Adapters for more agent platforms
Beyond Claude Code and Codex. **Source:** synthesis §3.3 (Review 4).

### Privacy and sensitivity tiers
**Source:** vision.

### Multi-user, teams and a hosted product
**Source:** vision. After the solo version proves itself.
