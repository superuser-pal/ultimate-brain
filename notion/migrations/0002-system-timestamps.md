# 0002 · Review, Projects and Questions get system timestamps

**Design change:** the views of Prompt 7 sort and filter on Created time and Last edited time, but the databases didn't list them (PR for this change). **Applies to:** spaces built before this migration.

Adds four automatic properties, owner "system". Notion fills them; the brain never reads or writes them.

| Database | Property | Used by |
|---|---|---|
| Review | Created time | Review → Decide, Clash: newest first |
| Review | Last edited time | Review → Done: "approved in the past month"; Dropped sort |
| Projects | Last edited time | Projects → Quiet: "not edited for a month" |
| Questions | Created time | Knowledge → Open: newest first |

## Prompt (Notion AI)
```text
In the existing databases on "Brain Data", add these properties and change nothing else. Do not create a new database or data source.
- "Review": a "Created time" property (type created time) and a "Last edited time" property (type last edited time).
- "Projects": a "Last edited time" property (type last edited time).
- "Questions": a "Created time" property (type created time).
Set each new property's description to "Owner: system. Do not edit." Keep them hidden in views you don't list.
```

## By hand (alternative)
In each database: **+** (new property) → type **Created time** or **Last edited time** → name it exactly as above → add the description.

## Then restore the views
Deleting these properties earlier drops them from view filters and sorts. Set them again:
- Review → Decide: sort Created time, descending. Clash: sort Created time, ascending.
- Review → Done: filter State is Applied and Last edited time is within the past month (relative); sort Last edited time, descending. Dropped: sort Last edited time, descending.
- Projects → Quiet: filter Status is Active and Last edited time is before one month ago (relative); sort Last edited time, ascending; show Last edited time.
- Knowledge → Open: sort Created time, descending.

## Verify
- [ ] The four properties exist with these exact names and types, and no new data source appeared.
- [ ] Each description starts with "Owner: system."
- [ ] The five view settings above are set again.
