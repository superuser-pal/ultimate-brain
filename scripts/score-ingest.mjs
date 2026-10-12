#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export async function scoreIngest({ base, run, expected: expectedPath, skipKinds = [] }) {
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  const skip = new Set(skipKinds);
  const files = await diffFiles(base, run);
  if (expected.expect.stop === true) {
    const pass = files.created.length === 0 && files.changed.length === 0 && files.deleted.length === 0;
    return { case: expected.case, files, verdict: pass ? "pass" : "fail", stop: { pass } };
  }

  const created = await Promise.all(files.created.map(async (path) => ({ path, ...await markdown(join(run, path)) })));
  const notes = created.filter((file) => file.attributes?.type && file.attributes.type !== "meeting" && file.attributes.type !== "source" && !file.path.startsWith("_proposals/"));
  const meeting = created.find((file) => file.attributes?.type === "meeting");
  const proposals = created.filter((file) => file.path.startsWith("_proposals/") && file.attributes?.type === "proposal");
  const tasks = meeting === undefined ? [] : actionItems(meeting.body);
  const matchedNotes = matchItems(expected.expect.notes ?? [], notes, noteMatches, { meeting, notes });
  const matchedProposals = matchItems((expected.expect.proposals ?? []).filter((item) => !skip.has(item.kind)), proposals, proposalMatches, { meeting, notes: matchedNotes.items });
  const matchedTasks = matchItems(expected.expect.tasks ?? [], tasks, taskMatches, {});
  const metrics = {
    notes: metricsFor(matchedNotes, notes, expected.optional ?? [], noteMatches, { meeting, notes: matchedNotes.items }),
    proposals: metricsFor(matchedProposals, proposals, expected.optional ?? [], proposalMatches, { meeting, notes: matchedNotes.items }),
    tasks: metricsFor(matchedTasks, tasks, expected.optional ?? [], taskMatches, {}),
  };
  const meetingCheck = meetingMatches(expected.expect.meeting, meeting, { meeting, notes: matchedNotes.items });
  const mustNot = await mustNotFailures(expected.expect.must_not ?? [], { base, run, files, notes, proposals, meeting, matchedNotes });
  const lint = lintRun(run);
  const pass = meetingCheck.pass && Object.values(metrics).every((metric) => metric.recall >= 0.8 && metric.precision >= 0.8)
    && mustNot.length === 0 && lint.errors === 0;
  return {
    case: expected.case, files, meeting: meetingCheck, metrics,
    unmatched: { notes: matchedNotes.unmatched, proposals: matchedProposals.unmatched, tasks: matchedTasks.unmatched },
    unexpected: { notes: metrics.notes.unexpected, proposals: metrics.proposals.unexpected, tasks: metrics.tasks.unexpected },
    must_not: mustNot, lint, verdict: pass ? "pass" : "fail",
  };
}

async function diffFiles(base, run) {
  const [baseFiles, runFiles] = await Promise.all([allFiles(base), allFiles(run)]);
  const paths = new Set([...baseFiles.keys(), ...runFiles.keys()]);
  const created = []; const changed = []; const deleted = [];
  for (const path of [...paths].sort()) {
    if (ignored(path)) continue;
    if (!baseFiles.has(path)) created.push(path);
    else if (!runFiles.has(path)) deleted.push(path);
    else if (!baseFiles.get(path).equals(runFiles.get(path))) changed.push(path);
  }
  return { created, changed, deleted };
}

async function allFiles(root, directory = root, result = new Map()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await allFiles(root, path, result);
    else if (entry.isFile()) result.set(relative(root, path).split(sep).join("/"), await readFile(path));
  }
  return result;
}

function ignored(path) {
  return path === "index.md" || path.startsWith("log/")
    || /^projects\/[^/]+\/(brief|decision-log)\.md$/.test(path);
}

async function markdown(path) {
  const source = await readFile(path, "utf8");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  return match === null ? { attributes: null, body: source } : { attributes: parse(match[1]), body: match[2] };
}

function normalize(value) {
  return String(value).normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

function equal(expected, actual) {
  if (Array.isArray(expected) || Array.isArray(actual)) return JSON.stringify(expected) === JSON.stringify(actual);
  return normalize(expected) === normalize(actual);
}

function resolveReference(value, context) {
  if (typeof value !== "string") return value;
  if (value === "@meeting") return context.meeting?.attributes.id;
  const named = /^@new:(.+)$/.exec(value);
  if (named) return context.notes.find((note) => normalize(note.attributes.title) === normalize(named[1]))?.attributes.id;
  const indexed = /^@note:(\d+)$/.exec(value);
  return indexed ? context.notes[Number(indexed[1])]?.attributes.id : value;
}

function noteMatches(expectation, note, context) {
  if (expectation.note) expectation = expectation.note;
  if (!note || note.attributes.type !== expectation.type) return false;
  if (!(expectation.title ?? []).every((word) => normalize(note.attributes.title).includes(normalize(word)))) return false;
  return Object.entries(expectation.fields ?? {}).every(([key, value]) => equal(resolveReference(value, context), note.attributes[key]))
    && Object.entries(expectation.facts ?? {}).every(([key, value]) => equal(resolveReference(value, context), note.attributes.facts?.[key]));
}

function proposalMatches(expectation, proposal, context) {
  if (expectation.proposal) expectation = expectation.proposal;
  if (!proposal) return false;
  return Object.entries(expectation).every(([key, value]) => key === "proposal" || equal(resolveReference(value, context), proposal.attributes[key]));
}

function taskMatches(expectation, task) {
  if (!task) return false;
  return (expectation.title ?? []).every((word) => normalize(task.action).includes(normalize(word)))
    && equal(expectation.owner, task.owner) && equal(expectation.due, task.due);
}

function matchItems(expectations, produced, matcher, context) {
  const used = new Set(); const items = []; const unmatched = [];
  for (const expectation of expectations) {
    const index = produced.findIndex((item, i) => !used.has(i) && matcher(expectation, item, context));
    if (index === -1) unmatched.push(expectation);
    else { used.add(index); items.push(produced[index]); }
  }
  return { items, unmatched, used, expected: expectations.length };
}

function metricsFor(matches, produced, optional, matcher, context) {
  const optionalCount = produced.filter((item) => optional.some((entry) => matcher(entry, item, context))).length;
  const denominator = produced.length - optionalCount;
  return {
    recall: matches.expected === 0 ? 1 : matches.items.length / matches.expected,
    precision: denominator === 0 ? 1 : matches.items.length / denominator,
    unexpected: produced.filter((item, index) => !matches.used.has(index) && !optional.some((entry) => matcher(entry, item, context))),
  };
}

function meetingMatches(expectation, meeting, context) {
  if (!meeting) return { pass: false, reason: "no created meeting" };
  for (const key of ["attendees", "projects"]) {
    const expected = (expectation?.[key] ?? []).map((value) => resolveReference(value, context)).sort();
    const actual = [...(meeting.attributes[key] ?? [])].sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) return { pass: false, reason: `${key} differ`, expected, actual };
  }
  return { pass: true };
}

function actionItems(body) {
  const section = /(?:^|\n)## Action items\n([\s\S]*?)(?=\n## |$)/.exec(body)?.[1] ?? "";
  return [...section.matchAll(/^- (.+?) — (.+?) — (.+)$/gm)].map(([, action, owner, due]) => ({ action, owner, due: due === "no date" ? null : due }));
}

async function mustNotFailures(entries, context) {
  const failures = [];
  for (const entry of entries) {
    if (entry.note && context.notes.some((note) => noteMatches(entry.note, note, { meeting: context.meeting, notes: context.matchedNotes.items }))) failures.push(entry);
    if (entry.proposal && context.proposals.some((proposal) => proposalMatches(entry.proposal, proposal, { meeting: context.meeting, notes: context.matchedNotes.items }))) failures.push(entry);
    if (entry.unchanged && !sameFile(join(context.base, entry.unchanged), join(context.run, entry.unchanged))) failures.push(entry);
    if (entry.deleted && !(await exists(join(context.run, entry.deleted)))) failures.push(entry);
    if (entry.changed_status === "_proposals" && await proposalStatusChanged(context.base, context.run)) failures.push(entry);
  }
  return failures;
}

async function sameFile(a, b) { try { return (await readFile(a)).equals(await readFile(b)); } catch { return false; } }
async function exists(path) { try { await readFile(path); return true; } catch { return false; } }
async function proposalStatusChanged(base, run) {
  const files = await allFiles(base);
  for (const path of files.keys()) if (path.startsWith("_proposals/") && path.endsWith(".md")) {
    if (!await sameFileStatus(join(base, path), join(run, path))) return true;
  }
  return false;
}
async function sameFileStatus(a, b) { try { return (await markdown(a)).attributes.status === (await markdown(b)).attributes.status; } catch { return false; } }

function lintRun(run) {
  const command = spawnSync(process.execPath, ["--experimental-strip-types", join(ROOT, "src/cli.ts"), "lint", "--brain", run, "--json"], { encoding: "utf8" });
  try { return JSON.parse(command.stdout).data; } catch { return { errors: 1, warnings: 0, issues: [{ message: command.stderr || "lint did not return JSON" }] }; }
}

function parseArgs(args) {
  const options = { skipKinds: [] };
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i]; const value = args[i + 1];
    if (key === "--skip-kinds") { options.skipKinds = value.split(",").filter(Boolean); i += 1; }
    else if (["--base", "--run", "--expected"].includes(key)) { options[key.slice(2)] = value; i += 1; }
  }
  if (!options.base || !options.run || !options.expected) throw new Error("Usage: score-ingest --base <dir> --run <dir> --expected <expected.json> [--skip-kinds kind,…]");
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const report = await scoreIngest(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.stderr.write(`${report.case}: ${report.verdict.toUpperCase()}\n`);
    process.exitCode = report.verdict === "pass" ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
