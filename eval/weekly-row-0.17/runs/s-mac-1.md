<!-- claude -p, 7 turns, 0.21 USD -->

Setup: 7 of 7 required items done. Next: the schedule, the last step before the setup report.

Checks I ran:
- Notion answers and Brain Data is found.
- The backup is private.
- First value passed earlier: tasks, report, organised and answer all pass.

Run the weekly review on its own every Monday at 08:00, and a catch-up every day at 07:30? Keep them, change a time or a day, or say no to either.

- **Catch-up:** it takes in what you've marked ready, at most 10 inputs a run, oldest first. It applies what you ticked in a Ready weekly row and leaves anything that needs your reading for your next "catch up".
- **Weekly review:** each Monday it writes the week's row (Your week, then Clean-up). It cleans up the mechanical items on its own, each with an undo, and decides nothing else. A quiet week writes nothing. The run stops at a 3 USD cost ceiling.
- **Agent and model:** Claude Code with `claude-sonnet-5-5`. Tell me if you'd rather use another full model id, such as `claude-opus-5-5`.
- **Publishing:** `settings.publish` is already `auto`, so scheduled runs can publish to Notion.
- **Allowed tools:** may I add these to the brain's `.claude/settings.json` allow list so scheduled runs aren't refused?
  - `Bash(brain:*)`, `Bash(git:*)`, `Read`, `Edit`, `Write` and the Notion tools.
  - For the weekly review also: `Bash(date:*)`, `Bash(jq:*)`, `Read(~/.ultimate-brain/weekly/**)` and `Edit(~/.ultimate-brain/weekly/**)`.
- **Computer:** your Mac must be on (asleep is fine) and you logged in at these times. A run missed while it was off waits for the next one. The schedule runs on this computer only.

Reply "keep them" with a yes or no to the allow list, or give the changes you want.
