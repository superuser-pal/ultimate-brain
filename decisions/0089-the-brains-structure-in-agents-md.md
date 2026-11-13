# 0089 — The brain's structure is in its AGENTS.md, briefs list their documents, and tasks are read live

**Status:** Accepted
**Date:** 2026-11-13
**Release:** 0.14.1
**Release amendment:** 2026-11-13 (CC-247): folded into 0.14.0 on the author's choice, so testers start with it; nothing else changes.
**Amends:** [0013](0013-ingest-context-and-index.md) (`index.md` stays navigation; `brain index` also writes the structure block); schema §16.1 and §16.3 (each brief gains a Documents section)
**Keeps:** 0081's style block and its placement rules; 0018 (tasks live only in Notion); 0022 (structure is changed in the product repo first); the rules block's "Add only what was asked for"; trust rule 2 (answers come from `brain query` and `brain recall`); the restricted-evidence rules of `index.md` (cli.md §5.8)

## Context

The author asked, on 2026-11-13, why an agent in their brain doesn't always know the structure of their work: the Domains, the Areas in each and the Projects in each, which is the organisation every push to Notion lands in. "Every time there is a domain or an area created they should be mentioned in the CLAUDE.md or AGENTS.md for the agent to always know what the structure is in Notion."

What the repositories show:
- **The structure is in the brain, but no session sees it whole.** Domains, Areas and Projects are notes (`domains/`, `areas/`, `projects/<slug>/`) with their Notion page ids; `brain index` already writes them into `index.md` under `## Domains`, `## Areas` (with `domain:`) and `## Projects` (with `area:`). Nothing tells an agent to read that file, and trust rule 2 points it to `brain query --candidates` instead. An agent finds a placement one search at a time and never sees, for example, that two similarly named Areas sit in two Domains.
- **The author wrote it by hand.** Their brain's `## My rules` carries a paragraph naming their Domains and which Area gets which language: a workaround that goes stale whenever the structure changes, and one a new user won't have.
- **The mechanism to fix it is new.** Until 0081 (2026-11-11) the brain's `AGENTS.md` held only the product's rules, identical in every brain. The style block is the first text `brain` writes there from the brain's own data.
- **Documents and tasks have no "what belongs here" read.** Documents are notes with `area` and `projects`, found by search or by backlinks; a project's brief and an Area's brief list decisions, questions, meetings and projects, not documents. Tasks exist only in Notion (0018) and are read live by the assistant and the query skill; the brain's rules don't say how a session gets a Project's or an Area's tasks.

The author's answers: a 0.14.x patch rather than 0.15.0; only active Projects; and, asked for a recommendation on linked repositories, the recommendation below.

## Decision

### 1. A structure block in the brain's AGENTS.md

- **`brain index` writes a structure block** in the brain's `AGENTS.md`, between `<!-- ultimate-brain:structure:start -->` and `<!-- ultimate-brain:structure:end -->`, under a heading `## Your structure`, with one line saying `brain` writes it from the Domain, Area and Project notes and that edits inside it are overwritten. Through `CLAUDE.md`'s `@AGENTS.md`, every session in the brain reads it.
- **What it lists:** the Domains, each with its Areas, each with its active Projects, as a nested list with each note's title and id, and its Notion page id when it has one. An Area with no Domain is listed under a last entry "No domain". With the Domains module off there is no Domain level: the Areas are listed directly.
- **What it leaves out:** archived Domains, Areas and Projects (`lifecycle: archived` or `notion_fields.archived`); Projects whose `notion_fields.status` is anything but `Active` (a Project with no status yet, created and not yet synced, is listed); Goals, tasks, documents, people and every other type.
- **It follows `index.md`'s restricted-evidence form:** a note `index.md` shows as awaiting cleanup appears with its id only.
- **It closes with the lookup lines of §3:** how to read what belongs to an Area or Project.
- **Placement and safety as the style block (cli.md §5.3.1):** after the rules block's end marker, and after the style block when there is one; never inside the rules block or below `## My rules`; not written when the markers are missing, out of order or duplicated (`AGENTS_BLOCK_NOT_FOUND`). No Domain, Area or Project at all means no block, and a block written before is removed.
- **Written by** `brain index` (which every skill already runs after every write) and `brain upgrade` (the first fill in an existing brain). So every path that creates, finds or changes the structure refreshes it: a Domain, Area or Project written with `brain note new` after the user's yes, a new Notion row taken in by `sync apply`, a rename, an archive, a merge or supersession, a Project moved to another Area or an Area to another Domain (`set_field`), a Project created by workflow setup or setup's seeding.
- **A stale block is reported:** `brain index --check`, and lint's and status's `index-stale`, count the block, so a run that skipped `brain index` is caught.
- **The block orients; it never authorises.** Placement still goes through note ids and the rules ("Ask when a request reads two ways", "Add only what was asked for"). Trust rule 2 is unchanged: the block is navigation, never a source for an answer.

### 2. A linked folder gets only its own place

- **A linked folder's instruction block (cli.md §5.12) shows only its own line:** its Domain, Area and Project, as titles and ids, where it already shows `- Project:` and `- Area:`. It gains a `- Domain:` line when its Area has a Domain and the module is on. It never lists the rest of the tree.
- **Why:** the block is committed in the linked repository, which can be a client's repository shared with other people; the whole tree would put the names of the user's other clients and Areas there. An agent in a linked folder works on one Project; for anything wider it asks the brain through `brain-query`, as today.

### 3. What belongs to an Area or Project

- **Each brief lists its documents.** The project brief (schema §16.1) and the Area brief (§16.3) gain a `## Documents` section: the Documents whose `projects` contains the project, or that belong to the Area as §16.3 defines it. The contract (CC-245) sets the order, the filters (following the existing sections' eligibility and waiting-line rules) and a cap with the count of the rest. The publish already writes the briefs into Notion, so the list shows on the project and Area pages too.
- **Tasks are read live, never stored.** The structure block's lookup lines and the rules block say: for an Area's or a Project's tasks, query the Tasks database through the Notion MCP filtered by its Notion page id (from the block), and never act on a task list from an earlier session. Task status stays the user's, in Notion (0018, trust rule 7).
- **So a new session knows what belongs where in two reads:** the brief (`brain query --read <id>`) for the knowledge and documents, and the live Tasks query for the work.

## Consequences

- **CC-245 (contract and CLI):** cli.md §5.8 (the block, its format, `--check`), §5.12 (the `- Domain:` line), §5.15 (upgrade writes the block), schema §16.1 and §16.3 (Documents); `src/` and tests on a synthetic brain; the rules block's tasks line in `templates/brain/AGENTS.md`.
- **CC-246 (skills):** a fork PR so that the skills which read "what belongs to" a Project or Area (brain-query, brain-workflow, ultimate-assistant's ramble placement) read the brief and the live tasks as §3 says, and brain-howto explains the block; vendored here.
- `AGENTS.md` changes in the brain's commits only when the structure changes. A brain with many Areas has a longer block; active Projects only keeps it to what an agent can use.
- After the upgrade, the author can shorten the hand-written structure paragraph in their `## My rules` to the rule it really states (the language per Domain); the product doesn't touch it.
- Out of scope: tasks or documents in the block, Goals and Key Results, a linked folder's view of the whole tree, any change to how the structure is created in Notion.

## Evidence

- The author's conversation of 2026-11-13 (this decision's Context).
- `templates/brain/AGENTS.md` (trust rule 2, "Add only what was asked for"); spec/cli.md §5.3.1 (the style block), §5.8 (`brain index`), §5.12 (`brain link`); spec/schema.md §13 and §16; spec/assistant.md §2.1 (tasks read live); decisions [0013](0013-ingest-context-and-index.md), [0018](0018-notion-tasks-mapping.md), [0081](0081-response-style-working-principles-and-plain-writing.md).
