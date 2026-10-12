# CLI inputs for an ingest

The JSON the ingest passes to the CLI, taken from a real run on the synthetic Acme brain (tests/fixtures/brain-acme) with the minutes in tests/fixtures/minutes/2026-12-10-acme-launch-review.md. The contracts are spec/cli.md §5.5 (`note new`), §5.6 (`proposal new`) and §5.14.5 (`sync tasks`). Write each input to a temporary file and pass `--input <file>`, or pipe it with `--input -`.

## 1. Source snapshot

```json
{ "notes": [ {
  "type": "source",
  "title": "Acme launch review (minutes)",
  "file_date": "2026-12-10",
  "frontmatter": { "source_key": "notion:3c4d5e6f-7a8b-4c0d-9e2f-3a4b5c6d7e8f", "origin_edited": "2026-12-10T16:40:00Z" },
  "body": "<the minutes, verbatim>"
} ] }
```

- **`source_key`:** `notion:<page id>` in Notion mode. In Markdown-only mode, use `url:https://…` if the minutes have a URL, else `agent:<agent>/<session-id>` (e.g. `agent:claude-code/<session id>`).
- **`origin_edited`:** the Notion page's `last_edited_time` (Notion mode only).
- **Do not set `content_hash` or `captured`;** the CLI sets both. The body must use LF line endings.
- **Title:** `<meeting title> (minutes)`. `file_date` is the meeting date.

## 2. The new-notes batch

All new notes of one meeting in one call, with ids from `brain id new`. Shortened from the real run:

```json
{ "notes": [
  { "type": "source", "id": "src-vdcsmjex", "...": "as in §1" },
  { "type": "meeting", "id": "mtg-pcpyn31n", "title": "Acme launch review",
    "frontmatter": {
      "summary": "Launch fixed for 15 Feb 2027, Contentful chosen as blog CMS, budget raised to 95000 EUR.",
      "date": "2026-12-10",
      "attendees": ["per-3h8w2n6c", "per-9t2c6m4a", "per-zzvs98vn"],
      "source": "src-vdcsmjex",
      "decisions": ["dec-axker49q", "dec-xe9x6apm"],
      "questions": ["que-wtnyy4r6", "que-zv7ckbtk"],
      "area": "area-2m7c4h8n", "projects": ["prj-9x4t1b7e"], "sources": ["src-vdcsmjex"] },
    "body": "## Summary\n…\n\n## Decisions\n- [Use Contentful as the blog CMS](../decisions/2026-12-10-use-contentful-as-the-blog-cms.md)\n- Send the launch announcement draft on Fridays for review (tentative).\n\n## Action items\n- Set up the Contentful space — Carlos Ruiz — 2026-12-17\n…" },
  { "type": "person", "id": "per-zzvs98vn", "title": "Lucía Fernández",
    "frontmatter": {
      "summary": "Marketing lead at Acme; writing the blog launch post for the website.",
      "org": "org-6d1f9z3k", "aliases": ["Lucía", "Lucia Fernandez"], "projects": ["prj-9x4t1b7e"], "sources": ["mtg-pcpyn31n"],
      "facts": { "role": "marketing lead" },
      "timeline": [ { "field": "role", "value": "marketing lead", "from": "2026-12-10", "learned": "2026-12-10", "source": "mtg-pcpyn31n", "assessment": "accepted" } ] },
    "body": "Marketing lead at [Acme](../orgs/acme.md), first seen at the [10 Dec launch review](../meetings/2026-12-10-acme-launch-review.md).\n" },
  { "type": "decision", "id": "dec-xe9x6apm", "title": "Use Contentful as the blog CMS",
    "frontmatter": {
      "summary": "Acme's blog runs on Contentful rather than a custom CMS; chosen over Strapi for its editor.",
      "date": "2026-12-10", "assessment": "accepted", "decided_in": "mtg-pcpyn31n", "deciders": ["per-9t2c6m4a"],
      "area": "area-2m7c4h8n", "projects": ["prj-9x4t1b7e"], "sources": ["mtg-pcpyn31n"] },
    "body": "## Decision\n…\n\n## Context\n…\n\n## Consequences\n…\n\n## Sources\n- [Acme launch review, 10 Dec](../meetings/2026-12-10-acme-launch-review.md)\n" },
  { "type": "question", "id": "que-zv7ckbtk", "title": "Migrating old blog posts to Contentful could delay the launch",
    "frontmatter": {
      "summary": "Risk raised by Carlos: moving old blog posts into Contentful may push back the 15 Feb launch.",
      "kind": "risk", "raised_in": "mtg-pcpyn31n", "area": "area-2m7c4h8n", "projects": ["prj-9x4t1b7e"], "sources": ["mtg-pcpyn31n"],
      "relations": [ { "type": "about", "target": "dec-axker49q" } ] },
    "body": "Raised by [Carlos Ruiz](../people/carlos-ruiz.md) at the [10 Dec launch review](../meetings/2026-12-10-acme-launch-review.md).\n" }
] }
```

Things the CLI checks that are easy to get wrong:
- **Never set** `id` inside `frontmatter`, or `type`, `title`, `created`, `updated` or `lifecycle`. The CLI sets them, and new notes are `draft`.
- **A decision needs `sources`.** `decided_in` / `raised_in` must agree with the meeting's `decisions` / `questions` lists. Both sides must be in this batch, since the meeting is new.
- **Every `facts` key needs an accepted `timeline` entry with the same value.**
- **Every reference must exist** in the brain or in the batch, and every relative link must resolve. Get the paths from a `--dry-run` first (SKILL.md step 7).
- **The meeting body uses relative links**, e.g. `../people/…`, `../decisions/…`, `../../projects/<slug>/project.md`.
- **Sources (`sources`) of knowledge notes are the meeting id.** The meeting itself cites the source snapshot.

## 3. The proposals batch

```json
{ "proposals": [
  { "kind": "update_fact", "title": "Acme budget: 80000 → 95000 EUR", "target": "prj-9x4t1b7e", "field": "budget",
    "after": "95000 EUR", "why": "Budget raised to 95000 EUR to cover the CMS licence.", "source": "mtg-pcpyn31n" },
  { "kind": "update_fact", "title": "Carlos Ruiz role: Developer → tech lead", "target": "per-9t2c6m4a", "field": "role",
    "after": "tech lead", "why": "Carlos is now tech lead for the website.", "source": "mtg-pcpyn31n" }
] }
```

- **Don't send `before` or `from`.** The CLI fills them: `before` from the current fact, `from` from the source meeting's date.
- **`add_link`** (decision 0028) adds one value to a list of an existing note:
  ```json
  { "kind": "add_link", "title": "Acme website: add Lucía Fernández to People", "target": "prj-9x4t1b7e", "field": "people",
    "after": "per-zzvs98vn", "why": "Lucía Fernández (Acme, marketing lead)", "source": "mtg-pcpyn31n" }
  ```
  `field` is one of `aliases`, `tags`, `projects`, `people`, `attendees`, `deciders`. A value that is already listed is skipped as `ALREADY_LINKED`.
- **`why`** is the sentence from the minutes, verbatim.
- **`title`** reads as a Review row: `<subject> <field>: <old> → <new>`.
- **Other kinds** (spec/schema.md §11):
  - `add_to_note`: `target`, `content`.
  - `contradiction`: `target`, `field`, `after` (the target must have a current value).
  - `supersede`: `target` = the new note, `supersedes` = the old one.
  - `merge`: `target` = the duplicate, `merge_into` = the survivor.
  - `new_item`: `note`, a `note new` item without `id`, for a decision or question of a meeting that already existed.
- **A re-run is safe:** identical pending proposals are skipped as `DUPLICATE_PENDING`.

## 4. Action items (Notion mode)

```json
{ "items": [
  { "title": "Set up the Contentful space", "owner": "Carlos Ruiz", "due": "2026-12-17" },
  { "title": "Write the blog launch post", "owner": "Lucía Fernández" }
] }
```

`brain sync tasks --meeting mtg-pcpyn31n --input <file>` turns these into Notion payloads using the Tasks mapping in `brain.json`. Leave out `due` when the minutes say "no date".

## 5. Log line

```sh
brain log ingest mtg-pcpyn31n created=7 proposals=3 tasks=2 --brain <brain> --json
```

- **`created`:** the number of notes `note new` wrote, the source included.
- **`proposals`:** the number `proposal new` created; skips don't count.
- **`tasks`:** the number of Notion tasks created, 0 in Markdown-only mode.
