# Sync input formats

A copy of the inputs in spec/cli.md §5.14, so the skill works from inside a brain where the product spec is not readable. If they ever disagree, the spec wins; report the difference.

## Snapshot (input to `brain sync plan`)

```json
{
  "as_of": "2026-12-05T09:00:00Z",
  "rows": [
    {
      "database": "people",
      "page_id": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d",
      "last_edited": "2026-12-05T08:40:00Z",
      "properties": {
        "Name": "Maria López", "Summary": "Product lead at Acme.", "Role": "Product lead",
        "Email": "maria@acme.example", "Lifecycle": "Reviewed",
        "Brain ID": "per-3h8w2n6c", "Org": ["9b8a7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d"]
      }
    }
  ]
}
```

- `database`: the `brain.json` key: `areas`, `goals`, `key_results`, `projects`, `people`, `orgs`, `decisions`, `questions`, `concepts`, `review` or `inbox`. Meetings are never a snapshot database; of the Inbox, send only rows whose Full text box is ticked, with `"Full text": true` and `"Brain ID"` (decision 0043). Each becomes a `full_text_requests` item `{ "page_id", "source" }` in the plan.
- `properties`: the Notion property names exactly, with normalized values:

  | Notion type | Normalized value |
  |---|---|
  | title, text, select, status, url, email | string; empty → `null` |
  | number | number or `null` |
  | checkbox | boolean |
  | date | `{"start": "<date or timestamp>", "end": "<…>" or null}` or `null` |
  | relation | array of page ids, sorted |
  | formula, rollup | their scalar result |
- A property you did not read is left out, and is then not compared.

## Plan (input to `brain sync apply` and `brain sync render --plan`)

The `data` object of the `sync plan` reply, unchanged. Not the whole reply.

## Record (input to `brain sync record`)

```json
{ "records": [
  { "id": "per-3h8w2n6c", "notion": "6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d",
    "synced_at": "2026-12-05T09:01:10Z", "published": { "Name": "Maria López", "Brain ID": "per-3h8w2n6c" } }
] }
```

- One record per page actually written. `synced_at` is required.
- `published`: the render item's `published`, unchanged.
- `tasks` (meetings and sources): the new task page ids.
