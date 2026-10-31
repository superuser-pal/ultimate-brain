# 0051 — Unattended catch-up and schedules

**Status:** Accepted
**Date:** 2026-10-29
**Amends:** 0003, 0037 · **Refines:** 0045
**Later amendment:** [0058](0058-acceptance-is-current-as-of-the-click-minute.md), 2026-10-31, says what "exact and current" accepted wording means for an unattended import.

## Context
The brain pays back only when it runs regularly, and today every catch-up waits for the user to say "catch up" and then for their answers (0037). reviews/07 found that Hermes, or any scheduler, could run the brain's skills, and that the one piece missing on our side is **an unattended mode for catch-up**. reviews/08 read a third-party vault "operator" that runs on cron with no questions: budgets per run with the rest queued, a run with nothing to do that writes nothing, a fixed report, failures logged and skipped, and a setup that schedules the run itself. The user agreed the shape below in a grill on 2026-10-29.

## Decision
### Catch-up can run unattended, in one turn, on defaults
- **The same skill, started with "catch up unattended"** (the prompt a schedule runs). It runs the read-only pass as today, then, instead of asking:
  - **An input with a blocker** (a pre-check question, a sync conflict, a What to fix it can't read, a likely new version) is **skipped whole** and listed under Needs you. It waits for the next attended catch-up; nothing is lost.
  - **A choice with a default** takes it: every attachment and repo file selected, keep as document **no**, Ask rows answered with a report. The identities question is skipped.
- **It applies the user's explicit decisions, and interprets none (amends 0003):**
  - **Applied:** a Review row the user set to Approve or Reject, an Edit with a value, and the user's corrections in Notion (a Status, a note set to Reviewed). The user decided them word for word; the run only carries them out, so an approval on Tuesday shows in the notes and Briefs on Wednesday morning.
  - **Waits for the next attended catch-up:** a Fix whose What to fix needs reading ("a: March, and drop c"), and an Approve whose What to fix narrows it ("all except b"): turning words into changes is the agent's judgment, which nobody would check. The report says "1 Fix waiting for you".
  - **Never:** an unattended run decides nothing itself. New notes as drafts, proposals, sources and Documents are additions and go in as usual.
- **Publish only when `settings.publish` is `auto`.** With `ask` (the default), an unattended run commits and pushes (`settings.push`) and leaves the publish to the next attended run.
- **The 5-minute bar (0043) is for attended runs.** An unattended run has a budget instead.

### A budget of inputs per run
- **`settings.unattended.max_inputs`, default 10:** meetings, Inbox rows and files together, oldest first. The rest is named in the report and waits for the next run.
- **Why 10:** a typical target user gets about 5–8 inputs a day (2–4 meetings, 2–5 captures), a heavy one about 15. Twice a day, 10 covers the heavy case; once a day, the typical one. The cap mainly guards the first run after a schedule is turned on, which can find dozens of inputs waiting.
- **Backlog warning:** when inputs were left over in 3 unattended runs in a row (read from the operation log), the report says "Backlog growing: run more often or raise the budget."

### A run with nothing to do writes nothing
- **No commit, no Notion write, no log line** when nothing is waiting, so a schedule leaves no noise.

### Where the run reports
- **The usual short report goes into the operation log** (0045's counts: notes read, duration).
- **One Inbox Report row** ("Catch-up 29 Oct: 2 meetings in, 1 needs you") **only when something needs the user or failed, and only when the Reports module is on.** A run that went well and needs nothing writes no row.
- **With Reports off (the default, 0048), no row:** what needs the user already waits where they would act on it (a skipped meeting stays Reviewed, a skipped Inbox row stays Ready, a Fix stays in Review). The next attended catch-up opens with a summary of the unattended runs since the last one, read from the log: "Since last time: 4 scheduled runs, 6 inputs in, 1 skipped, 1 Fix waiting, 1 failed: Notion login". The core space gains nothing.
- **When the user sets a schedule with Reports off,** the skill offers once: "Turn on Reports to get a row in the Inbox when a scheduled run needs you?"
- **A Notion failure** (an expired MCP login) can't be reported in Notion at all; it is in the log and in that opening summary.
- **A step that fails is logged and the run goes on** with the next input, as attended catch-up already does with a blocked input.

### Schedules
- **The skill's "Run on a schedule" section** (brain-catch-up, and brain-reflect, 0052) writes the settings and installs the schedule when the user says "run catch-up every morning".
- **`brain schedule install`** writes the scheduler entry, so nobody writes a launchd file by hand: on macOS a launchd agent that runs `claude -p "<prompt>"` in the brain folder at the chosen times; elsewhere it prints the cron line. `brain schedule list` and `brain schedule remove` go with it.
- **Supported first: local `claude -p`.** It is the only scheduler that sees every input: the drop folder, linked repos and the user's local Notion MCP. Hermes is documented as possible (reviews/07). Claude Code's cloud schedules run on a fresh clone without those, and stay out until checked.
- **A schedule pins a Claude model:** the skills are tested on Claude models only (reviews/07).

## Consequences
- **Amends 0037:** catch-up asks one batch of questions **when the user is there**; on a schedule it asks none.
- **Amends 0003:** "Unattended runs may only add notes and flag; they never apply proposals" becomes: unattended runs add notes and flag, apply only the user's explicit decisions (Approve, Reject, Edit with a value, corrections), and never interpret a What to fix or decide anything themselves. `--record-only` stays for runs that must not apply at all.
- **Refines 0045:** a Fix still means "apply it, corrected as I wrote in What to fix", and is applied by the next attended catch-up; an unattended run leaves it as it is and names it in the report.
- **Keeps 0048:** the Report row is part of the Reports module; the core space is unchanged.
- **Keeps 0043:** the 5-minute bar is unchanged for attended runs.
- **New settings:** `settings.unattended.max_inputs`. **New CLI:** `brain schedule install | list | remove`.
- **The setup pattern that reads first, probes connectors and asks only the gaps** goes into the v2 Onboarding suite, not into 0.7.0.
- **Built in 0.7.0** (CC-62 to CC-64), after U-19 has shown 0.6.0's catch-up is stable; tried on the user's brain in U-20.

## Evidence
- reviews/07-hermes-and-search.md §2 ("What the product would need", item 1).
- reviews/08-operator-and-optimizer.md §1 (Operator), §2.
- docs/v2-ideas.md: "Schedulers", "Hermes as an always-on brain operator".
