# 0005 · Inbox, Concepts, the Review Note, Area on Decisions and Questions

**Design change:** CC-22 (decisions 0037 and 0034; docs/notion-space-design.md §3.1, §3.4, §3.6, §3.8–§3.13, §4, §5). **Applies to:** spaces built before release 0.3.0.

This is the one Notion change of 0.3.0. Run it in one session, right after installing 0.3.0 and running `brain upgrade` in your brain, and before the next `brain sync`. The brain's 0.3.0 skills expect the new names, and 0.2.x expects the old ones, so don't run either version's sync halfway through.

The steps marked **agent** can be done through the API by the `brain-notion-change` skill, each with your yes. The steps marked **by hand** need the Notion UI, because the API can't change them.

## 1 · Inbox (was Capture Inbox)

| Change | Who |
|---|---|
| Rename the database **Capture Inbox** → **Inbox**. Its id doesn't change, so `brain.json` keeps working once `brain upgrade` has renamed the key `capture_inbox` → `inbox` | agent |
| Add **Kind** (select: Capture, Document, Email, Chat, Note), **Summary** (text), **Brain ID** (text), **Last Synced** (date) | agent |
| Set **Kind = Capture** on every existing row | agent |
| Make **Capture** the default of Kind | by hand |

## 2 · Review: Note replaces Edited Value

| Change | Who |
|---|---|
| Add **Note** (text) | agent |
| For every row with State = Pending and a non-empty Edited Value, copy Edited Value into Note | agent |
| Delete **Edited Value**, after the copy is checked | agent, with your yes |

## 3 · Concepts database

| Change | Who |
|---|---|
| On **Brain Data**, create the database **Concepts** with the properties of Prompt 2, item 13 | agent |
| Record its id: `brain config set notion.databases.concepts '"<id>"'` | agent |

## 4 · Relations (Prompt 3)

All two-way, with exactly these names on each side (**agent**):
- Decisions "Area" ↔ Areas "Decisions"
- Questions "Area" ↔ Areas "Questions"
- Concepts "Project" ↔ Projects "Concepts"
- Concepts "Area" ↔ Areas "Concepts"
- Inbox "Decisions" ↔ Decisions "Sources"
- Inbox "Questions" ↔ Questions "Sources"
- Inbox "Concepts" ↔ Concepts "Sources"
- Inbox "People" ↔ People "Sources"
- Inbox "Project" ↔ Projects "Inbox"
- Inbox "Area" ↔ Areas "Inbox"
- Tasks "Source" ↔ Inbox "Tasks": only for the default Tasks database. With your own Tasks database, add a relation to the Inbox there if you want the backlink, then `brain config set notion.tasks.properties.source '"<its name>"'`; without one, owner tasks from documents simply have no backlink.

## 5 · Areas: views replace two rollups (0034)

| Change | Who |
|---|---|
| Delete the rollups **Decisions via projects** and **Questions via projects** from Areas, and from the Areas page layout | agent (property), by hand (layout) |
| In the Areas template, after "Which meetings?", add "What have we decided here?" and "What's still open here?" exactly as in Prompt 6 | by hand, or Notion AI with that part of Prompt 6 |

## 6 · Ownership descriptions (Prompt 5)

**Agent.** "Owner: system. Do not edit." for Kind, Brain ID, Last Synced and Created in Inbox, and for Brain ID, Last Synced and Created time in Concepts. "Owner: you." for Name, Brain Status, Project, Area and Tasks in Inbox, the Inbox relation in Projects and Areas, and Note in Review. "Owner: brain." for every other new property.

## 7 · Views and layouts

By hand, or Notion AI with the prompt named:
- **Home:** the Quick capture button adds to **Inbox** with Kind = Capture and Brain Status = New (Prompt 7a, item 3).
- **Review:** "What needs my decision?" shows **Note** after Decision (Prompt 7e).
- **Knowledge:** a **Concepts** tab after Questions with its three views, and the **Inbox** tab with "What's in my inbox?" and "What came in?" (Prompt 7f, items 3 and 6).
- **Archive:** a **Concepts** tab (Prompt 7h, item 6).
- **Page layouts** for Areas, Projects, People, Decisions, Questions, Review, Inbox, Concepts and Tasks as in [views-guide.md](../views-guide.md) §9.

## 8 · First sync

Run `brain sync` (or "catch up"). It publishes, once:
- every concept note, to Concepts;
- an Inbox row for every document, email, chat and note already ingested (created as Processed), and Kind, Summary and the produced notes on every capture row: the History starts complete;
- Area on every decision and question.

Expect one write per record; the report gives the counts. Then update the live snapshot in [../templates.md](../templates.md) (Areas).

## Verify
- [ ] "Brain Data" holds 13 databases; Capture Inbox is gone and Inbox has Kind, Summary, Decisions, Questions, Concepts, People, Project, Area, Brain Status, Tasks, Brain ID, Last Synced, Created.
- [ ] Review has Note and no Edited Value; no pending row lost its edited value.
- [ ] `brain status` lists `inbox` and `concepts` under `configured`.
- [ ] An Area page shows its decisions and open questions in views, and its header shows only the two remaining "via projects" rollups.
- [ ] Quick capture creates an Inbox row with Kind Capture and Brain Status New.
- [ ] After the first sync: History lists the documents ingested so far, each with its produced decisions or concepts; a decision's Area matches its project's area.
