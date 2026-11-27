# Ultimate Brain — Product Vision

**Status:** Agreed in grilling session, 2026-10-11; the goal, the user, the loop, the interface and the business boundary set by [0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) (2026-11-27). Refines [brief.md](brief.md); where they differ, this file wins.

## Goal

A **personal context system** ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §1): one trusted memory you own, which every agent and tool you use reads from. Sources and factories plug into it. It never becomes the place where work is run: tasks stay in Notion, code stays in repos. For one person's work and life (consultants, founders, project managers, researchers), it gives their AI agents persistent, trustworthy context and gives them reliable retrieval of what they know. "An operating system for work" is not the product's description.

Built for the author first (dogfooding), structured so it can become open source.

## Moat

1. **Trust:** every claim is sourced and versioned; contradictions are surfaced, not silently resolved.
2. **Ownership:** plain Markdown in Git, no lock-in, works with any agent.
3. **Agent-native:** usable from any repo by Claude Code or Codex.

The "wow" is that it maintains and synthesizes itself. Tasks and project management are not the moat: Notion already owns them.

## User

- **Target ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §6):** one person, widening by access. Now: solo professionals who already use Claude Code or Codex, and people already exploring Claude or ChatGPT who need the push into Claude Code or Codex, so setup and the guides take them from the app into the Claude Code desktop app or Codex. Next: people who stay in the Claude or ChatGPT apps, reached through the access layer. Not now: companies and teams. (Until 0116: technical users, with semi-technical users a stretch goal.)
- **Daily experience:** agents use the brain without the user looking; capture is effortless. The user reads the brain in Notion, decides what it takes in during the agent session (since 0.16.0, [0096](../decisions/0096-one-place-to-decide.md)) and asks on demand.
- **Scope:** any life area, personal or professional, organized with PARA.
- **Since 0.8.0 ([0055](../decisions/0055-domains-capture-and-review.md)):** optional Domains, off by default, group Areas around PARA; selected subjects and items determine what enters the brain, and editable Review shows the exact changes the user accepts. Reflection follows in 0.11.0 ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)).
- **Capture sources (priority):** 1) agent sessions, 2) Notion AI meeting notes, 3) URLs and docs, 4) Notion quick captures. Email, Slack, Teams later via MCP.

## The loop ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §2, §3)

**Capture → Select → Agree → Act → Find & share → Maintain**, and Maintain's suggestions come back as captures.

| Stage | Today | Later (no release) |
|---|---|---|
| **Capture:** information arrives from where you already work | meetings from Notion AI or any tool, documents, web pages, agent sessions, the Inbox | email, Slack, Teams, spreadsheets, other databases |
| **Select:** you say what the brain may take, what still needs work and what to skip | a row marked Ready, the subjects and items ticked in the minutes | a tag on an email, the agent mentioned in a thread |
| **Agree:** the agent proposes, brings conflicts and asks; you agree what goes in | the catch-up by subject, conflicts in the session, Grill me | more options during the session |
| **Act:** the updated context becomes work in your tools | tasks, projects and goals in Notion | email drafts, calendar events, a spreadsheet updated |
| **Find & share:** you and your agents find what is known, and share it | cited answers, reports, Notion pages, Obsidian as a reading room | decks, diagrams and artifacts shared with colleagues |
| **Maintain:** the brain stays clean and compact | the weekly row, its clean-up with an undo, reflection | idle documents, stray properties, suggestions |

You decide twice: at Select, what the brain may read, and at Agree, what it keeps. Only Agree and Maintain write to the brain; Act and Find & share read from it. Nothing already in the brain changes without your yes; new notes apply as `draft` (0003), and the clean-up's mechanical part runs alone with an undo (0110).

**The access layer** is how agents and apps reach the brain. Today: Claude Code and Codex, through the CLI and the skills, and Notion. For adoption, in 0.20.0: an MCP server, context packs for Claude and ChatGPT, and your own skills. Later: other agent frameworks (Hermes, OpenClaw, a Grok bot). An app reads through Find & share, under the eligibility rule, and writes only through Capture.

**The key layer** ([design principle 8](design-principles.md#8-keep-the-key-context-lean)): each active Area and Project's state, My rules, the people you work with now and your approved memories are kept compact and reviewed in the loop; sources, research, files, finished work and long reports sit underneath, kept and searchable but not loaded by default.

**Notion is the first interface, not the product** ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §5). It was chosen because modular views and databases are quick to build there. Later the brain may be used from other tools, or from one the user builds on the access layer. Until then: knowledge and decisions live in Git, what is specific to Notion stays in the skills, the template and the migrations, and the CLI never depends on Notion.

## The business boundary ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §10)

This repo is the open-source core, published by Sentina under MIT, in English and Spanish chosen by one setting, with everything one person needs for the whole loop. A complete edition (more skills, features and use cases) is a separate, private package that installs on top through the seam 0.20.0 builds for your own skills, never a fork. Nothing released in the core moves to it. Entities, offers and pricing live outside this repo. The test for each feature: if one person's trusted loop needs it, it is core.

## Design principles

[Product design principles](design-principles.md), adopted in [0104](../decisions/0104-product-design-principles.md) and extended by 0116 with §8, keep the key context lean, govern features from ideation to release. They guide lean design, the information lifecycle, Notion and tool reuse, user effort, agent-first operation and identical macOS/Windows capabilities; the document names the evidence required at each development stage.

## Architecture decisions

| Topic | Decision |
|---|---|
| Canonical store | Markdown + Git, private GitHub remote |
| Structure | Hybrid PARA: `projects/`, `areas/` hold actionable containers (brief, status, open decisions); a shared knowledge layer (people, orgs, concepts, decisions, sources) is linked from them and outlives projects; finished containers move to `archive/`, their knowledge stays |
| Trust granularity | Per note by default (sources, status, supersession). Decisions and key facts (budget, owners, deadlines) get their own records with history, e.g. "€50k → €80k, 3 Dec, per meeting X" |
| Agent sessions | Agent proposes candidate memories; user approves in chat when present; otherwise the question waits for the next session ([0096](../decisions/0096-one-place-to-decide.md); the Notion review queue before 0.16.0) |
| Notion inbound | Meeting notes and a capture inbox; plus creation of new areas, goals, projects, people and orgs (amended by decision 0021) |
| Notion outbound | Curated types: projects, areas, people, meeting summaries, generated outputs; decisions and open questions inside the project and area pages since 0.16.0 ([0099](../decisions/0099-notion-without-decisions-and-questions.md)), as rows before it (and the review queue until 0.16.0, [0096](../decisions/0096-one-place-to-decide.md)). Raw sources and agent memory stay in Markdown |
| Notion edits | Published bodies are read-only and regenerated. A small set of human-owned properties (e.g. status, priority, tags) syncs back. Corrections go through the agent session ([0096](../decisions/0096-one-place-to-decide.md); the review queue before 0.16.0), and since 0.16.0 an edit to a brain-owned value is asked there before the brain takes it, because the brain can't tell your edit from an AI's ([0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md)) |
| Generated outputs | Derived views (project brief, decision log, digests), regenerated from canonical records with source links, never hand-edited, safe to overwrite in Notion. Narrative that exists nowhere else lives in a canonical note the output pulls from |
| Action items | Written to the user's Notion tasks database with a link back; Markdown keeps only the reference |
| Agent memory | Global preferences, clients, decisions live in the brain. Repo-specific conventions stay in that repo's CLAUDE.md / AGENTS.md |
| Access from other repos | v1: global skill/CLI (query + propose). From 0.20.0 ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md)): an MCP server for apps, reading under the eligibility rule and writing only as captures, context packs for Claude and ChatGPT, and your own skills |
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

## Roadmap to launch (decisions 0061, 0064, 0077, 0078, 0106, 0113, 0116)

After 0.8.0: **0.9.0** separates shared skill source and adds explicitly connected workflows ([0059](../decisions/0059-shared-skills-and-connected-workflows.md)); linked repos with a link kit join it; **0.10.0** adds a brain assistant that reviews your Areas, Domains, Projects and Tasks and changes them through Review or your yes ([0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md)); **0.11.0** adds reflection; **0.12.0** adds cross-agent memory continuity and reliable cited retrieval; **0.13.0** repairs trust: answers, reads, derived content and proposals keep the brain's approvals, reach and exclusions, and one upgrade reaches every linked project ([0077](../decisions/0077-trust-repair-in-0-13-0.md)); **0.14.0** makes onboarding and adoption repeatable, with a published Notion template and one guided setup, and starts early access for friends and family ([0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md)); **0.15.0** adds weekly knowledge payback, targeted correction propagation and the assistant's weekly review; **0.16.0** removes the Review database: conflicts are decided in the agent session, and the weekly review is an Inbox row ([0096](../decisions/0096-one-place-to-decide.md)).

**Feature work ends at 0.15.0** (moved from 0.14.0 by 0077; the weekly review's release since 0078). 0.16.0 simplifies how the user decides and adds no feature ([0096](../decisions/0096-one-place-to-decide.md)), and removes the Decisions and Questions databases: a question or risk you follow up is a task ([0099](../decisions/0099-notion-without-decisions-and-questions.md)); an attended ingest goes by subject ([0098](../decisions/0098-agree-by-subject-and-check-a-changed-document.md)). It also adds two features by explicit roadmap change, moved from a 0.17.0 that no longer exists ([0102](../decisions/0102-one-release-for-0-16-0-and-0-17-0.md)): a changed document is checked as an Inbox row before it goes in (0098), and any task can be kept as a document ([0100](../decisions/0100-keep-a-task-as-a-document.md)). [0101](../decisions/0101-where-notion-ai-and-the-brain-each-write.md) keeps knowledge in Git and action in Notion: in 0.16.0 your Notion edits to the brain's values are asked in the session; in 0.17.0 (moved from 1.0.0 by [0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md)), by explicit roadmap change, a user without Notion AI brings meetings from any tool and the agent writes the minutes. Productisation, translation and the acquisition/onboarding funnel then lead to **1.0.0**. Release candidates, or an explicitly scoped preparation version if needed, address launch readiness. Issues and dogfood still produce fixes; they do not silently expand feature scope. Each human-led development session for 0.9.0 onward starts with a grilling scope review and confirmed shared understanding. Hermes as a native operator ([0060](../decisions/0060-hermes-operator-and-learning.md)) comes after 1.0. See [0061](../decisions/0061-roadmap-and-launch-boundary.md), [0064](../decisions/0064-brain-assistant-before-reflection-hermes-after-1-0.md), [0077](../decisions/0077-trust-repair-in-0-13-0.md), [0078](../decisions/0078-onboarding-and-early-access-in-0-14-0.md) and [build/TASKS.md](../build/TASKS.md).

**0.16.1 is a bounded setup and upgrade repair ([0103](../decisions/0103-first-things-first-and-upgrades-with-unrelated-work.md)).** First things first makes manual Brain Assistant creation, page mentions and button bindings explicit, and tells users to ask Claude Code or Codex to "set up my brain" to connect and populate it; existing spaces get the checklist through a migration. Upgrades proceed around unrelated uncommitted work, preserve its contents and staging state, and report exact conflicts before writes. [0105](../decisions/0105-domains-on-projects-meetings-and-documents-and-domains-without-type.md) adds to it, by explicit roadmap change: Projects, Meetings and Documents show their Area's Domain through a Notion-only rollup, each Domain page lists them, and Domains lose Type. The feature cutoff and 1.0.0 scope otherwise stay as agreed.

**After 0.16.1 ([0106](../decisions/0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md)):** the beta runs on 0.16.x patches, which fix and polish but add no feature, with five English-speaking testers invited directly once 0.16.2 is released ([0108](../decisions/0108-beta-invitations-wait-for-0-16-2.md)), so they meet its minutes layout, New task button and meeting statuses named like the Inbox's (New, Ready, Done; [0109](../decisions/0109-meetings-use-the-inbox-s-status-names.md)) from the start. **0.17.0** brings the path without Notion AI and Brain Assistant's fields after your yes (moved from 1.0.0), and renames it Notion Brain Assistant; **0.18.0** was to add Spanish to everything a user meets, names included, chosen by the setup language. Both are explicit roadmap changes. Since [0110](../decisions/0110-the-weekly-row-scheduling-on-mac-and-windows-and-0-16-x-folded-into-0-17-0.md), 0.17.0 also brings the weekly row with its clean-up (the mechanical part done alone with an undo, the rest ticked in Notion) and scheduling on Mac and Windows, and the 0.16.x patches end at 0.16.2: their pending work ships in 0.17.0, a trust or data-loss fix aside. Since [0112](../decisions/0112-0-18-0-fourteen-features-and-espanol-in-0-19-0.md) (2026-11-22), **0.18.0** holds fourteen features chosen by the author from the study of the LifeOS project: a rule you state once is kept in "My rules" and followed, also by a scheduled run; "what do you use about me here?"; a scheduled run that didn't happen is named; `brain status` is quiet about what you declined; the scheduled jobs in plain words; the next move in the status line; a report says when what it rests on changed; reports about a person or an organisation; "Think it through" over your notes; facts kept apart from an author's conclusions and recommendations; the weekly row's loose ends, one slipping goal and expectations to check; and a problem report that is safe to send. **0.19.0** was to be Español, as planned for 0.18.0. Since [0113](../decisions/0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) (2026-11-23), from the author's daily use, **0.18.0** is Factories and Domain homes: a Factories database with one row per linked repo or connected working folder, what you want built next as tasks linked to a Factory, which a session there reads first and agrees with you how to do, and an overview on each Factory's page of its plan, what is being built, what is next and what was done lately; each Domain page becomes that Domain's home, tasks get a Domain, and Home keeps today across every Domain with one card per Domain. The fourteen features move to **0.19.0**, and **0.20.0** is Español, translating the texts of both. Since [0115](../decisions/0115-obsidian-as-a-reading-room-in-0-19-0.md) (2026-11-27), **0.19.0** also makes Obsidian an optional reading room: the wiki is the brain's own `knowledge/` and `reports/`; one setup question sets Obsidian to keep the brain's links, and a report may carry a diagram from a `diagrams/` folder. Obsidian stays optional. **1.0.0** is cut, after 0.20.0, from a release candidate that passed the complete native acceptance; the first candidate waits until 3 testers have used the brain for 2 weeks with no developer help. It is a soft launch: npm `latest` and the template links, linking to the author's landing page, which is built outside this repo with its wishlist and demo ([0107](../decisions/0107-the-landing-page-and-wishlist-are-built-outside-this-repo.md)). Since [0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) (2026-11-27), **0.20.0** is the access layer: an MCP server that reads under the eligibility rule and writes only as captures, context packs for Claude and ChatGPT, your own skills reading the brain and proposing to it, and the key layer made visible with Maintain's checks; **0.21.0** is Español, translating the texts of 0.18.0 to 0.20.0; and **1.0.0** is cut after 0.21.0, with the same bar. How pre-release versions come out and how English and Spanish are managed is open for its own session. For the next six months the focus is the road to 1.0, starting the beta now, the lean key layer and the path from the Claude and ChatGPT apps into Claude Code or Codex.

**0.12.0's opening grill is locked in [0074](../decisions/0074-scoped-memory-handovers-and-bounded-recall.md):** approved durable memories, work handovers in existing repo/task/session records, a generated opening context pack initially capped at 800 tokens, targeted recall and reviewed promotion. Prefer small TypeScript retrieval adaptations over another memory runtime; keep the existing architecture and flows.

**0.13.0's trust repair is locked in [0077](../decisions/0077-trust-repair-in-0-13-0.md):** one operational eligibility rule for search, full reads, summaries, citations and the evidence of proposals; an item whose eligible support can't be established is withheld whole; superseded memories only in an explicit historical read; every proposed change names its passages, checked at creation and before apply; one coordinated upgrade of the brain and its linked projects; one native run in Claude Code and one in Codex on the final package, every critical trust case passing. Not a filesystem security product, and no new features. **[0080](../decisions/0080-english-retrieval-quality-in-0-13-0.md) adds English retrieval quality to 0.13.0:** the first search finds facts in a note's body or fields and English paraphrases in its first ten results for at least 90% of each, an unresolved subject is asked about, and latency and output tokens grow by at most 25%, under the same eligibility rule. **[0082](../decisions/0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) moves the complete native run per agent to 1.0.0,** once beta testers are live and the core has no critical revision left; until then each release, from 0.13.0, gates on a native smoke run of 15 cases per agent, every critical-trust kind among them.

**The weekly review's opening grill (now 0.15.0, moved by 0077 and 0078) is locked in [0075](../decisions/0075-weekly-review-and-targeted-corrections.md):** one report per week with knowledge changes, task analysis and decisions, sharing five-decision/five-target limits; targeted correction checks after meaningful approved corrections; bounded partial coverage, no-op quiet weeks and a separate no-apply weekly run. Default scheduling is Monday 08:00 local when enabled; acceptance includes representative scenarios and one attended private-brain trial.

## Post-1.0 (deferred, not rejected)

The [backlog](v2-ideas.md) distinguishes the committed milestones above from post-1.0 candidates. The first candidates after 1.0, chosen from the beta's and the launch's evidence, are connectors (email, Slack, Teams, calendar, spreadsheets, other databases), Select by a tag or a mention, and Act in other tools ([0116](../decisions/0116-a-personal-context-system-the-key-layer-and-the-access-layer-in-0-20-0.md) §9). Out for the six months from 2026-11-27: companies, teams, hosting and a paid layer in the product, a second interface and other agent frameworks. Other candidates: topic dossiers and person/client profiles, rich fact/relationship modelling, OKF export/alignment, advanced retrieval infrastructure and sensitivity tiers, external worker execution, extra platforms/schedulers, multi-user/teams and hosting. None has a promised pre-launch version.

## How to evaluate reference repos

Judge each component by how much it helps build the v1 loop and outputs, then v2:

1. Meeting/source ingestion into structured notes (summary, decisions, facts, questions, contradictions).
2. Decision and key-fact records with history and supersession.
3. Hybrid PARA structure with a shared knowledge layer, stable IDs, links.
4. Derived-output generation (brief, decision log) from canonical records.
5. Agent retrieval from other repos (skill/CLI, later MCP).
6. Propose → approve → apply flow, decided in chat ([0096](../decisions/0096-one-place-to-decide.md); a Notion review queue before 0.16.0).
7. v2 flows: research, profiles, digest, maintenance reports, memory proposals.
