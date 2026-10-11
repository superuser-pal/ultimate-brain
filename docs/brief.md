# Second Brain Architecture — Repository Review Brief

**Status:** Research and architecture design  
**Primary agent:** Claude Code / Codex  
**Approach:** Review one repository at a time; decide what to port before implementation.

---

## 1. Project Goal

Build a Markdown-first knowledge and memory system operated by coding agents, with Notion as the primary human-facing interface.

This is not an attempt to reproduce Obsidian or adopt an existing second-brain application wholesale.

The objective is to identify useful, reusable mechanisms from selected open-source projects and combine them into a coherent architecture.

### Core Architecture

| Layer | Responsibility | Technology |
|---|---|---|
| Knowledge | Canonical facts, decisions, relationships, sources, history | Markdown + Git |
| Intelligence | Ingestion, linking, synthesis, retrieval, maintenance | Claude Code / Codex |
| Human interface | Navigation, review, approvals, corrections, actions | Notion + Notion AI |
| Long-term memory | Historical retrieval and context support | Optional separate provider |

### Foundational Decisions

- Markdown is the canonical source of truth for knowledge.
- Git provides version history and change tracking.
- Notion is the primary human interface.
- Notion should not become an uncontrolled duplicate knowledge base.
- Agents perform knowledge maintenance and propose changes.
- Human corrections and approvals must be traceable.
- Obsidian is optional, not a required dependency.
- A separate long-term memory provider may be introduced later.

### Central Design Challenge

The Markdown–Notion bridge must determine:

1. What knowledge should be published to Notion.
2. How Markdown content maps to Notion pages and databases.
3. How published content is refreshed.
4. How human feedback returns to canonical Markdown.
5. How conflicts and concurrent edits are resolved.

Do not implement unrestricted bidirectional synchronization.

---

## 2. Research Scope

Review these five repositories:

1. https://github.com/AgriciDaniel/claude-obsidian
2. https://github.com/Ar9av/obsidian-wiki
3. https://github.com/breferrari/obsidian-mind
4. https://github.com/eugeniughelbur/obsidian-second-brain
5. https://github.com/nashsu/llm_wiki

### Explicitly Excluded

- SamurAIGPT/llm-wiki-agent

The repositories are sources of potential implementation patterns, not competing products to rank.

Do not assume a feature exists based on a project's name or description. Verify it in source code or documentation.

---

## 3. What to Analyze Across Repositories

### A. Agent Skills and Operating Rules

Investigate how agents:

- Discover relevant existing knowledge.
- Create and update Markdown files.
- Avoid duplicates and destructive overwrites.
- Connect related notes.
- Distinguish facts, assumptions, and decisions.
- Preserve provenance and context.
- Operate consistently across sessions.

**Target deliverable:** Reusable agent skills, instructions, commands, and safeguards.

### B. Knowledge Structure

Investigate:

- Directory organization.
- Markdown schemas and frontmatter.
- Stable identifiers.
- Links, backlinks, and relationships.
- Source references and provenance.
- Decision history and supersession.
- Metadata needed for synchronization.

**Target deliverable:** A minimal, agent-friendly Markdown knowledge model.

### C. Knowledge Maintenance

Verify whether implementations support:

- Contradiction detection.
- Outdated-information detection.
- Duplicate detection and merging.
- Corrections and reconciliation.
- Superseded decisions.
- Incremental updates.
- Preservation of historical information.

**Target deliverable:** Maintenance workflows that distinguish current truth from history.

### D. Memory and Context

Investigate:

- Relevant-context retrieval.
- Context selection and summarization.
- Active versus historical memory.
- Archiving and retrieval.
- Traceability from summaries to sources.
- External database dependencies.

**Target deliverable:** Memory and context-management patterns compatible with local Markdown.

### E. Notion Integration Potential

Evaluate how each reusable component could support:

1. Publishing curated Markdown knowledge to Notion.
2. Presenting decisions and proposed corrections for review.
3. Capturing approvals and human feedback.
4. Reconciling approved changes into Markdown.
5. Updating Notion without overwriting unrelated user input.

**Target deliverable:** What can be ported, adapted, or must be built separately.

---

## 4. Repository-by-Repository Review

### Review 1 — AgriciDaniel/claude-obsidian

**Focus:** Agent operating rules and reusable skills.

Repository:
https://github.com/AgriciDaniel/claude-obsidian

Investigate:

- Agent instruction files and skills.
- Commands and workflows for reading and modifying notes.
- Knowledge discovery and navigation.
- Rules for safe Markdown editing.
- Duplicate prevention and source preservation.
- Obsidian-specific dependencies.
- Portability to Claude Code and Codex.

Questions:

1. How does the agent find relevant knowledge?
2. How is it instructed to create or modify notes?
3. What safeguards exist?
4. Which instructions are reusable without Obsidian?
5. Which behaviors should become Claude Code skills?
6. Could any workflow be exposed through Notion?

**Desired decision:** Which agent behaviors and skills to port or adapt.

---

### Review 2 — Ar9av/obsidian-wiki

**Focus:** Knowledge structure, linking, and navigation.

Repository:
https://github.com/Ar9av/obsidian-wiki

Investigate:

- Note organization.
- Entity and topic representation.
- Markdown metadata conventions.
- Links and backlinks.
- Wiki navigation.
- Knowledge reorganization.
- Automated versus manual maintenance.

Questions:

1. How are knowledge entities represented?
2. How are relationships established and maintained?
3. What metadata supports stable references?
4. How does reorganization affect links?
5. What depends on Obsidian?
6. How would the structure translate to Notion?

**Desired decision:** Which knowledge-modeling conventions to adopt.

---

### Review 3 — breferrari/obsidian-mind

**Focus:** Memory lifecycle and context management.

Repository:
https://github.com/breferrari/obsidian-mind

Investigate:

- Information capture.
- Memory organization.
- Retrieval and context assembly.
- Active versus historical information.
- Memory updating and invalidation.
- Source traceability.
- Infrastructure requirements.

Questions:

1. How is information retained?
2. How is relevant context selected?
3. Are active and historical memories distinguished?
4. How are incorrect memories updated?
5. Can summaries be traced to sources?
6. Which patterns work with Markdown alone?

**Desired decision:** Which memory and retrieval patterns to adapt.

---

### Review 4 — eugeniughelbur/obsidian-second-brain

**Focus:** End-to-end knowledge workflows.

Repository:
https://github.com/eugeniughelbur/obsidian-second-brain

Investigate:

- Capture and ingestion workflows.
- Processing stages.
- Knowledge creation and updating.
- Reusable commands, prompts, or skills.
- Task and decision handling.
- Automation triggers.
- Maintenance routines.

Questions:

1. What triggers processing?
2. Which stages are automated?
3. What does each stage produce?
4. Which workflows are portable?
5. How are tasks distinguished from reference knowledge?
6. Which stages would benefit from Notion review?

**Desired decision:** Which end-to-end workflows to adapt.

---

### Review 5 — nashsu/llm_wiki

**Focus:** Automated wiki synthesis and maintenance.

Repository:
https://github.com/nashsu/llm_wiki

Investigate:

- LLM-assisted page generation.
- Incorporation of existing knowledge.
- Incremental page updates.
- Cross-references and linking.
- Contradiction handling, if implemented.
- Structured outputs and content transformations.

Questions:

1. How are new wiki pages generated?
2. How is existing content incorporated?
3. Are updates incremental or full rewrites?
4. How are relationships maintained?
5. Is contradiction handling actually implemented?
6. Can outputs support selective Notion publication?

**Desired decision:** Which wiki-generation and maintenance mechanisms to adopt.

---

## 5. Required Output for Each Repository

Produce a concise implementation review containing:

### 1. Repository Overview

Maximum 150 words.

Explain what the repository actually implements and why it may be relevant.

### 2. Relevant Components

Identify exact:

- Files and paths.
- Modules.
- Skills and prompts.
- Commands.
- Data structures.
- Workflows.

Describe verified behavior.

### 3. Port / Adapt / Reject

For each candidate component, provide:

| Component | Source file | Verified behavior | Decision | Reason |
|---|---|---|---|---|
| Example | Exact path | What it does | Port / Adapt / Reference / Reject | Why |

### 4. Architecture Integration

Explain whether each accepted component belongs in:

- Claude Code skills or agent instructions.
- Markdown schema and conventions.
- Ingestion or maintenance workflows.
- Memory and retrieval.
- Notion bridge.
- Notion AI workflows.

### 5. Dependencies and Risks

Identify:

- Obsidian-specific assumptions.
- External services or databases.
- Complex infrastructure.
- Potential data loss or unsafe updates.
- Conflicts with canonical Markdown.

### 6. Open Decisions

List only decisions requiring human input.

### 7. Recommended Next Step

Propose what should be adopted.

**Stop before implementation.**

---

## 6. Architecture Constraints

### Canonical Knowledge

- Knowledge is stored in Markdown.
- Git tracks changes.
- Notes should have stable identifiers.
- Changes should preserve provenance where practical.
- Historical and superseded information must not silently appear as current truth.

### Agent Behavior

- Inspect existing knowledge before creating new notes.
- Prefer incremental, reviewable changes.
- Avoid destructive bulk rewrites.
- Identify contradictions rather than silently resolving uncertain claims.
- Distinguish verified facts from inferences.
- Make consequential changes auditable.

### Notion

- Notion is the human-facing workspace.
- Publish selected knowledge, not necessarily the entire repository.
- Track relationships between Markdown IDs and Notion IDs.
- Preserve the distinction between canonical content and user feedback.
- Reconcile corrections through an explicit workflow.
- Do not assume Notion AI can directly execute local agent skills.

### Infrastructure

- Prefer simple, composable tools.
- Avoid introducing a required vector database prematurely.
- Avoid duplicating capabilities already provided by Notion.
- Keep the system usable without Obsidian.
- Treat long-term memory infrastructure as an optional future decision.

---

## 7. Proposed Architecture

```text
                  Claude Code / Codex
                 Read · Reason · Maintain
                           |
                           v
                     Markdown + Git
                  CANONICAL KNOWLEDGE
                 Sources · Facts · Decisions
                    Links · History
                           |
                           v
                       Notion Bridge
                Publish · Map · Reconcile
                           |
                           v
                     Notion + Notion AI
                  HUMAN-FACING WORKSPACE
                 Review · Approve · Correct
                    Navigate · Act