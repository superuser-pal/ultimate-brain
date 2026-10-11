# v2 Ideas and Alternatives

Improvements and alternatives deliberately deferred from v1. Each entry names the v1 choice it would change.

## Key facts as separate records
**Changes:** decisions/0010 (timeline inside the note).

Each key fact becomes its own small file (e.g. `facts/acme-budget.md`) with its value history, several sources per value, and an assessment, linked from the parent note. Origins: claude-obsidian claim ledger (Review 1), obsidian-wiki page-level `valid_from/valid_until` (Review 2).

**Why later:** easier to show `contested` facts as Notion database rows, attach multiple sources, and query facts across notes. **Cost:** more files, more links to maintain.

**Trigger to revisit:** facts frequently contested, or a need to query facts across clients ("all budgets above €50k").

## Freshness rule as a hard lint
**Changes:** decisions/0011. Promote the warning to a failing check once the note format is stable.

## Long-term memory provider
**Changes:** decisions/0008. Evaluate GBrain (or similar) as a search index over the Markdown memory and knowledge files, never as a second store.

## Per-area "What to track" (purpose) sections
**Changes:** extraction in the meeting ingest (v1 uses the generic list from the schema for every meeting).

Optional small section inside each area note (e.g. `areas/clients.md`: "budget, deadlines, decisions, owners, risks, scope changes"), editable in Notion. If present, the ingest focuses extraction on those fields; if absent, the generic list applies. Origin: llm_wiki `purpose.md` (Review 5).

**Why later:** only pays off for long, noisy meetings, area-specific facts (health follow-ups, sales objections), or fields the generic list doesn't cover. **Target:** v2 or v3. **Trigger to revisit:** an area's meetings repeatedly produce trivial review rows or miss facts you care about.

## Direct Notion API client
**Changes:** decisions/0015 (Notion via MCP only). Add a small API client for bulk publishing and for unattended runs where MCP auth is not available headless. **Trigger:** publishing becomes slow or costly through agent turns, or schedulers need Notion access.
