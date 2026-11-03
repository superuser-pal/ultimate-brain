# 0014 · The Domains database in every space

**Design change:** decision 0065; CC-96 (release 0.8.1). **Applies to:** spaces built or migrated before 0.8.1 that have no **Domains** database under Brain Data. A space whose Domains were turned on with migration 0013 step 2 or notion/modules/domains.md already has it: check the Verify list below and skip what holds.

What changes: the Domains database and its relation to Areas become part of every space, used or not. The Domains module stays as it is (off unless you turned it on): it still decides whether the brain reads and publishes Domains. Nothing is renamed or deleted, and no page layout changes.

Who does each step:
- **agent:** the `brain-notion-change` skill, through the API, each with your yes;
- **Notion AI:** a prompt you paste;
- **by hand:** you, in Notion (the API ignores it with a 200: always read the result back).

## 1 · The database (agent, or Notion AI)

**Agent:** the Notion MCP tools can't create a database, but the REST API can: `POST https://api.notion.com/v1/databases` with `Notion-Version: 2025-09-03` and this body, using the integration token the MCP server uses (never shown in the chat):

```json
{ "parent": { "type": "page_id", "page_id": "<Brain Data page id>" },
  "title": [ { "type": "text", "text": { "content": "Domains" } } ],
  "initial_data_source": { "properties": {
    "Name": { "title": {} }, "Summary": { "rich_text": {} },
    "Lifecycle": { "select": { "options": [ { "name": "Draft" }, { "name": "Reviewed" }, { "name": "Disputed" }, { "name": "Archived" } ] } },
    "Archived": { "checkbox": {} }, "Brain ID": { "rich_text": {} }, "Last Synced": { "date": {} } } } }
```

The response holds the database id and, in `data_sources`, its data source id. With the hosted Notion MCP there is no token to call the REST API with: use the Notion AI prompt instead.

**Notion AI** (instead of the agent step) — paste this on the Brain Data page:

```text
Create a full-page database "Domains" with: Name (title), Summary (text), Lifecycle (select: Draft, Reviewed, Disputed, Archived), Archived (checkbox), Brain ID (text), Last Synced (date). Add it under Brain Data. Change nothing else.
```

Read the database back: six properties with exactly these names, types and options.

## 2 · Relations (agent)

| Step | Who |
|---|---|
| Areas: add the relation **Domain** to Domains, two-way, named **Areas** on the Domains side | agent |
| With an **Orgs** database in the space: Domains: add the relation **Org** to Orgs, two-way, named **Domains** on the Orgs side | agent |
| Store the id: `brain config set notion.databases.domains '"<database id>"'` (the database id, not the data source id). This doesn't turn the module on | agent |

Read each relation back from both data sources after writing it.

## 3 · Limit (by hand)

Open Areas · Domain → edit relation → **Limit: 1 page**. The API drops the limit silently (T7, docs/notion-space-design.md §3.18).

Turning Domains on (Home's Areas grouped by Domain, Domain shown on area homes) is not part of this migration: say "turn on domains" when you want the brain to use them ([../modules/domains.md](../modules/domains.md)).

## Verify
- [ ] Brain Data has a **Domains** database with Name, Summary, Lifecycle (Draft, Reviewed, Disputed, Archived), Archived, Brain ID and Last Synced.
- [ ] Areas has **Domain**, two-way with Domains · **Areas**, limited to 1 page.
- [ ] With Orgs: Domains has **Org**, two-way with Orgs · **Domains**.
- [ ] `brain modules` lists Domains with nothing `missing`, on or off as before.
