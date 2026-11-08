# 0.11.0 acceptance: the reflection fixture (CC-67)

A synthetic brain with planted problems in its notes, for the blind runs of the skill brain-reflect (decisions [0052](../../decisions/0052-reflection.md), [0076](../../decisions/0076-reflection-chat-first.md); spec/cli.md §6.2). Every name is invented: a small studio run by "Robin Example", with two Areas, four orgs, eight people, three projects, two decisions and thirteen meetings. The brain has no Notion, so a run's publish at "done" is skipped; a "later" stays a pending proposal, the Review row it becomes at the next publish.

## Files

| File | What it is |
|---|---|
| [planted.json](planted.json) | The manifest: the 15 planted problems, each with the cluster `brain reflect --candidates` gives it, the finding the skill should judge and its fingerprint; and `not_flagged` |
| [harness/fixture.mjs](harness/fixture.mjs) | The world, written into a brain made by `brain init`, every date as days relative to `as_of`; `clean` writes it with nothing to tidy |
| [harness/install.sh](harness/install.sh) | An isolated installation of a commit of this checkout (0.10.0's, packing a given commit) |
| [harness/make-sandbox.sh](harness/make-sandbox.sh) | One sandbox: the brain (Documents on, lint free of errors, one commit) and `env.sh` |
| [harness/check-planted.mjs](harness/check-planted.mjs) | Checks a sandbox's clusters against planted.json |
| [harness/RULES.md](harness/RULES.md) | The rules a blind runner reads first (0.10.0's, with no Notion) |
| [RESULTS.md](RESULTS.md) | The results of CC-67's blind runs |

## Make a sandbox

```sh
sh eval/acceptance-0.11.0/harness/install.sh /tmp/ub-0110/i
sh eval/acceptance-0.11.0/harness/make-sandbox.sh /tmp/ub-0110/i /tmp/ub-0110/a "$(date +%F)"
. /tmp/ub-0110/a/env.sh; node eval/acceptance-0.11.0/harness/check-planted.mjs /tmp/ub-0110/a
```

`make-sandbox.sh <install dir> <new dir> [<as_of>] [clean]`. Make it at today's date (the default), so the 30-day window the CLI computes from the real clock is the fixture's. To try an unreleased skills snapshot, vendor it with `vendor-skills.mjs --local <fork checkout>`, write the working tree to a commit object (a temporary index, `git write-tree`, `git commit-tree`), and pass that commit to `install.sh`.

## What is planted

| Kind | Notes | Why |
|---|---|---|
| Contradiction | Harbor app; Quarry website | a project's `launch_date` (2027-01, 2027-04) against a decision in the window that says March, May (`shared_ground`, two references in common) |
| Contradiction or stale fact | Lena Ortiz | a meeting calls her art director, her role says designer, and nothing says it changed |
| Stale fact | Priya Shah, Omar Diaz, Ana Costa; Quarry website's budget | a meeting says the fact changed (left, promoted, joined; budget raised) |
| Duplicate | Tomás Reyes and T. Reyes; Bluefin Labs and BlueFin Labs; Jin Park and J. Park | a reviewed note and a draft with matching names, the same org or role |
| Promotion | Harbor app; the Clients Area | a lasting rule said in a meeting (a security review per release; a kickoff call within a week) |
| Theme | pricing tiers (4 inputs), design system (3), referral programme (3) | a term no note carries |

Not to be flagged: "onboarding survey", in two meetings only; and the other overtaken clusters (mentions only). The `clean` sandbox gives no cluster at all.
