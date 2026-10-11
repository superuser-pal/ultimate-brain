# Review 03 — breferrari/obsidian-mind

**Focus:** Memory lifecycle and context management
**Commit reviewed:** `d02e3ccfdff212544f77b67b48313d7b681ee28f` (2026-10-06)
**Date:** 2026-10-11
**Method:** Static reading of source and docs only. Nothing was executed (Node scripts, tests, MCP server). "Verified" means seen at the cited path.

## 1. Repository Overview

An Obsidian vault template for a software engineer's work life (projects, 1:1s, incidents, performance reviews). On top of the vault sit lifecycle hooks (TypeScript run directly by Node, zero runtime dependencies), optional semantic search via QMD, and the **`om` MCP server**, which lets agent sessions in *other repos* search the vault and record memories back. Its value for us is the most carefully designed **cross-repo memory** seen so far: memories declare which projects they reach, writes follow a strict contract on how much a memory may claim, corrections append and supersede rather than overwrite, plus a "correction sweep" that separates current truth from historical records. It also ships a meeting-intake command. Agent-agnostic by design (Claude Code, Codex, Gemini hook configs). The note taxonomy (brag docs, competencies) is specific to engineers and not reusable.

## 2. Relevant Components

| Area | Path | Verified behavior |
|---|---|---|
| Operating manual | `CLAUDE.md` (vault conventions), `AGENTS.md` (multi-agent notes) | Folder map, note types, linking rules, memory system, write-correctness laws, decision-record gate. |
| Architecture | `ARCHITECTURE.md` (1k lines) | Procedural code owns environment, agent owns content; graph-first; vault-first memory; progressive disclosure under a byte budget; agent-agnostic core. |
| Manifest | `vault-manifest.json` | Single coordination file: QMD index name, infrastructure vs user-content roots, required frontmatter per type, MCP exposure roots, memory root, context budget. |
| Hooks | `.claude/scripts/{session-start,classify-message,validate-write,pre-compact,stop-checklist}.ts`; configs in `.claude/settings.json`, `.codex/hooks.json`, `.gemini/settings.json` | SessionStart injects a bounded briefing (North Star, active work, git summary, tasks, file listing, hygiene flags) under `eager_layer_budget_bytes`, clamped below Claude Code's 10k-char hook cap. UserPromptSubmit tags messages (decision, incident, 1:1…) as routing *hints*. PostToolUse validates frontmatter and wikilinks. PreCompact backs up transcripts. Stop shows a hygiene checklist once per change. |
| Cross-repo MCP server | `.claude/scripts/om-mcp.mjs`, `lib/mcp-server.ts`, `lib/mcp-exposure.ts`, `lib/mcp-context.ts` | Tools `search`, `expand` (links + backlinks), `recall`, `remember`, `record_work`, `reason`, `health`; notes as `vault://note/<path>` resources; prompts `recall_topic`, `prior_art`. Filters results by exposure policy *after* search; `private`-tagged notes never served; every call audited to `.claude/om-mcp-audit.jsonl`. |
| Memory scope | `ARCHITECTURE.md` "Which memories reach which repo", `lib/memory-recall.ts` | Memory frontmatter `scope: general\|platform\|project`, `projects: []`, `platforms: []`, `origin` (derived from the calling repo, not caller-asserted). Visibility: general → listed project → platform overlap → default deny. Ranking: superseded below live, then project > platform > general, then date. Repo identity = folder name or `.om-project` file. |
| Memory write contract | `lib/memory-write.ts` L59–L464 | `confidence: verified\|inferred\|unverified` required. Unjustified `general` is downgraded to `project` when it names projects. Rule engine: `reject` (structurally wrong, nothing written) vs `flag` (claim is weak: written but confidence capped at `inferred`, marker added). Example flag: a body that generalises from one session ("always", "every time") is capped at `inferred`. Near-duplicate check suggests `supersedes`. Atomic exclusive create. Writes refused from inside the vault. |
| Supersession | `lib/memory-supersede.ts`, `lib/mcp-server.ts` L336–406 | `remember` is append-only; correction passes `supersedes: [title]`; old memory gets `superseded_by` in frontmatter, is kept, and is served after live ones marked `SUPERSEDED by …`. Relevance never reorders across the live/superseded boundary. |
| Promotion | `ARCHITECTURE.md` "Serving a promoted block" | A cross-repo capture can be promoted into a `brain/` topic note; with an anchor (`promoted: brain/Note#^id`), `recall` serves the corrected promoted block instead of the original capture. |
| Memory notes in vault | `brain/{Memories,Key Decisions,Patterns,Gotchas,Skills,North Star}.md` | Plain topic notes; `Memories.md` is an index. Claude's `~/.claude` memory must only point to vault notes. |
| Correction sweep | `.claude/commands/om-correct.md`, `.claude/agents/correction-sweep.md`, `lib/correction-sweep.ts` | Input: the corrected fact. Finds restatements by semantic + literal search. Classifies each hit **AUTHORITATIVE** (correction applied there only), **RESTATEMENT** (replaced with a link), **HISTORICAL** (never edited, reported). Historical = record folder (`archive/`, `1-1/`, `meetings/`, `journal/`…), dated filename, or status superseded/archived/completed. Never deletes, never commits. |
| Write-correctness laws | `CLAUDE.md` "Write-Correctness Laws" | 1) volatile status lives in one place, others link; 2) corrections swept everywhere; 3) mark inference; 4) date-stamp volatile facts ("as of YYYY-MM-DD"); 5) attribution vs creation dates may differ; 6) no counts in instruction files. |
| Decision-record gate | `CLAUDE.md` "Decision Records", `templates/Decision Record.md` | Record only if hard to reverse, surprising without context, or a real trade-off. Linked from work notes, logged in `work/Index.md`. |
| Meeting intake | `.claude/commands/om-intake.md` | Reads each file in `work/meetings/`; classifies meeting type; searches existing context; routes: decision → decision record + log, action item → checkbox in work note, new person → stub, blocker / open question → sections in project note, project update → append; cross-links; asks before deleting the inbox file; reports "items that needed a judgment call". |
| Meeting prep | `.claude/commands/om-meeting.md` | Topic briefing: current state, open items, likely decisions, considerations, people. |
| Other commands | `.claude/commands/om-{standup,weekly,wrap-up,dump,tidy,project-archive,vault-audit,...}.md` | Morning kickoff, weekly review, session wrap-up, unstructured dump routing, hygiene, archive moves via `git mv`. |
| Folder model | `CLAUDE.md` "Vault Structure" | `work/active/` (1–3 current projects) → `work/archive/YYYY/`; `org/people/`, `org/teams/`; `brain/`; `reference/`; `thinking/` (scratchpad, deleted after promotion); `memories/YYYY/MM/` (time is the only path axis, reach in frontmatter). |

### Answers to the brief's questions

1. **How is information retained?** Agent-written Markdown notes in purpose folders, `brain/` topic notes for operational knowledge, and `memories/YYYY/MM/` for memories written from other repos over MCP. Transcripts are backed up before compaction to `thinking/session-logs/`.
2. **How is relevant context selected?** Progressive disclosure: a byte-budgeted SessionStart briefing, then QMD search (keyword + vector), then full reads as a last resort. From other repos: `recall` filters memories by declared scope, ranks by specificity and supersession; `search` filters results by exposure policy.
3. **Active vs historical distinguished?** Yes, in three places: `work/active/` vs `work/archive/YYYY/`; superseded memories ranked below live ones and labelled; correction sweep treats record folders, dated notes and archived statuses as historical and never edits them.
4. **How are incorrect memories updated?** Append-only: write a new memory with `supersedes`; the old one gets `superseded_by` and stays. For vault notes, `/om-correct` applies the fix at the single authoritative note and replaces restatements with links.
5. **Can summaries be traced to sources?** Partially. Laws require memories to link to where they were learned and inference to be marked; `origin` and `session` are recorded on memories; `reason` answers are stored separately as `confidence: inferred` and never auto-saved as memories. There is no source ledger or evidence locator model like Review 1's.
6. **Which patterns work with Markdown alone?** All of the memory model (scope frontmatter, supersession, write contract, correction sweep, laws, intake routing) works on plain Markdown; the code enforces it. QMD semantic search, Obsidian Bases dashboards and the Obsidian CLI are optional.

## 3. Port / Adapt / Reject

| Component | Source file | Verified behavior | Decision | Reason |
|---|---|---|---|---|
| Memory scope (`general/platform/project` + `projects: []`) with default-deny recall | `lib/memory-recall.ts`, `ARCHITECTURE.md` | Writer declares reach; reader never widens it | **Port** | Directly solves our "global preferences vs per-repo knowledge" split: agents in client repo X get only memories for X plus general ones. |
| Memory write contract (confidence required, weak claims capped at `inferred`, unjustified `general` downgraded, near-duplicate → suggest supersede) | `lib/memory-write.ts` | Reject vs flag rules | **Port** | Concrete enforcement of the trust moat for agent-written memories (v2 memory loop). Fits our proposal flow: flagged items go to the review queue. |
| Append-only supersession, superseded served after live and labelled | `lib/memory-supersede.ts`, `lib/mcp-server.ts` | Old kept with `superseded_by`; never ranked above its correction | **Port** | Same principle as decision 0005 (assessment `superseded`). Confirms the design. |
| Correction sweep (AUTHORITATIVE / RESTATEMENT / HISTORICAL) | `.claude/commands/om-correct.md`, `lib/correction-sweep.ts` | Fix at single source; restatements become links; history never edited | **Port** | The best answer yet to "historical information must not silently appear as current truth" *and* "never rewrite history". Maps onto our Notion corrections: a correction becomes a review item that triggers a sweep. |
| Write-correctness laws 1–4 | `CLAUDE.md` | Single-source status; sweep corrections; mark inference; date-stamp volatile facts | **Port** | Short, tool-agnostic rules for our AGENTS.md. Law 1 is the same idea as our derived outputs: status lives once, everything else links or is regenerated. |
| Decision-record gate | `CLAUDE.md` | Hard to reverse / surprising / real trade-off | **Port** | Keeps meeting ingestion from creating a decision record for every remark. |
| Meeting intake routing table | `.claude/commands/om-intake.md` | Classify meeting; route decision, action item, person, blocker, question, update; ask before clearing inbox; report judgment calls | **Adapt** | Closest existing match to our v1 loop. Changes: source is the Notion meeting DB (not a folder); action items go to Notion tasks; decisions become records with assessment and history; changes to existing facts go to the review queue (decision 0003); "judgment calls" become review-queue rows. |
| Cross-repo MCP server surface (`search`, `expand`, `recall`, `remember`, `record_work`, `health`, resources, prompts) | `lib/mcp-server.ts` | See §2 | **Reference only (v2)** | Best template for our v2 MCP server. For v1 the same contract is exposed through a skill/CLI. |
| "Prohibitions propagate, routing instructions do not" + two-step install | `AGENTS.md`, `CLAUDE.md` "Reaching the Vault" | Measured: MCP wired but no repo-side instruction → zero vault calls | **Port** | Important for v1 success criterion: each consuming repo needs an explicit line in its own CLAUDE.md/AGENTS.md telling the agent to consult the brain, not just a global skill. |
| Byte-budgeted SessionStart briefing, degrade to pointers | `lib/session-start.ts`, `ARCHITECTURE.md` "Progressive disclosure" | Fixed budget, meter, lowest-value sections drop first | **Adapt** | Pattern for whatever context our skill injects; keep it small and measured. Hooks themselves are optional for us. |
| Results filtered by exposure policy after search; `private` tag never served; audit log of reads | `lib/mcp-exposure.ts` | Filter result, not query | **Reference only** | Useful for the v2 privacy tiers; we chose "everything flows" for v1. |
| Classify-message routing hints | `classify-message.ts` | Tags prompts as decision, incident, etc. | **Reference only** | Helpful nudge but Claude-hook-centric; our capture is explicit or end-of-session. |
| `reason` (spawns a second Claude session over the vault, answers stored as `inferred`, not auto-memorised) | `lib/mcp-reason.ts` | Separate, audited, cost-logged | **Reference only** | Good principle: AI conclusions are not memories until accepted. Spawning sessions is v2+. |
| `thinking/` scratchpad deleted after promotion | `CLAUDE.md` "Thinking Workflow" | Drafts are not storage | **Reference only** | Our `_proposals/` plays this role. |
| Manifest as single coordination file | `vault-manifest.json` | One config read by all layers | **Adapt** | A small `brain.json` (roots, schema, Notion DB IDs, budgets) avoids scattered config. |
| QMD semantic search | `.scripts/qmd-bootstrap.ts`, `qmd-mcp.mjs` | Local SQLite + embeddings | **Reject (v1)** | Vision defers embeddings. Their own fallback order allows grep. |
| Engineer-specific taxonomy (brag doc, competencies, review prep, incidents, Slack archaeology) | `perf/`, `.claude/agents/*`, `om-review-*` | Performance-review workflows | **Reject** | Not our domain; not PARA. |
| Obsidian CLI, Bases, mod | `CLAUDE.md`, `bases/`, `.claude/skills/obsidian-mind/` | Obsidian app integration | **Reject** | Obsidian not required. |

## 4. Architecture Integration

- **Agent instructions:** write-correctness laws, decision-record gate, "consult the brain" line required in each consuming repo.
- **Markdown schema:** memory frontmatter `scope`, `projects`, `platforms`, `confidence`, `origin`, `supersedes`/`superseded_by`; "as of" dates on volatile facts. Combine with decisions 0001 (IDs) and 0005 (lifecycle/assessment): `confidence` maps to our provenance markers and assessment.
- **Ingestion:** meeting intake routing table as the v1 meeting-ingest skeleton.
- **Maintenance:** correction sweep as the reconciliation step for corrections arriving from Notion.
- **Memory & retrieval:** scoped recall with default deny and specificity ranking; progressive disclosure; v2 MCP server surface.
- **Notion bridge:** none in repo. Natural mapping (Inferred): flagged memories and intake judgment calls → review-queue rows; correction from Notion → `/om-correct`-style sweep proposal.

## 5. Dependencies and Risks

- **Runtime:** Node with `--experimental-strip-types` (zero npm runtime deps). QMD (≥2.0.0) optional but assumed by many commands (`qmd query`).
- **Obsidian:** wikilinks by default ("Always prefer `[[wikilinks]]`"), Bases, Obsidian CLI. Conflicts with decision 0002 (Markdown links); the memory code resolves links by note title.
- **No stable IDs:** memories referenced by title (`supersedes: ["<exact title>"]`), notes by name. Conflicts with decision 0001.
- **Direct writes:** the agent edits notes directly; intake appends to existing project notes and deletes inbox files after confirmation. No staging. Our flow must route existing-fact changes through proposals.
- **Repo identity by folder name** can collide (`api` vs `api`); mitigated by `.om-project`.
- **Complexity:** much of the 50k lines is hook plumbing for Claude Code output limits; port the rules, not the plumbing.
- **Not run:** large test suite (`.claude/scripts/tests/`) not executed.

## 6. Open Decisions

1. **Agent memory store shape:** one folder for agent memories with scope frontmatter (`memories/YYYY/MM/`, time-only path), or memories as regular notes in the knowledge layer with a `scope` field?
2. **Scope axes:** is `general / project` enough for you, or do you also want a middle axis (e.g. `area` or `client`, the PARA equivalent of their `platform`)?
3. **Consuming-repo instruction:** accept that every repo where agents should use the brain gets a short block in its CLAUDE.md/AGENTS.md (installed by a setup command)?
4. **Meeting inbox clearing:** after ingesting a Notion meeting note, mark it processed in Notion (property) and leave it there? (Recommended: never delete; set `ingested: true` + link to the brain record.)

## 7. Recommended Next Step

Adopt the memory model wholesale as design: scoped memories with default-deny recall, the write contract (confidence required, weak claims capped), append-only supersession, the correction sweep with its authoritative / restatement / historical split, write-correctness laws, and the decision-record gate. Use `om-intake` as the skeleton for the v1 meeting-ingest skill, rerouted through Notion and the review queue. Keep the `om` MCP server as the blueprint for v2.

## Fit with v1 (docs/vision.md)

| Criterion | Contribution |
|---|---|
| 1. Meeting/source ingestion | **Strong.** `om-intake` routing table covers decisions, action items, people, blockers, questions, project updates, judgment calls. Needs Notion source and review-queue routing. |
| 2. Decision/key-fact records with history | **Strong.** Decision-record gate, single-source status law, append-only supersession, correction sweep preserving history. |
| 3. Hybrid PARA + knowledge layer | Medium. `work/active` → `archive/YYYY` lifecycle plus `org/people`, `brain/`; graph-first rule. Taxonomy itself is engineer-specific. |
| 4. Derived outputs | Medium. Law 1 (status lives once, others link) is the principle; `om-meeting` briefing and `om-weekly` are generated outputs, not stored views. |
| 5. Agent retrieval from other repos | **Strongest so far.** Scoped recall, MCP surface, measured finding that each consuming repo needs its own instruction. |
| 6. Propose → approve → apply | Weak. Direct writes; only the memory write contract's "flag" path resembles a review step. |
| 7. v2 flows | Memory loop (scope + contract + supersession), weekly review, meeting prep, MCP server, privacy exposure policy. |

**Stopping here. Awaiting approval before Review 4 (eugeniughelbur/obsidian-second-brain).**
