---
name: brain-apply
description: Apply the user's decisions on proposed changes to the brain. Shows pending proposals in chat and applies what the user approves, rejects or edits, or reads the decisions the user made in the Notion Review queue and applies them, then rebuilds and republishes. Use when the user says "apply my reviews", "what needs my decision", "approve the launch change", "apply the Review queue", or after deciding proposals in Notion.
---

# Apply review decisions

Proposals are changes the brain wants to make to existing notes (decision 0003). The user decides each one: approve, reject, or edit (edit means approve, but with the user's own value). This skill records those decisions and applies them through the CLI. Only the user decides. Never approve, reject or edit on their behalf, and never infer a decision from the minutes or from earlier chat.

Run every CLI command as `brain <command> --brain <brain> --json`. Exit 1 means some items need attention; read them. Exit 2 or 4 means your command or input was wrong: fix it. Exit 3 or 5 means stop and report. Exit 10: report a bug.

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
   - `add_link`: what gets linked to what.
   - `supersede`: the new note replaces the old one.
   - `merge`: the duplicate is folded into the survivor.
   - `new_item`: the note that would be created.

   Look up titles with `brain index --json` instead of showing ids. Mention the ones already decided but not applied.
3. **Ask** which to approve, reject or edit. Accept replies like "approve 1 and 3, reject 2, edit 4 to 90000 EUR". Edit is only possible for `update_fact`, `contradiction` and `add_to_note`; say so if the user asks to edit another kind. **If a reply is unclear, ask again.** Don't guess.
4. **Apply.** Write the input and run `brain apply --input <file>`:
   ```json
   { "decisions": [
     { "proposal": "prp-…", "action": "approve", "decided_at": "<now, ISO 8601 UTC>", "decided_by": "chat" },
     { "proposal": "prp-…", "action": "edit", "value": "90000 EUR", "decided_at": "<now>", "decided_by": "chat" }
   ] }
   ```
   To apply only what was decided earlier, run `brain apply` with no `--input`.
5. Continue with **Finish** below.

## Notion mode

1. **Read** the Review database through the Notion MCP: the rows where **Decision** is set and **State** is Pending. Normalize each row into the snapshot format of spec/cli.md §5.14.1:
   - `database: "review"`, the `page_id` and `last_edited`;
   - the properties Name, Kind, Decision, Edited Value, State and Brain ID.
2. **Plan.** Run `brain sync plan --input <snapshot>`. It writes nothing. Save the reply's **`data` object** (not the whole JSON reply) as the plan file; `sync apply` rejects the full reply. Read:
   - `decisions`: what will be applied;
   - `conflicts`: e.g. `EDIT_WITHOUT_VALUE`, where Decision is Edit but Edited Value is empty. Tell the user, who fixes it in Notion;
   - `ignored`: e.g. `ALREADY_TERMINAL`. Nothing to do.
3. **Apply.** Run `brain sync apply --input <plan file>`, adding `--record-only` when unattended.
4. Continue with **Finish** below.

## Finish (both modes)

1. **Read the results** of each item:
   - **`applied`:** done.
   - **`closed`:** a rejection, or `STALE_PROPOSAL`. Stale means the note changed after the proposal was written (for example your own Notion edit), so the brain did not apply it. Tell the user the current value; the next ingest may propose again.
   - **`recorded`:** decided but not applied (`--record-only`).
   - **`skipped` with `ALREADY_TERMINAL`:** it was already done.
   - **`failed`:** report the `reason` and `message`. `INVALID_RESULT` means applying it would break a rule, such as a value of the wrong shape. `EDIT_NOT_ALLOWED` means an edit on a kind that can't be edited. `UNKNOWN_ID` means the proposal or its note is gone.
2. **Rebuild:** run `brain index`, `brain views`, then `brain lint`. If lint reports an error in a file this run changed, stop and report; don't commit.
3. **Commit:** `apply: <n> applied, <n> closed`, listing the proposal titles in the body.
4. **Publish** *(Notion mode, attended runs only)*. A chat run does not publish: its changes go out with the next Notion-mode run or `brain sync` (spec/cli.md §6, "Apply in chat"). In Notion mode:
   1. Run `brain sync render --changed`, write the pages through the MCP, then `brain sync record`. The steps are the same as in the brain-ingest skill's references/notion.md "Publish": Review rows move to State Applied or Closed, and the changed notes are updated.
   2. Log it with `brain log publish - pages=<n>`; `sync record` itself does not log (§3.9, §5.14.6).
   3. Commit: `publish: apply results`.
5. **Report** briefly:
   - what changed (in words: "Acme budget is now 95000 EUR");
   - what was closed and why;
   - what failed;
   - what is still pending.

## Don'ts

- **Don't apply anything the user didn't decide in this chat or in Notion.**
- **Don't edit notes directly** to "help" a proposal along. If a proposal is wrong, the user rejects it.
- **Don't re-run `apply` after a failure** without changing the input. Apply is atomic per item, and the failed item is unchanged; fix the cause first.
