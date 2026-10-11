# Handoff — state of the build (2026-10-11)

For the next Claude Code session. Read this, then `AGENTS.md`, `build/TASKS.md`, `synthesis/synthesis.md`.

## Where things are

- **Repo:** https://github.com/superuser-pal/ultimate-brain (private). `main` has the research, decisions 0001–0024, the synthesis, the Notion space design, the build plan, and the schema spec (PR #1, merged).
- **Two working folders:**
  - `/Users/rodrigocanoteran/GitHub/ultimate-brain`: **Codex's folder.** Do not switch branches or edit files there.
  - `/Users/rodrigocanoteran/GitHub/ultimate-brain-claude`: **Claude's git worktree.** Do all Claude work here, one branch per task (`claude/<task-id>-<slug>`, from `origin/main`).
- **Codex** runs in the user's Codex app (no Codex CLI on this machine). Coordinate through `build/TASKS.md`, PRs and review comments. Give the user ready-to-paste Codex prompts.

## Open work

| Item | State | Next action |
|---|---|---|
| PR #2 `claude/CC-01b-spec-fixes` | Open. Fixes all 9 P1 findings from Codex's review of PR #1; adds decision 0025 | Wait for Codex re-review, then user merges |
| CX-01 scaffold (Codex) | Done on local branch `codex/CX-01-scaffold`, **not pushed**. Claude reviewed: approve (3/3 tests, typecheck clean) | User asks Codex to push and open a PR; user merges |
| CX-02 core library (Codex) | Not started | User gives Codex the CX-02 prompt |
| CC-03 CLI contract | `spec/cli.md`; PR #5 was merged **into PR #2's branch**, so PR #2 now carries CC-01b + CC-03. Adds `note new`, `id new`, `status`, `config`, `log`, `proposal list`, `sync plan/apply/render/tasks/record`. Open points in its §7 | Codex reviews; retarget the PR to `main` once PR #2 merges |
| CC-02 brain template | `templates/brain/` + `templates/README.md` (fence contract, acceptance checks for CX-03). Draft PR stacked on PR #2 | Codex reviews; mark ready after PR #2 merges |
| **CC-04 Notion prompt files** | **Next for Claude** | See row below |
| CC-04 Notion prompt files | Todo | Extract from docs/notion-space-design.md §6/§9 into `notion/prompts/`. **Change:** in Prompt 6 the Meetings "Minutes format" callout is created empty, then a manual step 6b pastes the minutes text (Notion AI can't read our docs). The user already received this version in chat |
| U-01 Notion space | Prompts 1–6 done (pages, databases, relations, progress formula, ownership labels, templates incl. step 6b). **Pending: Prompt 7 (Spaces and views) and Prompt 8 (navigation)** | Help with 7–8 if Notion AI deviates; then confirm which Tasks database to map (default or existing, 0018) and verify the live space against the design via Notion MCP (0022) |

## How the user likes to work

- Explain decisions with a concrete example and a before/after comparison, plus a recommendation. Abstract option lists get bounced back.
- Record every accepted decision as `decisions/NNNN-*.md`; park v2 alternatives in `docs/v2-ideas.md`.
- Architecture changes go through the repo first (0022).
- Ask before commits, pushes, PR merges; merges to `main` need the user's approval.

## Useful checks

- Spec examples are validated with Ajv: a script lives in the previous session's scratchpad only. Recreate with `ajv@8.17.1` + `yaml@2.6.1` in a scratch folder (draft 2020-12, YAML 1.2 core). Expected: every `spec/examples/valid/*` passes, every `invalid/*` fails for the reason in its body.
