---
name: brain-apply
description: Apply the user's decisions on proposed changes to the brain. Shows pending proposals in chat and applies what the user approves, rejects or edits, or reads the decisions and Notes the user left in the Notion Review queue and applies them, then rebuilds and republishes. Use when the user says "apply my reviews", "what needs my decision", "approve the launch change", "apply the Review queue", or after deciding proposals in Notion.
---

# Apply review decisions

Proposals are changes the brain wants to make to existing notes (decision 0003). The user decides each one: approve, reject, or edit (edit means approve, but with the user's own value). This skill records those decisions and applies them through the CLI. Only the user decides. Never approve, reject or edit on their behalf, and never infer a decision from the minutes or from earlier chat.

Run every CLI command as `brain <command> --brain <brain> --json`. Exit 1 means some items need attention; read them. Exit 2 or 4 means your command or input was wrong: fix it. Exit 3 or 5 means stop and report. Exit 10: report a bug. If `brain` is not found (`command not found`), install it with `npm install -g ultimate-brain`, then retry.

## Pick the mode

- **Chat:** the user wants to decide here ("what needs my decision?", "approve the budget change"). Use this, or when Notion is not configured.
- **Notion:** the user decided in the Notion Review queue ("apply my reviews"), and `brain status` shows `review` among `notion.configured`.
- **Unattended** (a scheduled or background run, nobody in the chat): Notion mode with `--record-only`. Decisions are recorded but **never applied** (0003); the next attended run applies them.

## Chat mode

1. **List.** Run `brain proposal list --status pending,approved,edited,rejected`. `approved`, `edited` and `rejected` ones were decided earlier but not yet applied.
2. **Show** the pending ones as a numbered list, one line each, in words the user can judge without opening files:
   `3. Acme website: budget 80000 EUR → 95000 EUR. "Budget raised to 95000 EUR to cover the CMS licence." (Acme launch review, 10 Dec)`
   For each kind:
   - `update_fact`: old → new value.
   - `contradiction`: both values, and say approving keeps both as contested, while editing picks the true one.
   - `add_to_note`: the text to add.
   - `add_link`: what gets linked to what. A grouped row lists every link, lettered: "Acme website: add a) Lucía Fernández, b) Tomás Vidal to People, c) alias 'acme site'".
   - `supersede`: the new note replaces the old one.
   - `merge`: the duplicate is folded into the survivor.
   - `new_item`: the note that would be created.

   Look up titles with `brain index --json` instead of showing ids. Mention the ones already decided but not applied.
3. **Ask** which to approve, reject or edit. Accept replies like "approve 1 and 3, reject 2, edit 4 to 90000 EUR". Edit is only possible for `update_fact`, `contradiction` and `add_to_note`; say so if the user asks to edit another kind. On a grouped `add_link`, "approve 5 except b" approves it with those links excluded. **If a reply is unclear, ask again.** Don't guess.
4. **Apply.** Write the input and run `brain apply --input <file>`:
   ```json
   { "decisions": [
     { "proposal": "prp-…", "action": "approve", "decided_at": "<now, ISO 8601 UTC>", "decided_by": "chat" },
     { "proposal": "prp-…", "action": "edit", "value": "90000 EUR", "decided_at": "<now>", "decided_by": "chat" },
     { "proposal": "prp-…", "action": "approve", "exclude": [ { "field": "people", "value": "per-…" } ], "decided_at": "<now>", "decided_by": "chat" }
   ] }
   ```
   To apply only what was decided earlier, run `brain apply` with no `--input`.
5. Continue with **Finish** below.

## Notion mode

1. **Read** the Review database through the Notion MCP: the rows where **Decision** is set and **State** is Pending. Normalize each row into the snapshot format of spec/cli.md §5.14.1:
   - `database: "review"`, the `page_id` and `last_edited`;
   - the properties Name, Kind, Decision, Note, State and Brain ID.
2. **Plan.** Run `brain sync plan --input <snapshot>`. It writes nothing. Save the reply's **`data` object** (not the whole JSON reply) as the plan file; `sync apply` rejects the full reply. Read:
   - `decisions`: what will be applied;
   - `conflicts`: `NOTE_TO_READ` is an Approve or Reject with a Note: read it as "Reading a Note" below says. Others the user fixes in Notion: `EDIT_WITHOUT_VALUE` (Edit with an empty Note), `EDIT_NOT_ALLOWED` (Edit on a kind that can't be edited, such as a link row: suggest Approve or Reject, with a Note);
   - `ignored`: e.g. `ALREADY_TERMINAL`. Nothing to do.
3. **Apply.** Run `brain sync apply --input <plan file>`, adding `--record-only` when unattended. Then apply the decisions you resolved from Notes with `brain apply --input` (unattended: leave `NOTE_TO_READ` rows for an attended run).
4. Continue with **Finish** below.

## Reading a Note

The Note is the user's instruction for that one row (decision 0037). The CLI never interprets it; you do, and you **never apply a change the Note doesn't clearly ask for**. Decide each `NOTE_TO_READ` row as one of:
- **A narrower decision on this row:** "all except Tomás" or "only Ana" on a grouped `add_link` → `approve` with `exclude` listing the other links (by their `{field, value}` in the proposal's `links`). "Yes, but it's March" on an `update_fact` → `edit` with that value. Pass `note` = the Note as written, `decided_at` = the row's `last_edited`, `decided_by: notion`.
- **A different change** (a role typed on a link row, a fact about another note) → apply this row as its Decision says, and write the other change as its own proposal with `brain proposal new` (`why` = the Note, `source` = the proposal's `source`), so it gets its own Review row.
- **Unclear** → ask the user, quoting the Note, and leave the row as it is until they answer.

In a catch-up these are decided in its read-only pass and confirmed in its one batch of questions.

## Finish (both modes)

1. **Read the results** of each item:
   - **`applied`:** done.
   - **`closed`:** a rejection, or `STALE_PROPOSAL`. Stale means the note changed after the proposal was written (for example your own Notion edit), so the brain did not apply it. Tell the user the current value; the next ingest may propose again.
   - **`recorded`:** decided but not applied (`--record-only`).
   - **`skipped` with `ALREADY_TERMINAL`:** it was already done.
   - **`failed`:** report the `reason` and `message`. `INVALID_RESULT` means applying it would break a rule, such as a value of the wrong shape. `EDIT_NOT_ALLOWED` means an edit on a kind that can't be edited. `EXCLUDE_UNKNOWN` means an `exclude` named a link the row doesn't have: re-read the Note. `UNKNOWN_ID` means the proposal or its note is gone.
2. **Rebuild:** run `brain index`, `brain views`, then `brain lint`. If lint reports an error in a file this run changed, stop and report; don't commit.
3. **Commit:** `apply: <n> applied, <n> closed`, listing the proposal titles in the body. If this run does not publish (step 4), push now, per `settings.push` (the brain's AGENTS.md, "Write path").
4. **Publish** *(Notion mode, attended runs only, per `settings.publish`)*. A chat run does not publish: its changes go out with the next Notion-mode run or `brain sync` (spec/cli.md §6, "Apply in chat"). In Notion mode:
   1. Run `brain sync render --changed`, write the pages through the MCP, then `brain sync record`. The steps are the same as in the brain-ingest skill's references/notion.md "Publish": Review rows move to State Applied or Closed, and the changed notes are updated.
   2. Log it with `brain log publish - pages=<n>`; `sync record` itself does not log (§3.9, §5.14.6).
   3. Commit: `publish: apply results`, then push (same rule as step 3).
5. **Report** in three lines (decision 0037):
   ```
   Done: 8 applied · 1 closed (stale) · 12 pages published
   Needs you: 1 failed (EDIT_NOT_ALLOWED on "add Ivo to Acme rollout") · 2 rows still pending
   Next: fix that row in Notion, then "apply my reviews"
   ```
   - **Done:** counts only, and only the ones that aren't zero.
   - **Needs you:** what failed and why in a few words, a stale proposal with the note's current value, what is still pending. `Needs you: nothing` when there is none.
   - **Next:** one action, or one question.

   **Below the three lines, the report grows with what was applied** (decision 0037, amended 2026-10-18), uncapped, one line each:
   - **What changed:** each applied change in words ("Acme budget is now 95000 EUR", "Ivo joins Acme rollout").
   - **Check:** each proposal closed as stale, with the note's current value; each failure with its reason in a few words; each Edit or Note the user should look at again; each change proposed from a Note. Only things the user can act on: a note the render skipped because it has nothing to publish (its type has no database, or nothing changed) is not a finding.

   A run with nothing applied stops at three lines. Never ids, file paths, commands or commit names.

## Don'ts

- **Don't apply anything the user didn't decide in this chat or in Notion.**
- **Don't edit notes directly** to "help" a proposal along. If a proposal is wrong, the user rejects it.
- **Don't re-run `apply` after a failure** without changing the input. Apply is atomic per item, and the failed item is unchanged; fix the cause first.
