// Usage: node notion-state.cjs <sandbox>. Writes <sandbox>/notion/state.json for notion-sim: the user's duplicated
// space, with the twelve databases of <sandbox>/dbs.txt and their properties, Brain Data, and the System page whose
// text names the template version (0024). No pages in the databases.
const fs = require("fs"); const crypto = require("crypto"); const S = process.argv[2];
const names = { inbox: "Inbox", meetings: "Meetings", projects: "Projects", areas: "Areas", people: "People", review: "Review",
  decisions: "Decisions", questions: "Questions", orgs: "Orgs", documents: "Documents", domains: "Domains", tasks: "Tasks" };
const sel = (o) => ({ type: "select", options: o }); const databases = {};
for (const l of fs.readFileSync(S + "/dbs.txt", "utf8").trim().split("\n")) {
  const [k, id] = l.split(" "); const p = { Name: { type: "title" }, "Brain ID": { type: "rich_text" } };
  if (k === "tasks") Object.assign(p, { Status: sel(["To Do", "Doing", "Waiting On", "Done", "Won't Do"]), Due: { type: "date" }, Project: { type: "relation" } });
  if (k === "projects") Object.assign(p, { Status: sel(["Planned", "Active", "On Hold", "Done"]), Area: { type: "relation" }, Client: { type: "relation" } });
  if (k === "domains") Object.assign(p, { Type: sel(["Personal", "Entrepreneurship", "Professional"]) });
  databases[id] = { name: names[k], properties: p };
}
const pg = (n, extra) => ({ database: null, properties: Object.assign({ Name: n }, extra || {}), toggles: {}, archived: false, in_trash: false, last_edited: "2026-11-11T08:00:00Z" });
const pages = { [crypto.randomUUID()]: pg("Brain Data"), [crypto.randomUUID()]: pg("System", { Text: "Template version: 0024" }) };
fs.writeFileSync(S + "/notion/state.json", JSON.stringify({ databases, pages, fail: [], log: [] }, null, 2));
