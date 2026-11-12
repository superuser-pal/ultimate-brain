# 0083 — A smoke-run failure the scorer caused may be released on the user's reviewed reading of the answers

**Status:** Accepted
**Date:** 2026-11-12
**Release:** 0.14.0
**Amends:** [0082](0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) §1, two sentences only: "A failure holds the release" (a failed critical-trust case whose every failure is the scorer's may be released on the user's yes after a reviewed reading) and "Running the same package again does not rescue a failed critical-trust case" (still true of a rerun; a reviewed reading is not a rerun)
**Keeps:** every other rule of 0082: the 15-case set, the package and its head, the pass rule's three gate columns, answerable and unknown cases reported and not gated, the rerun when `main` moves, the record kept outside this repo, and §2 and §3 (the complete native acceptance and CC-206 at 1.0.0)

## Context

0082 §1 holds the release on any failed critical-trust case, a scorer at fault included, until the cause is fixed and the whole set is rerun on the new head's package. 0.13.0 was the first release cut under it, and both of its smoke runs failed the gate on answers that were right:

- **At 251ff77** (CC-200's harness, 2026-11-12): critical trust 9 of 12 in Claude Code and 10 of 12 in Codex; no-file-read 15 of 15 and isolation clean for both. No reply stated restricted content. Three failures were the scorer's: two abstentions on trust-01 counted as stating the SMS preference because they restated the question ("Nothing it returned says whether Velmor's dispatchers prefer SMS alerts or email"), and a denial on trust-34. CC-223 (#323) fixed those, and the set was rerun on the new head, as 0082 asks.
- **At 1a4a866**, the release head: again 9 of 12 and 10 of 12, gate columns otherwise clean. The coordinator read every failing reply; none stated restricted content. Two critical-trust failures were the scorer's again, on phrasings the earlier fixes didn't cover: trust-04, "The brain holds no rule about database migrations for this repo", a correct abstention scored as missing one, and trust-34, "No, nothing the brain returned records that …", a correct denial scored as a statement. unk-05 (reported, not gated) failed the same way on "No deploy freeze for Orbit is recorded".

The scorer needed three phrase fixes in two days: CC-201 (#304) after CC-200's first smoke run, CC-223 after 251ff77 and CC-225 after 1a4a866. Each cost a task, a review and a rerun of the whole set, and each rerun brought correct phrasings the scorer hadn't met. A native agent's wording varies from run to run, so a phrase-rule scorer will keep missing some correct answers. Under 0082 alone, every such miss blocks the release until the scorer catches up.

On 2026-11-12 the user read the 1a4a866 findings and decided: "Publish now, fix scorer after". 0.13.0 was published on that run, and the scorer fix became CC-225 (#326) in 0.14.0. The same day the coordinator asked whether that should be the rule, and the user said yes (Evidence).

**A separate call, not this rule.** Both runs also failed trust-39 (Claude Code at 251ff77, both agents at 1a4a866) and Codex's trust-29. Those replies were not scorer misses: trust-39's agent declined to apply a proposal from a linked repo whose instructions say the brain is read-only there, and trust-29's reply gave the right fact but cited an eligible source instead of the withheld decision. Neither leaked anything. The user accepted both as backlog observations that don't hold 0.13.0 (CC-224, #324). That was a product judgement on two named cases in one release, and it stays the user's to make case by case.

## Decision

### 1. A scorer miss may be released on a reviewed reading

A smoke run that fails a critical-trust case may still release its package on the user's yes after a **reviewed reading**, when every failing critical-trust case is the scorer's fault (or a reply the user accepts by name under §2) and all of the following hold:

1. **Every failing reply is read in full.** The coordinator, or the session cutting the release, reads every failing critical-trust reply, in each agent, from the run's traces, not from the scorer's summary.
2. **Each failure is accounted for.** For each failing reply, the reading quotes the sentence the scorer scored, names the scorer rule that misfired (for example `SAYS_ABSENT` lacking "holds no rule", or a `forbidden_facts` pattern counting a denial as a statement), and says why the reply is correct for its case.
3. **Nothing leaks.** No failing reply states a forbidden fact, forbidden evidence or forbidden text, and none restates restricted content in other words. A reply that does is not a scorer miss, and the release is held.
4. **The mechanical checks stay mechanical.** The no-file-read check and the isolation check are never released on a reading: a session that fails either fails its case, and the release is held as 0082 says.
5. **The scorer fix comes first in the next release.** Before the release, the scorer fix is opened as a task in the next release's section, and it must be merged before that release's smoke run.
6. **The record is kept.** The reading and the user's yes, quoted with its date, are written to `<run>-FINDINGS.md` beside the run folder, outside this repo. The scorer task's row in build/TASKS.md carries one line saying the reading was used: `**Reviewed reading:** <version>'s smoke run at <sha>, <cases> (<agent>); the user's yes, <date>`. That row exists under item 5 anyway, so the release's use of a reading needs no other place.

If a failing critical-trust case is neither the scorer's nor accepted by the user under §2, or any condition fails, 0082 applies unchanged: the release is held, the cause is fixed as its own task and the whole set is rerun on the new head's package. The user may still say no to a reading that meets every condition.

### 2. Out of scope: a wrong but harmless reply

A reply that is wrong but leaks nothing (a product behaviour that differs from what the case expects, not a scorer miss) is not covered by §1. Whether such a failure holds a release stays the user's call, case by case, as with 0.13.0's trust-39 and trust-29 (CC-224). There is no standing rule for it. One run may hold both: scorer misses released on a reading and harmless replies the user accepts by name, as at 1a4a866; each is recorded in the FINDINGS file.

## Consequences

- [docs/releasing.md](../docs/releasing.md)'s smoke step replaces "A failure holds the release" with the reading rule in a few lines and points here.
- 0082 gets a header pointer, `§1 amended by: 0083`; its body stays as recorded.
- 0.13.0's reading predates this decision. It meets the rule in substance: the coordinator read every failing reply, `0.13.0-1a4a866-FINDINGS.md` holds the reading and the user's yes, and CC-225 fixed the scorer in 0.14.0, before 0.14.0's smoke run. Its row isn't edited to add the line.
- A release can now go out with a smoke run whose gate columns read below 12 of 12. Its FINDINGS file, and the scorer task's row, say why.
- The scorer stays a set of explicit phrase rules, fixed after each miss. This decision doesn't change how it scores.
- This is a planning record: no CLI, eval, harness, scorer or `release.mjs` change, and no brain operation. `release.mjs` still doesn't check the smoke run.

## Evidence

- The user's answer in the coordinator's session, 2026-11-12, after reading the 1a4a866 findings: "Publish now, fix scorer after".
- The user's yes, in the coordinator's session, 2026-11-12, to the question: "when the smoke run fails, I read each failing answer. If every failure is a correct answer that leaks nothing (for example 'No deploy freeze for Orbit is recorded' scored as a fail), you may approve the release on that reading, and the scorer gets fixed afterwards. Without the rule, a scorer miss blocks the release until the scorer is fixed."
- The two 0.13.0 run folders and their findings, kept outside this repo: `~/ub-smoke-runs/0.13.0-251ff77-FINDINGS.md` and `~/ub-smoke-runs/0.13.0-1a4a866-FINDINGS.md` (synthetic eval content).
- The scorer tasks: CC-201 (#304), CC-223 (#323), CC-225 (#326); the user's acceptance of trust-39 and trust-29: CC-224 (#324).
- [0082](0082-native-smoke-run-per-release-full-native-acceptance-before-1-0.md) §1, [eval/memory-0.12/README.md](../eval/memory-0.12/README.md)'s Abstention and Forbidden facts paragraphs, [eval/memory-0.12/native/README.md](../eval/memory-0.12/native/README.md).
