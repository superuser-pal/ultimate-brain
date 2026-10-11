# 0003 — Where proposals live and how they are approved

**Status:** Accepted
**Date:** 2026-10-11

## Context
Agents propose changes (new decisions, fact updates, contradictions, memories). Options: Notion review queue, Git pull requests, chat only.

## Decision
- **Asynchronous:** pending proposals are files in `_proposals/` in the repo, published as rows in a Notion **Review** database (Approve / Reject / Edit). The next agent run applies approved rows to Markdown and commits.
- **In session:** when the user is present, the agent may ask for approval in chat instead.
- Git PRs are not part of the user experience; Git is the history underneath.

## What needs approval (resolved 2026-10-11)
- **Applies directly:** new notes (meeting summaries, new people, new decisions, new open questions). They land with lifecycle `draft` (0005), visible in Notion, reversible via Git.
- **Always a proposal:** any change to an existing note (fact updates, additions to project notes), any new note that **supersedes** an existing one (e.g. a decision replacing an older decision), contradictions, and merges suggested by dedup.
- Each review row shows what changes and the source sentence that triggered it.
- Unattended runs (future schedulers) may only add notes and flag; they never apply proposals.

Origin: obsidian-second-brain ingest confirmation gate (reviews/04-obsidian-second-brain.md).

## Evidence
reviews/02-obsidian-wiki.md (staged writes + patch files), reviews/01-claude-obsidian.md (inspect → approve → apply).
