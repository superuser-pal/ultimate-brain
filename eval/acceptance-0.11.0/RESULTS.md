# 0.11.0 acceptance: results (CC-67)

The blind runs of brain-reflect on 2026-11-08, on the fixture of [README.md](README.md). The skill was the fork branch `claude/CC-67-the-brain-reflect-skill` at 945d221, vendored with `vendor-skills.mjs --local` (snapshot `0.0.0-local`) on CC-67's product branch merged with CC-66's (#259, #260). The sub-agent text and the AGENTS.md row were in the same commit.

- **Installation:** `install.sh /tmp/cc67/i <commit>` packed that working tree and gave `installed: 0.11.0-rc.1`, with `vendored skills OK: ultimate-brain-skills 0.0.0-local`.
- **Sandboxes:** A, C and F were made with `make-sandbox.sh … 2026-11-08`, and B with `clean`. `check-planted.mjs` gave `planted OK: 21 clusters, 15 planted` on A and `planted OK: 0 clusters, clean` on B.
- **Runners:** one fresh Sonnet general-purpose sub-agent per session. Each got [harness/RULES.md](harness/RULES.md) with its sandbox filled in, its start, and the user's first message. The building session answered with the words below. It checked every result in the sandbox's files, its Git log and `brain reflect --candidates`.

**Verdict:** every acceptance line passes. No note changed without a yes. "later" wrote one pending proposal and nothing else. A report-only run and a nothing-found run wrote nothing. The fixes from the runners' notes (§3) went into the fork's second commit (2f9e80b), after these runs.

**The released text (1.4.0) was read against these results, not rerun.** The runs used fork commit 945d221. brain-v1.4.0 (merge commit 4df1d73, vendored here) differs from it in four files of `brain/`, 10 lines added and 9 removed, all wording: the fixes of §3 (2f9e80b: the report adds nothing around it, `seconds` from a kept start time, a stale value in the input's words, each `key=value` its own log argument), "no schedule for it yet" dropped from the guide (449321b, CC-159), and the review's two rules (90afda7: "Review rows" counts only "later" proposals still pending at "done"; a contradiction's tie-break ends on the lower id). None of them changes which findings a run shows, what a yes, later or skip writes, or what a nothing-found or report-only run writes, which is what the lines of §2 check.

## 1. Sessions

| Session | Sandbox | Start | User's words, in order |
|---|---|---|---|
| A1 | A | chat | `Tidy the brain.` · `more` · `yes 1, 8` · `1a. later 7, skip 9, yes 13` · `done` |
| A2 | A, after A1 | chat | `Tidy the brain again.` · `done` |
| B1 | B (clean) | chat | `Tidy the brain.` |
| C1 | C | `claude --agent ultimate-assistant` | `tidy the brain` · `done` |
| F1 | F | the Ultimate Assistant sub-agent | `The user asked: "Tidy the brain." report only` |

No runner called a Notion tool or `gh`. Every runner's first command was `brain status`, which named its sandbox's brain.

## 2. Acceptance

| Line (CC-67's row) | Result |
|---|---|
| Duplicate person shown as one merge finding naming the survivor; yes merges | **Pass.** A1 showed the duplicate pairs from all three runs as `Duplicate · T. Reyes and Tomás Reyes (people) …  a) merge T. Reyes into Tomás Reyes`, each pair once, with the reviewed note as survivor. "yes 8" wrote `merge` prp-922crsm2, approved in chat with fingerprint `merge:per-0b11e005+per-0b11e006`. The apply archived T. Reyes with `superseded_by`, and Tomás Reyes gained the alias `T. Reyes` (commit 39cff40) |
| Launch date moved by a later decision shown as a contradiction or stale fact; the brain asks which value holds | **Pass.** Both planted launch dates were findings 1 and 2, as `Contradiction · … · launch date 2027-04 here; the decision "Quarry website goes live in May" says 2027-05 / which holds? a) 2027-05  b) 2027-04  c) another value`. "yes 1" applied nothing and asked which holds. "1a" wrote `contradiction` prp-ww4e5dyp, decided `fix` with value 2027-05 in chat. `facts.launch_date` became 2027-05, and the 2027-04 entry became `superseded` (325d238) |
| A theme in four meetings is shown, and yes writes a draft learned Document in a Review notes row; two meetings show nothing | **Pass.** `Theme · pricing tiers · in 4 meetings …` was finding 13. "yes 13" wrote `knowledge/references/pricing-tiers.md` (`origin: learned`, `lifecycle: draft`, its four meetings in `sources`) and a pending `review_notes` with `theme:pricing-tiers`, `source` set to the newest meeting and all four in `evidence` (b94b19d). "onboarding survey", in two meetings, appeared in no run |
| "later" writes one Review row and changes nothing else | **Pass.** "later 7" wrote one pending `update_fact` (`stale:per-0b11e001:role`). Its commit df179f3 holds only that proposal and the log line. Notion isn't configured in the fixture, so the row is the pending proposal the next publish renders |
| 15 planted problems show 10, contradictions first, say 5 more; "more" shows them | **Pass.** A1, C1 and F1 each showed 10, in kind order (contradictions, stale facts, duplicates), then `5 more. Say "more".` In A1, "more" showed 11 to 15: the two promotions, then the three themes |
| A second run after skipping a duplicate doesn't show it | **Pass.** After A1's "skip 9", A2 didn't show BlueFin Labs, and `reflect --candidates` gave `held: 1`. Priya Shah's waiting row wasn't shown either: its fingerprint was in the cluster's `held` |
| Nothing found: nothing written | **Pass.** B1 showed `Nothing to tidy.` and stopped, with no commit, no proposal and no log line |
| From the Ultimate Assistant sub-agent, "tidy the brain" runs the skill | **Pass.** C1 started as `claude --agent ultimate-assistant` and read the agent file, which sent it to brain-reflect. It showed the same report and closed with one commit holding only the log line. F1, as a sub-agent with `report only`, returned the report as its whole answer and wrote nothing (still one commit, clean tree) |
| The skill mirror check passes | **Pass.** `tests/skills.test.ts` (`build-skills.ts --check`) passed with the vendored snapshot |

Judgment varied as planted.json allows. Lena Ortiz's role was a stale fact in A1 and C1, and a contradiction in F1. Each runner judged the noise clusters (mentions only) as no finding.

## 3. Findings from the runners' notes, and what changed

- **`seconds` was guessed** (A1 wrote 600; the session took about 130). The skill now keeps `date +%s` at step 2 and subtracts it at the log line.
- **Text added around the report** ("Nothing has been written yet", "That is all 15 findings"). The skill now says the report has nothing before it and nothing after the answer line.
- **A stale value for a role that ended** was worded by each runner on its own. judging.md now says to use the input's words, or the old value marked as past.
- **The log line passed as one quoted string** (A2 corrected it by hand). The skill now says each `key=value` is its own argument.
- **Not changed:** `mktemp -d` writes outside the sandbox (in RULES.md, not a skill problem), and `notes_read` is approximate when files are read in bulk (counted once, now said).
- **For the CLI, not this task:** after "1a" (the decision's value), the accepted entry's `source` is the decision, not `user-correction:<prp>`. schema §11.2's edit rule appends a `user-correction` entry when no timeline entry has the value. cli.md §6.2 attributes only "a value no claim holds" to the user, and the decision does hold it. Worth a look in CC-65's terms.
