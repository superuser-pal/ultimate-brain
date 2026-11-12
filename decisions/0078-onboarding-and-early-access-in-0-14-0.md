# 0078 — Onboarding and early access in 0.14.0: a published Notion template and one guided setup

**Status:** Accepted
**Date:** 2026-11-10
**Release:** 0.14.0
**Scope amended by:** [0079](0079-lean-minutes-and-follow-ups-as-tasks.md) (2026-11-10): 0.14.0 also ships the lean minutes format and quick follow-ups as Tasks, so testers start on it
**Scope amended by:** [0081](0081-response-style-working-principles-and-plain-writing.md) (2026-11-11): 0.14.0 also ships the response style setting (a settings-screen item), the working principles and the plain writing reference
**§1 amended by:** [0084](0084-the-notion-template-is-the-authors-emptied-space-with-example-rows.md) (2026-11-12): the template is a copy of the author's own space, emptied and scrubbed, in their one workspace, not a dedicated workspace; it carries seven `Example · ` rows (a sample meeting among them), which setup removes when it connects the brain
**§2 amended by:** [0086](0086-the-brain-works-on-main-and-early-access-requires-gh.md) (2026-11-12): `gh` is required for early access, so setup always creates the private remote with it (the steps for another Git host return at 1.0); a brain is worked on one branch, with no pull requests
**Amends:** [0077](0077-trust-repair-in-0-13-0.md) §6 and [0061](0061-roadmap-and-launch-boundary.md) (release order only: onboarding 0.15.0 → 0.14.0, the weekly review 0.14.0 → 0.15.0; early access starts on 0.14.0, before 1.0); [0075](0075-weekly-review-and-targeted-corrections.md) (release placement only: 0.14.0 → 0.15.0)
**Refines:** [0019](0019-notion-space-built-with-notion-ai-prompts.md) (a new user duplicates a published template instead of building from the prompts), [0048](0048-modules-and-simpler-rows.md) (the modules a new brain starts with), [0015](0015-notion-access-via-mcp.md) and [0037](0037-intake-experience.md) (what setup asks, and when)
**Keeps:** 0077's trust repair as 0.13.0 and first; 0075's weekly scope (unchanged, one release later); the feature cutoff at 0.15.0; Markdown + Git canonical, Notion as the interface, 0022 (structure changes in the product first); the build prompts and migrations; the CLI stays non-interactive; the session-opening scope gate

## Context

A new user today goes through four places in turn: the README's Install, what `brain init` prints, `notion/CHECKLIST.md` (about fifteen Notion AI prompts, each edited by hand for the chosen modules, then buttons and page layouts by hand) and the connect-notion skill. Three steps the meeting flow needs sit outside that path: the minutes prompt (only in `pasting-the-minutes-prompt.md`, written for upgrades), Brain Assistant (only in `notion/brain-assistant.md`) and the How it works page (only in migration 0004). The Notion connection surfaces only when the connect skill fails, after the space is built. Git identity and the remote are silent: a missing identity is a warning, and with no remote every push fails. The drop folder is asked the first time it's needed.

On 2026-11-10 the user ran a scope grill on the first-time setup for early testers (friends and family) and 1.0, and chose each option below. 0077 had moved onboarding to 0.15.0 the same day; the user then chose to build onboarding before the weekly review so testers start earlier.

## Decision

### 1. A new user duplicates a published Notion template

- The product publishes a **ready-built Notion template** with every database, view, template, button, page layout, the How it works page and the Brain Assistant Skills database. A new user duplicates it; the build prompts, `notion/CHECKLIST.md` and the migrations stay, for upgrading a space and for anyone who prefers to build.
- The template is built in a **dedicated Notion workspace holding only the template**, never copied from the author's space, and published with duplication allowed. Its URL and version are kept once, in `notion/TEMPLATE.md`; everything else (README, `docs/setup.md`, the setup skill) takes the link from there, and one leak-allow entry covers that URL.
- The template's top page has a **"Start here"** callout: this is the Notion half of Ultimate Brain; next, install it and say "set up my brain", with a link to the README's Get started.
- The System page carries a **Template version** line. The connect step stores it as `notion.template_version`, and `brain upgrade` names the migrations newer than it.
- Two templates now exist; user-facing text names them apart: the **brain folder** (`templates/brain/`, the Git repo `brain init` creates) and the **Notion template**.

### 2. One phrase starts one guided setup

- `brain init` ends with one next step: open your agent in the brain folder and say **"set up my brain"**. `brain init` itself stays non-interactive.
- A new skill, **`brain-setup`**, written in the skills fork, runs the steps in this order and **resumes** at the first unfinished one when asked again:
  1. **Prerequisites,** all checked at once: Node, Git identity, Claude Code or Codex, the Notion MCP connection, `gh`, the Notion plan (asked, since the API can't read it).
  2. **One settings screen,** every item with a default filled in and a one-line explanation of what it is and why it matters.
  3. **The template** duplicated, and the agent connected to Notion.
  4. **"Connect the brain to Notion"** (the existing skill): modules, database ids, the Tasks database, the template version.
  5. **Identities** (0037).
  6. **Seeding** (§3).
  7. **The first-value check** (§4).
  8. **The scheduled catch-up,** offered only after first value works.
- **Required** (setup stops there until it is done, and resumes later): Git identity, a private remote (created with `gh repo create --private` when `gh` is signed in, otherwise the steps), the Notion MCP connection, the connection to the brain's databases, identities, the drop folder (created), the language notes are written in, the minutes prompt and Brain Assistant (as a Custom Agent, or as personal Instructions on a plan without Custom Agents). **Optional,** explained and stored as a setting rather than skipped: MarkItDown, the schedule and `gh`. Push and publish keep their defaults and are shown. There is no skip list.
- The two Notion steps done by hand are **walked through and checked**: the minutes prompt by summarising a short note and checking its shape (subjects, `Selection:` lines, item ids); Brain Assistant with `/Today` returning only the brain's tasks. Whether the minutes prompt can live inside the Meetings template is checked on the test duplicate; if it can, that step goes.
- **`brain status`** gains a `setup` block from the checks it can make offline (Git identity, remote, database ids, drop folder, `owner.person`, template version), and its human output starts with a line like "Setup: 6 of 9 done · next: connect Notion". The skill adds the online checks. No new command.
- Setup never sends the user to a path under `npm root -g`: the agent reads the product's files and gives links or text. The settings screen shows where the brain lives (folder, remote).

### 3. Seeding: describe your work, then one preview

- The user describes their work in a few sentences; the setup skill, through Ultimate Assistant's "tell it what's on your mind" flow (0064), proposes one preview:
  - **Domains** only when the description has two or more contexts (work and personal); the Domains module is then turned on;
  - **Areas** (name and Domain); **Projects** (name, Area, Status, a one-line purpose, the client org if any);
  - **the 5 to 10 people** the user works with most, with org and role, so the first meeting doesn't create duplicates;
  - **3 to 5 key documents** dropped in the drop folder and kept as Documents.
- The user can also point to a folder or repo, which reuses 0.9.0 project adoption.
- Nothing is written before the user's yes; the seeded notes are then published in one go. Notion is connected before seeding.
- What the brain reads from the seeded documents (decisions, questions, people) goes through **Review as usual**, one row per file: the first Review is on the user's own material.

### 4. Modules for a new brain

A new brain starts with **Knowledge, Orgs, Documents, Reports and Tasks** on; Planning stays off; Domains follows seeding (§3). Existing brains keep their modules.

### 5. First value is proven three ways

The evidence is **correct tasks, a report generated and the information organised**:
- **Release gate:** a synthetic persona brain run end to end in a **clean test Notion workspace duplicated from the template**: seeding, one meeting, one document, catch-up. Checked: the tasks are exactly the owner's commitments with the right project and due date, and nothing from other people; "report on <project>" lands in Documents, linked from the project, citing the meeting and the document; each note sits under the expected Area and Project, with no duplicate people. The same run records what survives duplication (the Custom Agent and its access, the buttons that message it, relations and the Home buttons). Claude Code runs it; Codex runs it once before early access starts.
- **Each user's setup** ends with the same three checks on a seeded document and a report on the user's main project, with no meeting needed.
- **The first meeting** is checked later: the first catch-up after the first Reviewed meeting adds one line saying how it went.

### 6. Early access for friends and family starts on 0.14.0

- Order: the trust repair stays **0.13.0** and first (0077); onboarding is **0.14.0**; the weekly review and targeted corrections (0075, CC-111) move to **0.15.0**, unchanged, and remain the feature cutoff. Testers receive 0.15.0 through `brain upgrade`, which tests the upgrade path with real users before 1.0.
- **Early access for friends and family starts on 0.14.0.** The README's Get started, `docs/setup.md`, the template and its "Start here" callout, and a short block at the top of the skills repo's README ship with it. This brings forward setup guidance that 0061 placed in 1.0; the rest of 1.0's scope (translation, funnel, positioning, launch) stays.
- **The product README** gets a "Get started" of about six steps (prerequisites, duplicate the Notion template, install, `brain init`, say "set up my brain", what you'll have at the end). It is written as live: anyone can follow it, and "friends and family" describes who is invited. `docs/setup.md` holds each setting, recovery from common failures and the path without Notion AI; it ships in the npm package so the skill and the reader see the same text.
- **The skills repo README** keeps upstream's text and gains one block at its top: these are the skills behind Ultimate Brain; to use them, set up Ultimate Brain (link). The change goes through a fork PR.
- **Testers' feedback:** setup ends with a short setup report (each step done or not, time taken, what failed, the three first-value checks) holding no names or content. It offers to file it as a `beta-setup` issue in the public product repo, shows the text first and files only after a yes. No telemetry.
- **Notion AI is required for early access.** At 1.0 it becomes optional with what exists today: without it, setup drops the minutes prompt and Brain Assistant from the required list and says what is lost; meetings come from any transcript or summary pasted onto the meeting page and are ingested whole (no selection); how-to questions go to the agent (brain-howto). Rewriting a pasted transcript into the minutes format is noted for after 1.0.
- How the template link reaches testers, the npm channel and the number of testers are decided at 1.0's opening grill (0061).

### Out of scope

An interactive `brain init`; a new diagnostic command; telemetry; a synthetic sample meeting in the template; rich profiles and specialised types (0030); the Notion template gallery and the acquisition funnel (1.0); any operation on the author's private brain or Notion workspace without an explicit yes. The minimal per-area tracking preferences of 0061's onboarding package stay in 0.14.0's scope as recorded, and are not decided here.

## Consequences

- [build/TASKS.md](../build/TASKS.md): the onboarding section becomes 0.14.0 with its task rows (contracts, the template, the CLI, the setup skill, the guides, the release gate and the user's workspace step); the weekly review section and CC-111 become 0.15.0. The release table, `docs/vision.md`, `docs/v2-ideas.md` and `AGENTS.md` state the new order.
- 0019, 0048, 0061, 0075 and 0077 get header pointers to this decision; their bodies stay as recorded. Spec lines that name a release for the moved work are corrected by the contracts task.
- This is a planning record: no CLI, schema, spec, skill, template, README or Notion change, no brain operation, and no implementation starts with it.

## Evidence

- The user's scope grill, 2026-11-10, Q1 to Q31: the published template and its dedicated workspace, one guided and resumable setup with its order, the required and optional items without a skip list, the checked Notion steps, seeding through a preview, the new defaults, the three-way evidence, the status setup block and template version, the README and skills README blocks, the "Start here" callout, the setup report, Notion AI required for early access and optional at 1.0, onboarding before the weekly review, early access on 0.14.0.
- The current path: [README.md](../README.md), [notion/CHECKLIST.md](../notion/CHECKLIST.md), `src/commands/init.ts`, the brain-connect-notion skill, [notion/brain-assistant.md](../notion/brain-assistant.md), [notion/pasting-the-minutes-prompt.md](../notion/pasting-the-minutes-prompt.md), [migration 0004](../notion/migrations/0004-ai-prompts-and-guide.md).
- [Roadmap](0061-roadmap-and-launch-boundary.md), [trust repair and release order](0077-trust-repair-in-0-13-0.md), [weekly review](0075-weekly-review-and-targeted-corrections.md), [the template prompts](0019-notion-space-built-with-notion-ai-prompts.md), [modules](0048-modules-and-simpler-rows.md).
