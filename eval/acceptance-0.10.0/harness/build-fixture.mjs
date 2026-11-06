#!/usr/bin/env node
// CC-140: writes the synthetic world of fixture.mjs at a given as_of. Called by make-sandbox.sh.
//   build-fixture.mjs write <brain dir> <notion dir> <as_of>   the notes (into a brain made by `brain init`), brain.json's
//                                                              modules and Notion ids, and <notion dir>/state.json
//   build-fixture.mjs commit <brain dir> <as_of>               commits the brain with dated history: the brain's own
//                                                              files first, then each note on its `created` day, then
//                                                              the generated files (views, index, log) on the day before as_of
//   build-fixture.mjs publish <notion dir> <render.json>       what a publish does to Notion: each rendered item's
//                                                              properties and toggle sections onto its page in the state, so
//                                                              the state holds what the brain records as published
//   build-fixture.mjs times <as_of>                            prints the init and publish timestamps (for --now)
// Dates in the output are as_of plus fixture.mjs's day offsets; nothing else changes with as_of.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as W from "./fixture.mjs";

const [mode, ...rest] = process.argv.slice(2);
const pad = (n) => String(n).padStart(2, "0");
const KK = { domain: "d0", area: "a0", project: "b0", task: "c0", meeting: "e0", source: "e0", decision: "dc", org: "f0", person: "f1", database: "db" };
const PREFIX = { domain: "dom", area: "area", project: "prj", meeting: "mtg", source: "src", decision: "dec", org: "org", person: "per" };
export const brainId = (kind, n) => `${PREFIX[kind]}-0a10${KK[kind]}${pad(n)}`;
export const pageId = (kind, n) => `0a10${KK[kind]}00-0000-4000-8000-0000000000${pad(n)}`;
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
let AS_OF;
const date = (offset) => new Date(Date.parse(`${AS_OF}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const stamp = (offset, time = "09:00:00") => `${date(offset)}T${time}Z`;
const scalar = (v) => (typeof v === "string" && (/: | #|[,[\]{}]/.test(v) || /^[-?:!&*|>'"%@`]/.test(v)) ? JSON.stringify(v) : v);
const list = (xs) => `[${xs.map(scalar).join(", ")}]`;
const byN = (xs, n) => xs.find((x) => x.n === n);

const DB = { domains: 1, areas: 2, goals: 3, key_results: 4, projects: 5, meetings: 6, people: 7, orgs: 8, decisions: 9, questions: 10, review: 11, inbox: 12, documents: 13, tasks: 14 };
const db = (key) => pageId("database", DB[key]);

function note(path, front, body) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(front)) {
    if (v === undefined || v === null) continue;
    if (v && typeof v === "object" && "raw" in v) lines.push(`${k}:${v.raw}`);
    else if (typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [k2, v2] of Object.entries(v)) lines.push(`  ${k2}: ${scalar(v2)}`);
    } else lines.push(`${k}: ${Array.isArray(v) ? list(v) : scalar(v)}`);
  }
  return { path, text: `${lines.join("\n")}\n---\n${body}` };
}

// The notes, each with the day (offset) it was created.
function notes() {
  const out = [];
  const snapshot = stamp(-1, "08:00:00");
  for (const d of W.domains) out.push({ day: d.created, ...note(`domains/${slug(d.title)}.md`, {
    id: brainId("domain", d.n), type: "domain", title: d.title, summary: d.summary, lifecycle: "reviewed",
    sources: [`notion:${pageId("domain", d.n)}`], created: date(d.created), updated: date(d.created), notion: pageId("domain", d.n),
    notion_fields: { as_of: snapshot, type: d.type, archived: false } }, `${d.summary}\n`) });
  for (const a of W.areas) out.push({ day: a.created, ...note(`areas/${slug(a.title)}.md`, {
    id: brainId("area", a.n), type: "area", title: a.title, summary: a.summary, lifecycle: "reviewed",
    domain: a.domain ? brainId("domain", a.domain) : null, sources: [`notion:${pageId("area", a.n)}`],
    created: date(a.created), updated: date(a.created), notion: pageId("area", a.n),
    notion_fields: { as_of: snapshot, archived: false } }, `${a.summary}\n`) });
  for (const p of W.projects) out.push({ day: p.created, ...note(`projects/${slug(p.title)}/project.md`, {
    id: brainId("project", p.n), type: "project", title: p.title, summary: p.why, lifecycle: "reviewed",
    area: brainId("area", p.area), client: p.client ? brainId("org", p.client) : null,
    people: p.people.length ? p.people.map((x) => brainId("person", x)) : null,
    created: date(p.created), updated: date(p.updated), notion: pageId("project", p.n),
    notion_fields: { as_of: snapshot, status: p.status, priority: p.priority, archived: false } }, `## Why\n${p.why}\n`) });
  const projectsOf = (pred) => W.projects.filter(pred).map((p) => brainId("project", p.n));
  const firstMeeting = (n) => byN(W.meetings, n);
  for (const o of W.orgs) { const m = firstMeeting(o.meeting); out.push({ day: m.date, ...note(`knowledge/orgs/${slug(o.title)}.md`, {
    id: brainId("org", o.n), type: "org", title: o.title, summary: o.summary, lifecycle: "reviewed",
    area: brainId("area", 1), projects: projectsOf((p) => p.client === o.n), sources: [brainId("meeting", m.n)],
    created: date(m.date), updated: date(m.date), notion: pageId("org", o.n),
    notion_fields: { as_of: snapshot, relationship: "Client", archived: false } }, `${o.summary}\n`) }); }
  for (const p of W.people) { const m = firstMeeting(p.meeting); out.push({ day: m.date, ...note(`knowledge/people/${slug(p.title)}.md`, {
    id: brainId("person", p.n), type: "person", title: p.title, summary: `${p.role} at ${byN(W.orgs, p.org).title}.`, lifecycle: "reviewed",
    org: brainId("org", p.org), aliases: [p.title.split(" ")[0]], projects: projectsOf((x) => x.people.includes(p.n)),
    sources: [brainId("meeting", m.n)], facts: { role: p.role },
    timeline: { raw: `\n  - field: role\n    value: ${p.role}\n    from: ${date(m.date)}\n    learned: ${date(m.date)}\n    source: ${brainId("meeting", m.n)}\n    assessment: accepted` },
    created: date(m.date), updated: date(m.date), notion: pageId("person", p.n) }, `${p.role} at ${byN(W.orgs, p.org).title}.\n`) }); }
  for (const m of W.meetings) {
    const file = `${date(m.date)}-${slug(m.title)}`;
    const body = `## Notes\n${m.minutes.map((x) => `- ${x}`).join("\n")}\n`;
    out.push({ day: m.date, ...note(`sources/notion/${file}-notion-minutes.md`, {
      id: brainId("source", m.n), type: "source", title: `${m.title} (Notion minutes)`, source_key: `notion:${pageId("meeting", m.n)}`,
      content_hash: `sha256:${createHash("sha256").update(body, "utf8").digest("hex")}`, captured: stamp(m.date, "11:00:00"),
      origin_edited: stamp(m.date, "10:30:00"), created: date(m.date), updated: date(m.date) }, body) });
    const decs = (m.decisions ?? []).map((n) => byN(W.decisions, n));
    out.push({ day: m.date, ...note(`knowledge/meetings/${file}.md`, {
      id: brainId("meeting", m.n), type: "meeting", title: m.title, summary: m.summary, lifecycle: "reviewed", date: date(m.date),
      attendees: m.attendees.map((x) => brainId("person", x)), source: brainId("source", m.n),
      decisions: decs.length ? decs.map((d) => brainId("decision", d.n)) : null, area: brainId("area", m.area),
      projects: [brainId("project", m.project)], sources: [brainId("source", m.n)], created: date(m.date), updated: date(m.date),
      notion: pageId("meeting", m.n) }, `## Summary\n${m.summary}\n${decs.map((d) => `\n## Decisions\n- [${d.title}](../decisions/${date(m.date)}-${slug(d.title)}.md)\n`).join("")}`) });
    for (const d of decs) out.push({ day: m.date, ...note(`knowledge/decisions/${date(m.date)}-${slug(d.title)}.md`, {
      id: brainId("decision", d.n), type: "decision", title: d.title, summary: d.summary, lifecycle: "reviewed", date: date(m.date),
      assessment: "accepted", decided_in: brainId("meeting", m.n), area: brainId("area", d.area), projects: [brainId("project", d.project)],
      sources: [brainId("meeting", m.n)], created: date(m.date), updated: date(m.date), notion: pageId("decision", d.n) },
      `## Decision\n${d.body}\n\n## Context\nAgreed at the ${m.title.toLowerCase()}.\n\n## Consequences\nThe first issue goes out next month.\n\n## Sources\n- [${m.title}](../meetings/${file}.md)\n`) });
  }
  return out;
}

function notionState() {
  const sel = (o) => ({ type: "select", options: o });
  const r = { type: "relation" };
  const wf = { Workflow: sel(["Standard", "Connected"]), "Work type": sel(["Software", "General"]),
    "Logging level": sel(["Tasks only", "Tasks + final outputs", "Full durable record", "Custom"]),
    "Log artifacts": { type: "multi_select", options: ["Briefs", "Plans", "Specifications", "Decisions", "Final deliverables"] } };
  const base = { Name: { type: "title" }, "Brain ID": { type: "rich_text" } };
  const databases = {
    [db("domains")]: { name: "Domains", properties: { ...base, Summary: { type: "rich_text" }, Type: sel(["Personal", "Entrepreneurship", "Professional"]), Areas: r, Org: r, Archived: { type: "checkbox" } } },
    [db("areas")]: { name: "Areas", properties: { ...base, Summary: { type: "rich_text" }, Domain: r, Projects: r, Tasks: r, Archived: { type: "checkbox" }, ...wf } },
    [db("goals")]: { name: "Goals", properties: { ...base, Status: sel(["Not Started", "Active", "Achieved", "Dropped"]), Area: r, Archived: { type: "checkbox" } } },
    [db("key_results")]: { name: "Key Results", properties: { Name: { type: "title" }, Goal: r } },
    [db("projects")]: { name: "Projects", properties: { ...base, Summary: { type: "rich_text" }, Status: sel(["Planned", "Active", "On Hold", "Done"]), Priority: sel(["High", "Medium", "Low"]), Dates: { type: "date" }, Area: r, Goal: r, Client: r, People: r, Meetings: r, Tasks: r, Archived: { type: "checkbox" }, ...wf } },
    [db("meetings")]: { name: "Meetings", properties: { ...base, Date: { type: "date" }, Attendees: r, Project: r, Area: r, "Brain Status": sel(["Not Reviewed", "Reviewed", "Ingested", "Skipped"]), Decisions: r, Questions: r, Tasks: r } },
    [db("people")]: { name: "People", properties: { ...base, Org: r, Projects: r } },
    [db("orgs")]: { name: "Orgs", properties: { ...base, Relationship: sel(["Client", "Prospect", "Partner", "Supplier", "Employer", "Other"]), Archived: { type: "checkbox" } } },
    [db("decisions")]: { name: "Decisions", properties: { ...base, Date: { type: "date" }, Project: r, Area: r, "Decided In": r } },
    [db("questions")]: { name: "Questions", properties: { ...base, Status: sel(["Open", "Answered", "Dropped"]), Area: r, Project: r } },
    [db("review")]: { name: "Review", properties: { ...base, Kind: { type: "select" }, State: sel(["Pending", "Approved", "Rejected", "Applied"]), Proposed: { type: "rich_text" }, Area: r, Project: r } },
    [db("inbox")]: { name: "Inbox", properties: { Name: { type: "title" }, Kind: { type: "select" }, Status: sel(["New", "Processed"]), Area: r, Project: r } },
    [db("documents")]: { name: "Documents", properties: { ...base, Category: { type: "select" }, Project: r, Area: r } },
    [db("tasks")]: { name: "Tasks", properties: { Name: { type: "title" }, Status: sel(["To Do", "Doing", "Waiting On", "Someday", "Done", "Won't Do"]), Due: { type: "date" }, Project: r, Area: r, Meeting: r, Source: r, "Brain ID": { type: "rich_text" } } },
  };
  const pages = {};
  const page = (id, database, properties, edited, toggles = {}) => { pages[id] = { database, properties, body: "", toggles, archived: false, in_trash: false, last_edited: stamp(edited) }; };
  for (const d of W.domains) page(pageId("domain", d.n), db("domains"), { Name: d.title, "Brain ID": brainId("domain", d.n), Summary: d.summary, Type: d.type,
    Areas: W.areas.filter((a) => a.domain === d.n).map((a) => pageId("area", a.n)), Org: [], Archived: false }, d.created);
  for (const a of W.areas) page(pageId("area", a.n), db("areas"), { Name: a.title, "Brain ID": brainId("area", a.n), Summary: a.summary,
    Domain: a.domain ? [pageId("domain", a.domain)] : [], Projects: W.projects.filter((p) => p.area === a.n).map((p) => pageId("project", p.n)),
    Tasks: W.tasks.filter((t) => (t.area ?? byN(W.projects, t.project)?.area) === a.n).map((t) => pageId("task", t.n)), Archived: false,
    Workflow: null, "Work type": null, "Logging level": null, "Log artifacts": [] }, a.created, { Brief: "" });
  for (const p of W.projects) page(pageId("project", p.n), db("projects"), { Name: p.title, "Brain ID": brainId("project", p.n), Summary: p.why,
    Status: p.status, Priority: p.priority, Dates: null, Area: [pageId("area", p.area)], Goal: [], Client: p.client ? [pageId("org", p.client)] : [],
    People: p.people.map((x) => pageId("person", x)), Meetings: W.meetings.filter((m) => m.project === p.n).map((m) => pageId("meeting", m.n)),
    Tasks: W.tasks.filter((t) => t.project === p.n).map((t) => pageId("task", t.n)), Archived: false,
    Workflow: null, "Work type": null, "Logging level": null, "Log artifacts": [] }, p.updated, { Brief: "", "Decision log": "" });
  for (const t of W.tasks) page(pageId("task", t.n), db("tasks"), { Name: t.title, Status: t.status, Due: t.due === null ? null : date(t.due),
    Project: t.project ? [pageId("project", t.project)] : [], Area: [pageId("area", t.area ?? byN(W.projects, t.project).area)],
    Meeting: [], Source: [], "Brain ID": "" }, t.edited);
  for (const m of W.meetings) page(pageId("meeting", m.n), db("meetings"), { Name: m.title, "Brain ID": brainId("meeting", m.n), Date: date(m.date),
    Attendees: m.attendees.map((x) => pageId("person", x)), Project: [pageId("project", m.project)], Area: [pageId("area", m.area)],
    "Brain Status": "Reviewed", Decisions: [], Questions: [], Tasks: [] }, m.date);
  for (const o of W.orgs) page(pageId("org", o.n), db("orgs"), { Name: o.title, "Brain ID": brainId("org", o.n), Relationship: "Client", Archived: false }, byN(W.meetings, o.meeting).date);
  for (const p of W.people) page(pageId("person", p.n), db("people"), { Name: p.title, "Brain ID": brainId("person", p.n), Org: [pageId("org", p.org)],
    Projects: W.projects.filter((x) => x.people.includes(p.n)).map((x) => pageId("project", x.n)) }, byN(W.meetings, p.meeting).date);
  for (const d of W.decisions) page(pageId("decision", d.n), db("decisions"), { Name: d.title, "Brain ID": brainId("decision", d.n),
    Project: [pageId("project", d.project)], Area: [pageId("area", byN(W.projects, d.project).area)], "Decided In": [pageId("meeting", d.meeting)] }, byN(W.meetings, d.meeting).date);
  return { as_of: AS_OF, databases, pages, fail: [], log: [] };
}

function write(brain, notion, asOf) {
  AS_OF = asOf;
  const cfgPath = join(brain, "brain.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  cfg.owner = { name: W.owner };
  cfg.modules = { domains: true, knowledge: true, orgs: true, documents: true, reports: true, tasks: true, planning: true };
  for (const k of Object.keys(DB)) if (k !== "tasks") cfg.notion.databases[k] = db(k);
  cfg.notion.tasks.database = db("tasks");
  writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
  for (const n of notes()) { mkdirSync(dirname(join(brain, n.path)), { recursive: true }); writeFileSync(join(brain, n.path), n.text); }
  mkdirSync(notion, { recursive: true });
  writeFileSync(join(notion, "state.json"), JSON.stringify(notionState(), null, 2));
}

// The brain's first day (the day before its oldest note) and the publish, the day before as_of: the clock
// make-sandbox.sh gives the CLI with --now, so its log and timestamps match the history.
const firstDay = () => Math.min(...notes().map((n) => n.day)) - 1;
function times(asOf) { AS_OF = asOf; console.log(`${stamp(firstDay())} ${stamp(-1, "08:00:00")}`); }

function commit(brain, asOf) {
  AS_OF = asOf;
  const git = (args, when) => execFileSync("git", ["-C", brain, ...args], { stdio: ["ignore", "pipe", "inherit"],
    env: when ? { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when } : process.env });
  git(["init", "-q", "-b", "main"]); git(["config", "user.email", "eval@studio.example"]); git(["config", "user.name", "Eval"]);
  const all = notes();
  const generated = (p) => p === "index.md" || p.startsWith("log/") || /\/(brief|decision-log)\.md$/.test(p) || p.startsWith("areas/briefs/");
  const files = execFileSync("git", ["-C", brain, "ls-files", "--others", "--exclude-standard"], { encoding: "utf8" }).split("\n").filter(Boolean);
  const notePaths = new Set(all.map((n) => n.path));
  const first = firstDay();
  git(["add", "--", ...files.filter((p) => !notePaths.has(p) && !generated(p))]);
  git(["commit", "-q", "-m", "init: ultimate brain (schema v1)"], stamp(first));
  for (const day of [...new Set(all.map((n) => n.day))].sort((a, b) => a - b)) {
    git(["add", "--", ...all.filter((n) => n.day === day).map((n) => n.path)]);
    git(["commit", "-q", "-m", `notes of ${date(day)}`], stamp(day, "18:00:00"));
  }
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "publish: sandbox"], stamp(-1, "08:00:00"));
}

// The publish, as the brain-sync skill would do it through the MCP; last_edited stays the fixture's date, so the
// pages keep their history (a publish is not your edit).
function publish(notion, renderFile) {
  const file = join(notion, "state.json");
  const st = JSON.parse(readFileSync(file, "utf8"));
  const plain = (p) => (p.type === "date" && p.value && typeof p.value === "object" ? p.value.start : p.value);
  for (const item of JSON.parse(readFileSync(renderFile, "utf8")).data.items) {
    const page = st.pages[item.page_id];
    if (!page) throw new Error(`no page ${item.page_id} for ${item.id}`);
    const schema = st.databases[page.database].properties;
    for (const [k, p] of Object.entries(item.properties)) {
      schema[k] ??= { type: p.type };
      const v = plain(p), old = page.properties[k];
      if (p.mode === "add") page.properties[k] = [...new Set([...(old ?? []), ...v])];
      else if (p.mode === "if_empty") { if (old == null || (Array.isArray(old) && old.length === 0)) page.properties[k] = v; }
      else page.properties[k] = v;
    }
    for (const [k, md] of Object.entries(item.sections ?? {})) page.toggles[k] = md;
    if (item.body != null) page.body = item.body;
  }
  writeFileSync(file, JSON.stringify(st, null, 2));
}

if (mode === "write" && rest.length === 3) write(...rest);
else if (mode === "publish" && rest.length === 2) publish(...rest);
else if (mode === "times" && rest.length === 1) times(...rest);
else if (mode === "commit" && rest.length === 2) commit(...rest);
else { console.error("Usage: build-fixture.mjs write <brain> <notion> <as_of> | commit <brain> <as_of> | publish <notion> <render.json> | times <as_of>"); process.exit(2); }
