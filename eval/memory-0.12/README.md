# Memory and recall evaluation for 0.12.0 (CC-165)

A fixed synthetic test set for decision [0074](../../decisions/0074-scoped-memory-handovers-and-bounded-recall.md) §6, written before any 0.12.0 code. It measures whether retrieval and answers respect trust rules, give answers the brain holds, and say so when it holds none. Every name, company and figure is made up.

| File | What it is |
|---|---|
| `world.mjs` | The synthetic world: areas, orgs, projects, sources, decisions, memories, linked repos and their task rows |
| `cases.mjs` | The cases, written against the world's keys |
| `make-brain.mjs` | Builds the brain and the linked repos, and writes `cases.json` with the keys resolved to ids |
| `cases.json` | The committed cases (generated; never edit by hand) |
| `score.mjs` | Runs one adapter on every case and prints the gates |
| `adapters/query-candidates.mjs` | The baseline: today's `brain query --candidates` |
| `adapters/reference-answers.mjs`, `reference-answers.json` | Hand-written correct answers: a check that the answer rules can be met |

## Run it

```sh
node eval/memory-0.12/make-brain.mjs /tmp/mem12            # writes /tmp/mem12/brain, /tmp/mem12/repos and cases.json
node src/cli.ts lint --brain /tmp/mem12/brain              # 0 errors
node eval/memory-0.12/score.mjs /tmp/mem12                 # the query adapter (default)
node eval/memory-0.12/score.mjs /tmp/mem12 --adapter reference-answers
```

`score.mjs` options: `--rows` prints every case, `--json` the full result, `--strict` exits 1 when a gate fails. The generator is deterministic: no clock, no randomness, ids are hashes of the entity keys, so two runs give identical bytes. It copies the product files (the AGENTS.md rules block, CLAUDE.md, the assistant sub-agent, the vendored skills) from this checkout, as `brain init` would, so the brain lints clean. Lint leaves warnings: memories written in a session have no `sources`, and `index.md` is not generated.

## The synthetic brain

- **Reach (0009).** Two areas (Client work, Studio operations) and three projects: Harbor (Velmor Freight, repos `harbor-api` and `harbor-web`), Orbit (Tandrel Health, `orbit-app`) and Quill (studio-operations, `quill`). `studio-site` is linked to the studio-operations area only, and `scratch` is a folder with no `.brain`, which sees only general memories. Memories cover all four scopes: general, area, project and stack (`node`, `postgres`, `react`, `react-native`, `sqlite`, `astro`).
- **Approval.** An approved memory is `lifecycle: reviewed`. An unapproved inferred memory is `lifecycle: draft` and is never eligible (one general, one Harbor, one Orbit). An approved inferred memory keeps `confidence: inferred` and its `^[inferred]` marker: approval does not make it verified (0074 §2).
- **Supersession and corrections.** Memory pairs (pnpm → npm workspaces, Friday freeze → Thursday 16:00, Postmark sandbox → SES sandbox) and decision pairs (Fly.io → Hetzner, Postmark → SES), each with both sides of the `supersedes` relation. Orbit's budget was corrected in Notion (`notion-edit` timeline entry).
- **Contested evidence.** Harbor's go-live date (two contested timeline entries, no current fact) and Orbit's offline-mode decision (`assessment: contested`).
- **Excluded evidence (0055).** The Harbor pricing call is a selected extract in two versions; version 2 drops paragraph 2 (a second-year discount) after its item became Meeting only, with an active record in `_suppressions/`. A decision and a memory rest only on that paragraph; two other decisions rest on paragraphs that stay, and remain eligible.
- **Work state for handovers.** Each linked repo has a `.brain`, a `brain-kit.json` (`tracked-in-repo`, a `pattern` source on `build/TASKS.md`, statuses `in progress`, `review`, `todo`, `done`; it passes `brain repo kit check`) and `build/TASKS.md`. Where work stopped is one `**Stopped:** <date>: done…; tried…; open…; next…` line under a row. One active row has no Stopped line, to test that unrecorded work is not invented. Which agent wrote each Stopped line and each memory is case metadata only (`handover`, `memory_writers`), never a note field. `brain.json` lists the repos with the kit's hash; their `path` is a placeholder (`~/memory-0.12-eval/repos/<name>`), because adapters pass the real folder.

## Cases

20 critical trust, 47 answerable and 10 unknown cases. Each names its caller (the folder whose `.brain` gives project, area and stacks), the evidence a correct answer cites, and the facts it must contain.

| Kind | Categories |
|---|---|
| trust | `approval` (3), `scope` (6), `exclusion` (3), `supersession` (4), `unsupported` (2), `inference` (2) |
| answerable | `paraphrase` (27), `current` (5), `correction` (4), `contested` (2), `handover-claude-to-codex` (3), `handover-codex-to-claude` (3), `later-session` (3) |
| unknown | `unknown` (10) |

Fields of a case in `cases.json`:

| Field | Meaning |
|---|---|
| `caller` | `{ repo, task?, agent? }`: the folder under `repos/` the question is asked from, the task row being worked on, and the agent asking |
| `handover` | `{ from, to }`: the agent whose session wrote the Stopped line, and the one continuing |
| `expected_evidence` | ids a correct answer cites. A note id, or `repo:<name>/build/TASKS.md#<task id>` for a task row |
| `forbidden_evidence` | ids that must never be returned or cited: unapproved, out of reach, excluded, or a trap from another project |
| `labelled_evidence` | `{ id, label }`: may appear only labelled `superseded` or `inferred` |
| `rank_above` | `[a, b]`: when both are returned, `a` ranks above `b` (live before superseded, 0009) |
| `facts`, `forbidden_facts` | `{ says, all: [regex…] }`: a fact is present when every regex matches the answer (case-insensitive) |
| `abstain` | the answer must say the brain does not hold the answer |

## Scoring rules

0074 §6 asks for retrieval and answers to be evaluated separately, so an adapter declares one level.

### Retrieval level (a ranked list of candidates)

| Kind | A case passes when |
|---|---|
| trust | no `forbidden_evidence` is returned; every `labelled_evidence` returned carries its label; every `rank_above` pair that is returned is in order |
| answerable | the trust conditions hold, **and** every `expected_evidence` id is returned (within the adapter's page; the query adapter uses 10) |
| unknown | no `forbidden_evidence` is returned |

A retriever can't state facts, so `unsupported` trust cases and abstention are tested only at the answer level; at the retrieval level they pass unless forbidden evidence comes back. A note returned with its excluded text blanked still counts as returned: excluded evidence must not reach the caller.

### Answer level (text and citations)

| Kind | A case passes when |
|---|---|
| trust | no forbidden evidence is cited; no `forbidden_facts` matches; every fact in `facts` is present; a cited `labelled_evidence` item is named as such in the text (superseded: "superseded", "previously", "replaced", "retired", "no longer"…; inferred: "inferred", "inference", "not verified"…); with `abstain`, the answer abstains |
| answerable | the trust conditions hold, **and** every `expected_evidence` id is cited, every fact is present and the answer does not abstain. A missed available answer is a failure (0074 §6) |
| unknown | the answer abstains; no forbidden fact matches; no forbidden evidence is cited |

An answer abstains when the adapter returns `abstained: true`, or its text says so ("not recorded", "no … is recorded", "no approved memory", "not in the brain", "unknown", "don't know"…; the exact pattern is `ABSTAIN` in `score.mjs`). Facts are regular expressions, so a failure can be a wording miss: read the failure line before blaming the system, and fix a case only with a reason in its PR.

### Gates

| Gate | Required |
|---|---|
| Critical trust | 100% of trust cases |
| Answerable | at least 90% of answerable cases |
| Unknown | reported separately, no threshold in 0074 |

Costs are reported per phase: `opening` (the pack at the start of work, budget 800 tokens) and `later` (targeted retrieval). An adapter reports `tokens` when it can count them; bytes and milliseconds are printed but are not a token count (0074 §3). The gates are never weakened, and cases are not dropped, to make a candidate pass (0074 §6).

## Adapters

An adapter is a module in `adapters/` whose default export is:

```js
{
  name: "…",
  level: "retrieval" | "answer",
  describe: "the command or method, as printed",
  run(testCase, env) → result   // may be async
}
// env:    { brain, callerDir, out }: the brain folder, the caller's folder under repos/, and the output folder
// result: retrieval: { candidates: [{ id, labels: ["superseded" | "inferred" | "contested"…] }], cost? }
//         answer:    { answer: { text, citations: [id…], abstained? }, cost? }
// cost:   { phase: "opening" | "later", tokens?, bytes?, ms? }
```

The interface names no command. A 0.12.0 recall adapter maps its output onto it: a pack's memories and work items become candidates (a work row's id is `repo:<name>/build/TASKS.md#<task id>`), its token count goes into `cost.tokens` with `phase: "opening"`, and a later search is a second adapter with `phase: "later"`. CC-166 defines those commands; no adapter for them is written here.

## Baseline

`query-candidates` runs `brain query --candidates <question> --limit 10 --types <default types plus memory> --repo <caller folder>`. Memory is added because the default types leave memories out. The query applies the restricted-evidence rule but not memory reach, approval or supersession ranking, and it does not read task rows, so it is not expected to pass. Its output at the commit that adds this README (timing varies by machine; the full output then lists each failing case and why):

```text
adapter: query-candidates (retrieval level)
runs: brain query --candidates <question> --limit 10 --types area,goal,project,person,org,meeting,decision,question,concept,reference,source,memory --repo <caller folder>
cases: 77

| gate (0074 §6) | required | result | met |
|---|---|---|---|
| critical trust | 100% | 4/20 (20%) | NO |
| answerable | at least 90% | 34/47 (72%) | NO |
| unknown (scored separately) | reported | 8/10 (80%) | — |

| kind / category | pass |
|---|---|
| trust/approval | 0/3 (0%) |
| trust/scope | 0/6 (0%) |
| trust/exclusion | 0/3 (0%) |
| trust/supersession | 2/4 (50%) |
| trust/unsupported | 2/2 (100%) |
| trust/inference | 0/2 (0%) |
| answerable/paraphrase | 26/27 (96%) |
| answerable/current | 3/5 (60%) |
| answerable/correction | 3/4 (75%) |
| answerable/contested | 2/2 (100%) |
| answerable/handover-claude-to-codex | 0/3 (0%) |
| answerable/handover-codex-to-claude | 0/3 (0%) |
| answerable/later-session | 0/3 (0%) |
| unknown/unknown | 8/10 (80%) |

cost (later retrieval): 77 calls, mean 4097 bytes and 165 ms per call; tokens not measured by this adapter (bytes are not a token count, 0074 §3)
cost (opening pack): not measured by this adapter
```
