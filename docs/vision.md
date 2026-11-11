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
- **Since 0.8.0 ([0055](../decisions/0055-domains-capture-and-review.md)):** optional Domains, off by default, group Areas around PARA; selected subjects and items determine what enters the brain, and editable Review shows the exact changes the user accepts. Reflection follows in 0.11.0 ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)).
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
| Runner | v1: on demand. Later: n8n or Hermes Agent (Nous). Notion agents: optional, bounded and measured, for deliberate button clicks only (decision 0054, 2026-10-29; was "rejected on cost") |
| Privacy | Everything flows (Git, Notion, cloud LLMs) in v1. Sensitivity tiers later |

## Permanent rules (never, from brief)

- No unrestricted bidirectional Notion sync.
- Obsidian is never required (it may be used as an optional viewer).

## v1 scope

**Loop:** Notion meeting note → ingest → Markdown summary, decision records, fact updates, open questions/risks, contradictions with existing knowledge; action items → Notion tasks.

**Outputs:** meeting summary, project brief, decision log.

**Planning layer (added 2026-10-11, decision 0020):** goals and their measures are part of v1, because planning is a key part of a second brain for the target user. See decisions/0020.

**Success criterion:** for 2 weeks, every Notion meeting note is ingested with one command; Claude or Codex in any repo answers "what did we decide with client X and why?" with a citation to the meeting; Notion shows a project page and decision log the user trusts.

## Roadmap to launch (decisions 0061, 0064, 0077, 0078)

After 0.8.0: **0.9.0** separates shared skill source and adds explicitly connected workflows ([0059](../decisions/0059-shared-skills-and-connected-workflows.md)); linked repos with a link kit join it; **0.10.0** adds a brain assistant that reviews your Areas, Domains, Projects and Tasks and changes them through Review or your yes ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)); **0.11.0** adds reflection; **0.12.0** adds cross-agent memory continuity and reliable cited retrieval; **0.13.0** repairs trust: answers, reads, derived content and proposals keep the brain's approvals, reach and exclusions, and one upgrade reaches every linked project ([0077](../decisions/0077-trust-repair-in-0-13-0.md)); **0.14.0** makes onboarding and adoption repeatable, with a published Notion template and one guided setup, and starts early access for friends and family ([0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md)); **0.15.0** adds weekly knowledge payback, targeted correction propagation and the assistant's weekly review.

**Feature work ends at 0.15.0** (moved from 0.14.0 by 0077; the weekly review's release since 0078). Productisation, translation and the acquisition/onboarding funnel then lead to **1.0.0**. Release candidates, or an explicitly scoped preparation version if needed, address launch readiness. Issues and dogfood still produce fixes; they do not silently expand feature scope. Each human-led development session for 0.9.0 onward starts with a grilling scope review and confirmed shared understanding. Hermes as a native operator ([0060](../decisions/0060-hermes-operator-and-learning.md)) comes after 1.0. See [0061](../decisions/0061-roadmap-and-launch-boundary.md), [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md), [0077](../decisions/0077-trust-repair-in-0-13-0.md), [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md) and [build/TASKS.md](../build/TASKS.md).

**0.12.0's opening grill is locked in [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md):** approved durable memories, work handovers in existing repo/task/session records, a generated opening context pack initially capped at 800 tokens, targeted recall and reviewed promotion. Prefer small TypeScript retrieval adaptations over another memory runtime; keep the existing architecture and flows.

**0.13.0's trust repair is locked in [0077](../decisions/0077-trust-repair-in-0-13-0.md):** one operational eligibility rule for search, full reads, summaries, citations and the evidence of proposals; an item whose eligible support can't be established is withheld whole; superseded memories only in an explicit historical read; every proposed change names its passages, checked at creation and before apply; one coordinated upgrade of the brain and its linked projects; one native run in Claude Code and one in Codex on the final package, every critical trust case passing. Not a filesystem security product, and no new features. **[0080](../decisions/0080-english-retrieval-quality-in-0-13-0.md) adds English retrieval quality to 0.13.0:** the first search finds facts in a note's body or fields and English paraphrases in its first ten results for at least 90% of each, an unresolved subject is asked about, and latency and output tokens grow by at most 25%, under the same eligibility rule. **[0082](../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) moves the complete native run per agent to 1.0.0,** once beta testers are live and the core has no critical revision left; until then each release, from 0.13.0, gates on a native smoke run of 15 cases per agent, every critical-trust kind among them.

**The weekly review's opening grill (now 0.15.0, moved by 0077 and 0078) is locked in [0075](../decisions/0075-weekly-review-and-targeted-corrections.md):** one report per week with knowledge changes, task analysis and decisions, sharing five-decision/five-target limits; targeted correction checks after meaningful approved corrections; bounded partial coverage, no-op quiet weeks and a separate no-apply weekly run. Default scheduling is Monday 08:00 local when enabled; acceptance includes representative scenarios and one attended private-brain trial.

## Post-1.0 (deferred, not rejected)

The [backlog](v2-ideas.md) distinguishes the committed milestones above from post-1.0 candidates: new email/Slack/Teams connectors, topic dossiers and person/client profiles, rich fact/relationship modelling, MCP access, OKF export/alignment, advanced retrieval infrastructure and sensitivity tiers, external worker execution, extra platforms/schedulers, multi-user/teams and hosting. None has a promised pre-launch version.

## How to evaluate reference repos

Judge each component by how much it helps build the v1 loop and outputs, then v2:

1. Meeting/source ingestion into structured notes (summary, decisions, facts, questions, contradictions).
2. Decision and key-fact records with history and supersession.
3. Hybrid PARA structure with a shared knowledge layer, stable IDs, links.
4. Derived-output generation (brief, decision log) from canonical records.
5. Agent retrieval from other repos (skill/CLI, later MCP).
6. Propose → approve → apply flow suitable for chat and a Notion review queue.
7. v2 flows: research, profiles, digest, maintenance reports, memory proposals.
