# v2 Backlog

Everything deliberately deferred from v1, in one place. Each entry names what it would change and, where known, when to revisit it. Nothing here is scheduled; pick from it after the v1 dogfood (U-05).

Sources folded in: docs/vision.md "v2", synthesis/synthesis.md §3.3, decisions 0008, 0010, 0011, 0015, 0028, 0030, and the CC-12 dogfood (2026-10-13). Open v1 fixes stay in build/TASKS.md (dogfood table); rejected ideas stay in synthesis §3.4.

## Onboarding and getting knowledge in

### Onboarding suite
**Adds:** a `brain-onboard` skill (or agent) that interviews a new user and populates the brain and Notion, so a new brain is useful on day one instead of empty.

It would orchestrate the existing skills in one guided flow:
1. **Install and connect:** check `brain` and the plugin, give the agent access to Notion (dogfood finding 3), run `brain init` and brain-connect-notion.
   - **Converters:** check `markitdown --version`. If it's missing, explain that it turns Word, PowerPoint, Excel and web pages into text the brain can read (PDFs and images are read natively in Claude Code), and offer `pipx install 'markitdown[all]'` (installing `pipx` first if needed). Codex needs it for every file type. Raised by the user on 2026-10-15, when the first Word file failed for lack of it.
2. **Interview:** who the user is and their work; their areas, goals and active projects; the people and organisations they work with; what they want to track. One topic at a time, with examples, and it suggests answers from what's already in Notion.
3. **Populate:** create the answers as rows in Notion (Areas, Goals, Projects, People, Orgs), then run brain-sync, so Notion and the brain start identical and the first ingest has something to match.
4. **Seed from existing material:** offer to import documents the user already has (see "Document ingestion" below) and recent meeting notes.
   - **Drop folder, asked up front:** ask which folder the user will drop documents into for ingest (e.g. `~/Documents/brain-dropbox/`) and explain why it lives **outside both repos**: originals stay where they are and the brain keeps only the converted text, the file name and its hash (decision 0032), so private files never enter Git history, and the product repo never holds personal data (0014). Store the path in the brain's personal rules (or a `brain.json` setting, if one is added), so "ingest my drop folder" works without asking again. Raised by the user on 2026-10-15.
5. **Personal rules:** write names, language and confidential clients into the user section of the brain's AGENTS.md.
6. **First run:** walk through one real ingest and one query, end to end, and show where to review.
7. **Link code repos** with `brain link`.

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
- **Notion file uploads:** the agent fetches files attached to Notion pages.
- **A Sources database in Notion** to browse everything ingested (title, kind, date, what came out of it). Structural, so it needs a decision.
- **Docling or Marker** as a second converter, if the 0.2.0 bake-off shows MarkItDown and native reading aren't enough.
- **Agent setup steps for Notion** (dogfood finding 3), before a second user.

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
A semantic lint across notes. **Source:** vision, synthesis §3.3 (Review 5).

### Correction sweep command
One correction propagated to every restatement of the fact. **Source:** synthesis §3.2 (v1 has the manual correction flow).

### Dedup audit
Finds likely duplicate notes and people and writes `merge` proposals. **Source:** synthesis §3.3.

### Freshness rule as a hard lint
**Changes:** decisions/0011. Promote the warning to a failing check once the note format is stable.

## New flows and outputs

- **Weekly digest:** decisions, open questions and what changed. **Source:** vision, synthesis.
- **Person and client profiles,** generated from the notes. **Source:** vision.
- **Topic research dossiers:** draft, then merge into the brain. **Source:** vision, synthesis (Review 1).
- **Agent-memory loop:** agents propose memories and the user promotes them to knowledge. `memories/` already exists. Includes Stop-hook memory capture. **Source:** vision, 0008, 0009.

## Retrieval and access

### MCP server
`search`, `expand`, `recall` and `remember` for other repos and tools, next to or in place of the CLI and query skill. **Source:** vision, synthesis §3.3. **Revisit:** when several agents or tools need the brain.

### Long-term memory provider
**Changes:** decisions/0008. Evaluate GBrain (or similar) as a search index over the Markdown memory and knowledge files, never as a second store.

### BM25, graph or vector search
**Source:** vision, synthesis. **Revisit:** when the query ladder gets slow or misses notes.

## Automation and platform

### Direct Notion API client
**Changes:** decisions/0015 (Notion via MCP only). Add a small API client for bulk publishing and for unattended runs where MCP auth is not available headless. **Trigger:** publishing becomes slow or costly through agent turns, or schedulers need Notion access.

### Schedulers
Unattended ingest and sync with n8n or Hermes. **Source:** vision.

### Public source for the Claude Code plugin
The CLI is public on npm, but the plugin installs from the private product repo, so other users can't get the skills in Claude Code. Options: a public plugin repo built from `skills/`, or a marketplace listing. **Revisit:** before the second user. **Source:** dogfood 2026-10-13.

### Automated releases
A GitHub Action that publishes to npm on a version tag (npm trusted publishing), replacing the manual `npm publish` in docs/releasing.md. **Source:** dogfood 2026-10-13.

### Adapters for more agent platforms
Beyond Claude Code and Codex. **Source:** synthesis §3.3 (Review 4).

### Privacy and sensitivity tiers
**Source:** vision.

### Multi-user, teams and a hosted product
**Source:** vision. After the solo version proves itself.
