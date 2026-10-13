---
name: brain-connect-notion
description: Connect the brain to the user's Notion space after it was built from the notion/ prompts. Finds the Brain Data page and its databases through the Notion connection, checks each has the properties the brain reads and writes, stores their ids in brain.json, and maps the Tasks database. Changes nothing in Notion. Use when the user says "connect the brain to Notion", after building the Notion space, or when a skill reports a Notion database is not configured.
---

# Connect the brain to Notion

Find the user's Notion databases and record their ids in `brain.json` (decision 0015). This skill **only reads Notion**. Its single write is `brain.json`, through `brain config set`.

Run CLI commands as `brain <command> --brain <brain> --json`. If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry. Don't build it from a plugin folder.

## Procedure

1. **Check access.** The Notion connection (MCP) must reach the user's workspace. Search for the page **"Brain Data"**:
   - **Not found:** the integration isn't connected to it. Tell the user to open Brain Data in Notion → `•••` → **Connections** → add the integration, then stop.
   - **More than one:** ask which one.
2. **Find the databases.** List the Brain Data page's child blocks; each `child_database` has a title. Match the titles exactly:

   | Title | `brain.json` key |
   |---|---|
   | Areas | `areas` |
   | Goals | `goals` |
   | Key Results | `key_results` |
   | Projects | `projects` |
   | Meetings | `meetings` |
   | People | `people` |
   | Orgs | `orgs` |
   | Decisions | `decisions` |
   | Questions | `questions` |
   | Review | `review` |
   | Capture Inbox | `capture_inbox` |
   | Tasks | `notion.tasks.database` (below) |

   A missing database is reported, not invented. The brain works without it, and the skills that need it say so.
3. **Check each database** (read-only). Retrieve the database, then its data source (current Notion API: a database has `data_sources`, and its properties live on the data source). Check that every property in docs/notion-space-design.md §3 for that database exists with the right type: relations point to the right database, and selects have the listed options.
   - Report each difference as `Database · Property: expected …, found …`.
   - Report two select options that share an id (it has happened after adding an option through Notion AI), and suggest deleting and re-adding the option by hand.
   - **Don't fix anything in Notion.** Structure changes go through the `brain-notion-change` skill (decision 0022).
4. **Store the ids.** For each database found, run `brain config set notion.databases.<key> '"<database id>"'`. Store the **database** id, not the data source id; skills resolve the data source when they query.
5. **Tasks** (decision 0018):
   - **The default Tasks database on Brain Data:** set `notion.tasks.database` to its id. The template's property mapping (Name, Status, Due, Project, Area, Meeting, Brain ID) already matches it.
   - **The user's own tasks database:** ask which one, read its properties, and propose a mapping for `title` (required), `status`, `due`, `project`, `area`, `owner`, and either `meeting` (a relation to Meetings, preferred) or `meeting_url` (a URL property).
     - Show the mapping and get a yes before running `brain config set notion.tasks '<json>'`.
     - Also set `new_task_status` to the status option new tasks should get.
   - **No tasks database:** leave `notion.tasks.database` empty. The ingest then lists action items in its report instead.
6. **Verify.** Run `brain status`. `notion.configured` lists the keys you set, and `notion.tasks_database` is true when Tasks is set. Then run `brain lint`: its `brain-config` rule validates the whole file.
7. **Commit** in the brain repo: `connect: Notion databases`.
8. **Report:**
   - the databases connected;
   - anything missing or different from the design (step 3);
   - what to do next: build the Notion space's missing parts, or run `brain-sync` to import the rows you already created in Notion (0021), then ingest reviewed meetings.

## Re-running

Re-running is safe. Ids that are already correct are left alone, and changed ids are updated (for example, after the user recreated a database). If an id changes for a database the brain has already published to, warn the user. The brain's notes keep their old page ids, and the next sync reports `NOTION_ID_MISMATCH` for them.
