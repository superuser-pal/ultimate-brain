# 0116 — A personal context system: the loop, the key layer, the access layer in 0.20.0 and Español in 0.21.0

**Status:** Accepted
**Date:** 2026-11-27
**Release:** 0.20.0 (§7, the access layer and the key layer made visible); 0.21.0 (§8, Español); the rest is the product's direction and holds from this date
**Amends:** [0061](0061-roadmap-and-launch-boundary.md) (release order: an explicit roadmap change after the cutoff; MCP access leaves the post-1.0 list); [0104](0104-product-design-principles.md) (a principle 8, and principle 6 names the access layer); [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) §5 and its release order (Español ships in 0.21.0, its rules unchanged; 1.0.0 is cut after it); [0113](0113-factories-and-domain-homes-in-0-18-0-the-fourteen-features-in-0-19-0-espanol-in-0-20-0.md) §C (0.20.0 is the access layer, Español 0.21.0)
**Keeps:** Markdown and Git canonical, Notion as the human interface, no unrestricted two-way sync; [0003](0003-proposal-review-flow.md) as amended (new notes apply as `draft`; a change to existing knowledge needs your yes); [0014](0014-product-repo-vs-brain-repo.md) (one private brain per user); [0015](0015-notion-access-via-mcp.md) (the brain's program reads no Notion); [0060](0060-hermes-operator-and-learning.md) (Hermes after 1.0); [0074](0074-scoped-memory-handovers-and-bounded-recall.md) (the opening context pack and its budget); [0077](0077-trust-repair-in-0-13-0.md) (one eligibility rule for every read); [0096](0096-one-place-to-decide.md) (you decide in the agent session); [0107](0107-the-landing-page-and-wishlist-are-built-outside-this-repo.md) (the author's commercial pages live outside this repo); 0106 §6 to §8 (the release-candidate bar and the soft launch); every rule of 0112, 0113 and 0115 for 0.18.0 and 0.19.0

## Context

On 2026-11-27 the author asked for a grilling session on the product's long-term vision and its areas of focus, recorded as a decision. Before it, the author's pitch material (a deck and three diagrams, kept outside this repo) was read against `docs/vision.md` and the accepted decisions. Where they disagreed:

- the pitch called the product "an operating system for work", which the vision doesn't say, and the vision says tasks and project management are not the moat;
- it showed a service, "a brain per company", and a paid layer, where the product is one private brain per person (0014) and 0061 selects no commercial model;
- it showed email, Slack, Teams, calendar and MCP access as planned, where they were post-1.0 with no version, and calendar appeared nowhere;
- it said nothing changes the brain without your yes, where new notes apply as `draft` (0003) and the weekly clean-up's mechanical part runs alone with an undo (0110).

The session then settled the vision, the loop the pitch draws, who the product is for, the next six months and the business boundary. Questions were asked one at a time, each with options and a recommendation.

## Decision

### 1. The vision: a personal context system
Ultimate Brain is a **personal context system**: one trusted memory you own, which every agent and tool you use reads from. Sources and factories plug into it. It never becomes the place where work is run: tasks stay in Notion, code stays in repos. The moat stays trust, ownership and being agent-native. "An operating system for work" is not the product's description.

### 2. The loop
The work moves through six stages, and the last feeds the first:

| Stage | What it is | Today | Later (no release; §9) |
|---|---|---|---|
| **Capture** | Information arrives from where you already work | meetings from Notion AI or any tool, documents, web pages, agent sessions, the Inbox | email, Slack, Teams, spreadsheets, other databases |
| **Select** | You say what the brain may take, what still needs work and what to skip | a row marked Ready, the subjects and items ticked in the minutes | a tag on an email, the agent mentioned in a thread |
| **Agree** | In the session the agent proposes, brings conflicts and asks; you agree what goes in | the catch-up by subject (0098), conflicts in the session (0096), Grill me | more options offered during the session |
| **Act** | The updated context becomes work in your tools | tasks, projects and goals in Notion | email drafts, calendar events, a spreadsheet updated |
| **Find & share** | You and your agents find what is known, and share it | cited answers, reports, Notion pages, Obsidian as a reading room (0115) | decks, diagrams and artifacts shared with colleagues |
| **Maintain** | The brain stays clean and compact | the weekly row with the state of projects, goals and tasks, its clean-up with an undo (0110), reflection | idle documents, stray properties, suggestions |

- **Two points where you decide:** Select, where you decide what the brain may read, and Agree, where you decide what it keeps.
- **Act or Find & share:** what does something in another tool is Act; what is made to be read is Find & share.
- **Writes and reads.** Only Agree and Maintain write to the brain; Act and Find & share read from it; Capture and Select don't touch it. Maintain's suggestions come back as captures, as the weekly row already does (an Inbox row you tick, mark Ready and a catch-up applies).
- **The claim the product supports:** nothing already in the brain changes without your yes. New notes apply as `draft` (0003), and the clean-up's mechanical, reversible part runs alone with an undo (0110).

### 3. The access layer: how agents and apps reach the brain
Three bands:
- **Today:** Claude Code and Codex, through the CLI and the skills; Notion, the first interface (§5).
- **For adoption (0.20.0, §7):** an MCP server; context packs for Claude and ChatGPT; your own skills reading the brain and proposing to it.
- **Later (no release):** other agent frameworks (Hermes under 0060, OpenClaw, a Grok bot).

**One rule for every app:** an app reads through Find & share, under the one eligibility rule (0077), and writes only through Capture, so what it adds passes Select and Agree like any other source. However many apps connect, nothing already in the brain changes without your yes. The development agent stays the brain's primary operator (0104 §6); an app that reads or proposes is not an operator.

### 4. Principle 8: keep the key context lean
Added to [the design principles](../docs/design-principles.md) as §8:
- **The key layer** is what truly matters to you day to day: each active Area and Project's state (its brief, status, open decisions and what is next), My rules, the people you are working with now, and your approved memories. It is kept compact and clean, and you review it in the loop, where Maintain says what needs attention. A finished project moves to the archive and leaves the key layer.
- **Underneath** sit sources, research, files, finished work and long reports: kept, cited and searchable, never loaded by default or treated as important.
- **New material lands underneath** and rises into the key layer only through Agree.
- **The key layer is content, not code:** the agent and you manage it through the loop, so changing what is in it takes a yes, not a release.
- **It reuses what exists:** the hybrid PARA containers and their briefs, the Area and Project pages in Notion, `archive/`, and the opening context pack of 0074, which is generated from this layer. No new database, page type or tool.
- **It applies to new work from today:** a feature that brings in material puts it underneath by default. The key layer is made visible, and Maintain's checks of it are built, in 0.20.0 (§7).

### 5. Notion is the first interface, not the product
Notion is the interface today because modular views and databases are quick to build there. Later the brain may be used from other tools (ClickUp, Obsidian beyond reading, Linear, Airtable, Coda) or from one the user builds on the access layer. Before 1.0 this is a direction and a guard, nothing more:
- knowledge and decisions live in Git;
- what is specific to Notion stays in the skills, the template and the migrations;
- the CLI never depends on Notion (0015).

Nothing is built for a second interface before 1.0. Which one comes, and when, is decided later from evidence, and its contract is written then, from what it needs.

### 6. Who it is for
One person, widening by access:
- **Now:** solo professionals (consultants, founders, project managers, researchers) who already use Claude Code or Codex, and people already exploring Claude or ChatGPT who need the push into Claude Code or Codex. Work leads how the product is presented; personal areas stay supported.
- **Next:** people who stay in the Claude or ChatGPT apps, reached through the access layer.
- **Not now:** companies and teams.

So setup and the guides must take someone from the Claude or ChatGPT app into the Claude Code desktop app or Codex. That is 1.0's onboarding and funnel work, already in its scope, now with a named audience.

### 7. 0.20.0: the access layer
A feature release before 1.0, by explicit roadmap change after the cutoff:
- an **MCP server** that reads under the eligibility rule and writes only as captures (§3);
- **context packs** for Claude and ChatGPT, generated from the key layer;
- **your own skills** reading the brain and proposing to it through a supported seam, which is also the seam a complete edition installs through (§10);
- **the key layer made visible**, with Maintain's checks of it (§4).

It is decomposed after its own opening scope review, which also settles: which apps and transports the MCP server supports first; what a context pack holds and how it reaches each app (a file, a paste, an app's own context feature); how a skill outside the product proposes; and how the key layer is shown and checked. Same outcome on macOS and Windows (0104 §7); a difference between Claude Code and Codex is named.

### 8. 0.21.0 Español, then 1.0.0
- **0.21.0 is Español:** 0106 §5 word for word, with 0.21.0 where it says 0.18.0. It translates the texts of 0.18.0, 0.19.0 and 0.20.0, so the texts are still translated once, when they are finished.
- **1.0.0 is cut after 0.21.0.** Its release-candidate bar (0106 §6) and soft launch (§7, as amended by 0107) are unchanged.
- **Open, for its own session:** how pre-release versions come out, and how English and Spanish are managed while both exist. The author raised it and kept it for a separate discussion; CC-411 holds it. Until it is settled, 0106 §5's rules stand.

### 9. The next six months
**Focus:**
1. **The road to 1.0:** 0.18.0 Factories and Domain homes; 0.19.0 with its fifteen features; 0.20.0 the access layer; 0.21.0 Español; 1.0.0.
2. **Start the beta now.** The attended setup run (U-31), the readiness recheck (U-32) and the invitations (U-28) go ahead on the latest release rather than waiting, because 1.0's gate (3 testers using the brain for 2 weeks with no developer help) can't start without them.
3. **The lean key layer** (§4).
4. **The path from the Claude and ChatGPT apps into Claude Code or Codex** (§6).

**First candidates after 1.0, chosen from the beta's and the launch's evidence:** connectors (email, Slack, Teams, calendar, spreadsheets, other databases); Select by a tag or a mention; Act in other tools (email drafts, calendar events, spreadsheets). None has a release.

**Out for the six months:** companies, teams, shared brains, hosting and a paid layer in the product; a second interface; other agent frameworks.

### 10. The business boundary
1. **This repo is the open-source core,** published by Sentina under MIT, in English and Spanish chosen by one setting. It holds everything one person needs for the whole loop (capture, Select, Agree, act, find and share, maintain, the key layer and the access layer). It never needs another edition to work.
2. **A complete edition** (more skills, features and use cases, such as ready-made factories) is a separate, private package that installs on top of the core through the seam 0.20.0 builds for your own skills. It is never a fork of the core.
3. **Nothing released in the core moves to the complete edition.**
4. **Entities, regions, offers, pricing and the complete edition's contents live outside this repo.** The repo records only the seam and these rules.
5. **Which edition a feature belongs to** is decided per feature in each release's scope review, by one test: if one person's trusted loop needs it, it is core.

## Consequences

- `docs/vision.md`: the goal, the user, the loop, the access layer, Notion as the first interface, the business boundary and the roadmap.
- `docs/design-principles.md`: §8, and §6 names the access layer.
- `docs/v2-ideas.md`: 0.20.0 the access layer, 0.21.0 Español, MCP access out of the post-1.0 list, the first candidates after 1.0 and what is out for six months.
- `AGENTS.md`: the release order.
- `build/TASKS.md`:
  - the release sequence gains 0.20.0 (the access layer) and 0.21.0 (Español), and 1.0.0 follows 0.21.0;
  - a 0.20.0 section holds CC-409 (this record) and CC-410, which plans 0.20.0 after its opening scope review;
  - a 0.21.0 section holds CC-354, U-40 and CC-411 (the release-management and language discussion);
  - U-28, U-31 and U-32 go ahead on the latest release.
- "Amended by 0116" lines in 0061, 0104, 0106 and 0113.
- No spec, CLI, skill, template, Notion or CHANGELOG change in this decision's own PR.
- The author's pitch material, outside this repo, is not changed by this decision; what it would need to match was given to the author in the session, not recorded here.

## Evidence

The author's answers in the session of 2026-11-27 (CC-409), in order:
- **The vision:** chose the personal context system ("B. A personal context system. … B is ok").
- **The loop,** from the author's notes on the pitch's loop diagram:
  - Capture is "to have the capture pulled from other sources. Directly from data pulled from Excel, other Databases, slack, teams, emails and any other that would fit in the day to day of a founder or professional worker".
  - Review is "how the user let's the system know what can the system take, what still needs work or is skipped. for example in the email this could be with a tag, or by tagging an agent in a discussion".
  - Ingest is "what happens at catch up and the grill me session between the user and the ai to know what goes into the brain, how conflicts are brought to the user, and what other options can be added while the session is going".
  - Act is where "we create the actionable assets, and would like to have in the future multiple formats from here. possibility to create emails, events, presentation, diagrams, update the excel".
  - The output stage is "all about organization and documentation … How do we have the user find the information. Document, organize, send artifacts or share with collegues".
  - Correct is "how do we have the clean up and compact of the context. the weekly report mentioning the state of the projects, goals and tasks, the self organization that catches idle documents, unrelated properties and suggest more".
- **The access layer:** "this system must help the user centralize functions with other app via mcp, create artifacts for either claude or chap gpt, send the context to app …, and have the skill of the user work with the system. These is key for adoption. In later stages we could include other functions such as working with other agent fws like hermes, open claw, grok bot". The loop with the access layer: "yes".
- **The key layer:** "a principle for the brain is to keep it as lean as possible. … if research, files and more data come to the system, it can cause context rot if it is all considered important for the day to day of the user. … the truly important must be a layer that can be managed without a lot of programmatic changes. there can be more layers of data but these will be underneath the key layer of context that will be kept compact, clean and in a way that the user can review in the loop to know what needs attention". Its contents: "A" (active containers).
- **Notion:** "notion is for now used as the interface … but this is just a convinient start … eventually the system should move to a state where this can be adopted with other programs such as click up, obsidian, … or one the user would be able to build by themselves. For now, notion is convenient as a start". What it commits to before 1.0: "A" (a direction and the guard).
- **The audience:** "A but including non technical who are already exploring claude and chat gpt, but need the push to claude code and codex".
- **The access layer's release:** "We might postpone 1.0 and include this in the pre release versions so I would say B. Also, we need to review again how to manage the pre-release versions coming out and how do we manage spanish vs english. Anyway, this is a different discussion"; then "this as 0.20.0. Spanish as 0.21.0".
- **The business:** "I will offer a spanish and english version of open source (ideally the same) and just having the user configure the language. Then I would offer a clear divide betweenn the open source, and the complete version that has additional skills, additional features, additional use cases. I am sure that I will have the divide between [two entities] … so perhaps for this I would have two sets of repo's". Against one core and a complete edition installed on top, with the entities splitting the commercial side rather than the code: "yes to all five".
- **The whole record:** "yes".

Read on 2026-11-27: `docs/vision.md`, `docs/design-principles.md`, `docs/v2-ideas.md`, decisions 0061, 0106, 0112, 0113 and 0115; `build/TASKS.md` (U-28, U-31 and U-32 open); the opening context pack of 0074 §3.
