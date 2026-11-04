#!/bin/sh
# Usage: make-notion.sh <notion dir> <brain dir> [<fail json>]: a simulated Notion with the brain's Tasks, Projects and Areas
# databases (ids from its brain.json), a page for each of its Projects and Areas (ids from their notes), and no tasks.
# Needs `brain` on PATH.
set -e
mkdir -p "$1"
brain index --brain "$2" --json > "$1/index.json"
node -e '
const fs = require("fs");
const [dir, brainDir, failArg] = process.argv.slice(1);
const config = JSON.parse(fs.readFileSync(brainDir + "/brain.json", "utf8"));
const notes = JSON.parse(fs.readFileSync(dir + "/index.json", "utf8")).data.notes;
const T = config.notion.tasks.database, P = config.notion.databases.projects, A = config.notion.databases.areas;
const sel = (o) => ({ type: "select", options: o });
const wf = { Workflow: sel(["Standard", "Connected"]), "Work type": sel(["Software", "General"]),
  "Logging level": sel(["Tasks only", "Tasks + final outputs", "Full durable record", "Custom"]),
  "Log artifacts": { type: "multi_select", options: ["Briefs", "Plans", "Specifications", "Decisions", "Final deliverables"] } };
const databases = {
  [T]: { name: "Tasks", properties: { Name: { type: "title" }, Status: sel(["To Do", "Doing", "Waiting On", "Done", "Won" + String.fromCharCode(39) + "t Do"]),
    Project: { type: "relation" }, Area: { type: "relation" }, "Brain ID": { type: "rich_text" }, Due: { type: "date" }, Meeting: { type: "relation" } } },
  [P]: { name: "Projects", properties: { Name: { type: "title" }, Status: { type: "status" }, "Brain ID": { type: "rich_text" }, ...wf } },
  [A]: { name: "Areas", properties: { Name: { type: "title" }, "Brain ID": { type: "rich_text" }, ...wf } },
};
const pages = {};
for (const note of notes) {
  if (!note.notion || (note.type !== "project" && note.type !== "area")) continue;
  pages[note.notion] = { database: note.type === "project" ? P : A,
    properties: { Name: note.title, "Brain ID": note.id, Workflow: null, "Work type": null, "Logging level": null, "Log artifacts": [] },
    toggles: note.type === "project" ? { Brief: "", "Decision log": "" } : {}, archived: false, in_trash: false, last_edited: "2026-11-01T09:00:00Z" };
}
fs.writeFileSync(dir + "/state.json", JSON.stringify({ databases, pages, fail: failArg ? JSON.parse(failArg) : [], log: [] }, null, 2));
' "$1" "$2" "$3"
rm "$1/index.json"
