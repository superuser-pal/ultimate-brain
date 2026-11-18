# 0101 — Where Notion AI and the brain each write, and the path without Notion AI

**Status:** Accepted
**Date:** 2026-11-16
**Release:** 0.16.0 (§4 to §6, and §7's labels); 1.0.0 (§3, §8)
**Amended by:** [0104](0104-product-design-principles.md) (2026-11-17): Claude Code or Codex is the preferred brain-management path, with Notion AI an optional convenience within its existing scope; the releases and write boundaries below stay unchanged
**Amended by:** [0106](0106-beta-on-0-16-x-patches-0-17-0-and-0-18-0-before-1-0-and-the-launch-bar.md) (2026-11-18): §9's 1.0.0 part (§3 and §8) ships in 0.17.0; read "1.0" in §8 as 0.17.0
**Amends:** [0023](0023-notion-edits-as-user-corrections.md) and [0027](0027-what-notion-corrections-can-change.md) (an edit to a brain-owned value in Notion is asked in the session, not applied by sync; §4); [0099](0099-notion-without-decisions-and-questions.md) §6 (a tracked question whose task is Done, or gone, is asked about; §6); [0035](0035-notion-ai-prompts-read-only.md) and [0054](0054-brain-assistant-buttons.md) (Brain Assistant may set your operational fields after your yes, from 1.0.0; §3); [0007](0007-notion-meeting-notes-not-deleted.md) (the brain may write the minutes on a meeting page that has a transcript and none, from 1.0.0; §8); [0078](0078-onboarding-and-early-access-in-0-14-0.md) §6 (what "Notion AI optional at 1.0" means; §8); [0061](0061-roadmap-and-launch-boundary.md) (1.0.0 holds the minutes the agent writes, by explicit roadmap change); [0096](0096-one-place-to-decide.md) §4 (one exception, from 1.0.0: a scheduled run may write the minutes for a transcript that has none, which takes nothing in; §8.3)
**Keeps:** Markdown and Git as canonical, Notion as the human interface, no unrestricted two-way sync; [0021](0021-notion-first-creation.md) (what you create in Notion comes in as a new note); [0096](0096-one-place-to-decide.md) (you decide in the session, and work done without you only queues questions, except §8.3's minutes); [0012](0012-meeting-minutes-reviewed-before-ingest.md) (nothing from a meeting is read before you mark it Reviewed) and 0055's selection; [0018](0018-notion-tasks-mapping.md) (the brain never models task workflow; task status is a pointer); [0058](0058-acceptance-is-current-as-of-the-click-minute.md) (a Document's accepted wording); Brain Assistant as a Notion Custom Agent with buttons; 0.15.0 as the feature cutoff

## Context

On 2026-11-16 the author mapped what the brain system (Claude Code or Codex with the `brain` CLI and its skills) does and what Notion AI does, because Notion is becoming the place where work is done, users will talk to Notion AI as much as to Claude, and two writers on one workspace can drift. Today the brain system writes Git and publishes to Notion; Brain Assistant (a Notion Custom Agent, 0035, 0054) reads, cleans an input's text before it goes in, and drafts text you accept. Claude already sets Notion fields after your yes (the assistant, 0072); Brain Assistant sets none.

The map found six ways the two could fall out of step, ranked:
1. **An AI's edit taken as yours.** Sync applies any change to a brain-owned value in Notion as your correction (0023). It can't tell your edit from one by Notion AI, a Custom Agent, ChatGPT through Notion's MCP or an automation. Only Brain Assistant's scoped access guards against it.
2. **The same task twice.** If Notion AI or a notetaker creates Tasks from a meeting and the meeting is then ingested, the ingest creates them again; `sync tasks` deduplicates only quick follow-ups (spec/cli.md §5.14.5).
3. **A task and its question disagree** (0099): the task Done in Notion, the question still open in Git and in the Brief; or the task trashed and the link dangling.
4. **Notion lags Git,** so Notion AI and Claude can answer the same question differently between publishes.
5. **One fact in two fields,** such as a project's Dates and the deadline among its Key Facts.
6. **Knowledge settled in a Notion AI chat** never reaches the brain.

The author then raised users who get the brain system without a paid Notion plan. Notion's help pages, read on 2026-11-16: Notion AI (Notion Agent, AI meeting notes) is included in Business and Enterprise; Custom Agents run on Notion credits, an add-on to Business and Enterprise ($10 per 1,000 credits; Notion's examples run about 45 to 90 times per 1,000); Free and Plus get at most a trial of Notion AI and can't buy credits. Without them a user loses the minutes and Brain Assistant. 0078 §6 planned Notion AI as optional at 1.0 with a weaker path (a pasted transcript ingested whole, with no selection), and the agent writing minutes was a post-1.0 idea.

The author answered Q1 to Q9, each the recommended option; Q6 and Q9 in the author's words, as recorded in §8 and §7.

## Decision

### 1. Git holds what you know, Notion is where you act on it
Each AI writes only on its own side. The brain system writes what the brain believes: notes, facts, decisions, the Briefs and Decision logs it publishes, and the Tasks it creates from knowledge. Notion AI, a Custom Agent or any other AI in Notion writes only what the brain points to and never copies: a task's status, due date or priority, a project's status, a key result's value. It also cleans an input's text before you hand it to the brain, and drafts text that you accept.

### 2. Everything crosses through a door you open
- **Into the brain:** a meeting marked Reviewed or an Inbox row set Ready; an area, goal, project, person or org created in Notion (0021); an edit to a brain-owned value, asked in the session (§4); wording you accepted (0054, 0058). Your operational fields are read as pointers each time, never stored.
- **Into Notion:** the publish; Tasks created once, by the ingest, "track it" or the assistant after your yes; Inbox rows (catch-up, weekly review, reports); the assistant's changes after your yes.

### 3. Brain Assistant may set your operational fields after your yes (1.0.0; Q1)
In the Notion chat, after you say yes to the change it names with its value, Brain Assistant may set the operational fields of Tasks, Projects, Areas, Goals and Key Results: status, priority, dates and due dates, progress values. Never: a brain-owned property or a section the brain writes; Brain Status, an Accept, a request flag (Document asked, Refresh asked) or another of your instructions to the brain; a Task created from minutes (§5). Its Weekly review then sets what you agreed on a task instead of only listing it. Notion becomes the place where you act, and nothing it sets is knowledge.

### 4. Your Notion edits to brain-owned values are asked in the session (0.16.0; Q2)
Sync still finds the edit by the three-way comparison of spec/cli.md §5.14, but no longer applies it. Each edit waits in `_proposals/` as a correction from Notion, and the next attended session asks them all as one question, listed: "3 corrections from Notion: accept all, all except …, or reject." An accepted correction is applied as 0027 says (a key fact with its `timeline` entry and `source: notion-edit`; text and references replaced). A rejected one is put back in Notion by the next publish. A run without you queues them (0096 §4). Judgments already go through proposals (0027), operational fields stay yours, and what you create in Notion still comes in as a new note (0021).

Why: the brain can't tell your edit from an AI's, so it asks instead of guessing. This closes risk 1 for every AI at once, including ChatGPT (§8), and it is 0096's one place to decide applied to the last door that still decided without you.

### 5. Only the ingest creates a meeting's Tasks (0.16.0; Q3)
The minutes prompt (notion/minutes-format.md), Check minutes and Brain Assistant's Instructions say never to create Tasks from a meeting: the ingest does, once. An outside tool delivers the transcript or the minutes, never Tasks (§8); setup says to turn off a notetaker's own task export to the same Tasks database. A Task you create yourself is yours, and the brain still doesn't deduplicate it.

### 6. A tracked question's task Done, or gone, is asked about (0.16.0; Q4)
When sync reads that the task tracking an open question (0099 §3) is Done, or no longer exists, the next attended session asks once: "Task X is Done. Is the question answered? (a) yes: … (b) drop it (c) keep it open." (a) records the answer, your yes being the one 0096 §3 asks for; (b) drops the question; (c) keeps it open, and it isn't asked again while the task stays as it is. A run without you queues the question. This replaces 0099 §6's "a task you mark Done in Notion leaves the question open".

### 7. Three kinds of Notion, and the buttons need Business with credits (Q9)
| Your Notion | Meetings | Brain Assistant and its buttons |
|---|---|---|
| Business or Enterprise, with Notion credits | Notion AI meeting notes and the minutes prompt, or any tool (§8) | yes |
| Business or Enterprise, without credits | as above | no: Custom Agents run on credits |
| Free or Plus | any tool (§8) | no |

Brain Assistant stays a Custom Agent, and its buttons stay: they message the agent. **In 0.16.0** the template and docs/setup.md say that Brain Assistant and its buttons need Business with Notion credits. **From 1.0.0,** a user without them asks their agent for the same skill instead (§8). Changing Brain Assistant's Instructions or skills for this decision is allowed. Prices and plan rules are checked again against Notion's help pages whenever setup text states them.

### 8. The path without Notion AI (1.0.0; Q5 to Q8)
1. **One meetings contract.** A Meetings row holds a transcript, or minutes in the format (notion/minutes-format.md), or both, from any tool: Notion AI meeting notes; a notetaker (Granola, Fireflies or another) through its own Notion integration or an automation (Zapier, n8n); or pasted by you. A transcript file in the drop folder becomes such a row. The ingest doesn't care which tool wrote it (Q7).
2. **Minutes in the format, from any tool,** are taken as they are, and selection works as today: you can run the minutes prompt in another tool and paste the result (Q6).
3. **A transcript with no minutes:** the brain agent writes the minutes on the page in the format, from the same prompt text, and you review them and mark the meeting Reviewed (Q6). Nothing is read for the brain before Reviewed (0012). **Amends 0007:** the brain may write the minutes on a meeting page that has a transcript and no minutes, once, and nothing else on the page. The minutes pass 0079 §6's bar (at least 9 of 10 items carry an id and quotes that occur in the transcript, every follow-up a `q` id), and the CLI checks the quotes before they are written. **The record's reading, not asked:** an attended session offers to write them, and a scheduled run writes them too, because writing minutes takes nothing in; the author can change this on the PR. A summary from another tool that isn't in the format is still ingested whole, as 0078 §6 says.
4. **Brain Assistant's skills run in Claude Code or Codex** through the Notion MCP, from one copy of each skill's text (Q5): "prep my 3pm", "tidy that capture", "what's due today".
5. **ChatGPT is documented as optional** (Q5): the same skills through Notion's MCP. Its guide is written only after OpenAI's and Notion's current documents are checked. §4 makes its edits safe.
6. **Setup asks two questions:** do you have Business with Notion credits, and where do your transcripts come from (Notion AI meeting notes, another tool, pasting or files). The answers decide whether Brain Assistant and the minutes prompt are installed; nothing else is configured.

It ships in **1.0.0, by explicit roadmap change** (Q8): it is the launch-readiness step that makes Notion AI optional (0078 §6), and without it a user without Notion AI starts 1.0 with no selection. The early-access testers have Notion AI (0078 §6), so nothing of §8 is needed before 1.0.

### 9. Release
- **0.16.0:** §4, §5, §6 and §7's labels, in the same contracts, CLI, skills release, Notion migration and template as 0096 and 0099. They decide in the session what was decided elsewhere, and add no feature: 0.15.0 stays the feature cutoff. Inviting testers (U-28) still waits for 0.16.0 only.
- **1.0.0:** §3 and §8.

## Consequences
- **0.16.0:** CC-323 (the contracts: corrections from Notion, the tracked task Done or gone, Tasks only from the ingest) beside CC-307 and CC-313, then CC-324 (the CLI) after CC-323 and CC-296; CC-298, CC-299, U-33 and U-34 grow. CC-298 waits for CC-324 too, and CC-299 does as well.
- **1.0.0:** CC-325 (Brain Assistant sets your fields after your yes), CC-326 (the contracts without Notion AI), CC-327 (the CLI), CC-328 (the skills), CC-329 (Notion, setup and the guides) and U-36 (a brain on a workspace without Notion AI).
- docs/v2-ideas.md's "Minutes from a pasted transcript, without Notion AI" moves into 1.0.0.
- Risks 4 and 5 (Notion lags Git, one fact in two fields) are named here and get no change; risk 6 is covered by the Inbox capture you already make from anywhere.

## Evidence
The author's mapping session of 2026-11-16 (CC-322): the map and its ranked risks; Q1 a, Q2 b, Q3 a, Q4 a; Q5 a, Q6 in the author's words ("any other tool like Granola or Fireflies; accept the user pasting the transcript or the meetings in the format requested") and the author's yes to the reading in §8.2 and §8.3, Q7 a, Q8 a; Q9 in the author's words (keep buttons that message the agent, available only with a Business account; changes to Brain Assistant are fine). Notion's help pages on Custom Agent pricing and Notion credits (https://www.notion.com/help/buy-and-track-notion-credits-for-custom-agents, https://www.notion.com/help/what-are-notion-credits), read 2026-11-16. Today's shape: spec/cli.md §5.14 (sync, corrections, `sync tasks`), spec/capture-and-review.md §3.4 and §6, notion/brain-assistant.md, notion/minutes-format.md, decisions 0023, 0027, 0035, 0054, 0078, 0096, 0099.
