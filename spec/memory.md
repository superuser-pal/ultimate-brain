# Memory, handovers and recall (contract, decision 0074)

The 0.12.0 contract for six capabilities: hot opening context, cross-session handover, durable capture, targeted recall, scoped and correctable memory, and reviewed promotion (0074 "Consequences"). It adds one command, `brain recall` (cli.md §5.33), and one setting, `settings.recall` (schema §12). Everything else reuses what exists: memory notes (schema "memory", 0008, 0009), `proposal new` and `apply` decided in chat (cli.md §5.6, §5.7, §5.14.4), the restricted-evidence rule (cli.md §5.13), linked repos and their `.brain` marker (cli.md §5.12, linked-repos.md). It adds no store, queue, index, service or dependency (0074 §5).

Both Claude Code and Codex follow this contract. Where their capabilities differ, §7 says how.

## 1. Three layers

| Layer | What it holds | Where it lives | Who writes it |
|---|---|---|---|
| Durable memory | Reusable preferences, constraints, lessons and the reasons behind choices | Memory notes, `memories/YYYY/MM/` (schema "memory") | The closing review (§3), with the user's yes |
| Work handover | Where work stopped, what was tried, open questions, the next action | The repo's own task records (§4) | The agent, in the records the repo already has |
| Hot context | A small selection of the two above for the next session | Nowhere: `brain recall --pack` computes it on every call (§5) | Nobody; it is never stored |

A handover is not copied into a memory, and a memory is not a task list (0074 §1). Hot context is never evidence: an answer cites the memory or the record, never the pack.

## 2. Eligibility (normative)

A memory is **eligible** for a caller when all of these hold:

1. Its `lifecycle` is `reviewed`. A `draft` memory is not approved (§3.3); `disputed` and `archived` are not eligible.
2. Nothing supersedes it: it has no `superseded_by` relation (schema §6).
3. Its reach includes the caller (0009, §2.1).
4. The restricted-evidence rule (cli.md §5.13) leaves it in: a memory that rule leaves out whole is not eligible. A memory with `sources` is not eligible either when that rule leaves out **every** one of them (a source it leaves out is no evidence, as `reflect` reads it, cli.md §5.32), since nothing then supports it (0055). A memory with no `sources` is judged on its own text.

### 2.1 The caller and reach

The caller is the folder the command runs for: `--repo <path>`, else the current directory. Its identity is the `.brain` marker in that folder, the repo's root, where `brain link` writes it (cli.md §5.12): `project`, `area`, `stacks`. A folder with no `.brain` has no project, area or stacks.

Reach follows 0009, default deny:

| Memory `scope` | Reaches the caller when |
|---|---|
| `general` | always |
| `project` | the caller's `project` is in `projects` |
| `area` | the caller's `area` is in `areas`, or the caller's project's `area` is |
| `stack` | the caller's `stacks` and the memory's `stacks` share one |

A caller never widens the reach the writer declared. The brain itself, run with `--repo` naming the brain or with no `.brain`, is a caller with no project, area or stacks: only `general` memories reach it.

### 2.2 Labels

Every memory the CLI returns carries `confidence` (schema "memory"). `inferred` and `unverified` are shown with that word beside the text, every time. Approval does not change `confidence`: an approved inferred lesson stays `inferred` (0074 §2).

## 3. Durable capture: the closing review

### 3.1 When

- **"Wrap up"** (or the user's own words for it, such as "let's close", "end of session"): the agent runs the closing review. This is the rule in both agents.
- **"Remember this"**, at any time: the agent shows that one candidate (§3.2) and asks.
- **Immediate suggestion:** only when forgetting it would change the current work materially; at most once per subject per session (0074 §2).
- **Claude Code's offer** at the end of a task is a convenience: the agent may offer the review once ("Want me to save what we learned?"); declining ends it. Codex has no such offer (§7).

### 3.2 What the agent shows

At most **five** suggested candidates, chosen in this order: reusable constraints, then decisions with their reasons, then costly lessons. When there are more, the agent says how many. Every candidate the user asked for with "remember this" is shown as well, beyond the five.

Each candidate shows:

- the text, one to three sentences;
- its reach (`scope` and its list), the **narrowest** the user's words support. A project instruction stays a project memory. Only explicit general wording ("always", "in every repo") supports `general`;
- `inferred`, when the user didn't say it in those words, with one to three examples from the session that support it;
- the memory it would supersede, when one is eligible and says something different (§6).

A one-off event is not a candidate; it belongs in the work record (§4).

### 3.3 The answers and what each writes

| Answer | Writes |
|---|---|
| yes | `proposal new` with a `new_item` memory note, then `apply` decided in chat. The memory is written `reviewed` (cli.md §5.7 `new_item`). Decided in chat, it never becomes a Review row (cli.md §5.14.4) |
| yes, with an edit | The same, with the user's text or reach |
| no, or later | Nothing. A candidate isn't kept: when the session's evidence recurs, a later closing review may show it again |

There is no waiting list of candidates: 0074 §2 allows no parallel approval queue, and a memory is approved or it doesn't exist. A `draft` memory (one written by `note new` some other way, or before 0.12.0) is not eligible (§2) until something reviews it. Memories never reach Notion (0008), so none of this has a Notion step.

The closing review, "remember this" and the "wrap up" phrase are a section of the `brain-query` skill, which every linked repo has (cli.md §5.12). It is written in the skills fork and arrives as a released snapshot (skills-delivery.md §9.5), in a build task after this contract.

The memory's frontmatter: `scope` and its list (schema "memory"), `confidence` (`verified` when the user stated it, `inferred` otherwise, `unverified` when the user doubts it), `origin` (the caller's `.brain` `repo`, or `brain` when there is none), and `sources` when it comes from notes or inputs the brain holds.

## 4. Work handover

A handover points at the records the repo **already has**. No new file type, and nothing about work state is copied into the brain (0074 §1; the user's answer to CC-166's question 1).

### 4.1 The records

| Record | Where | Read by |
|---|---|---|
| Task rows | The repo's task source as its link kit names it (`brain-kit.json` `tasks.source`, linked-repos.md §2.1, §2.4) | `brain recall --pack` (§5), for a `markdown` source; the agent itself, for `github` and `gitlab` |
| Open pull requests and branches | Git and the forge | The agent, with `git` and `gh` when it has them; the pack names the active task ids so the agent knows which to look for |
| The task's own notes | The lines under its row (a `**Stopped:**` line, below) or its issue comments | The agent, when it reads the row |

### 4.2 Recording where work stopped

At "wrap up", and before leaving unfinished work, the agent writes **one** `**Stopped:**` line under its task row (or one comment on its issue): the date, what is done, what was tried and failed, open questions, and the next action. A later `**Stopped:**` line replaces the earlier one. Work the agent didn't record is never invented by the next session: an interrupted session resumes from the last recorded state (0074 §1).

This line is the repo's record, written under the repo's own rules. In a repo whose rules forbid it (a task file the agent doesn't own, for example), the agent says so in its summary instead and writes nothing.

## 5. Hot context: `brain recall --pack`

Opening recall runs only when `settings.recall` is `opening` (schema §12) **and** the caller's folder is linked: it has a `.brain` (cli.md §5.12). When either is missing, the skill runs nothing, and the command, run by hand, still works.

### 5.1 Selection (normative)

1. **Memories:** the eligible ones (§2), ranked by 0009: `project`, then `area`, then `stack`, then `general`; within a level, by relevance to `--task` when given (§5.4), then by `updated`, newest first, then by `id`.
2. **Work:** when the caller's folder has a `brain-kit.json` whose `tasks.mode` is `tracked-in-repo` and whose source is `markdown`, the items of that file whose status meaning is `in_progress` or `review` (the kit's `status_map` over §2.4's defaults, linked-repos.md §2.4), in file order. Each is its item key, title, raw status, and its **stopped line**: the first line after the item's line, before the next item or heading, that starts with `**Stopped:**`, without that prefix, trimmed to 300 characters. Without such a kit there is no work section, and the agent reads its task records itself (§4.1). A kit that isn't valid (linked-repos.md §2) or a task file that can't be read leaves `work` empty and sets `work_unread` to that file's repo-relative path (else `null`); it is no error, since the memories still help.
3. The pack holds work first, then memories, each whole, in that order, while the next item fits in the budget (§5.2). An item that doesn't fit is left out whole, never cut; the items after it are still tried. Every left-out item is counted in `omitted`.

### 5.2 The token budget

The budget is **800 tokens** by default (`--budget <n>`, an integer from 200 to 4000), for the whole delivered text: the framing lines and every item (0074 §3).

The CLI counts with a fixed estimate: **tokens = ⌈UTF-8 bytes ÷ 3⌉**, summed over the delivered `text`. The estimate is a guard, not evidence (0074 §3): the **measured** count decides. The evaluation (CC-165, CC-167) measures every delivered `text` with one named tokenizer and reports both numbers; the measured count must stay within the budget. If it ever doesn't, the divisor gets smaller, never the budget larger (0074 §6).

### 5.3 Output

```json
{ "ok": true, "data": {
  "caller": { "repo": "acme-api", "project": "prj-9x4t1b7e", "area": "area-2m7c4h8n", "stacks": ["supabase"] },
  "budget": 800, "tokens": 412,
  "work": [
    { "task": "CC-12", "title": "Retry the import", "status": "in progress",
      "stopped": "2026-11-07: parser done; the date test fails on leap years; next: fix it", "source": "build/TASKS.md" }
  ],
  "memories": [
    { "id": "mem-3k8d2m4q", "text": "acme-api: ask before running migrations; the prod database is shared.",
      "scope": "project", "confidence": "verified", "updated": "2026-10-30", "path": "memories/2026/10/2026-10-30-acme-api-migrations.md" }
  ],
  "omitted": { "memories": 3, "work": 0 }, "work_unread": null,
  "text": "Brain context for acme-api (prj-9x4t1b7e). Work: …"
} }
```

- `text` is what the agent reads at the start: one framing line, then the work lines, then one line per memory (its text, then `(inferred)` or `(unverified)` when so). The `tokens` count is over `text`.
- `memories[].text` is the memory's `summary`, else its body's first paragraph, trimmed to 300 characters at a word boundary. The pack never expands a memory in full (0074 §3).
- With no eligible memory and no active work, `text` is empty, `tokens` is 0, and the skill says nothing.

### 5.4 Relevance

`--task "<text>"` ranks memories within a reach level by the token overlap between the task text and the memory's text, with cli.md §5.13 step 1's tokens and stopwords; ties keep the §5.1 order. Without `--task`, there is no relevance step.

### 5.5 How the agent uses it

The agent reads the pack silently. It mentions a memory only when it shapes the approach, in one line with its origin ("Using your rule from acme-api: ask before migrations"). It never recites the pack (0074 §3). When the pack says `omitted`, and a decision needs more, the agent searches (§6.1); it never assumes the pack is complete.

## 6. Targeted recall and correction

### 6.1 `brain recall --search "<query>"`

`brain recall --search "<query>"` returns compact results over the **eligible** memories (§2), ranked like `brain query --candidates` (cli.md §5.13, the same scoring), at most `--limit` (default 10, at most 50). Each result has the same fields as a pack memory, plus `score`. `--include-superseded` also returns memories that something supersedes, each marked `superseded_by`, after the eligible ones; drafts and memories outside the caller's reach are never returned. Knowledge about the world is still `brain query --candidates`; neither command expands a note in full. The agent reads a note's file only when a decision needs it.

### 6.2 Correction and supersession

- **A conflicting instruction** applies to the current task only, by default. Nothing is written. At "wrap up", when the distinction matters, the agent asks whether it should change the lasting rule (0074 §4).
- **"From now on", or a yes at that question:** the closing review shows a candidate that supersedes the old memory. Its yes writes the new memory (§3.3), then a `supersede` proposal decided in chat (schema §11.2): the old memory gets `superseded_by` and `lifecycle: archived`, the new one `supersedes`. The old file stays.
- **No expiry:** no date makes a memory ineligible. When newer evidence challenges an eligible memory, the agent says so and offers the supersession; it doesn't drop the memory silently.

### 6.3 Promotion

A memory that turns out to be knowledge about the world is promoted by a reviewed step: a `new_item` proposal for the knowledge note with `relations: [{ type: derived_from, target: <mem id> }]`, decided like any other. The memory gets no edit: its link is the computed `used_by` (schema §6). Promotion is never automatic.

## 7. Agents and opt-in

| | Claude Code | Codex |
|---|---|---|
| Opening recall | The `brain link` instruction block tells the agent to run `brain recall --pack --json` before substantive work and read its `text` (cli.md §5.12) | The same block, the same rule |
| Closing review | "Wrap up", plus the optional offer (§3.1) | "Wrap up" only |
| Remember this | Both, any time | Both, any time |

- **Opt-in:** `settings.recall` is `off` by default. Setup asks once whether to turn it on (`brain config set settings.recall '"opening"'`). Turning it on or off changes nothing until `brain link` runs again in each repo, which then adds or removes the block's recall paragraph. Nothing is installed globally: no hook, no user-level setting, and no repo the user didn't link (0074 §3). A Claude Code `SessionStart` hook could run the pack without the agent's step; it is left out of 0.12.0 because `brain link` would have to merge the repo's `.claude/settings.json`.
- **Connected workflows** (connected-workflows.md): a repo running a connected workflow without a `.brain` gets no recall, whatever the setting.
- **No cache:** `brain recall` reads the files on every call. A change to approval, reach, exclusion, correction or supersession takes effect on the next call, with nothing to invalidate. A later index must be rebuildable from the files and must never return what §2 excludes (0074 §3).

## 8. The evaluation adapter (CC-165)

The evaluation set's adapter maps its cases to these commands:

| Case kind | Command | What is scored |
|---|---|---|
| Opening (agent switch, later session) | `brain recall --pack --repo <case repo> [--task …]` | the expected memories and task rows are in `memories` and `work`; nothing §2 excludes is; `tokens` ≤ budget, and the measured count too |
| Targeted recall | `brain recall --search` | expected evidence ids in the results |
| Knowledge question | `brain query --candidates` | as in 0.11.0 |
| Answer | the agent's answer from those results | 0074 §6's gates: correct, complete enough, cited; inference labelled; unknown stays unknown |

Errors are cli.md §5.33's: `USAGE` for every bad call, a `--repo` that isn't a folder and an invalid `.brain` included, and `SUPPRESSIONS_UNREADABLE`.
