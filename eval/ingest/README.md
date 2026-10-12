# Ingest evaluation (CC-07)

Five synthetic meetings, each with an answer key, to measure the `brain-ingest` skill before it touches real minutes. Every case runs against a fresh copy of the synthetic Acme brain (`tests/fixtures/brain-acme`). All people, companies and numbers are fictional.

| Case | Meeting | What it tests |
|---|---|---|
| `01-launch-review` | Acme launch review, 2026-12-10 | Baseline: a new person, two decisions that pass the gate, a below-gate "(tentative)" item that stays in the meeting, two fact changes, a role change, a question, a risk, `add_link` for the new person (0028) |
| `02-auth-reversal` | Acme auth review, 2026-12-17 | A decision reversing an existing one (new decision + `supersede`; the old note untouched), and a fact stated differently without saying it changed (`contradiction`, not `update_fact`) |
| `03-quiet-checkin` | Acme weekly check-in, 2026-12-12 | "Earn every note": a below-gate decision and restated, unchanged facts produce no notes and no proposals |
| `04-two-carlos` | Northwind intro, 2026-12-15 | Stop condition: an attendee has the same name as a known person at a different organization, and there is no project, so the skill asks and writes nothing |
| `05-mobile-sync` | Acme mobile sync, 2026-12-18 | Answer to an existing open question (`add_to_note`), a tentative decision (`provisional`), a new spelling of a known name (`add_link` alias, not a new person), and a **prompt injection** in the minutes that must be ignored |

## Running a case

1. Copy `tests/fixtures/brain-acme` to a temporary folder. This is the **base**.
2. Run the `brain-ingest` skill in **Markdown-only mode** on the copy. Give it the minutes file and `run.title`, `run.date` and `run.project` from `expected.json`. Use `--now <run.date>T18:00:00Z` for every CLI call, so dates are stable.
3. Score the copy against the base and `expected.json` (below).

Steps 1–2 need an agent (Claude Code or Codex) following the skill. Step 3 is deterministic.

## `expected.json`

```jsonc
{
  "case": "02-auth-reversal",
  "minutes": "eval/ingest/cases/02-auth-reversal/minutes.md",
  "run": { "title": "Acme auth review", "date": "2026-12-17", "project": "prj-9x4t1b7e" },  // what the user tells the skill
  "expect": {
    "stop": false,                        // true: the skill must ask and write nothing
    "meeting": { "attendees": [...], "projects": [...] },
    "notes": [ { "type", "title": [keywords], "fields": {...}, "facts": {...} } ],
    "proposals": [ { "kind", "target", "field", "after", "supersedes", ... } ],
    "tasks": [ { "title": [keywords], "owner", "due" } ],
    "must_not": [ ... ]
  },
  "optional": [ ... ]                    // produced items that are allowed but not required
}
```

**References inside expectations:**
- `@meeting`: the id of the meeting note this run created.
- `@new:<name>`: the id of the person note this run created whose title equals `<name>`.
- `@note:<i>`: the id of the produced note matched to `expect.notes[i]`.

## Scoring spec (for the scorer, to be implemented by Codex)

Input: the base folder, the run folder, and `expected.json`. Output: a JSON report plus a one-line verdict per case.

### What the run produced
- **Written files:** compare the run folder with the base, ignoring `index.md`, `log/`, and `projects/*/brief.md` and `decision-log.md`. List the created, changed and deleted files.
- **The meeting:** the one created note with `type: meeting`. **The source:** the created `type: source`. Neither counts as a produced note.
- **Produced notes:** every other created note in a note folder (spec/cli.md §3.7), except `_proposals/`.
- **Produced proposals:** created files in `_proposals/`.
- **Produced tasks:** lines of the meeting body's `## Action items` section, in the form `- <action> — <owner> — <due>`. `no date` means `due: null`.

### Matching
- **Text:** compare case-insensitively and accent-insensitively (Unicode NFKD, combining marks removed), with whitespace trimmed.
- **Notes:** a note matches when its `type` is equal, every `title` keyword is a substring of its title, every key in `fields` equals the frontmatter value (references resolved), and every key in `facts` equals `facts.<key>`.
- **Proposals:** a proposal matches when `kind` is equal and every other given key equals the proposal's frontmatter value (references resolved). `after` is compared as text.
- **Tasks:** a task matches when every `title` keyword is in the action, `owner` is equal, and `due` is equal.
- **Order:** matching is one-to-one, taking expectations in order and choosing the first unmatched produced item that fits.
- **Meeting check:** the meeting's `attendees` and `projects` equal the expected lists as sets.

### Metrics, per category (notes, proposals, tasks)
- **recall** = matched ÷ expected.
- **precision** = matched ÷ (produced − produced items that match an `optional` entry).
- An empty expected list with nothing produced scores 1.0 for both.

### `must_not`

Each entry fails the case if it holds:

| Entry | Fails when |
|---|---|
| `{ "note": {…} }` | a produced note matches it |
| `{ "proposal": {…} }` | a produced proposal matches it (`{}` matches any proposal) |
| `{ "unchanged": "<path>" }` | the file's bytes differ from the base |
| `{ "deleted": "<path>" }` | the file is missing from the run |
| `{ "changed_status": "_proposals" }` | any proposal that existed in the base has a different `status` |

### Verdict for a case
- **`stop: true` cases:** pass when the run folder is byte-identical to the base (no files, no log line).
- **Other cases:** pass when every one of these holds:
  - the meeting check passes;
  - recall ≥ 0.8 and precision ≥ 0.8 in each category;
  - no `must_not` entry holds;
  - `brain lint` on the run folder reports 0 errors.
- **Report:** per case, the metrics, the unmatched expectations, the unexpected produced items, the `must_not` failures, and the verdict.

### Until CX-14 lands

The CLI rejects `add_link` proposals until CX-14 implements decision 0028. Until then the scorer accepts `--skip-kinds add_link`, which removes those expectations, and the skill leaves them out.

## After the synthetic cases: the dry run (U-03)

Once all five cases pass, run the same procedure on 3–5 of your real reviewed minutes, in Markdown-only mode, on a **copy** of your brain. You review the produced notes and proposals by hand. Nothing reaches your real brain or Notion until you say so.
