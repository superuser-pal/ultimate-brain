# Native runs of the memory evaluation (CC-200)

Decision [0077](../../../decisions/0077-trust-repair-in-0-13-0.md) §5 makes 0.13.0's final acceptance one complete native run in Claude Code and one in Codex, on the final package, of every case in [`../cases.json`](../cases.json), with each session's trace, 0074 §6's token accounting, the exact package and snapshot identity, and a check that no session read a brain file for an answer or a proposal's evidence ([spec/eligibility.md](../../../spec/eligibility.md) §12). This folder is the harness for it; CC-186 runs it and commits the results. It changes no case, no scoring rule and no product file: the answers go to the unchanged [`../score.mjs`](../score.mjs) through `adapter.mjs`.

| File | What it does |
|---|---|
| `run.mjs` | Builds the sandbox, runs every case as a fresh session per agent, keeps the traces, then writes the results |
| `results.mjs` | Scores a run with `score.mjs` and writes `results.md` and `results.json`; run it again to rewrite them from the kept sessions |
| `adapter.mjs` | `score.mjs`'s answer-level adapter for a run's recorded answers (`--adapter ../native/adapter`, `NATIVE_ANSWERS=<run>/<agent>/answers.json`) |
| `lib/classify.mjs` | The no-file-read check: classifies every tool call |
| `lib/trace.mjs` | Reads both agents' traces into one shape, with each agent's own token usage |
| `lib/answer.mjs` | Citations, full reads, `brain apply` reports and retrieval costs from a trace |
| `lib/world.mjs` | The sandbox: package install, the synthetic world, per-case copies, outcomes, identity, scrubbing |
| `lib/agents.mjs` | How each agent is started, and the session runner with its timeout |

Tests: `tests/native-run.test.mjs` (in `npm test`) covers the classifier, both trace parsers and token accounting, citations, retrieval costs, the identity header and the managed-block hash, with no agent.

## Run it

```sh
npm ci --prefix eval/memory-0.12/adapters                      # the tokenizer for retrieval costs, once
npm pack --pack-destination /tmp/pkg                           # the package under test, from the head being accepted
node eval/memory-0.12/native/run.mjs --package /tmp/pkg/ultimate-brain-<version>.tgz --commit "$(git rev-parse HEAD)" \
  --out /tmp/native-run --claude-config ~/agent-logins/claude --codex-home ~/agent-logins/codex
```

| Option | Meaning |
|---|---|
| `--package` | a tarball, or a published version (`0.13.0`, fetched with `npm pack ultimate-brain@<version>`) |
| `--out` | a new or empty folder for the run |
| `--agents` | `claude,codex` (default), or one of them |
| `--cases` | case ids, comma-separated (default: all 108) |
| `--timeout` | seconds per session (default 900); a session cut off fails its case as `timed out` |
| `--jobs` | sessions run at once (default 2) |
| `--commit` | the commit the package was built from; without it the header records this checkout's HEAD and says so |
| `--claude-config`, `--codex-home` | the agents' login folders (below); or `NATIVE_CLAUDE_CONFIG_DIR`, `NATIVE_CODEX_HOME` |
| `--keep-world` | keep each session's copy of the brain and repos (removed by default once its outcome is read) |

The run refuses to start when the package's vendored skills differ from this checkout's (the brain gets them from `make-brain.mjs`), or when the brain doesn't lint clean.

## Logins

Each agent needs a login of its own that loads nothing global. Make one folder per agent once, and never point the harness at `~/.claude` or `~/.codex` (it refuses them):

- Claude Code: `CLAUDE_CONFIG_DIR=~/agent-logins/claude claude`, then `/login` and `/exit`.
- Codex: `CODEX_HOME=~/agent-logins/codex codex login`.

## Method choices (the user's, 2026-11-11)

These five choices are made by no decision; the user accepted them as #303 proposed them, and the sections below carry them out:

1. **Logins.** Each agent logs in from a dedicated folder (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`), never `~/.claude` or `~/.codex`, inside a temporary HOME; on macOS that HOME links only `Library/Keychains`, where Claude Code's login is.
2. **Prompt.** The case's question, after "I'm working on `<task>` in this repo." when the case names a task, then one fixed line asking for `Evidence: <ids>`; only that line's ids are citations.
3. **Fresh copies.** Every case runs on its own fresh copy of the world, not only the cases with outcomes.
4. **Claude Code's tools.** Read, Glob, Grep, Skill and Bash in Claude Code's sandbox; Edit, Write, sub-agents and the web are off.
5. **Product files.** A read of `brain.json` or the brain's product files (`.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`) is recorded, not a violation.

## The sandbox

`<run>/world/home` is a HOME holding `memory-0.12-eval/{brain,repos}` from `make-brain.mjs`, so `brain.json`'s repo paths (`~/memory-0.12-eval/repos/<name>`) resolve inside it. The brain is committed (a brain is a Git repo), and every repo with a `.brain` and no managed block is linked with the package's own `brain link`: `harbor-api`, `harbor-web`, `orbit-app`, `quill`, `studio-site`. `scratch` stays unlinked (it has no `.brain`), and `harbor-ops` keeps the block 0.12.0 wrote: only `brain upgrade` changes it, and the case that follows the upgrade runs `brain upgrade` before its session.

Each session gets its own copy of that HOME, so no case sees what another wrote, and runs in its caller repo with:

- `HOME` the copy; `PATH` = `<run>/bin` (the package's `brain`, `node`, a `gh` that always fails), `/usr/bin`, `/bin`, `/usr/sbin`, `/sbin`: no global `brain`; `BRAIN_DIR` the copy's brain; Git without user or system config;
- **Claude Code:** `claude -p --output-format stream-json --verbose --no-session-persistence --setting-sources project,local --strict-mcp-config` with no MCP server, permission mode `dontAsk`, tools Read, Glob, Grep, Skill and Bash, Bash in Claude Code's OS sandbox writing only under the session's folder; Edit, Write, sub-agents and the web off. On macOS the login is in the keychain, which Claude Code finds through HOME, so the copy links `Library/Keychains` and nothing else of the real home;
- **Codex:** `codex exec --json --ignore-user-config -s workspace-write`, the session's folder the only writable root, no network, approvals never asked, and no login shell (a login shell's profile would put a global `brain` back on PATH);
- the agent's default model (each trace records it), and the prompt: the case's question, after "I'm working on `<task>` in this repo." when the case names a task, then one fixed line asking the reply to end with `Evidence:` and the ids it rests on. That line's ids are the answer's citations; a reply without it cites nothing.

Isolation is checked per session and reported: every brain command must have run on the session's brain, and Claude Code's init must show no MCP server and only built-in plugins. The skills Claude Code loaded are kept in `session.json`.

## The no-file-read check

`lib/classify.mjs` classifies every tool call:

| Class | What | Effect |
|---|---|---|
| `brain-cli` | a call of `brain` (or `node …/brain.js`); recorded with its category: `answer` (`query --candidates`, `query --read`, `recall`, `reflect --candidates`), `administrative` (eligibility §7: `status`, `index`, `lint`, `log`, `proposal list`, `repo`, `schedule`, `modules`, `config`, `sync plan`, `render` and `record`, `workflow`…), `write` (`apply`, `proposal`, `link`, `upgrade`…) | none |
| `brain-read` | Read, Grep, Glob, LS (Claude Code), or a shell command (both agents) that opens, searches or lists a path under the brain folder: absolute, relative (`../../brain`), through `~`, `$HOME` or `$BRAIN_DIR`, a redirection (`< file`), a `$(…)` substitution, or any program run while standing in the brain (`cd brain && grep -r …`); a program that only names a path (`echo`, `cd`, `basename`…) doesn't count | fails the session, and so the run (§12 item 4) |
| `product-read` | a brain path holding product files: `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, and `brain.json` | recorded, not a violation |
| `intake` | a brain path the caller names as the new input being taken in (§10); the cases name none | recorded, not a violation |
| `other` | anything else: the caller repo's own files, its linked skills | none |

A brain path written inside a longer word also counts: an interpreter's inline script (`python3 -c "open('…/brain/a.md')"`, `node -e …`), a here-document's body, or a `$(…)` whose output feeds another command (`cat $(echo …/brain/a.md)`; there even `echo` counts).

**Stated limit.** The check finds paths the call spells out: absolute, relative, or through `~`, `$HOME` or `$BRAIN_DIR` as the shell expands them. A path an interpreter builds at run time (`os.environ["BRAIN_DIR"] + "/a.md"`, joined strings, a path read from a file) is not found. The trace keeps every such call for a reader to see. The check is about the agent's tool calls. It does not judge what a `brain` command returned; that is what the cases score.

## What a session leaves

`<run>/<agent>/<case>/`:

| File | What |
|---|---|
| `trace.jsonl` | the agent's full event stream: every tool call with its input and output, every message |
| `reply.md` | the final reply |
| `session.json` | the prompt, model, exit, time, citations, every call with its class, the violations, the isolation check, the agent's token usage, the retrieval it received, and the outcome read after it |
| `stderr.txt` | the agent's standard error |

Everything kept is scrubbed: the run folder becomes `<run>`, the login folder `<agent-home>`, the home folder `<home>`, the user and host names `<user>` and `<host>`, UUIDs `<uuid>` and real e-mail addresses `<email>`, so a run can be committed past the leak check. Codex's model is read from its session file in the login folder; nothing else of that file is kept.

**Outcomes** (cases with `outcomes`, `created_forbidden` or `upgrade`) are read from the session's copy after it ends: each proposal's `status`, with the reason `brain apply` printed for it (else the file's `closed_reason`); each target note's text; the proposals the session wrote; and the upgraded repo's managed block, `current` when it equals what the package's `brain link` writes now (checked on a throwaway copy), with the hash of the text outside it.

**Token accounting (0074 §6).** Per session: the agent's own usage (Claude Code's `result.usage` and cost; Codex's `turn.completed` usage), and the brain output it received, in o200k tokens (the tokenizer `adapters/` installs): the opening pack (`recall --pack`'s `text`, against the 800-token budget) apart from later retrieval, and administrative output apart from both. `score.mjs` gets the case's phase cost.

## Results

`<run>/results.md` (and `results.json`) has:

1. **Identity:** the package file and sha256, `brain --version`, the commit it was built from, the harness checkout, the skills snapshot's name, version, integrity, fork commit and tag, the generator's output hash and whether it wrote `cases.json` as committed, each agent's version and model, the cases, the prompt and the timeout.
2. **Gates per agent:** critical trust, answerable, unknown (from `score.mjs`), the no-file-read check (every session clean) and isolation; `met` only when all hold.
3. **Token accounting** per agent: agent tokens and cost, wall time, opening packs against the budget, later retrieval.
4. **Failures** per agent: every failing case with each cause (`score.mjs`'s reasons, a brain-file read with its call, an isolation problem, a timeout).
5. **Sessions:** one row per session.

The results files are `results.md`, `results.json` and `run.json`; the session folders are the traces 0077 §5 keeps as evidence. What CC-186 commits, and where under `eval/memory-0.12/`, is its row's to say.
