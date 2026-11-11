# v2 Backlog

Deferred ideas and their current disposition. [Decision 0061](../decisions/0061-roadmap-and-launch-boundary.md) sets the launch boundary: feature work ends at 0.15.0 (moved from 0.14.0 by [0077](../decisions/0077-trust-repair-in-0-13-0.md); since [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md) it is the weekly review's release, after onboarding in 0.14.0), then productisation, translation and the funnel lead to 1.0. Entries below retain historical context; the disposition table and decision govern current placement. Issues/dogfood may produce fixes without silently reopening feature scope.

| Disposition | Items |
|---|---|
| Already delivered; retained as history | Basic document ingestion and Notion attachments, local unattended scheduling, area homes and retired-plugin cleanup |
| 0.8.0 | Selected transcript/voice capture, Domains, editable Review and explicit Waiting On; broader ownership of other people's Tasks remains deferred |
| 0.9.0 ([0059](../decisions/0059-shared-skills-and-connected-workflows.md)) | Shared skill source, standard/connected workflows, setup/adoption and update coordination; linked repos with the link kit ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)) |
| 0.10.0 ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)) | The brain assistant: reviews Areas, Domains, Projects and Tasks, recommends, and changes through Review rows or a yes in chat |
| 0.11.0 | Contradiction/staleness/dedup reflection under 0052; later in-catch-up reflection remains deferred |
| 0.12.0 ([0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md)) | Shared Claude Code/Codex memory capture, work handovers, generated hot context initially capped at 800 tokens, scoped/correctable memory, targeted cited retrieval and reviewed promotion; prefer surgical TypeScript component reuse and evaluate before selecting ranking/index changes |
| 0.13.0 ([0077](../decisions/0077-trust-repair-in-0-13-0.md)) | Trust repair: one operational eligibility rule for answers, reads, derived content and proposals' evidence; one coordinated upgrade of the brain and its linked projects; no new features |
| 0.14.0 ([0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md), [0079](../decisions/0079-lean-minutes-and-follow-ups-as-tasks.md), [0081](../decisions/0081-response-style-working-principles-and-plain-writing.md)) | Full onboarding: a published Notion template, one guided resumable setup, seeding, diagnostics in `brain status` and minimal per-area tracking preferences; early access for friends and family; lean minutes with quick follow-ups left unticked becoming Tasks; a response style each user chooses, and plain writing for text people read; rich capability profiles remain deferred |
| 0.15.0 ([0075](../decisions/0075-weekly-review-and-targeted-corrections.md), moved by 0077 and 0078) | One report per week with knowledge changes, task analysis and decisions; shared five-decision/five-target limits, selective reminders and bounded partial coverage; targeted checks after meaningful approved corrections; separate no-apply weekly run, default Monday 08:00 local when enabled |
| Launch readiness | Product packaging, guidance/templates (setup guidance and the Notion template ship in 0.14.0 for early access, 0078), Notion AI made optional, translation, funnel, fresh-user acceptance and common-failure recovery; no new feature milestone |
| Post-1.0, evidence-gated | Native Hermes operator, private Telegram, scoped learning and native schedules ([0060](../decisions/0060-hermes-operator-and-learning.md), moved by 0064); new connected sources, extra converters, richer fact/relationship models and profiles, person/client outputs, research dossiers, minutes written from a pasted transcript without Notion AI (0078), MCP, OKF, advanced search infrastructure, direct Notion API, Notion webhooks, n8n/cloud scheduling, worker execution, an optional tool-agnostic coordination profile, extra hosts/channels/agents, broad sensitivity tiers and multi-user/hosting |

Confirmed defects and essential recovery/integrity work belong in the release that needs them or a patch. Revalidate the two CLI loose ends below before scheduling. Basic retention/removal and capture-consent requirements are prerequisites when an integration needs them, not blanket permission to add a pre-launch feature release.

Sources folded in: docs/vision.md "v2", synthesis/synthesis.md §3.3, decisions 0008, 0010, 0011, 0015, 0028, 0030, the CC-12 dogfood (2026-10-13), and reviews/06-okf-and-gbrain.md (2026-10-19). Open v1 fixes stay in build/TASKS.md (dogfood table); rejected ideas stay in synthesis §3.4.

## Onboarding and getting knowledge in

### Onboarding suite
**Now 0.14.0 under [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md)** (0061 placed it in 0.14.0, 0077 moved it to 0.15.0, 0078 back to 0.14.0 before the weekly review). Previously moved out of 0.4.0 on 2026-10-20 (no second user yet; CC-35). The owner's identities and finding 3 shipped in 0.3.0 (CC-26). Reuse 0.9.0 project adoption and the 0.10.0 assistant rather than building duplicate flows (0064).

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

### Minutes from a pasted transcript, without Notion AI
**Post-1.0 (0078).** At 1.0 a user without Notion AI pastes any transcript or summary onto the meeting page and it is ingested whole, with no way to leave a subject or item out. The agent could rewrite a pasted transcript into the minutes format (notion/minutes-format.md) during ingest, so selection works without Notion AI. Wait until early users without Notion AI show they need it.

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

**Minimal preferences planned for 0.14.0 under 0061, with onboarding (0077, 0078).** Optional small section inside each area note (e.g. `areas/clients.md`: "budget, deadlines, decisions, owners, risks, scope changes"), editable in Notion. If present, the ingest focuses extraction on those fields; if absent, the generic list applies. Origin: llm_wiki `purpose.md` (Review 5).

**Why:** pays off for long, noisy meetings, area-specific facts or fields the generic list doesn't cover. Keep the 0.14.0 implementation within the stable schema; richer domain-specific profiles remain post-1.0.

### Capability profiles
Composable profiles (client work, meeting-heavy work, research, writing, learning, personal planning) that tailor onboarding, extraction, views and optional note types on top of the same core schema. **Source:** decision 0030. **Revisit:** with the onboarding suite.

## Maintenance and quality

### Contradiction and staleness reports
A semantic lint across notes. **Source:** vision, synthesis §3.3 (Review 5). **Decided in 0052; now 0.11.0 under [0061](../decisions/0061-roadmap-and-launch-boundary.md) as amended by 0064:** `brain-reflect` writes contradictions and stale facts as Review rows.

### Correction sweep command
One correction propagated to affected restatements through reviewable changes. **Source:** synthesis §3.2. Reflection in 0.11.0 proposes a fix for a stale restatement it finds; **0.15.0 under 0061, moved by 0077 and 0078,** adds the targeted sweep after a correction. Preserve independently supported claims; no blind global replacement.

### Dedup audit
Finds likely duplicate notes and people and writes `merge` proposals. **Source:** synthesis §3.3. **Decided in 0052; now 0.11.0 under 0061 as amended by 0064:** reflection's near-duplicate candidates and the `near-duplicate` lint warning.

### Two CLI loose ends
Noted on 2026-10-23, left out of 0.6.0 by the user: an applied fact doesn't refresh a summary that states it, and `brain report --help` with no subcommand exits 2 instead of showing help. **Target:** the next patch that touches the CLI.

### Freshness rule as a hard lint
**Changes:** decisions/0011. Promote the warning to a failing check once the note format is stable.

## New flows and outputs

- **Owners on Tasks:** an optional owner mapping on the user's Tasks database, so other people's action items become tasks too; today they stay in the meeting text, because a task with no owner would show as the user's. The Tasks database is the user's (0018). **Source:** U-13, decision 0043.
- **Weekly digest (0.15.0, 0061, moved by 0077 and 0078):** decisions, open questions and what changed, with a concise weekly-review flow. **Source:** vision, synthesis.
- **Person and client profiles,** generated from the notes. **Source:** vision.
- **Topic research dossiers:** draft, then merge into the brain. **Source:** vision, synthesis (Review 1).
- **Agent-memory loop (0.12.0, 0061):** Claude Code/Codex propose memories and the user promotes them to knowledge, defining the shared capture/proposal/promotion boundary itself, for a later Hermes to reuse (0064). `memories/` already exists. Includes session-end capture where supported and explicit fallbacks. **Source:** vision, 0008, 0009.

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
**Post-1.0 ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md); designed in [0060](../decisions/0060-hermes-operator-and-learning.md), previously planned for 0.11.0).** The paragraph below records the earlier investigation; unattended catch-up has since shipped in 0.7.0. The new milestone includes native operation, private Telegram, scoped learning and prepared handoffs; external worker execution and supervision remain post-1.0.

**Raised by the user on 2026-10-22 (U-15 grill).** Hermes (Nous Research's Hermes Agent) would run the brain next to Claude Code and Codex: scheduled catch-ups, captures and answers from a phone. It would not build the product (0044). **Why:** the brain pays back only when it runs regularly; an operator that runs on its own makes the habit bar ("every meeting ingested within 2 working days") automatic. **Open:** whether it can run the shared skills and the CLI unattended, its Notion access, how a scheduled catch-up asks its one batch of questions, and how it answers short questions fast (see "Retrieval index over Markdown"). **CC-50 (reviews/07-hermes-and-search.md, 2026-10-23):** Hermes loads the brain's skills from `.agents/skills/` after `hermes skills trust`, runs scheduled jobs in the brain folder with `AGENTS.md`, reaches Notion through MCP, and no command the skills run needs its approval; a reply to a scheduled delivery can continue the run. Missing on our side: catch-up has no unattended mode, the skills were tested only on Claude models, and brain-connect-notion has no Hermes setup lines. **Decided in 0051 (2026-10-29):** one turn on defaults, which works with any scheduler; local `claude -p` is supported first and Hermes is documented as possible. **Next step:** a trial of Hermes on the user's brain with a Claude model pinned, after 0.7.0; the two-turn shape (post the batch, run on the reply) stays here for it. Ties to "Schedulers" and "Adapters for more agent platforms".

### Optional tool-agnostic coordination profile for ultimate-brain-skills
**Future idea, post-1.0 (raised by the user on 2026-11-07, recorded by CC-149).** No release is promised and nothing is implemented. Revisit only when the user asks for it explicitly; the 0061 launch boundary stays as it is. The preferences below come from the discussion and are revalidated when the idea is reopened: they are a sketch, not an accepted contract, and the profile's file name, keys and adapters are not decided.

**Goal:** less juggling of sessions, with the skills and agent capabilities that already exist and few changes. The deliverable would be an optional, reusable execution profile plus small shared instructions or hooks in existing skills; not a set of new specialist agents, a new runtime or a new task tracker.

**Portability is a requirement.** The shared profile and the core coordination rules depend on no specific tool, Orca included. Each user's environment maps dispatch, follow-ups, results and recovery to the capabilities it already has; Orca may be one optional local choice, never required. A missing capability is surfaced and any fallback agreed with the user, rather than promising the same messaging, isolation, background execution or persistence everywhere. A portability claim needs evidence from more than one environment, one of them without Orca.

**Scope:** software and general work, including already-connected Notion workflows. Standard workflows keep their current tracker and gain no brain or Notion access by default.

**Working preferences:**
- Off by default; explicit opt-in per folder, remembered.
- One working folder or project and a finite, approved batch; the current conversation coordinates.
- Up to four concurrent workers, configurable and bounded by what the tool can actually run.
- Optional agent/model choice per role, inheriting the folder's defaults and obeying the repo's binding policies.
- The coordinator owns updates to the shared tracker, workflow and Notion, and publishes approved outputs; workers return results and evidence.
- Two in-scope repair attempts with the same worker before escalating; independent work may continue meanwhile.
- After an interruption: recover and show the state, then resume on an explicit "continue" without reapproving unchanged scope.
- In general work, verified outputs may unblock dependencies within the approved batch; explicit human gates and final acceptance remain. Software keeps its repository's branch, review and merge rules.
- Notify on decisions, blockers and batch completion; progress on request.

**Guardrails:** existing task IDs, approvals, claims and canonical records stay as they are. Preferences and configuration are not a second backlog or a store of live task status. No automatic merges to main, silent activation or unbounded retries, and the brain's knowledge-review rules are not replaced. **Measure:** manual interventions and session switches; quality, time and model/token cost as secondary evidence.

**Inspiration:** the AI LABS router/worker walkthrough (https://www.youtube.com/watch?v=3DklR44DHnM) and, as a research reference only (not an adopted runtime), https://github.com/deepseek-ai/dsh-superagent-prototype. Speedups they advertise are not measured results for this product. Ties to "Hermes as an always-on brain operator" (external worker execution) and "Adapters for more agent platforms".

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
