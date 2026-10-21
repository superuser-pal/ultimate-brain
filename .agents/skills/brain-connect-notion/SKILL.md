---
name: brain-connect-notion
description: Connect the brain to the user's Notion space after it was built from the notion/ prompts. Gives the agent access to Notion, finds the Brain Data page and its databases, checks each has the properties the brain reads and writes, stores their ids in brain.json, maps the Tasks database and records the owner's identities. Changes nothing in Notion. Use when the user says "connect the brain to Notion", after building the Notion space, when Notion is unreachable, or when a skill reports a Notion database is not configured.
---

# Connect the brain to Notion

Find the user's Notion databases and record their ids in `brain.json` (decision 0015). This skill **only reads Notion**. It writes `brain.json` through `brain config set`, and, only in step 6 and only with the user's answer as their approval, the owner's identities: an owner-ruling source note, plus either alias proposals on the owner's person note (applied in chat) or a new person note.

Run CLI commands as `brain <command> --brain <brain> --json`. If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry.

## Procedure

1. **Check access.** The Notion connection (MCP) must reach the user's workspace. Search for the page **"Brain Data"**:
   - **No Notion tools in this session:** the agent isn't connected to Notion. Give the user the steps in "Connect your agent to Notion" below for the agent they are using, and stop.
   - **Not found:** the connection can't see the page. With the hosted Notion MCP, the user's own Notion account must have access to Brain Data; with an integration token, open Brain Data in Notion → `•••` → **Connections** → add the integration. Then stop.
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
   | Inbox (called Capture Inbox before 0.3.0) | `inbox` |
   | Concepts | `concepts` |
   | Tasks | `notion.tasks.database` (below) |

   A missing database is reported, not invented. The brain works without it, and the skills that need it say so.
3. **Check each database** (read-only). Retrieve the database, then its data source (current Notion API: a database has `data_sources`, and its properties live on the data source). Check that every property in docs/notion-space-design.md §3 for that database exists with the right type: relations point to the right database, and selects have the listed options.
   - Report each difference as `Database · Property: expected …, found …`.
   - Report two select options that share an id (it has happened after adding an option through Notion AI), and suggest deleting and re-adding the option by hand.
   - **Don't fix anything in Notion.** Structure changes go through the `brain-notion-change` skill (decision 0022).
4. **Store the ids.** For each database found, run `brain config set notion.databases.<key> '"<database id>"'`. Store the **database** id, not the data source id; skills resolve the data source when they query.
5. **Tasks** (decision 0018):
   - **The default Tasks database on Brain Data:** set `notion.tasks.database` to its id. The template's mapping (Name, Status, Due, Project, Area, Meeting, Source, Brain ID) already matches it; check `notion.tasks.properties.source` is `"Source"` when the database has that relation (built from 0.3.0 on, or after migration 0005), and set it to `""` when it doesn't, so sync never writes to a missing property.
   - **The user's own tasks database:** ask which one, read its properties, and propose a mapping for `title` (required), `status`, `due`, `project`, `area`, `owner`, either `meeting` (a relation to Meetings, preferred) or `meeting_url` (a URL property), and `source` (a relation to the Inbox, optional: the backlink for the owner's tasks from documents and emails).
     - Show the mapping and get a yes before running `brain config set notion.tasks '<json>'`.
     - Also set `new_task_status` to the status option new tasks should get, and `status_type` to the mapped Status property's type: `status` (Notion's built-in Status) or `select`. Leave it out when it's `status`.
   - **No tasks database:** leave `notion.tasks.database` empty. The ingest then lists action items in its report instead.
6. **Your identities** (decision 0037), when `brain.json` has no `owner.person`. Ask once: "Which names and work email addresses do you appear under in meetings, documents and emails?" (for example a nickname, a work name, two email addresses). Find the owner's person note in `brain index --json` by the owner name in `brain.json` and its aliases. Then:
   - add each name and email the note doesn't list yet as an alias, with one `add_link` proposal per value (`field: aliases`, `why` = the user's answer, `source` = an owner-ruling source as in brain-ingest references/extraction.md, "Owner rulings"); the CLI groups them into one Review row, which the user approves here in chat (brain-apply, chat mode). In a catch-up, the answer to its batch question is that approval: apply them with `decided_by: chat` without asking again;
   - run `brain config set owner.person '"<per- id>"'`.
   - No person note yet: create it with `brain note new` (a `person` with `title` = the owner name and the answer as `aliases`, citing the owner-ruling source), then set `owner.person`.
7. **Verify.** Run `brain status`. `notion.configured` lists the keys you set, and `notion.tasks_database` is true when Tasks is set. Then run `brain lint`: its `brain-config` rule validates the whole file.
8. **Commit** in the brain repo: `connect: Notion databases`.
9. **Report:**
   - the databases connected;
   - anything missing or different from the design (step 3);
   - what to do next: build the Notion space's missing parts, or run `brain-sync` to import the rows you already created in Notion (0021), then ingest reviewed meetings.

## Connect your agent to Notion

The agent reads and writes Notion through a Notion MCP server (decision 0015). Give the user the steps for their agent; they run them in their own terminal, then restart the agent in the brain folder.

**Hosted Notion MCP (recommended).** Notion runs it; the user signs in with their Notion account, and the agent can reach what that account can.
- **Claude Code:** `claude mcp add --transport http notion https://mcp.notion.com/mcp`, then in Claude Code run `/mcp`, choose notion and sign in.
- **Codex:** add to `~/.codex/config.toml`:
  ```toml
  [mcp_servers.notion]
  url = "https://mcp.notion.com/mcp"
  ```
  then run `codex mcp login notion` and sign in.

**Integration token (access limited to Brain Data).** For users who want the agent to see only the brain's pages. Notion no longer maintains this server, so prefer the hosted one.
1. Open notion.so/profile/integrations, create an internal integration for the workspace, and copy its secret (`ntn_…`) from its Configuration tab.
2. Open **Brain Data** → `•••` → **Connections** → add the integration. Do the same for the **How it works** page if the user wants the agent to update it.
3. Add the server, with the secret in place of `ntn_…`:
   - **Claude Code:** `claude mcp add notion --env NOTION_TOKEN=ntn_… -- npx -y @notionhq/notion-mcp-server`
   - **Codex:** `codex mcp add notion --env NOTION_TOKEN=ntn_… -- npx -y @notionhq/notion-mcp-server`

The secret is a password: the user types it in their own terminal, never in the chat.

## Re-running

Re-running is safe. Ids that are already correct are left alone, and changed ids are updated (for example, after the user recreated a database). If an id changes for a database the brain has already published to, warn the user. The brain's notes keep their old page ids, and the next sync reports `NOTION_ID_MISMATCH` for them.
