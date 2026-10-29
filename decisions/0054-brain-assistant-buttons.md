# 0054 — Buttons that run Brain Assistant in Notion: Tidy capture, Write up, Refresh report

**Status:** Accepted
**Date:** 2026-10-29
**Amends:** 0035 (what Brain Assistant may edit), 0049 (a promoted Document's body comes back to Git), 0043 and 0045 (how a report is refreshed) · **Refines:** 0048 and 0053 (buttons), 0051 (what an unattended run imports) · **Keeps:** 0003, 0015, 0052

## Context
Notion now lets a button send a message to an agent. The user confirmed that a button can target **Brain Assistant**, our Notion Custom Agent (0035); Notion's button, database-button and automation help pages didn't yet describe the "send message to agent" action when this was researched (Evidence). The user grilled the idea with Codex on 2026-10-29 and accepted the scope below ("yes, log this"), for release 0.7.1. It builds on an open thread from the same day: a promoted Document is only a seed, and what the user writes in it never comes back to Git.

What it is **not**: a button doesn't wake Claude Code, Codex or the local `brain` CLI, and doesn't replace the 0.7.0 schedules (0051). Brain Assistant works inside Notion right away; Claude Code or Codex reads the accepted result later, during a catch-up, through the official Notion MCP (0015). Markdown and Git stay canonical.

## Decision
### Three buttons that run Brain Assistant at once
| Button | Where | What Brain Assistant does |
|---|---|---|
| **Tidy capture** | Inbox rows | Rewrites the capture's **body** only; Name and every property stay as they are. The row stays **New** while it works; the user sets Ready afterwards. It never sets Ready itself |
| **Write up** | Documents, on a **promoted** Document only | Develops the body from the Document and the brain pages it links in Notion (format below). Body only: never the original Decision or Concept, never a property, never a Review row |
| **Refresh report** | Report rows (the existing button) | Searches the relevant brain pages in Notion, beyond the report's current links, and **appends** a dated, cited section "Proposed refresh · based on Notion". The current report stays intact |
- **No external research** in any of them unless the user asks for it explicitly.
- **Check minutes gets no button:** it adds too little over the existing skill, which keeps its rule (only before a meeting is Reviewed).
- **Keep as document and Promote to document stay queued** as today: no Notion AI step. Promote creates the canonical Document at the next catch-up, and only then can Write up be used on it.

### The Write up format
- **Purpose → Main content → Open questions → Sources**, in readable native Notion blocks: a short purpose callout, headings, concise prose and lists, linked citations, toggles for supporting detail, open questions visible.
- **The first Write up develops the seeded text.** A **repeat** Write up keeps the user's wording and appends a clearly marked **proposed revision**, which the user adopts or discards.

### Accepting the wording
- **The user accepts the finished wording explicitly** (Accept write-up; for a report, accepting the proposed refresh).
- **An unresolved proposed revision blocks acceptance.** A later edit of the body **invalidates** the acceptance; it must be accepted again.
- **A repeat Refresh report replaces only the pending proposal** (unlike Write up, which keeps the user's wording and appends). The user accepts the replacement under the same rule.
- **The contracts (0.7.1) define the mechanism:** how acceptance is recorded against the exact accepted text, how a stale or conflicting body is detected, and how the Notion blocks become Markdown. Nothing here claims that mechanism exists today.

### Catch-up imports only accepted wording (amends 0049, 0043, 0045)
- **Write up:** the accepted wording goes **exactly** into the existing Git Document. The catch-up then looks for other useful canonical knowledge and **proposes** a separate **Related knowledge** appendix, each item cited with the reason it helps. Only the user's approval appends it, and the accepted wording is kept as it is. A change to any other existing note is a separate proposal (0003).
- **Refresh report:** the accepted replacement goes in exactly; useful additions only Git knows are proposed separately. **Reports stay derived outputs,** never evidence for new knowledge.
- **Publishing keeps what is pending in Notion:** a publish never overwrites a pending draft, a proposed revision or a proposed refresh. A Refresh report click never sets off the old queued full refresh, which would overwrite pending or accepted wording.
- **Unattended (refines 0051):** an unattended run imports only wording the user accepted exactly and explicitly, and still current; it never interprets an unresolved draft, revision or instruction.

### What Brain Assistant may edit (amends 0035)
0035's exceptions (Check minutes, Tidy capture, Clean email) gain: **Write up** on the body of a promoted Document, and **Refresh report** appending its proposed section to a Report row's body. Still never: a property, a Review row, a Decision's or Concept's page, or a brain-written section of any other page.

### Cost
**The vision's "Notion agents rejected on cost" becomes optional, bounded and measured use:** the user already has Notion AI; deliberate button clicks only, not event-driven automation; the 0.7.1 acceptance run measures real usage.

## Consequences
- **Notion:** three button changes and Brain Assistant skills (Write up, the Tidy capture and Refresh report behaviour), page layouts, and a migration (0012), with the user guide. **The brain:** `sync plan` reads accepted wording; a publish keeps pending drafts; catch-up imports and proposes appendices.
- **Unchanged:** 0.7.0 (CC-62 to CC-64) and 0.8.0 (CC-65 to CC-67, decision 0052). A bridge from Notion to a local or Hermes run, event-driven triggers and replacing the schedules stay in docs/v2-ideas.md.
- **Built in 0.7.1:** CC-70 to CC-73, then U-22.

## Evidence
- **User-confirmed (2026-10-29):** a Notion button can send a message to Brain Assistant. Not verified in official docs.
- **Official, verified at research time:** Custom Agents https://www.notion.com/help/custom-agents · MCP connections for Custom Agents https://www.notion.com/help/mcp-connections-for-custom-agents · webhook actions https://www.notion.com/help/webhook-actions · AI credits https://www.notion.com/help/manage-your-ai-credits and https://www.notion.com/help/how-ai-credits-work-for-custom-agents · pricing update https://www.notion.com/blog/notion-ai-more-for-less (19 Oct: typically 1,500 credits on Standard, 500 on Select; existing workspaces from 2 Nov; Custom Agents on Select; actual cost varies).
- **Not established:** that the "send message to agent" action runs in the background, on a property change or on a schedule. The scope is deliberate buttons only.
- Decisions 0035, 0043, 0045, 0048, 0049, 0051, 0053.
