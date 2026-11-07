#!/usr/bin/env node
// Usage: evidence.mjs <sandbox> --mark | evidence.mjs <sandbox> [--json]
// The evidence of one blind-run session of docs/acceptance-0.10.0.md (CC-110). `--mark` records where the session starts
// (the brain's HEAD and the length of notion-sim's call log) in <sandbox>/eval-mark.json; without it, it prints what
// changed since that mark, which the runner checks against the scenario: the brain's commits and their files, what is
// left uncommitted, every proposal added or changed (kind, status, finding, decision, settle), the dismissal store, the
// log lines added, every notion-sim call that writes (create, update, body, toggle, trash) with its properties, the
// number of reads, and `brain lint`'s counts. Reads only, apart from the mark file.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const sandbox = resolve(process.argv[2] ?? "");
const brainDir = join(sandbox, "brain");
const markFile = join(sandbox, "eval-mark.json");
const statePath = join(sandbox, "notion", "state.json");
const git = (...args) => execFileSync("git", ["-C", brainDir, ...args], { encoding: "utf8" }).trim();
const state = () => JSON.parse(readFileSync(statePath, "utf8"));
const brain = (args) => {
  try { return JSON.parse(execFileSync("brain", [...args, "--brain", brainDir, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
  catch (e) { return JSON.parse(e.stdout); }
};

if (process.argv.includes("--mark")) {
  writeFileSync(markFile, JSON.stringify({ head: git("rev-parse", "HEAD"), log: state().log.length, at: new Date().toISOString() }, null, 2) + "\n");
  console.log(`marked: ${git("rev-parse", "--short", "HEAD")}, notion-sim call ${state().log.length}`);
  process.exit(0);
}
if (!existsSync(markFile)) { console.error("no mark: run with --mark before the session"); process.exit(2); }
const mark = JSON.parse(readFileSync(markFile, "utf8"));

const commits = git("log", "--reverse", "--format=%h %s", `${mark.head}..HEAD`).split("\n").filter(Boolean).map((line) => {
  const [hash] = line.split(" ");
  return { commit: line, files: git("show", "--name-only", "--format=", hash).split("\n").filter(Boolean) };
});
const uncommitted = git("status", "--porcelain", "--untracked-files=all").split("\n").filter(Boolean);
const changedPaths = new Set([
  ...git("diff", "--name-only", mark.head).split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean));

const pick = ["id", "kind", "status", "finding", "source", "area", "target", "merge_into", "database", "page_id", "page_title", "property", "field", "value_before", "value_after", "value", "closed_reason"];
const proposals = (brain(["proposal", "list"]).data?.proposals ?? [])
  .filter((p) => [...changedPaths].some((path) => p.path && (path === p.path || path.endsWith(`/${p.path}`) || p.path.endsWith(`/${path}`))))
  .map((p) => ({ ...Object.fromEntries(pick.filter((k) => p[k] !== undefined).map((k) => [k, p[k]])),
    decision: p.decision && { action: p.decision.action, decided_by: p.decision.decided_by, decided_at: p.decision.decided_at } }));

const dismissalsPath = join(brainDir, "_assistant", "dismissals.json");
const dismissals = existsSync(dismissalsPath) ? JSON.parse(readFileSync(dismissalsPath, "utf8")).dismissals : null;

const logLines = (() => {
  const diff = git("diff", mark.head, "--", "log");
  return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1));
})();

const s = state();
const dbName = (id) => s.databases[id]?.name ?? id;
const calls = s.log.slice(mark.log);
const reads = calls.filter((c) => /^(get|query|databases)\b/.test(c.cmd));
const writes = calls.filter((c) => !/^(get|query|databases|help)\b/.test(c.cmd)).map((c) => {
  const [cmd, target] = c.cmd.split(" ");
  const page = s.pages[target];
  return { at: c.at, cmd, on: cmd === "create" ? dbName(target) : `${page ? dbName(page.database) : "?"} · ${page?.properties?.Name ?? target}`,
    args: c.cmd.slice(cmd.length + 1 + (target ?? "").length + 1).slice(0, 300), error: c.error };
});
const reviewDb = Object.keys(s.databases).find((id) => s.databases[id].name === "Review");
const reviewRows = Object.entries(s.pages).filter(([, p]) => p.database === reviewDb && !p.in_trash)
  .map(([id, p]) => ({ page: id, name: p.properties.Name, kind: p.properties.Kind, state: p.properties.State, your_call: p.properties["Your call"] ?? null, brain_id: p.properties["Brain ID"] }));

const lint = brain(["lint"]);
const out = {
  since: { commit: mark.head.slice(0, 7), notion_call: mark.log, at: mark.at },
  commits, uncommitted, proposals, dismissals, log_lines: logLines,
  notion: { reads: reads.length, read_errors: reads.filter((c) => c.error).length, writes },
  review_rows: reviewRows,
  lint: { ok: lint.ok, errors: lint.data?.errors, warnings: lint.data?.warnings, issues: (lint.data?.issues ?? []).slice(0, 5) },
};
if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`since ${out.since.commit} / notion call ${out.since.notion_call} (${out.since.at})`);
  console.log(`\ncommits (${commits.length}):`); for (const c of commits) console.log(`  ${c.commit}\n    ${c.files.join("\n    ")}`);
  console.log(`\nuncommitted (${uncommitted.length}):`); for (const u of uncommitted) console.log(`  ${u}`);
  console.log(`\nproposals (${proposals.length}):`); for (const p of proposals) console.log(`  ${JSON.stringify(p)}`);
  console.log(`\ndismissals: ${JSON.stringify(dismissals)}`);
  console.log(`\nlog lines (${logLines.length}):`); for (const l of logLines) console.log(`  ${l}`);
  console.log(`\nnotion-sim: ${out.notion.reads} reads (${out.notion.read_errors} failed), ${writes.length} writes`); for (const w of writes) console.log(`  ${w.at} ${w.cmd} ${w.on}${w.error ? ` ERROR ${w.error}` : ""}\n    ${w.args}`);
  console.log(`\nreview rows (${reviewRows.length}):`); for (const r of reviewRows) console.log(`  ${JSON.stringify(r)}`);
  console.log(`\nlint: ${JSON.stringify(out.lint)}`);
}
