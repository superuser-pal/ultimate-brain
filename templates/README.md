# Brain template

`templates/brain/` is copied byte for byte by `brain init` (spec/cli.md §5.1) to create a user's brain repo (0014). This file is not copied.

## Contents

| Path | Owner after init | Notes |
|---|---|---|
| `AGENTS.md` | product (fenced part) + user | Operating rules for agents. See "Upgrade boundary" |
| `CLAUDE.md` | user | One line, `@AGENTS.md`, so Claude Code loads the same rules as Codex |
| `brain.json` | user | Valid against spec/schemas/brain.schema.json. `init` replaces `owner.name` (`"Owner"`) and keeps `schema_version: 1`. The Tasks mapping is pre-filled for the default Tasks database (0018); Notion database ids stay empty until the connect-notion skill fills them |
| `index.md` | generated | The empty index exactly as `brain index` writes it for a brain with no notes (spec/schema.md §13) |
| `.gitignore` | user | OS files, env files, and the `.*.tmp` files an interrupted atomic write can leave (spec/cli.md §3.6) |
| `<folder>/.gitkeep` | — | Keeps the empty note folders of spec/schema.md §2 in Git. `.gitkeep` is not `.md`, so it is not a note (spec/cli.md §3.7) |

`log/` is not in the template: the first logged operation (`init` itself) creates `log/<YYYY-MM>.md` with its header (spec/cli.md §3.9).

## Upgrade boundary (0014)

Product-owned text in a brain sits between two marker lines:

```text
<!-- ultimate-brain:rules:start v<N> -->
…
<!-- ultimate-brain:rules:end -->
```

- `v<N>` is the version of the rules text. Bump it whenever the text between the markers changes.
- An upgrade replaces the lines from the start marker through the end marker, inclusive, with the new version, and leaves every other byte of the file alone. If the markers are missing or out of order, the upgrade stops and reports the file; it never guesses.
- Everything outside the markers belongs to the user, including the `## My rules` section the template seeds after the end marker.
- `CLAUDE.md` has no fence. The only thing an upgrade may do there is add the line `@AGENTS.md` if it is missing.

The consuming-repo block written by `brain link` uses different markers (`<!-- ultimate-brain:start -->`, spec/cli.md §5.12), so the two can never be confused.

## Names the rules depend on

The rules in `AGENTS.md` name the skills `brain-connect-notion`, `brain-ingest`, `brain-apply`, `brain-sync`, `brain-query` and `brain-notion-change`, and the CLI commands of spec/cli.md. Renaming any of them means changing `AGENTS.md` and bumping its version (CC-05 packages the skills under these names).

## Acceptance checks (for CX-03 tests)

1. `brain.json` validates against spec/schemas/brain.schema.json.
2. `brain index --check` on a fresh brain exits 0 (the template's `index.md` is already current).
3. `brain lint` on a fresh brain reports no errors and no warnings.
4. `AGENTS.md` contains exactly one start marker and one end marker, in that order.
