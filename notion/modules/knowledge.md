# Knowledge

What the brain learns: decisions, open questions and risks, and concepts, each linked to the meetings and inputs it came from (decisions 0005, 0034, 0037, 0048; docs/notion-space-design.md §3.8, §3.9, §3.13). On by default.

## Turning it on

### 1 · The databases

**Notion AI**, on **Brain Data** (the API can't create databases):
> In this page, create three full-page databases. "Decisions": Name (title), Summary (text), Date (date), Assessment (select: Accepted, Provisional, Contested, Superseded), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date). "Questions": Name (title), Summary (text), Kind (select: Question, Risk), Status (select: Open, Answered, Dropped), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time). "Concepts": Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Brain ID (text), Last Synced (date), Created time (created time). Don't change anything else.

### 2 · Relations and descriptions

| Change | Who |
|---|---|
| Two-way relations, as in [Prompt 3](../prompts/03-relations.md)'s `[Knowledge]` lines: Projects "Decisions" ↔ Decisions "Project"; Projects "Questions" ↔ Questions "Project"; Meetings "Decisions" ↔ Decisions "Decided In"; Meetings "Questions" ↔ Questions "Raised In"; Decisions "Supersedes" ↔ Decisions "Superseded By"; Decisions "Area" ↔ Areas "Decisions"; Questions "Area" ↔ Areas "Questions"; Concepts "Project" ↔ Projects "Concepts"; Concepts "Area" ↔ Areas "Concepts"; Inbox "Decisions" ↔ Decisions "Sources"; Inbox "Questions" ↔ Questions "Sources"; Inbox "Concepts" ↔ Concepts "Sources" | agent |
| With Documents on: Promote asked (checkbox) on Decisions and Concepts, and Documents "From decision" ↔ Decisions "Documents", Documents "From concept" ↔ Concepts "Documents"; then the Promote to document buttons of [documents.md](documents.md) step 4 | agent, then by hand |
| Descriptions per [Prompt 5](../prompts/05-ownership.md): Questions Status "Owner: you. The brain sets Open when it creates a question, and Answered once after you approve an Answer row in Review."; Lifecycle "Owner: you."; Brain ID, Last Synced, Created time "Owner: system. Do not edit."; the rest "Owner: brain." | agent |
| Record the ids: `brain config set notion.databases.decisions '"<id>"'`, and the same for `questions` and `concepts` | agent |

### 3 · Views

**Notion AI**, with "Add only these. Don't change anything else." each time:
1. On **Knowledge**: the `[Knowledge]` tabs of [Prompt 7f](../prompts/07f-knowledge.md) (Decisions, Questions, Concepts, first), and its "also show Decisions and Concepts" line for "What came in?".
2. On each template: the `[Knowledge]` lines of [Prompt 6](../prompts/06-templates.md) for Areas, Projects and Meetings.
3. On **Meetings**: the `[Knowledge]` line of [Prompt 7d](../prompts/07d-meetings.md); on **Archive**: the `[Knowledge]` tabs of [Prompt 7h](../prompts/07h-archive.md).

**By hand:** page layouts of Decisions and Concepts ([views-guide.md](../views-guide.md) §9).

### Verify
- [ ] `brain modules` shows `knowledge` on with nothing missing.
- [ ] Knowledge has Decisions, Questions and Concepts tabs; a new project shows "What do we know?".
- [ ] After the next ingest, new decisions appear as Draft and link their meeting.

## Turning it off

The brain stops publishing decisions, questions and concepts to Notion, and the ingest's Review rows no longer link them; it still extracts them into Git, so the brain's answers keep using them. You may hide: the Decisions, Questions and Concepts tabs of Knowledge and Archive, "What have we decided here?", "What's still open here?" and "What do we know?" on area and project pages, and the Decisions and Questions toggles on meeting pages.
