#!/usr/bin/env node
// Usage: check-planted.mjs <sandbox dir> [--json]. CC-140: confirms that a sandbox made by make-sandbox.sh holds every
// problem eval/acceptance-0.10.0/planted.json lists, with the dates and relations that make it a finding at the
// sandbox's `as_of`, and that no other row trips a signal. Needs `brain` on PATH (source <sandbox>/env.sh first).
//
// The signals below are a reference reading of decision 0072 §3 and CC-140's task text, so the fixtures can be
// checked before CC-108 writes the contracts; CC-108 may rename or refine them, and this file follows. It reads the
// sandbox and writes nothing in it: notion-sim is run on a copy of the state, so the call log stays empty.
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const args = process.argv.slice(2);
const json = args.includes("--json");
const dir = args.find((a) => !a.startsWith("--"));
if (!dir) { console.error("Usage: check-planted.mjs <sandbox dir> [--json]"); process.exit(2); }
const D = resolve(dir), B = join(D, "brain"), N = join(D, "notion");
const manifest = JSON.parse(readFileSync(join(HERE, "..", "planted.json"), "utf8"));
const state = JSON.parse(readFileSync(join(N, "state.json"), "utf8"));
const config = JSON.parse(readFileSync(join(B, "brain.json"), "utf8"));

const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok: Boolean(ok), detail }); return ok; };

// ---- dates: whole days before as_of (positive = in the past), from the date part only
const asOf = state.as_of;
check("state has as_of", /^\d{4}-\d{2}-\d{2}$/.test(asOf ?? ""), String(asOf));
const day = (s) => Date.parse(`${String(s).slice(0, 10)}T00:00:00Z`) / 86400000;
const age = (s) => day(asOf) - day(s);

// ---- Notion state
const dbId = (name) => Object.keys(state.databases).find((k) => state.databases[k].name === name);
const rows = (name) => Object.entries(state.pages).filter(([, p]) => p.database === dbId(name) && !p.in_trash && !p.archived).map(([id, p]) => ({ id, ...p, props: p.properties }));
for (const name of ["Domains", "Areas", "Projects", "Tasks"]) check(`database ${name} exists`, dbId(name));
const domains = rows("Domains"), areas = rows("Areas"), projects = rows("Projects"), tasks = rows("Tasks");
const rel = (v) => (Array.isArray(v) ? v : []);
const byId = Object.fromEntries([...domains, ...areas, ...projects, ...tasks].map((r) => [r.id, r]));

// ---- the brain, through the installed CLI (index --check writes nothing)
let index = null;
try { index = JSON.parse(execFileSync("brain", ["index", "--check", "--brain", B, "--json"], { encoding: "utf8" })).data; }
catch (e) { index = e.stdout ? JSON.parse(e.stdout).data : null; }
check("brain index readable", index && Array.isArray(index.notes));
const notes = index?.notes ?? [];
const noteById = Object.fromEntries(notes.map((n) => [n.id, n]));
const brainIdOf = (row) => row.props["Brain ID"];
const pageOfBrain = Object.fromEntries([...domains, ...areas, ...projects].map((r) => [brainIdOf(r), r.id]));
const domainOf = (areaNote) => { const m = readFileSync(join(B, areaNote.path), "utf8").match(/^domain: (dom-[0-9a-z]{8})$/m); return m ? m[1] : null; };

// The brain and Notion agree: every Domain, Area and Project row has its note, with the same Area and Domain.
for (const r of [...domains, ...areas, ...projects]) {
  const n = noteById[brainIdOf(r)];
  if (!check(`${r.props.Name}: brain note ${brainIdOf(r)} exists with this page id`, n && n.notion === r.id)) continue;
  if (n.type === "project") check(`${r.props.Name}: brain area matches Notion Area`, pageOfBrain[n.area] === rel(r.props.Area)[0]);
  if (n.type === "area") check(`${r.props.Name}: brain domain matches Notion Domain`, (domainOf(n) ? pageOfBrain[domainOf(n)] : undefined) === rel(r.props.Domain)[0]);
}
check("Domains module on", config.modules?.domains === true && config.notion.databases.domains === dbId("Domains"));

// ---- signals (reference reading of 0072 §3 and the CC-140 task text)
const DONE = "Done", WONT = "Won't Do", WAITING = "Waiting On";
const S = manifest.signals;
const isOpen = (t) => t.props.Status !== DONE && t.props.Status !== WONT;
const flaggable = (t) => isOpen(t) && t.props.Status !== WAITING;
const tasksOf = (p) => tasks.filter((t) => rel(t.props.Project).includes(p.id));
const active = (p) => p.props.Status === "Active";
const mentionsOf = (p) => notes.filter((n) => n.projects.includes(brainIdOf(p)) && !["view", "proposal", "source"].includes(n.type));
const mentionDate = (n) => n.fields?.date ?? n.updated;
const lastMention = (p) => [noteById[brainIdOf(p)]?.updated, ...mentionsOf(p).map(mentionDate)].filter(Boolean).sort().at(-1);
const lastDone = (p) => tasksOf(p).filter((t) => t.props.Status === DONE).map((t) => t.last_edited).sort().at(-1);
const STOP = new Set(["the", "a", "an", "of", "and", "for", "to", "new"]);
const tokens = (s) => new Set(s.toLowerCase().replace(/catalogue/g, "catalog").split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)));
const jaccard = (a, b) => { const x = tokens(a), y = tokens(b); const i = [...x].filter((w) => y.has(w)).length; return i / (x.size + y.size - i); };

const found = [];
const add = (signal, pages) => found.push({ signal, pages: [...pages].sort() });
for (const t of tasks) {
  if (flaggable(t) && age(t.last_edited) >= S["task_stalled"].days) add("task_stalled", [t.id]);
  if (flaggable(t) && t.props.Due && age(t.props.Due) >= S["task_overdue"].days) add("task_overdue", [t.id]);
  if (isOpen(t) && rel(t.props.Project).length === 0) add("task_no_project", [t.id]);
}
for (const p of projects.filter(active)) {
  const ts = tasksOf(p), done = lastDone(p), mention = lastMention(p);
  if ((!done || age(done) >= S["project_stalled"].days) && (!mention || age(mention) >= S["project_stalled"].days)) add("project_stalled", [p.id]);
  const finished = ts.length > 0 && ts.every((t) => !isOpen(t)) && ts.some((t) => t.props.Status === DONE);
  if (finished) add("project_done_but_open", [p.id]);
  else if (!ts.some(isOpen)) add("project_no_next_step", [p.id]); // spec/assistant.md §3.3: not also project_done_but_open
  const ms = mentionsOf(p), area = noteById[brainIdOf(p)]?.area;
  if (ms.length > 0 && ms.every((n) => n.area && n.area !== area)) add("project_misplaced", [p.id]);
}
const live = projects.filter((p) => p.props.Status !== DONE);
for (const [i, p] of live.entries()) for (const q of live.slice(i + 1)) {
  if (rel(p.props.Area)[0] === rel(q.props.Area)[0] && jaccard(p.props.Name, q.props.Name) >= S["project_duplicate"].similarity) add("project_duplicate", [p.id, q.id]);
}
for (const a of areas) {
  const ps = projects.filter((p) => rel(p.props.Area).includes(a.id));
  const openHere = tasks.filter(isOpen).some((t) => rel(t.props.Area).includes(a.id) || rel(t.props.Project).some((id) => ps.some((p) => p.id === id)));
  if (!ps.some(active) && !openHere) add("area_empty", [a.id]);
  if (rel(a.props.Domain).length === 0) add("area_no_domain", [a.id]);
}

// ---- compare with planted.json
const keyOf = (f) => `${f.signal} ${f.pages.join(" ")}`;
const expected = manifest.planted.flatMap((p) => [p.signal, ...(p.also ?? [])].map((signal) => ({ signal, pages: [...p.pages].sort(), key: p.key })));
const foundKeys = new Set(found.map(keyOf)), expectedKeys = new Set(expected.map(keyOf));
for (const e of expected) check(`planted ${e.key}: ${e.signal} is found`, foundKeys.has(keyOf(e)));
for (const f of found) check(`no unplanted finding: ${f.signal} ${f.pages.map((id) => byId[id]?.props.Name).join(" + ")}`, expectedKeys.has(keyOf(f)));
for (const n of manifest.not_flagged) check(`not flagged: ${n.key}`, !found.some((f) => f.pages.includes(n.page)), n.why);
const findings = new Set(manifest.planted.map((p) => p.key)).size;
check(`more than 10 planted findings (${findings})`, findings > 10);

// Each planted row has the evidence planted.json gives: status, dates (days before as_of) and relations.
const evid = (key, row, ev) => {
  if (!check(`${key}: page ${row?.id ?? "?"} exists`, row)) return;
  for (const [k, v] of Object.entries(ev)) {
    let got;
    if (k === "status") got = row.props.Status;
    else if (k === "last_edited_days_ago") got = age(row.last_edited);
    else if (k === "due_days_ago") got = row.props.Due ? age(row.props.Due) : null;
    else if (k === "project") got = rel(row.props.Project)[0] ?? null;
    else if (k === "area") got = rel(row.props.Area)[0] ?? null;
    else if (k === "domain") got = rel(row.props.Domain)[0] ?? null;
    else if (k === "last_done_days_ago") got = lastDone(row) ? age(lastDone(row)) : null;
    else if (k === "last_mention_days_ago") got = lastMention(row) ? age(lastMention(row)) : null;
    else if (k === "open_tasks") got = tasksOf(row).filter(isOpen).length;
    else if (k === "tasks") got = tasksOf(row).length;
    else if (k === "mention_areas") got = [...new Set(mentionsOf(row).map((n) => pageOfBrain[n.area]))].sort();
    else if (k === "brain") got = brainIdOf(row);
    else got = `unknown evidence key ${k}`;
    check(`${key}: ${k} = ${JSON.stringify(v)}`, JSON.stringify(got) === JSON.stringify(v), `got ${JSON.stringify(got)}`);
  }
};
for (const p of [...manifest.planted, ...manifest.not_flagged]) {
  for (const [i, page] of (p.pages ?? [p.page]).entries()) evid(p.key, byId[page], (p.evidence_each ?? [p.evidence ?? {}])[i] ?? {});
}

// ---- the state loads through notion-sim (on a copy, so the sandbox's call log stays as it is)
const tmp = mkdtempSync(join(tmpdir(), "cc140-")); cpSync(N, tmp, { recursive: true });
try {
  const sim = (...a) => JSON.parse(execFileSync(join(D, "bin", "notion-sim"), a, { encoding: "utf8", env: { ...process.env, NOTION_SIM_DIR: tmp } }));
  check("notion-sim lists the databases", Object.keys(sim("databases")).length === Object.keys(state.databases).length);
  for (const [name, list] of [["Domains", domains], ["Areas", areas], ["Projects", projects], ["Tasks", tasks]]) {
    check(`notion-sim query ${name} returns ${list.length} rows`, sim("query", dbId(name)).results.length === list.length);
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
check("sandbox call log is empty", state.log.length === 0, `${state.log.length} calls`);

// ---- brain lint is clean
let lint;
try { lint = JSON.parse(execFileSync("brain", ["lint", "--strict", "--brain", B, "--json"], { encoding: "utf8" })).data; }
catch (e) { lint = e.stdout ? JSON.parse(e.stdout).data : { errors: -1, warnings: -1, issues: [] }; }
check(`brain lint clean (${lint.errors} errors, ${lint.warnings} warnings)`, lint.errors === 0 && lint.warnings === 0, lint.issues.filter((i) => i.severity !== "info").map((i) => `${i.path}: ${i.rule}`).join("; "));
check("brain has no uncommitted change", execFileSync("git", ["-C", B, "status", "--porcelain"], { encoding: "utf8" }) === "");

const failed = checks.filter((c) => !c.ok);
if (json) console.log(JSON.stringify({ as_of: asOf, findings: found.length, planted: findings, checks: checks.length, failed }, null, 2));
else {
  for (const c of failed) console.log(`FAIL ${c.name}${c.detail ? ` (${c.detail})` : ""}`);
  console.log(`${checks.length - failed.length}/${checks.length} checks pass; ${found.length} findings at ${asOf}, ${findings} planted`);
}
process.exit(failed.length ? 1 : 0);
