# Modules: turning one on or off later

The space is a core (Inbox, Meetings, Projects, Areas, People, Review) plus optional modules (decision 0048; docs/notion-space-design.md §1). You choose them when you build the space ([CHECKLIST](../CHECKLIST.md)). To change them later, ask your agent: "turn on documents", "turn planning off". The `brain-connect-notion` skill runs `brain modules on|off <module>` and walks you through the module's file here.

| Module | File | Databases |
|---|---|---|
| Knowledge | [knowledge.md](knowledge.md) | Decisions, Questions, Concepts |
| Orgs | [orgs.md](orgs.md) | Orgs |
| Documents | [documents.md](documents.md) | Documents |
| Reports | [reports.md](reports.md) | none: Ask and Report rows on the Inbox |
| Tasks | [tasks.md](tasks.md) | Tasks, or your own tasks database |
| Planning | [planning.md](planning.md) | Goals, Key Results |

## How a module file works

Each file has the same parts, and each step says **who** does it, as in a migration ([../migrations/README.md](../migrations/README.md)):
- **agent:** the skill does it through the Notion API, with your yes;
- **Notion AI:** you paste the prompt into Notion AI on the page named, then say "done". The API can't create databases or linked views;
- **by hand:** you do it in Notion, following the steps. The API can't create buttons or set page layouts.

**Turning a module on:** run its steps in order, then **Verify**. The last agent step stores each new database's id (`brain config set notion.databases.<key> '"<id>"'`); until then the brain skips its notes with `DATABASE_NOT_CONFIGURED`. Stopped halfway? Say "turn on <module>" again: the skill starts from the first step whose Verify item doesn't hold.

**Turning a module off** deletes nothing: the brain stops reading and writing its databases, and its notes stay in Git (spec/schema.md §12). The file's **Turning it off** lists the views you may hide; hiding is optional. Turning the module back on later needs no steps when the databases are still there: the brain picks up where it stopped.

A space built before 0.6.0 has every module on, and [migration 0010](../migrations/0010-modules-documents-buttons-area-homes.md) brings its databases up to date: these files are for a module you didn't have.
