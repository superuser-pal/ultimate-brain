#!/usr/bin/env node
// Usage: reference.mjs <sandbox> [--date YYYY-MM-DD] [--unreachable] [--repo-error <name>=<reason>]... [-- <findings args>...]
// The reference report for a blind run of docs/acceptance-0.10.0.md (CC-110): it reads the sandbox's notion-sim state as
// spec/assistant.md §2.1 says the skill reads Notion (every row, not in the trash), adds the tracked-in-repo rollups of
// §2.2 (`brain repo tasks`; a GitHub or GitLab source is given as `--repo-error`, since its issues can't be fetched in a
// sandbox), and runs `brain assistant findings` on that snapshot. The runner compares the report the agent showed with
// `data.report`. `--unreachable` gives the brain-only snapshot of §2.3. Writes only a temporary file under <sandbox>.
// Extra arguments after `--` go to `brain assistant findings` (--scope, --exclude, --number-from, --limit).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const dashes = argv.indexOf("--");
const own = dashes < 0 ? argv : argv.slice(0, dashes);
const extra = dashes < 0 ? [] : argv.slice(dashes + 1);
const sandbox = resolve(own[0] ?? "");
const flag = (name) => { const i = own.indexOf(name); return i < 0 ? undefined : own[i + 1]; };
const date = flag("--date") ?? new Date().toISOString().slice(0, 10);
const unreachable = own.includes("--unreachable");
const repoErrors = Object.fromEntries(own.flatMap((a, i) => (a === "--repo-error" ? [own[i + 1].split(/=(.*)/s).slice(0, 2)] : [])));
const brainDir = join(sandbox, "brain");
const brain = (args) => {
  try { return JSON.parse(execFileSync("brain", [...args, "--brain", brainDir, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
  catch (e) { return JSON.parse(e.stdout); }
};

const config = JSON.parse(readFileSync(join(brainDir, "brain.json"), "utf8"));
const repos = [];
for (const entry of config.repos ?? []) {
  if (repoErrors[entry.name] !== undefined) { repos.push({ name: entry.name, error: repoErrors[entry.name] }); continue; }
  const out = brain(["repo", "tasks", entry.name]);
  if (out.ok) repos.push({ name: entry.name, rollup: out.data });
  else if (!["NO_KIT", "MODE_CONNECTED", "NO_TASKS"].includes(out.error?.code)) repos.push({ name: entry.name, error: out.error?.message ?? "failed" });
}

let snapshot;
const asOf = `${date}T${new Date().toISOString().slice(11, 19)}Z`;
if (unreachable) snapshot = { as_of: asOf, notion: "unreachable", repos };
else {
  const state = JSON.parse(readFileSync(join(sandbox, "notion", "state.json"), "utf8"));
  const database = (name) => Object.keys(state.databases).find((id) => state.databases[id].name === name);
  const rows = (name) => Object.entries(state.pages).filter(([, p]) => p.database === database(name) && !p.in_trash);
  const sorted = (v) => (Array.isArray(v) ? [...v].sort() : []);
  const brainId = (v) => (typeof v === "string" && v !== "" ? v : null);
  const nul = (v) => (v === undefined || v === "" ? null : v);
  snapshot = {
    as_of: asOf, notion: "live",
    task_statuses: state.databases[database("Tasks")].properties.Status.options.map((name) => ({ name, group: null })),
    tasks: rows("Tasks").map(([id, p]) => ({ page_id: id, title: p.properties.Name, status: nul(p.properties.Status), due: nul(p.properties.Due)?.slice(0, 10) ?? null,
      projects: sorted(p.properties.Project), areas: sorted(p.properties.Area), created: p.created ?? p.last_edited, last_edited: p.last_edited })),
    projects: rows("Projects").map(([id, p]) => ({ page_id: id, brain_id: brainId(p.properties["Brain ID"]), title: p.properties.Name, status: nul(p.properties.Status),
      archived: p.properties.Archived === true, last_edited: p.last_edited })),
    areas: rows("Areas").map(([id, p]) => ({ page_id: id, brain_id: brainId(p.properties["Brain ID"]), title: p.properties.Name, archived: p.properties.Archived === true })),
    repos,
  };
}
const input = join(sandbox, "reference-snapshot.json");
writeFileSync(input, JSON.stringify(snapshot));
const out = brain(["assistant", "findings", "--input", input, ...extra]);
rmSync(input);
if (!out.ok) { console.error(JSON.stringify(out.error)); process.exit(1); }
process.stdout.write(out.data.report);
console.log("\n--- keys (rank signal key)");
for (const f of out.data.findings) console.log(`${f.rank} ${f.signal} ${f.key}`);
