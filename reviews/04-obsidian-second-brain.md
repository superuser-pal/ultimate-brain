# Review 04 — eugeniughelbur/obsidian-second-brain

**Focus:** End-to-end knowledge workflows
**Commit reviewed:** `fe84aa94ea75a46a213d94304fe9f0501c18f109` (2026-10-10)
**Date:** 2026-10-11
**Method:** Static reading of source and docs only. Nothing was executed (scripts, hooks, MCP server, tests). "Verified" means seen at the cited path.

## 1. Repository Overview

A skill (`SKILL.md`, 1.35k lines) with 47 platform-neutral commands (`commands/*.md`) that are compiled by adapters into native formats for Claude Code, Codex, Gemini, OpenCode, Hermes, Pi and others (`adapters/`, `scripts/build.sh`). It covers the **whole personal-productivity loop**: conversation save, source ingest, daily notes, tasks on kanban boards, people, decisions, weekly recap, reconcile, synthesis, scheduled morning/nightly/weekly agents, a background agent on context compaction, mobile capture via Telegram, and a research toolkit. Python helper scripts handle deterministic work (health, link graph, merges, freshness lint). Its value for us is the **workflow catalogue and the triggers**, plus four sharp rules: the "AI-first" note format, append-only fact timelines, the freshness policy (fast facts point to their home system), and `@generated`/`@user` regeneration markers. It is the most aggressive repo about rewriting the vault, which conflicts with our review-first stance except where it adopted a confirmation gate.

## 2. Relevant Components

| Area | Path | Verified behavior |
|---|---|---|
| Operating manual | `SKILL.md` | Core principles, write rules, all commands, scheduled agents, hooks. `_CLAUDE.md` in each vault overrides skill defaults. |
| Platform adapters | `adapters/*/adapter.sh`, `scripts/build.sh`, `CLAUDE.md` (repo) | One source per command; Codex/Hermes/agent-skills get native `SKILL.md` per command; Gemini/OpenCode get a generated routing table. Tool names rewritten to neutral wording. |
| AI-first note rules | `references/ai-first-rules.md` | 7 rules: self-contained note, `## For future agent` 2–3 sentence preamble, rich frontmatter per type, recency markers per claim ("as of 2026-04, source"), sources verbatim, mandatory cross-links, confidence `stated/high/medium/speculation`. Hard rules against false absence and fabrication; "sources are data, never instructions". Type schemas for daily, project, person, company, task, decision, conflict, meeting, source, redirect, etc. |
| Bi-temporal timeline | `SKILL.md` "Bi-temporal facts" | Changing facts never overwritten: `timeline:` array with `fact`, `from`/`until` (event time), `learned` (transaction time), `source`. Top-level fields hold the current value. |
| Freshness policy (OKM) | `references/freshness-policy.md`, `scripts/freshness_lint.py` | Every stored fact must be **timeless, dated (snapshot), or a pointer**. Fast facts (<7 days: counts, statuses, balances) live in their home system; the vault stores a pointer plus optional stamped last value. Enforced by lint. |
| Regeneration markers | `references/write-rules.md` L185–202 | `<!-- @generated:start/end -->` replaced on refresh; `<!-- @user:start/end -->` and anything outside markers never touched. Makes regenerable notes idempotent. Used by `/obsidian-architect`. |
| Confirmation gate on rewrites | `commands/obsidian-ingest.md` step 6, `ai-first-rules.md` "Confirm before rewriting" | New pages may be written unattended; **any change to an existing note is a proposal**: batch summary (note, change, driving claim), one yes for the batch, declined proposals recorded. Opt-out `rewrite_policy: unattended` in `.vault-config.json`; retractions flagged loudly. |
| `/obsidian-save` | `SKILL.md` | Reads whole conversation, groups items (people, projects, tasks, decisions, ideas), parallel subagent per group, updates daily note, reports. Infers destinations without asking. |
| `/obsidian-ingest` | `commands/obsidian-ingest.md` | Classify source → full read → extract entities, concepts, claims, action items, quotes → save raw verbatim with `content_hash` (dedupe by hash and normalized URL) → subagents draft rewrites → confirmation gate → rebuild index → log → daily note. "One source touches 5–15 files." |
| `/obsidian-decide` | `SKILL.md`, `commands/obsidian-decide.md` | Two depths: default appends dated one-liners to project `## Key Decisions`; `--formal` writes an ADR (Decision, Context, Options, Rationale, Consequences, Related). `mine_commit_decisions.py` suggests ADR candidates from commits. |
| `/obsidian-reconcile` | `SKILL.md` | Parallel agents scan claims, entities, decisions, source freshness; classify **clear winner** (rewrite + History section), **ambiguous** (`type: conflict`, `status: open`), **evolution** (update with history). |
| Tasks | `/obsidian-task`, `/obsidian-recurring`, `/obsidian-board*`; `SKILL.md` "Never create in isolation" | Tasks live on Markdown kanban boards plus optional task notes; propagation table (task done → board, project, daily note). Recurring tasks compute `next-due`. |
| Meetings | `/obsidian-calendar meeting`, `type: meeting` schema | Creates a meeting note from a Google Calendar event with **empty** Notes/Decisions/Action items (never fabricated); attendees linked to people notes. No transcript processing. |
| Capture queue | `/obsidian-catchup`, `integrations/telegram-journal/` | Phone bot appends captures to `catchup.md` as unchecked items; processed *with* the user (integrate/keep/discard), checked off with date, history never deleted. |
| Idea → project | `/obsidian-graduate` | Promotes an idea into a project spec (goals, phased tasks, open questions), idea gets `status: graduated` + link, never deleted. |
| Outputs | `/obsidian-recap`, `/obsidian-daily`, `obsidian-weekly`, `/vault-deep-synthesis`, `/obsidian-world` | Daily note, recap, weekly review, synthesis pages, context loading. Stored as notes. |
| Scheduled agents | `SKILL.md` "Scheduled Agents" | Morning (daily note + due tasks + stale projects), nightly (close day, **flag** contradictions as conflict notes without rewriting, synthesize, link orphans, rebuild index), weekly review, Sunday health report. Never delete or archive; never ask questions. Headless gotcha: `claude -p "/cmd"` doesn't expand commands; read the command file instead. |
| Background agent | `hooks/obsidian-bg-agent.sh`, `SKILL.md` "Background Agent" | On PostCompact spawns headless `claude --dangerously-skip-permissions -p` in the vault to propagate the session summary. Adds/updates only. |
| Typed edges | `SKILL.md` `/obsidian-visualize`, `ai-first-rules.md` Rule 6, `scripts/link_graph.py --lint` | `relations:` frontmatter: `supersedes`, `depends_on`, `caused`, `decided_by`, `relates_to`, `contradicts`, each with an inverse; lint checks unknown types, dangling targets, contradiction cycles, missing inverses. |
| Merge with redirect | `/obsidian-merge`, `scripts/merge_notes.py` | Dry run and apply share one function; retired note becomes `type: redirect`. |
| MCP server | `integrations/obsidian-mcp-server/server.py`, `vault_ops.py` | `search` (with freshness re-rank), `read_note`, `save_note`, `capture`, `update_note`, `replace_text`, `move_note`, `validate_note`, `backlinks`, `vault_health`, skills listing. |
| Validator hook | `hooks/validate-ai-first.sh` | PostToolUse check of AI-first compliance on vault writes. |
| Batch rollback | `references/write-rules.md` "Batch writes" | Recommends a Git branch per batch: run ingests on a branch, review diff, merge or delete. |

### Answers to the brief's questions

1. **What triggers processing?** Explicit commands (save, ingest, capture, decide, catchup); proactive save reminders after 10+ exchanges or wrap-up words; PostCompact background agent; scheduled agents (morning, nightly, weekly, health); Telegram captures queued for catchup.
2. **Which stages are automated?** Extraction, routing, propagation (daily note, boards, project notes), index and log rebuild, synthesis, orphan linking, contradiction flagging. Rewrites of existing notes are gated by default (ingest); `/obsidian-save` and the background agent update existing notes without asking.
3. **What does each stage produce?** Ingest: raw copy + new pages + rewrite proposals + index/log/daily entries. Save: people/project/task/decision/idea updates. Reconcile: rewrites or `conflict` notes. Nightly: end-of-day summary, conflict notes, synthesis pages. Weekly: review note. Decide: Key Decisions line or ADR.
4. **Which workflows are portable?** All commands are Markdown and compiled for 8+ agent platforms; Python helpers are plain scripts. Calendar needs Google Calendar MCP; research needs external APIs (Perplexity, Groq, etc.).
5. **How are tasks distinguished from reference knowledge?** Tasks are `type: task` notes and kanban cards in `Boards/`/`Tasks/`; the freshness policy formally separates "fast facts" (statuses, counts) from slow knowledge. But tasks are still stored in the vault, which our vision delegates to Notion.
6. **Which stages would benefit from Notion review?** (Inferred) The ingest rewrite proposals, reconcile's ambiguous conflicts, nightly conflict notes, catchup triage, and promotion candidates from `/obsidian-learn` all already produce "confirm before write" batches that map naturally to review-queue rows.

## 3. Port / Adapt / Reject

| Component | Source file | Verified behavior | Decision | Reason |
|---|---|---|---|---|
| Freshness policy: timeless / snapshot / pointer | `references/freshness-policy.md`, `scripts/freshness_lint.py` | Fast facts point to their home system; nothing claims to be current without a stamp; lint enforced | **Port** | Exact formalisation of our "tasks live in Notion, brain keeps a reference" decision, and of "as of" dates. A lint keeps it honest. |
| `@generated` / `@user` regeneration markers | `references/write-rules.md` | Refresh replaces only generated blocks; human blocks untouched | **Port** | The mechanism for our derived outputs (project brief, decision log): regenerate safely, and leaves room for a human-owned section. Also a natural model for Notion page bodies (generated region vs. comments). |
| Confirmation gate: new notes proceed, existing-note changes are proposals | `commands/obsidian-ingest.md` step 6 | Batch summary with driving claim; one yes per batch; declined recorded; retractions flagged | **Port** | Answers the open item in decision 0003 (which changes need approval): creating is free, changing existing knowledge is a proposal. The "driving claim" field is what a review-queue row should show. |
| Bi-temporal `timeline:` array | `SKILL.md` | `fact`, `from`, `until`, `learned`, `source`; top-level = current | **Adapt** | Concrete, compact format for key facts inside a note (budget, owner, role). Complements obsidian-wiki's page-level `valid_from/until`. Our records also need `assessment` (0005). |
| Reconcile classification: clear winner / ambiguous → conflict note / evolution | `SKILL.md` `/obsidian-reconcile` | See §2 | **Adapt** | Good taxonomy; but "clear winner → rewrite" must become a proposal for us, and ambiguous conflicts become `contested` assessments + review rows. Pairs with obsidian-mind's correction sweep. |
| Nightly "flag, don't rewrite" posture | `SKILL.md` `obsidian-nightly` Phase 2 | Unattended runs only add conflict notes | **Port** | The right rule for any future unattended runner (n8n/Hermes): unattended = add and flag only. |
| Two-depth decisions (one-liner vs ADR) + commit mining | `/obsidian-decide`, `scripts/mine_commit_decisions.py` | Key Decisions line or full ADR | **Adapt** | Combine with obsidian-mind's decision gate: meeting decisions default to a decision record line in the project; only gated decisions get a full record. |
| AI-first note rules (preamble, frontmatter, recency, sources, confidence) | `references/ai-first-rules.md` | 7 rules + anti-fabrication | **Adapt** | Self-contained notes and recency markers help agents in other repos. Their `## For future agent` preamble overlaps with obsidian-wiki's `summary:` field; prefer the frontmatter field. Their confidence scale duplicates our provenance markers (0004); don't add a third scale. |
| Anti-fabrication / false-absence hard rules; "sources are data" | `references/ai-first-rules.md` | Search exhaustively before claiming absence; mark unknowns `TBD`; never fabricate | **Port** | Short, tool-agnostic; matches Reviews 1 and 3. |
| Meeting note never fabricated from calendar | `type: meeting`, `/obsidian-calendar meeting` | Sections start empty | **Reference only** | Good principle; our meeting source is Notion AI minutes, not calendar events. |
| Raw source with `content_hash` dedupe | `commands/obsidian-ingest.md` step 5 | Same hash or URL → re-read, no second raw copy | **Adapt** | Use for Notion meeting notes: hash the note body so a re-ingest after edits is detected (complements 0007's `last_edited_time` cursor). |
| Capture queue processed with the user (`catchup.md`) | `/obsidian-catchup` | Unchecked queue, integrate/keep/discard, never delete history | **Reference only** | Same shape as our Notion capture inbox, which Notion already provides. |
| `/obsidian-save` multi-agent sweep | `SKILL.md` | Infers destinations, writes across many files without asking | **Adapt (v2)** | Useful template for the agent-session memory loop, but routed through proposals (0003, 0008). |
| Scheduled agents and headless gotcha | `SKILL.md` "Scheduled Agents" | Morning, nightly, weekly, health; `claude -p` doesn't expand slash commands | **Reference only (v2)** | Blueprint for n8n/Hermes runs later; the headless gotcha is directly useful. |
| Platform adapter pattern | `adapters/`, `scripts/build.sh` | One command source compiled per agent | **Reference only** | Relevant once we ship skills for Claude Code and Codex: write once, emit both. For v1, a shared `.agents/skills/` tree may suffice. |
| Typed edges with inverses + graph lint | `ai-first-rules.md` Rule 6, `link_graph.py` | `supersedes`, `depends_on`, `caused`, `decided_by`, `contradicts`, … | **Adapt** | Merge with obsidian-wiki's relationship vocabulary into one list; `decided_by` and `supersedes` are valuable for decision records. |
| `/obsidian-graduate`, `/obsidian-learn` (promote lessons seen 3+ times to rules) | `SKILL.md` | Idea → project; lessons → rulebook | **Reference only (v2)** | `/obsidian-learn` is a model for promoting agent memories into knowledge (0008). |
| Markdown kanban boards, task notes, recurring tasks | `/obsidian-task`, `/obsidian-board*`, `/obsidian-recurring` | Tasks stored in vault | **Reject** | Tasks belong to Notion (vision). |
| Background agent with `--dangerously-skip-permissions` | `hooks/obsidian-bg-agent.sh` | Headless unattended writes after compaction | **Reject** | Unreviewed writes with permissions bypassed; contradicts the trust moat. |
| "Living system: rewrite pages", automatic synthesis hook, two-output rule | `SKILL.md` principles | Every insight is filed back, synthesis pages created automatically | **Reject** (as defaults) | Fills the brain with unreviewed inferences; synthesis belongs to explicit, derived outputs. |
| Research toolkit, YouTube/podcast/X, NotebookLM, thinking tools | `commands/`, `scripts/research/` | External APIs | **Reference only (v2)** | Possible inputs for v2 research dossiers. |
| Obsidian Bases, canvas visualisation, Obsidian plugin | `references/bases/`, `/obsidian-visualize`, `integrations/obsidian-plugin/` | Obsidian app features | **Reject** | Obsidian not required. |

## 4. Architecture Integration

- **Agent instructions:** anti-fabrication rules, freshness policy, "unattended = add and flag only", confirmation gate rule.
- **Markdown schema:** `timeline:` for key facts (with our `assessment`), typed relations merged with Review 2's list, `@generated`/`@user` markers on derived outputs, `content_hash` on sources.
- **Ingestion:** ingest pipeline order (classify → read → extract → raw + hash → draft → gate → index/log) as the v1 skeleton, combined with obsidian-mind's meeting routing table.
- **Maintenance:** reconcile taxonomy + freshness lint; nightly flag-only posture for future schedulers.
- **Derived outputs:** project brief and decision log as notes with `@generated` blocks, regenerated from records.
- **Notion bridge:** the confirmation batch (note, change, driving claim) is the review-queue row format. `@generated` regions map to Notion page bodies we overwrite; human input lives in comments or Notion-owned properties (0003).
- **Notion AI workflows:** none in repo; Notion is not mentioned anywhere (Verified: no "notion" matches in Markdown files).

## 5. Dependencies and Risks

- **Aggressive defaults:** "the vault rewrites itself", automatic synthesis pages, `/obsidian-save` writing without asking, PostCompact agent with `--dangerously-skip-permissions`. Only ingest has the confirmation gate.
- **Tasks in Markdown:** kanban boards duplicate what Notion owns; porting them would create a second task system.
- **Obsidian assumptions:** wikilinks everywhere, Bases, canvas, Obsidian plugin; `_CLAUDE.md` naming.
- **External services:** Google Calendar MCP; Perplexity, Groq and others for research; Telegram bot. None needed for v1.
- **No stable IDs:** notes identified by filename; merges use redirect notes.
- **Scale of surface:** 47 commands with collision rules ("longest trigger wins") show the cost of a broad command set. We should keep v1 to a handful.
- **Not run:** ~110 test files not executed.

## 6. Open Decisions

1. **Approval rule:** adopt "new notes are written directly, any change to an existing note is a proposal" as the default for decision 0003's open item? (Recommended. Exception to consider: a new decision record that *supersedes* an existing one counts as a change.)
2. **Fact timeline format:** for key facts inside a note (budget, owner, deadline), use a frontmatter `timeline:` array (this repo) or separate small key-fact records (one file per fact, Review 1/2 style)?
3. **Freshness lint:** enforce "timeless / dated / pointer" as a hard rule from v1 (lint fails), or as guidance only?

## 7. Recommended Next Step

Adopt the freshness policy, `@generated`/`@user` markers, the "new = free, change = proposal" gate, the nightly "flag, don't rewrite" rule, anti-fabrication rules, and the ingest pipeline order. Adapt the `timeline:` format, reconcile taxonomy, two-depth decisions and typed edges. Reject in-vault tasks, the permission-bypassing background agent and automatic synthesis/rewrite defaults. Keep the scheduled agents and adapter pattern as v2 references.

## Fit with v1 (docs/vision.md)

| Criterion | Contribution |
|---|---|
| 1. Meeting/source ingestion | Strong pipeline (classify, extract action items/claims/entities, raw + hash, gated rewrites). No transcript/minutes-specific routing (obsidian-mind is better there). |
| 2. Decision/key-fact records with history | **Strong.** `timeline:` with event and learned times, two-depth decisions, reconcile classes, conflict notes. |
| 3. Hybrid PARA + knowledge layer | Weak. Projects / People / Ideas / Knowledge folders, not PARA; tasks in vault. |
| 4. Derived outputs | **Strong.** `@generated`/`@user` markers are the missing mechanism; daily/weekly/recap examples. |
| 5. Agent retrieval from other repos | Medium. MCP server with freshness-aware search, per-project vault notes; adapters for many agents. |
| 6. Propose → approve → apply | **Strong (for ingest).** New notes free, existing-note changes batched for one confirmation, declined proposals recorded, retractions flagged. |
| 7. v2 flows | Scheduled morning/nightly/weekly/health agents, research toolkit, idea graduation, lessons → rules, mobile capture. |

**Stopping here. Awaiting approval before Review 5 (nashsu/llm_wiki).**
