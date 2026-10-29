# Review 08 — Operator and Optimizer (third-party vault skills)

**Focus:** what two third-party Claude Code skills for running a Markdown vault as a second brain can give Ultimate Brain: an unattended maintenance agent on a schedule (Operator) and an audit with fixes (Optimizer) (CC-60)
**Reviewed:** the skills' `SKILL.md` files and their `references/` (Operator: the setup procedure, a rendered-prompt template of about 360 lines, connector fragments; Optimizer: the procedure, 10 framework references, 10 pass files, HTML report templates), shared with the user as a download, 2026-10-29. Not copied into this repo; no code run.
**Date:** 2026-10-29

Both skills target Baalda, a desktop vault app with sync, in which a note's identity is a server-side id tied to its path. Much of their text works around that: a note moved with `mv` loses its id, history and sharing, so moves go through the app's MCP. We have no such problem: notes carry a permanent `id` (0001) and links are repaired by id (0002). Claims are **Verified** (read in the skill files) or **Inferred**.

## 1. What each skill does

### Operator
A setup skill that writes a prompt and schedules it. **Verified.**
- **Setup:** reads the vault first (its `CLAUDE.md` and its curated "context" folder: org, team, voice, folders), shows what it found and asks for overrides, then asks only what the vault can't tell: cadence, connectors, the one person who gets chat escalations, budgets. It **probes each connector with a read-only call** instead of asking whether it is set up, and reports "found and working / found but failing / not found". It ends by **creating the scheduled run itself** (Claude Code's `schedule` skill), falling back to printing the cron line.
- **The rendered prompt:** one session is one run; it never asks or confirms. Each run: transcripts, chat and community digests, per-person dailies, a root daily briefing, a rotating housekeeping sweep, a lint pass, a task-list rewrite, a run report.
- **Rules worth noting:**
  - **Budgets per run** (reads, writes, transcripts, DMs, housekeeping fixes); on a breach the rest is queued and the next run picks it up. "Small, verified, complete over ambitious, half-done."
  - **The daily is state, not a log:** create it once, update sections in place, and **a run with nothing new writes nothing** (no "9th pass, still quiet" blocks; run status goes to the report).
  - **Freshness:** only the last 24 hours go into today's daily; an unanswered item older than that is queued once and never escalated again.
  - **Every failure is logged and the run goes on;** one retry on a write, no retry loops; the cadence is the recovery.
  - **Read back every write** and check its content, not only that the file exists.
  - **A fixed report:** files modified, tasks extracted, housekeeping (fixed or queued), lint, errors, run stats, budget left.
  - Narrate between tool batches so the session doesn't hit an idle timeout.

### Optimizer
An audit of every `.md` in the vault against 10 "frameworks", each finding with a fix the user applies now, saves to a plan file, or declines; then a score and an HTML dashboard. **Verified.**

| Group | Frameworks | Checks |
|---|---|---|
| Notes | F2 "LLM wiki" | dead links, orphans, missing cross-references, duplicates, stubs, sources not digested, raw sources edited |
| | F5 memory, F4 context rot | file size budgets (≤ 10 KB recommended), long files, similar-topic distractors |
| Reflection across notes | F8 (after Anthropic's Managed Agents "Dreams") | contradictions, merge candidates, stale entries, recurring themes with no canonical note, promotions of durable lines out of session logs; reads the curated layer plus the last 30 days of session notes |
| Instruction files | F1 CLAUDE.md, F3 compression, F6 progressive disclosure, F10 "rules for Claude 5 models" | size, vague rules, filler and hedging, reference depth, description quality; F10 sorts each rule into retired / one-sided / bare prohibition / aggressive / obvious / keep as hard rule / keep as gotcha, and proposes the published Fable 5.1 guidance where missing |
| Structure | F9 architecture | discovers each folder's role by reading it, an index file per folder, routing-table truth, every file reachable in ≤ 3 hops |
| Hygiene | G7 | em dashes, frontmatter, H1 equal to the file name |

Its operating rules: every finding ships a fix; semantic fixes are walked one by one; mechanical ones may be bulk-applied, and a "bulk-apply everything" mode applies every finding; a vault checkpoint before applying; a sanity gate that re-runs a framework when its findings restate the rule instead of judging the case.

## 2. Port / Adapt / Reject

| Component | Source | Decision | Reason |
|---|---|---|---|
| Reflection across notes (F8) | Optimizer `passes-reflection.md` | **Adapt** (0052) | The v2 entries "Contradiction and staleness reports", "Dedup audit" and part of "Correction sweep". Its five findings map onto our proposal kinds (`contradiction`, `update_fact`, `merge`, `add_to_note`) and new draft notes, so the output is Review rows, never edits (0003) |
| Orphans, oversized notes, near-duplicate names (F2, F5) | Optimizer | **Adapt** as `brain lint` warnings (0052) | Deterministic; near-duplicates feed reflection's merge candidates |
| Stub notes (F2.7) | Optimizer | Reject | Drafts from ingest are short on purpose |
| Unattended run with budgets, a no-op that writes nothing, a fixed report, failures logged and skipped | Operator prompt | **Adapt** (0051) | The missing piece reviews/07 named for any scheduler: catch-up has no unattended mode |
| Setup that probes and schedules | Operator setup | **Adapt**, the schedule step only (0051) | The read-first, ask-the-gaps, probe-connectors pattern goes into the v2 Onboarding suite |
| Rules for current models (F10), skill layering (F6), compression (F3) | Optimizer | **Adapt** for this repo's skills and brain AGENTS template (CC-61) | In a brain these files are product-owned (`product-file` lint, 0038); the audit belongs here |
| Read back every write | Operator | Reference | Our CLI writes are checked by `brain lint`; Notion writes already go through one batch per run (0043) |
| Score and HTML dashboard | Optimizer | Reject | Brain skills report counts, what needs the user and the next action |
| Folder role discovery, an index file per folder (F9) | Optimizer | Reject | Our layout is fixed by the schema and `index.md` is generated (0013) |
| Bulk-apply of changes; autonomous edits of curated notes | both | Reject | Changes to existing knowledge are proposals (0003); unattended runs only add and flag (synthesis §3.1) |
| Wikilinks, Obsidian syntax | both | Reject | 0002 |
| Chat and community DMs, team profiles, dailies, a coloured signature | Operator | Reject | Not our scope; Notion is the human interface |
| Baalda rules (`move_note`, `.context/`, checkpoints) | both | Reject | Stable ids already solve note identity; Git is our checkpoint |

## 3. Integration
- **Unattended catch-up (0051):** a flag on the existing catch-up, not a new skill. Questions become skips listed under Needs you; the user's explicit decisions are applied, a What to fix waits for an attended run; publishing needs `settings.publish: auto`; a budget of inputs per run; no commit, Notion write or log line when nothing is waiting; a Report row in the Inbox only when something needs the user or failed (Reports module on; otherwise a summary at the next attended catch-up). `brain schedule install` writes the local scheduler entry.
- **Reflection (0052):** a `brain-reflect` skill over `brain reflect --candidates`, like brain-query over `brain query --candidates`. Proposals go to Review as Conflict or Review notes rows (0048's three kinds stay three).
- **Skills audit (CC-61):** a one-time pass over `skills/` and `templates/brain/AGENTS.md`, plus mechanical checks in `scripts/build-skills.ts`.

## 4. Risks
- **Review-queue flooding:** a first reflection on a grown brain could propose dozens of rows. Mitigated by a cap per run and fingerprints of rejected findings (0052).
- **Unattended cost and drift:** a scheduled run nobody watches can loop or grow. Mitigated by the input budget, the backlog warning and the no-op rule (0051).
- **Models other than Claude:** the skills are tested on Claude models only (reviews/07); a schedule pins one.
- **Claude Code's cloud schedules** run on a fresh clone without the drop folder, linked repos or a local Notion MCP. **Inferred**, unchecked; left out until checked.

## 5. Recommended next step
Decisions 0051 and 0052 and their tasks (CC-60). Order: the skills audit in 0.6.1, the unattended catch-up in 0.7.0 after U-19, reflection in 0.8.0 after the agency brain moves in.
