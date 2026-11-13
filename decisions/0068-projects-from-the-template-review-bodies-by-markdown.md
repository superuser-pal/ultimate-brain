# 0068 — Projects from the Notion template, Review bodies by markdown

**Status:** Accepted (by the user, 2026-11-03)
**Date:** 2026-11-03
**Release:** 0.9.0
**Amended by:** [0088](0088-a-review-row-says-it-needs-you-and-a-review-page-reads-plainly.md) (2026-11-13; built in 0.15.0): a pending Review row nobody has touched is rebuilt once as a new page; the markdown write still goes only to a page just created
**Amends:** 0037 (its 2026-10-18 amendment: "Projects are created in Notion, never by the agent"), 0043 (the block API stays the rule for sections, with one exception)
**Keeps:** 0003, 0021, 0026, 0033, 0041, 0055

## Context

In 0.2.2 (CC-23, CX-26) the first drop-folder run created a project page through the API. The page had no linked views and no "My notes", because the API could not apply the Projects template. The 2026-10-18 amendment of 0037 then said that projects are created in Notion and never by the agent, and `sync render` began to refuse a project with no Notion page: item error `PROJECT_NOT_IN_NOTION` (spec/cli.md §5.14.4). The user had to create each project page by hand with **New project**, put the note's id in its Brain ID, and sync again.

Two findings from a real brain on 0.8.1:
- **#193.** The API can now apply the template. `GET /v1/data_sources/{id}/templates` lists the Projects data source's default template, and `POST /v1/pages` with `"template": { "type": "default" }`, a Name and a Brain ID creates a page with the whole template: the Brief and Decision log toggle headings, the linked views and My notes. The next `sync plan` links the page by its Brain ID. So the reason for `PROJECT_NOT_IN_NOTION` is gone, and six new projects each needed a manual step for nothing.
- **#194.** A Review row with item sections (0055) has one "Proposed final wording" toggle per item. brain-sync says to write each toggle as a real toggle block, but the Notion reference describes only the block API and forbids the markdown page update (0043, because it flattens toggles on a page that already has content). That leaves the agent to write its own Markdown-to-blocks converter, and a converter that reads back differently spoils `proposed_hash`. Writing the body once with `PATCH /v1/pages/{id}/markdown` (`replace_content`) on the new, still-empty page gave 20 real toggle blocks.

## Decision

### Projects come from the template
- **`sync render` returns a `create` for a project with no `notion`,** like any other note, with every rendered property and its `sections`, plus `"template": { "type": "default" }`. `PROJECT_NOT_IN_NOTION` is retired.
- **The skill creates the page from the space's default Projects template.** It lists the Projects data source's templates once per run. With a default template, it creates the page with the template and the item's properties (no children: the template supplies the body), waits until the template's content is on the page, then writes Brief and Decision log through the block API as for any project.
- **No default template:** the skill creates nothing for that project and asks the user to create it with **New project** in Notion and put the note's id in its Brain ID, as before. The next sync links them.
- **A new project can come from the brain side.** When the user names a new project, or says yes to one the agent suggests in the pre-check, the agent writes the project note and the next publish creates its page. The agent still never invents a project (the ambiguous-project stop condition stays), and creating a project in Notion first, then syncing, still works (0021).

### Review bodies are written by markdown, once, on create
- **On create only, a Review row's `body` is written with Notion's markdown endpoint,** to the page just created and still empty. Nothing of the user's is on it yet, so nothing can be flattened, and the `<details>` toggles of the rendered body become real toggle blocks. This is the only use of the markdown write.
- **Everything else stays on the block API (0043):** the `Review summary` section and the item sections named in `item_updates`, the project and area sections, and every other body. The markdown update is never used on a page that already has content.

## Consequences
- spec/cli.md §5.14.4: a project `create` and its `template` field; the Review body rule. spec/capture-and-review.md §9: the markdown write on an empty page is a verified mechanism (M9).
- `src/lib/sync.ts` render: a project without `notion` is a `create` with `template`; the `PROJECT_NOT_IN_NOTION` test becomes a create test. A test shows that a Review body, read back as Notion's markdown returns it (toggle children indented), gives each item its rendered `proposed_hash`.
- brain-sync step 10 and brain-ingest references/notion.md: create from the template, wait for its content, the New project fallback, and the markdown write of a Review body on create. brain-ingest SKILL.md and references/sources.md: a new project the user asks for is written as a note and published from the template.
- Status on Projects stays the user's: render never sends it. A page created through the API has the Status the template sets, else none; the publish report names each new project, so the user can set it. **New project** on Home is unchanged.
- Brains on a space whose Projects database has no default template keep the 0.2.2 behaviour through the fallback.

## Evidence
- Dogfood issues #193 and #194 (0.8.1, closed into CC-114).
- build/HISTORY.md: CC-23 and CX-26 (0.2.2), which introduced `PROJECT_NOT_IN_NOTION`.
- Notion API: data source templates (`GET /v1/data_sources/{id}/templates`), page create with `template`, the page markdown endpoint (`PATCH /v1/pages/{id}/markdown`).
