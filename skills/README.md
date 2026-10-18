# Skills

Agent skills that operate a user's brain. The skills do the judgment and the Notion I/O, and call the `brain` CLI for every write (spec/cli.md §1). Decisions 0014 and 0024.

## One source, two outputs

| What | Where | Read by |
|---|---|---|
| **Source (edit here)** | `skills/<name>/SKILL.md` (+ optional `references/`, `scripts/`) | nothing directly |
| Generated mirror, shipped in the npm package | `.agents/skills/<name>/` | copied by `brain init` and `brain upgrade` into a brain's `.agents/skills/` (Codex) and `.claude/skills/` (Claude Code) |

Never edit `.agents/skills/`: it is rebuilt from `skills/`.

## Build step

```sh
node scripts/build-skills.ts          # validate skills/, then rebuild .agents/skills/
node scripts/build-skills.ts --check  # validate and report drift; writes nothing (also run by npm test)
```

Run the build after changing any skill and commit both folders together. `npm test` fails if the mirror is stale.

## Install

npm is the only channel (decision 0038): `brain init` and `brain upgrade` write the skills into the brain for both agents, and `brain link` writes `brain-query` into a linked repo. The Claude Code plugin is retired. A brain's copies are read-only: fix a skill here and release it.

## Rules for a skill

- **Folder:** lowercase kebab-case, prefixed `brain-` for brain operations (the names in templates/brain/AGENTS.md).
- **Frontmatter:** `name` (equal to the folder name) and `description` only. The description says what the skill does and when to use it, in words the user would say ("ingest my reviewed meetings"), up to 1024 characters.
- **Body:** the procedure, end to end. Keep it lean; long reference material goes in `references/` and is linked from the body.
- **Writes go through the CLI** (`brain … --json`), never by editing note files directly. Read exit codes as templates/brain/AGENTS.md says.
- **No personal data;** examples use the synthetic Acme brain (tests/fixtures/brain-acme).

## Skills

| Skill | Task | Status |
|---|---|---|
| `brain-ingest` | CC-06 | done (#29) |
| `brain-connect-notion`, `brain-sync` | CC-08 | review |
| `brain-apply` | CC-09 | done (#35) |
| `brain-query` | CC-10 | done (#33) |
| `brain-notion-change` | CC-11 | review |
| `brain-howto` | CC-19 | review |
