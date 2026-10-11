# Ultimate Brain — Product Vision

**Status:** Agreed in grilling session, 2026-10-11. Refines [brief.md](brief.md); where they differ, this file wins.

## Goal

An AI-assisted second brain for solo knowledge workers (consultants, founders, researchers, solopreneurs, remote workers). It gives their AI agents persistent, trustworthy context and gives the user reliable retrieval of what they know.

Built for the author first (dogfooding), structured so it can become open source.

## Moat

1. **Trust:** every claim is sourced and versioned; contradictions are surfaced, not silently resolved.
2. **Ownership:** plain Markdown in Git, no lock-in, works with any agent.
3. **Agent-native:** usable from any repo by Claude Code or Codex.

The "wow" is that it maintains and synthesizes itself. Tasks and project management are not the moat: Notion already owns them.

## User

- **Target:** technical users already running Claude Code or Codex. Semi-technical (follows a setup guide, avoids Git) is a stretch goal.
- **Daily experience:** agents use the brain without the user looking; capture is effortless. The user reviews in Notion a few times a week and asks on demand.
- **Scope:** any life area, personal or professional, organized with PARA.
- **Capture sources (priority):** 1) agent sessions, 2) Notion AI meeting notes, 3) URLs and docs, 4) Notion quick captures. Email, Slack, Teams later via MCP.

## Architecture decisions

| Topic | Decision |
|---|---|
| Canonical store | Markdown + Git, private GitHub remote |
| Structure | Hybrid PARA: `projects/`, `areas/` hold actionable containers (brief, status, open decisions); a shared knowledge layer (people, orgs, concepts, decisions, sources) is linked from them and outlives projects; finished containers move to `archive/`, their knowledge stays |
| Trust granularity | Per note by default (sources, status, supersession). Decisions and key facts (budget, owners, deadlines) get their own records with history, e.g. "€50k → €80k, 3 Dec, per meeting X" |
| Agent sessions | Agent proposes candidate memories; user approves in chat when present, otherwise in the Notion review queue |
| Notion inbound | Meeting notes and a capture inbox; plus creation of new areas, goals, projects, people and orgs (amended by decision 0021) |
| Notion outbound | Curated types: projects, areas, decisions, people, meeting summaries, generated outputs, review queue. Raw sources and agent memory stay in Markdown |
| Notion edits | Published bodies are read-only and regenerated. A small set of human-owned properties (e.g. status, priority, tags) syncs back. Corrections go through comments or the review queue |
| Generated outputs | Derived views (project brief, decision log, digests), regenerated from canonical records with source links, never hand-edited, safe to overwrite in Notion. Narrative that exists nowhere else lives in a canonical note the output pulls from |
| Action items | Written to the user's Notion tasks database with a link back; Markdown keeps only the reference |
| Agent memory | Global preferences, clients, decisions live in the brain. Repo-specific conventions stay in that repo's CLAUDE.md / AGENTS.md |
| Access from other repos | v1: global skill/CLI (query + propose). Later: MCP server |
| Runner | v1: on demand. Later: n8n or Hermes Agent (Nous). Notion agents rejected on cost |
| Privacy | Everything flows (Git, Notion, cloud LLMs) in v1. Sensitivity tiers later |

## Permanent rules (never, from brief)

- No unrestricted bidirectional Notion sync.
- Obsidian is never required (it may be used as an optional viewer).

## v1 scope

**Loop:** Notion meeting note → ingest → Markdown summary, decision records, fact updates, open questions/risks, contradictions with existing knowledge; action items → Notion tasks.

**Outputs:** meeting summary, project brief, decision log.

**Planning layer (added 2026-10-11, decision 0020):** goals and their measures are part of v1, because planning is a key part of a second brain for the target user. See decisions/0020.

**Success criterion:** for 2 weeks, every Notion meeting note is ingested with one command; Claude or Codex in any repo answers "what did we decide with client X and why?" with a citation to the meeting; Notion shows a project page and decision log the user trusts.

## v2 (deferred, not rejected)

Agent-memory proposal loop, optional long-term memory provider as an index over Markdown (evaluate GBrain; see decisions/0008), topic research dossiers, person/client profiles, weekly digest, contradiction and staleness reports, schedulers (n8n / Hermes), email/Slack/Teams ingestion, privacy tiers, MCP server, multi-user/teams, hosted product, embeddings / vector search.

## How to evaluate reference repos

Judge each component by how much it helps build the v1 loop and outputs, then v2:

1. Meeting/source ingestion into structured notes (summary, decisions, facts, questions, contradictions).
2. Decision and key-fact records with history and supersession.
3. Hybrid PARA structure with a shared knowledge layer, stable IDs, links.
4. Derived-output generation (brief, decision log) from canonical records.
5. Agent retrieval from other repos (skill/CLI, later MCP).
6. Propose → approve → apply flow suitable for chat and a Notion review queue.
7. v2 flows: research, profiles, digest, maintenance reports, memory proposals.
