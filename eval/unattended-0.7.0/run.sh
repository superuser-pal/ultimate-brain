#!/bin/bash
export PATH=/tmp/cc64/bin:$PATH
B=/tmp/cc64
SIM() { echo "Notion isn't connected in this session and no Notion tools exist. Treat these files as the Notion tools' answers: $B/$1-sim/snapshot.json holds the rows of every configured database in the shape sync plan takes (the Review rows and the people row); $B/$1-sim/meetings.json is the Meetings database (Brain Status, Date, Project, Attendees, page_text); there are no Inbox rows and no Ask rows. Wherever the skill would write to Notion with its tools (create or update a page, set a property, create a Report row), append one line saying exactly what you would write to $B/$1-sim/writes.md and treat the write as done. The user is away and cannot be asked anything. There is no git remote."; }
AWAY="The user is away and cannot be asked anything. There is no git remote and no Notion in this session."
run() { (cd $B/$1 && claude -p "$2" --permission-mode bypassPermissions --strict-mcp-config --mcp-config $B/no-mcp.json --add-dir $B > $B/$1.log 2>&1); }
run noop "catch up unattended. $AWAY" &
run budget "catch up unattended. $AWAY" &
run mixed-on "catch up unattended. $(SIM mixed-on)" &
run mixed-off "catch up unattended. $(SIM mixed-off)" &
wait
