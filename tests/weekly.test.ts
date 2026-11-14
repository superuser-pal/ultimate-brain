import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import { runCli } from "../src/cli.ts";
import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { area, areaRow, meeting, note, project, projectRow, snapshot, task, world, type NoteSpec } from "./assistant-world.ts";
import { brain } from "./helpers.ts";
import { bodies, configure, decide, homeOf, plan, prepare, proposalFiles, readText, record, runWeek, select, tree, weeklyLines, withDatabases, type Judge } from "./weekly-world.ts";

// CC-253: `brain weekly plan`, `select` and `record` on synthetic weeks (spec/weekly-review.md §14, cli.md §5.34). Every name is invented.

const NOW = "2026-11-09T08:00:00Z"; // Monday, 2026-W46
const NEXT = "2026-11-16T08:00:00Z"; // 2026-W47
const HEALTH = "area-2m7c4h8n";
const GARDEN = "area-6p3r8t2w";
const SIGNAGE = "prj-9x4t1b7e";
const HARBOR = "prj-4k8m2q7t";
const LENA = "per-3h8w2n6c";
const REPORT = "reports/2026-11-09-weekly-review.md";
const STATE = "_weekly/state.json";
const P = (n: number) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Extra stalled projects in Health, numbered from 3: more candidates than the limits hold. */
const stalled = (count: number): NoteSpec[] => Array.from({ length: count }, (_, index) =>
  project(`prj-${["2c6v8m3q", "5w9h2k7d", "7j3n6r8x"][index]}`, ["Orchard fence", "Tide charts", "Kiln repair"][index]!, HEALTH, { notion: P(index + 3) }));
const stalledRows = (count: number) => Array.from({ length: count }, (_, index) => projectRow(index + 3, `prj-${["2c6v8m3q", "5w9h2k7d", "7j3n6r8x"][index]}`, ["Orchard fence", "Tide charts", "Kiln repair"][index]!));

async function busy(context: TestContext, extra: { stalled?: number; notes?: NoteSpec[] } = {}): Promise<string> {
  const root = await world(context, [
    area(HEALTH, "Health", { notion: "a0000000-0000-4000-8000-000000000001" }),
    area(GARDEN, "Garden", { notion: "a0000000-0000-4000-8000-000000000002" }),
    project(SIGNAGE, "Pinecrest signage", HEALTH, { notion: P(1) }),
    project(HARBOR, "Harbor app", HEALTH, {
      notion: P(2), updated: "2026-11-06", facts: { budget: "18000 EUR" },
      timeline: [
        { field: "budget", value: "12000 EUR", from: "2026-09", learned: "2026-09-10", source: "mtg-5t2k9w4h", assessment: "accepted" },
        { field: "budget", value: "18000 EUR", from: "2026-11", learned: "2026-11-05", source: "mtg-8c4n2p7w", assessment: "accepted" },
      ],
    }),
    ...stalled(extra.stalled ?? 0),
    note({ id: LENA, type: "person", title: "Lena Hart", updated: "2026-09-01", facts: { role: "Designer" } }),
    meeting("mtg-8c4n2p7w", "Harbor sync", "2026-11-05", { project: HARBOR }),
    meeting("mtg-5t2k9w4h", "Harbor kickoff", "2026-11-03", { project: HARBOR }),
    note({ id: "dec-2p9f6h1r", type: "decision", title: "Launch Harbor app in March", created: "2026-11-04", date: "2026-11-04", sources: ["mtg-8c4n2p7w"] }),
    note({ path: "knowledge/questions/que-7h3m9q2c.md", id: "que-7h3m9q2c", type: "question", title: "Who signs off the Harbor budget?", created: "2026-11-05", status: "open", asked_in: "mtg-8c4n2p7w" }),
    ...(extra.notes ?? []),
  ]);
  await bodies(root, {
    "knowledge/meetings/mtg-8c4n2p7w.md": "Lena Hart now leads design for Harbor.",
    "knowledge/meetings/mtg-5t2k9w4h.md": "Lena Hart presented the mockups.",
  });
  await configure(root, withDatabases);
  return root;
}

const busySnapshot = (now = NOW, parts: { stalled?: number; tasks?: ReturnType<typeof task>[] } = {}) => snapshot({
  as_of: now,
  tasks: parts.tasks ?? [
    task(1, "Send the logo proposals", { due: "2026-10-30", projects: [P(1)] }),
    task(2, "Book the venue", { status: "Waiting On", projects: [P(2)] }),
    task(3, "Draft the Harbor brief", { due: "2026-11-12", created: "2026-11-06T09:00:00Z", projects: [P(2)] }),
  ],
  projects: [projectRow(1, SIGNAGE, "Pinecrest signage"), projectRow(2, HARBOR, "Harbor app"), ...stalledRows(parts.stalled ?? 0)],
  areas: [areaRow(1, HEALTH, "Health"), areaRow(2, GARDEN, "Garden")],
});

/** The skill's reading of a cluster: Lena Hart's role is overtaken by the meetings naming her; other clusters are nothing. */
const judge: Judge = (cluster) => cluster.signal === "overtaken"
  ? { cluster: cluster.key, kind: "contradiction", fingerprint: `contradiction:${cluster.notes[0].id}:role`, targets: [cluster.notes[0].id], evidence: cluster.evidence.map((input: { id: string }) => input.id), subject: `${cluster.notes[0].title}: role`, decide: "now leads design?" }
  : null;

const state = async (root: string) => JSON.parse(await readText(root, STATE));
const frontmatter = async (root: string, path: string) => parseFrontmatter(await readText(root, path)).attributes as Record<string, any>;
const section = (body: string, heading: string) => body.split(`## ${heading}\n`)[1]!.split("\n## ")[0]!;

test("busy: one report with three sections, the limits held in priority order, cited bullets, the rest queued, nothing applied", async (context) => {
  const root = await busy(context, { stalled: 3 });
  const week = await runWeek(root, busySnapshot(NOW, { stalled: 3 }), NOW, { judge });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  const data = week.record!.json.data;
  assert.equal(data.path, REPORT);
  assert.equal(data.week, "2026-W46");

  const selection = week.select!.json.data;
  const { decisions, new_items, targets } = selection.counts;
  assert.ok(decisions <= 5 && new_items <= 5 && targets <= 5, JSON.stringify(selection.counts));
  assert.equal(decisions, 5);
  // §5.2: the contradiction first, then overdue and stalled work in the assistant's rank; structure cleanup comes after and is queued here.
  assert.deepEqual(selection.items.map((item: any) => item.category), ["contradiction", "overdue", "stalled", "stalled", "stalled"]);
  assert.ok(selection.queued.length >= 2, JSON.stringify(selection.queued));
  assert.equal(selection.counts.queued, selection.queued.length);
  assert.ok(selection.queued.some((entry: any) => entry.key === `area_empty:${GARDEN}`), "the structure item waits for next week");

  const text = await readText(root, REPORT);
  const body = text.split("\n---\n")[1]!;
  for (const heading of ["What changed", "Task analysis", "What needs your decision"]) assert.ok(body.includes(`## ${heading}\n`), heading);
  for (const bullet of section(body, "What changed").trim().split("\n")) assert.match(bullet, /^- \*\*(Decided|Changed|Open|Answered|Next):\*\* .+\]\(.+\), \d{1,2} [A-Z][a-z]{2}\)/);
  assert.match(section(body, "Task analysis"), /Order of attention:\n1\. Send the logo proposals: due 30 Oct, 10 days late\./);
  assert.match(body, new RegExp(`${selection.queued.length} more findings? wait(s)? for next week\\. Say "weekly review more" in a session for the rest\\.`));
  const words = body.split("\n").slice(2).join(" ").replace(/\]\([^)]*\)/g, "]").split(/\s+/).filter(Boolean).length;
  assert.ok(words <= 450, `${words} words`);

  // Every new Review item is a pending proposal: a weekly run applies nothing.
  const files = await proposalFiles(root);
  assert.equal(files.length, new_items);
  for (const name of files) assert.equal((await frontmatter(root, `_proposals/${name}`)).status, "pending", name);
  const fm = await frontmatter(root, REPORT);
  assert.deepEqual([fm.type, fm.view_kind, fm.week, fm.coverage, fm.counts], ["view", "weekly_review", "2026-W46", "complete", selection.counts]);
  assert.equal(fm.title, "Weekly review · 9–15 Nov 2026");
  assert.equal(fm.generated_from.some((id: string) => id.startsWith("prp-")), false, "the proposals it links are not its sources");

  const lines = await weeklyLines(root);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /^- 2026-11-09T08:00:00Z weekly - "" mode=unattended week=2026-W46 coverage=complete decisions=5 new_items=\d targets=\d queued=\d+ changes=4 failed=0 published=no notes_read=3 seconds=60$/);

  const saved = await state(root);
  assert.deepEqual(saved.last_success, { week: "2026-W46", report: data.id, covered_to: NOW, covered_on_to: [], coverage: "complete" });
  assert.deepEqual(saved.weeks["2026-W46"].items, selection.items.map((item: any) => item.key));
  assert.equal(saved.weeks["2026-W46"].path, REPORT);
  assert.deepEqual(saved.queued.map((entry: any) => entry.key), selection.queued.map((entry: any) => entry.key));
  const lint = await brain(["lint", "--brain", root, "--json"]);
  const ours = lint.json.data.issues.filter((issue: any) => issue.severity === "error" && /^(reports|_weekly|_proposals)\//.test(issue.path));
  assert.deepEqual(ours, [], "the files the run wrote lint clean (the synthetic fixtures are not the point here)");
});

test("quiet: a first run with nothing to say, and a week where every finding was already shown, write nothing", async (context) => {
  const empty = await world(context, []);
  const before = await tree(empty);
  const first = await plan(empty, snapshot({ as_of: NOW }), NOW);
  assert.equal(first.code, 0, first.stdout);
  assert.equal(first.json.data.quiet, true);
  assert.deepEqual(await tree(empty), before);

  const root = await busy(context);
  const tasks = [task(2, "Book the venue", { status: "Waiting On", projects: [P(2)] })];
  const week1 = await runWeek(root, busySnapshot(NOW, { tasks }), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  // The contradiction is decided; next week brings nothing new, and the stalled project's row is still pending.
  const contradiction = (await proposalFiles(root)).find((name) => name.includes("lena-hart"))!;
  const decided = await decide(root, (await frontmatter(root, `_proposals/${contradiction}`)).id, "reject", "2026-11-10T09:00:00Z");
  assert.equal(decided.code, 0, decided.stdout);
  const snapshotBefore = await tree(root);
  const week2 = await plan(root, busySnapshot(NEXT, { tasks }), NEXT);
  assert.equal(week2.code, 0, week2.stdout);
  assert.equal(week2.json.data.quiet, true, JSON.stringify({ changes: week2.json.data.changes, clusters: week2.json.data.clusters, findings: week2.json.data.findings?.filter((finding: any) => finding.repetition.show) }));
  assert.deepEqual(await tree(root), snapshotBefore, "no file, state or log line");
  assert.equal((await weeklyLines(root)).length, 1);
});

let inputs = 0;
async function inputFile(root: string, value: unknown): Promise<string> {
  const path = join(root, "..", `decide-${inputs += 1}.json`);
  await writeFile(path, JSON.stringify(value));
  return path;
}

test("same-week rerun: unchanged is quiet; with a new change it rewrites the same file in place, with no duplicate item and the counts kept", async (context) => {
  const root = await busy(context);
  const week1 = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  const first = await frontmatter(root, REPORT);
  const proposalsBefore = await proposalFiles(root);

  const later = "2026-11-09T10:00:00Z";
  const unchanged = await tree(root);
  const rerun = await plan(root, busySnapshot(later), later);
  assert.equal(rerun.json.data.quiet, true, "the same inputs as this week's report");
  assert.deepEqual(await tree(root), unchanged);

  await writeFile(join(root, "knowledge/decisions/dec-6r2w8k4m.md"), "---\nid: dec-6r2w8k4m\ntype: decision\ntitle: Move the Harbor demo to Friday\nsummary: Synthetic.\nlifecycle: reviewed\ndate: 2026-11-09\ncreated: 2026-11-09\nupdated: 2026-11-09\n---\n");
  const week1b = await runWeek(root, busySnapshot(later), later, { judge });
  assert.equal(week1b.plan.json.data.quiet, false);
  assert.equal(week1b.record!.code, 0, week1b.record!.stdout);
  assert.equal(week1b.record!.json.data.path, REPORT, "the same file");
  assert.equal(week1b.record!.json.data.id, first.id, "the same id");
  assert.deepEqual(await proposalFiles(root), proposalsBefore, "no new Review item");
  const again = week1b.select!.json.data;
  assert.deepEqual(again.items.map((item: any) => [item.key, item.because, item.write]), week1.select!.json.data.items.map((item: any) => [item.key, "this_week", false]));
  assert.deepEqual(again.counts, week1.select!.json.data.counts, "the week's counts are kept, not doubled");
  const fm = await frontmatter(root, REPORT);
  assert.deepEqual([fm.window.from, fm.window.to, fm.created], [first.window.from, later, first.created]);
  assert.ok((await readText(root, REPORT)).includes("Move the Harbor demo to Friday"));
  assert.equal((await readText(root, REPORT)).match(/## What needs your decision/g)!.length, 1);
  assert.equal((await weeklyLines(root)).length, 2);
});

test("repeated finding: shown ones are counted, not items; new evidence and a newly overdue task are items again; a dismissed and a rejected one stay out", async (context) => {
  const root = await busy(context);
  const week1 = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  assert.deepEqual(week1.select!.json.data.items.map((item: any) => item.key), [`contradiction:${LENA}:role`, `task_overdue:notion:${"c0000000-0000-4000-8000-000000000001"}`, `project_stalled:${SIGNAGE}`, `area_empty:${GARDEN}`]);

  // The user rejects the stalled project's row and dismisses the empty Area.
  const stalledRow = (await proposalFiles(root)).find((name) => name.includes("pinecrest"))!;
  const id = (await frontmatter(root, `_proposals/${stalledRow}`)).id;
  const rejected = await decide(root, id, "reject", "2026-11-10T09:00:00Z");
  assert.equal(rejected.code, 0, rejected.stdout);
  assert.equal((await brain(["assistant", "dismiss", "--brain", root, "--json", "--now", "2026-11-10T09:00:00Z", "--input", await inputFile(root, { dismissals: [{ key: `area_empty:${GARDEN}`, reason: "keeping it for spring" }] })])).code, 0);

  const tasks = [
    task(1, "Send the logo proposals", { due: "2026-11-02", projects: [P(1)] }), // a new due date, still late: new evidence
    task(2, "Book the venue", { status: "Waiting On", projects: [P(2)] }),
    task(3, "Draft the Harbor brief", { due: "2026-11-12", created: "2026-11-06T09:00:00Z", projects: [P(2)] }), // overdue since last week
  ];
  const week2 = await runWeek(root, busySnapshot(NEXT, { tasks }), NEXT, { judge });
  assert.equal(week2.record!.code, 0, week2.record!.stdout);
  const items = week2.select!.json.data.items;
  const byKey = Object.fromEntries(items.map((item: any) => [item.key, item]));
  assert.equal(byKey[`task_overdue:notion:c0000000-0000-4000-8000-000000000001`]?.because, "evidence");
  assert.equal(byKey[`task_overdue:notion:c0000000-0000-4000-8000-000000000003`]?.because, "new");
  // The contradiction on a reviewed note stays visible while unresolved, linking its pending row (D 1, I 0).
  const contradiction = byKey[`contradiction:${LENA}:role`];
  assert.deepEqual([contradiction?.because, contradiction?.write, contradiction?.new_items], ["critical", false, 0]);
  assert.match(contradiction.proposal, /^prp-/);
  assert.equal(byKey[`project_stalled:${SIGNAGE}`], undefined, "rejected: held 30 days");
  assert.equal(byKey[`area_empty:${GARDEN}`], undefined, "dismissed");
  assert.equal(week2.select!.json.data.queued.some((entry: any) => [`project_stalled:${SIGNAGE}`, `area_empty:${GARDEN}`].includes(entry.key)), false);
  assert.ok(await readFile(join(root, "reports/2026-11-16-weekly-review.md"), "utf8"));
});

test("missed week: four weeks since the last review, the 8 most consequential changes, the rest counted", async (context) => {
  const decisions = Array.from({ length: 10 }, (_, index) => {
    const date = `2026-11-${String(16 + index).padStart(2, "0")}`;
    return note({ id: `dec-${"abcdefghjk"[index]}${"2m4n6p8q".slice(0, 7)}`, type: "decision", title: `Synthetic decision ${index + 1}`, created: date, date });
  });
  const root = await busy(context);
  const week1 = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  for (const spec of decisions) {
    const { path, ...attributes } = spec;
    const { stringify } = await import("yaml");
    await writeFile(join(root, path), `---\n${stringify(attributes, { lineWidth: 0, flowCollectionPadding: false })}---\n`);
  }
  const later = "2026-12-07T08:00:00Z";
  const week5 = await runWeek(root, busySnapshot(later), later, { judge });
  assert.equal(week5.record!.code, 0, week5.record!.stdout);
  const planned = week5.plan.json.data;
  assert.equal(planned.window.from, NOW, "from the last success");
  assert.equal(planned.changes.filter((change: any) => change.bullet).length, 8);
  const body = await readText(root, "reports/2026-12-07-weekly-review.md");
  assert.match(body, /\n28 days since the last review\. Covered: 10 changes from 0 meetings and 0 sources\. 2 not shown: 2 decided\./);
  assert.equal(section(body, "What changed").trim().split("\n").length, 8);
  assert.match(body, new RegExp(`Covered: ${planned.changes.length} changes`));
  assert.match(body, new RegExp(`${planned.changes.length - 8} not shown`));
});

test("partial: clusters beyond the budget are omitted honestly, the limits hold, and next week judges them first", async (context) => {
  const ivo = note({ id: "per-8d4f2j6k", type: "person", title: "Ivo Brand", updated: "2026-09-01", facts: { role: "Engineer" } });
  const root = await busy(context, { notes: [ivo] });
  await bodies(root, {
    "knowledge/meetings/mtg-8c4n2p7w.md": "Ivo Brand now leads the backend.",
    "knowledge/meetings/mtg-5t2k9w4h.md": "Ivo Brand reviewed the API.",
  });
  await configure(root, (config) => { config.settings = { ...config.settings, weekly: { max_judged: 1 } }; });
  const week1 = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  const planned = week1.plan.json.data;
  assert.equal(planned.clusters.length, 1);
  assert.equal(planned.clusters_left.length, 1);
  const left = planned.clusters_left[0];
  const selection = week1.select!.json.data;
  assert.equal(selection.coverage, "partial");
  assert.deepEqual(selection.omitted.clusters, [left]);
  const fm = await frontmatter(root, REPORT);
  assert.deepEqual([fm.coverage, fm.omitted.clusters], ["partial", 1]);
  assert.match(await readText(root, REPORT), /Partial: /);
  assert.ok(selection.counts.decisions <= 5 && selection.counts.new_items <= 5 && selection.counts.targets <= 5);
  assert.deepEqual((await state(root)).carry.clusters, [left]);

  const week2 = await plan(root, busySnapshot(NEXT), NEXT);
  assert.equal(week2.json.data.clusters[0]?.key, left, "the omitted cluster is judged first next week");
});

test("the boundary day: a change dated on the last review's day is reported once, and one added after it is not missed", async (context) => {
  const covered = note({ id: "dec-4h7k2m9p", type: "decision", title: "Pick the Harbor colours", created: "2026-11-09", date: "2026-11-09" });
  const root = await busy(context, { notes: [covered] });
  const week1 = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week1.record!.code, 0, week1.record!.stdout);
  assert.ok(week1.plan.json.data.changes.some((change: any) => change.key === "decided:dec-4h7k2m9p"));
  assert.deepEqual((await state(root)).last_success.covered_on_to, ["decided:dec-4h7k2m9p"]);
  await writeFile(join(root, "knowledge/decisions/dec-9q3t6w2y.md"), "---\nid: dec-9q3t6w2y\ntype: decision\ntitle: Hire a second tester\nsummary: Synthetic.\nlifecycle: reviewed\ndate: 2026-11-09\ncreated: 2026-11-09\nupdated: 2026-11-09\n---\n");
  const week2 = await plan(root, busySnapshot(NEXT), NEXT);
  const keys = week2.json.data.changes.map((change: any) => change.key);
  assert.equal(keys.includes("decided:dec-4h7k2m9p"), false, "not checked twice");
  assert.equal(keys.includes("decided:dec-9q3t6w2y"), true, "not missed");
});

test("record checks the shape: a bullet without its label, a dead link, too many words, and publishing with Reports off write nothing", async (context) => {
  const root = await busy(context);
  const prepared = await prepare(root, busySnapshot(), NOW, { judge });
  const before = await tree(root);
  const base = { input_hash: prepared.plan.json.data.input_hash, proposals: prepared.proposals, task_analysis: ["- No overdue, stalled or blocked work."], mode: "attended", publish: false, failures: [], notes_read: 1, seconds: 5 };
  const ok = "- **Decided:** Launch Harbor app in March ([decision](../knowledge/decisions/dec-2p9f6h1r.md), 4 Nov).";

  const noLabel = await record(root, { ...base, what_changed: ["- Launch Harbor app in March ([decision](../knowledge/decisions/dec-2p9f6h1r.md), 4 Nov)."] }, NOW);
  assert.equal(noLabel.json.error.code, "INPUT_INVALID");
  const dead = await record(root, { ...base, what_changed: ["- **Decided:** Launch Harbor app in March ([decision](../knowledge/decisions/dec-0000zzzz.md), 4 Nov)."] }, NOW);
  assert.equal(dead.json.error.code, "INPUT_INVALID", dead.stdout);
  assert.match(dead.json.error.message, /dec-0000zzzz/);
  const long = await record(root, { ...base, what_changed: [ok, ...Array.from({ length: 7 }, () => `- **Open:** ${"word ".repeat(70).trim()} ([q](../knowledge/questions/que-7h3m9q2c.md), 5 Nov).`)] }, NOW);
  assert.equal(long.json.error.code, "WEEKLY_TOO_LONG", long.stdout);
  assert.equal(long.code, 4);
  await configure(root, (config) => { config.modules = { ...config.modules, reports: false }; });
  const reportsOff = await record(root, { ...base, what_changed: [ok], publish: true }, NOW);
  assert.equal(reportsOff.json.error.code, "INPUT_INVALID", reportsOff.stdout);
  assert.match(reportsOff.json.error.message, /Reports/);
  await configure(root, (config) => { config.modules = { ...config.modules, reports: true }; });
  const brainJson = (lines: string[]) => lines.filter((line) => !line.startsWith("brain.json "));
  assert.deepEqual(brainJson(await tree(root)), brainJson(before), "nothing written");
});

test("Notion unreachable: the header says brain only, and the run is not quiet", async (context) => {
  const root = await busy(context);
  const snap = { as_of: NOW, notion: "unreachable", repos: [] };
  const week = await runWeek(root, snap, NOW, { judge });
  assert.equal(week.plan.json.data.quiet, false);
  assert.equal(week.record!.code, 0, week.record!.stdout);
  assert.match(await readText(root, REPORT), /\nWeek of 9 Nov 2026 · first review, last 7 days · Notion unreachable: brain only\n/);
});

test("a damaged state file fails plan with WEEKLY_STATE_UNREADABLE, and lint names it", async (context) => {
  const root = await busy(context);
  assert.equal((await runWeek(root, busySnapshot(), NOW, { judge })).record!.code, 0);
  const saved = await state(root);
  saved.shown.push(saved.shown[0]);
  await writeFile(join(root, STATE), JSON.stringify(saved));
  const planned = await plan(root, busySnapshot(NEXT), NEXT);
  assert.equal(planned.json.error.code, "WEEKLY_STATE_UNREADABLE");
  assert.equal(planned.code, 5);
  const lint = await brain(["lint", "--brain", root, "--json"]);
  assert.ok(lint.json.data.issues.some((issue: any) => issue.rule === "weekly-state" && issue.path === STATE && /repeats the key/.test(issue.message)), JSON.stringify(lint.json.data.issues));
});

test("publishing: sync render puts the report in Documents with Origin Report, a proposal link as its Review row once the row exists", async (context) => {
  const root = await busy(context);
  await configure(root, (config) => { config.notion.databases = { ...config.notion.databases, documents: "a1000000-0000-4000-8000-00000000000d", review: "a1000000-0000-4000-8000-00000000000e" }; });
  const week = await runWeek(root, busySnapshot(), NOW, { judge, publish: true });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  assert.match((await weeklyLines(root))[0]!, / published=yes /);
  const id = week.record!.json.data.id;
  const render = async () => (await brain(["sync", "render", "--ids", id, "--brain", root, "--json", "--now", NOW])).json.data.items[0];
  const first = await render();
  assert.deepEqual([first.database, first.action, first.properties.Origin, first.properties.Name.value], ["documents", "create", { type: "select", value: "Report" }, "Weekly review · 9–15 Nov 2026"]);
  assert.match(first.body, /^1\. Contradiction · Lena Hart: role · now leads design\? → Review row \(after the next publish\)$/m);
  assert.match(first.body, /^2\. Overdue · "Send the logo proposals" · .+ → \[the task\]\(https:\/\/www\.notion\.so\/c0000000000040008000000000000001\)$/m);
  assert.equal(first.body.includes("_proposals/"), false, "no brain path in Notion");

  // The contradiction's row is published: the report's next render links it.
  const proposal = week.proposals[0]!;
  const row = (await brain(["sync", "render", "--ids", proposal, "--brain", root, "--json", "--now", NOW])).json.data.items[0];
  const ROW = "6c5d4e3f-2a1b-4c0d-9e8f-7a6b5c4d3e2f";
  const synced = await brain(["sync", "record", "--brain", root, "--json", "--now", NOW, "--input", await inputFile(root, { records: [{ id: proposal, notion: ROW, synced_at: NOW, published: row.published }] })]);
  assert.equal(synced.code, 0, synced.stdout);
  const second = await render();
  assert.match(second.body, /^1\. Contradiction · Lena Hart: role · now leads design\? → \[Review\]\(https:\/\/www\.notion\.so\/6c5d4e3f2a1b4c0d9e8f7a6b5c4d3e2f\)$/m);
  assert.match(await readText(root, REPORT), /→ \[Review\]\(\.\.\/_proposals\//, "the Git report is never rewritten for Notion");
});

test("status: unattended.weekly from the log line and the attempt marker, weekly_snapshot and settings.weekly", async (context) => {
  const root = await busy(context);
  const none = (await brain(["status", "--brain", root, "--json"])).json.data;
  assert.equal(none.unattended.weekly, null);
  assert.deepEqual(none.settings.weekly, { minutes: 10, max_judged: 30, max_usd: 3, schedule: "off" });
  assert.match(none.weekly_snapshot, /\/\.ultimate-brain\/weekly\/brain-[0-9a-f]{8}\.json$/);
  assert.equal(none.weekly_snapshot.startsWith("~"), false, "the expanded home path");

  assert.equal((await runWeek(root, busySnapshot(), NOW, { judge })).record!.code, 0);
  await writeFile(join(root, "_weekly/attempt.json"), JSON.stringify({ week: "2026-W47", started: "2026-11-16T08:00:00Z", mode: "unattended" }));
  const fresh = (await brain(["status", "--brain", root, "--json", "--now", "2026-11-16T09:00:00Z"])).json.data.unattended.weekly;
  assert.deepEqual(fresh, { last: NOW, week: "2026-W46", coverage: "complete", decisions: 4, failed: 0, failures: [], report: REPORT, unfinished: null });
  const stuck = (await brain(["status", "--brain", root, "--json", "--now", "2026-11-16T10:30:00Z"])).json.data.unattended.weekly;
  assert.deepEqual(stuck.unfinished, { week: "2026-W47", started: "2026-11-16T08:00:00Z", mode: "unattended" });
  assert.match(await readFile(join(root, ".gitignore"), "utf8"), /^_weekly\/attempt\.json$/m, "the marker is never committed");
});

async function scheduleEnv(context: TestContext, platform: string) {
  const root = await mkdtemp(join(tmpdir(), "weekly-schedule-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  await mkdir(bin);
  await writeFile(join(bin, "claude"), "#!/bin/sh\n");
  await chmod(join(bin, "claude"), 0o755);
  const agents = join(root, "LaunchAgents");
  return { agents, bin, env: { PATH: bin, UB_LAUNCH_AGENTS_DIR: agents, UB_SCHEDULE_PLATFORM: platform } as NodeJS.ProcessEnv, home: root };
}

async function schedule(dir: string, args: string[], env: NodeJS.ProcessEnv, home: string) {
  const out: string[] = [];
  const code = await runCli(["schedule", ...args, "--brain", dir, "--json"], { io: { stdout: { write: (value) => out.push(String(value)) }, stderr: { write: () => undefined } }, env, homeDirectory: home });
  return { code, json: JSON.parse(out.join("")) };
}

test("schedule install weekly-review: Monday 08:00 by default, the budget cap from settings or --max-budget-usd, as a plist and as a cron line", async (context) => {
  const root = await busy(context);
  const skill = join(root, ".claude/skills/brain-weekly-review");
  const { env, home, bin } = await scheduleEnv(context, "darwin");
  const missing = await schedule(root, ["install", "weekly-review", "--model", "claude-sonnet-5-5"], env, home);
  assert.equal(missing.json.error.code, "SKILL_MISSING");
  await mkdir(skill, { recursive: true });
  await writeFile(join(skill, "SKILL.md"), "---\nname: brain-weekly-review\ndescription: synthetic\n---\n");

  const installed = await schedule(root, ["install", "weekly-review", "--model", "claude-sonnet-5-5"], env, home);
  assert.equal(installed.code, 0, JSON.stringify(installed.json));
  const data = installed.json.data;
  assert.match(data.label, /^eu\.ultimate-brain\.brain-[0-9a-f]{8}\.weekly-review$/);
  assert.deepEqual([data.times, data.days, data.prompt], [["08:00"], ["mon"], "weekly review unattended"]);
  assert.deepEqual(data.command, [join(bin, "claude"), "-p", "weekly review unattended", "--model", "claude-sonnet-5-5", "--max-budget-usd", "3"]);
  assert.deepEqual(installed.json.warnings.map((warning: any) => warning.code), ["FOLDER_TRUST"]);
  assert.match(installed.json.warnings[0].message, /Open Claude Code in .+ once and accept the trust dialog/);
  const plist = await readFile(data.path, "utf8");
  assert.match(plist, /<string>weekly review unattended<\/string>\s*<string>--model<\/string>\s*<string>claude-sonnet-5-5<\/string>\s*<string>--max-budget-usd<\/string>\s*<string>3<\/string>/);
  assert.match(plist, /<key>Hour<\/key>\s*<integer>8<\/integer>\s*<key>Minute<\/key>\s*<integer>0<\/integer>\s*<key>Weekday<\/key>\s*<integer>1<\/integer>/);
  // The snapshot file and the schedule label name the brain the same way.
  const status = (await brain(["status", "--brain", root, "--json"])).json.data;
  assert.equal(status.weekly_snapshot.split("/").at(-1), `${data.label.split(".")[2]}.json`);

  const capped = await schedule(root, ["install", "weekly-review", "--model", "claude-sonnet-5-5", "--max-budget-usd", "1.5", "--at", "07:30", "--days", "sun"], env, home);
  assert.deepEqual(capped.json.data.command.slice(-2), ["--max-budget-usd", "1.5"]);
  assert.equal((await schedule(root, ["install", "catch-up", "--model", "claude-sonnet-5-5", "--max-budget-usd", "2"], env, home)).json.error.code, "USAGE");
  assert.equal((await schedule(root, ["install", "weekly-review", "--model", "claude-sonnet-5-5", "--max-budget-usd", "0"], env, home)).json.error.code, "USAGE");

  const linux = await scheduleEnv(context, "linux");
  await configure(root, (config) => { config.settings = { ...config.settings, weekly: { max_usd: 2 } }; });
  const cron = await schedule(root, ["install", "weekly-review", "--model", "claude-sonnet-5-5"], linux.env, linux.home);
  assert.equal(cron.code, 0, JSON.stringify(cron.json));
  assert.deepEqual(cron.json.warnings.map((warning: any) => warning.code), ["FOLDER_TRUST"], "the cron line needs the trusted folder too");
  assert.match(cron.json.data.cron[0], /^0 8 \* \* 1 mkdir -p .+ '-p' 'weekly review unattended' '--model' 'claude-sonnet-5-5' '--max-budget-usd' '2' >> "\$HOME\/\.ultimate-brain\/logs\/eu\.ultimate-brain\..+\.weekly-review\.log" 2>&1$/);
});

test("upgrade adds the attempt marker to an older brain's .gitignore, once", async (context) => {
  const root = await world(context, []);
  const ignore = join(root, ".gitignore");
  const shipped = await readFile(ignore, "utf8");
  await writeFile(ignore, shipped.replace(/^_weekly\/attempt\.json\n/m, "").replace(/# The weekly review.*\n/, ""));
  const run = await brain(["upgrade", "--brain", root, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.ok(run.json.data.files.some((entry: any) => entry.path === ".gitignore" && entry.action === "updated"), JSON.stringify(run.json.data.files));
  assert.match(await readFile(ignore, "utf8"), /^_weekly\/attempt\.json$/m);
  const again = await brain(["upgrade", "--brain", root, "--json"]);
  assert.equal(again.json.data.files.some((entry: any) => entry.path === ".gitignore"), false);
});

test("the hand-off files: plan prints a summary and saves the plan beside the snapshot; select and record go by input_hash; record removes them", async (context) => {
  const root = await busy(context);
  const folder = join(homeOf(root), ".ultimate-brain", "weekly");
  const planned = await plan(root, busySnapshot(), NOW);
  const summary = planned.summary;
  assert.deepEqual(Object.keys(summary).sort(), ["as_of", "counts", "file", "input_hash", "local_date", "notion", "quiet", "report", "week", "window"]);
  assert.equal(planned.stdout.includes('"clusters":['), false, "the plan itself is not printed");
  assert.equal(dirname(summary.file), folder, "beside the snapshot, outside the brain");
  assert.equal(summary.file.startsWith(`${root}/`), false);
  assert.deepEqual(summary.counts, { changes: 4, findings: planned.json.data.findings.length, findings_shown: planned.json.data.findings.filter((finding: any) => finding.repetition.show).length, clusters: 1, clusters_left: 0, corrections: 0, pending: 0, earlier_open: 0 });
  const status = (await brain(["status", "--brain", root, "--json"], homeOf(root))).json.data;
  assert.equal(summary.file, status.weekly_snapshot.replace(/\.json$/, ".plan.json"));

  const judged = { clusters: [`overtaken:${LENA}`], findings: [], corrections: [] };
  const stale = await select(root, { input_hash: `sha256:${"0".repeat(64)}`, judged }, NOW);
  assert.equal(stale.json.error.code, "INPUT_INVALID");
  assert.match(stale.json.error.message, /another plan/);
  const embedded = await select(root, { plan: planned.json.data, judged }, NOW);
  assert.equal(embedded.code, 0, "embedding the plan still works");
  const selected = await select(root, { input_hash: summary.input_hash, judged }, NOW);
  assert.equal(selected.code, 0, selected.stdout);
  const selectionFile = join(folder, basename(summary.file).replace(".plan.json", ".selection.json"));
  assert.deepEqual(JSON.parse(await readFile(selectionFile, "utf8")), selected.json.data);
  assert.equal(selected.json.data.input_hash, summary.input_hash);

  // A new plan drops the selection of the earlier one.
  await plan(root, busySnapshot(), NOW);
  await assert.rejects(readFile(selectionFile));
  const noSelection = await record(root, { input_hash: summary.input_hash, proposals: [], what_changed: ["- Nothing new this week."], task_analysis: ["- No overdue, stalled or blocked work."], mode: "attended", publish: false, failures: [], notes_read: 0, seconds: 1 }, NOW);
  assert.equal(noSelection.json.error.code, "INPUT_INVALID");
  assert.match(noSelection.json.error.message, /no saved selection/);

  const week = await runWeek(root, busySnapshot(), NOW, { judge });
  assert.equal(week.record!.code, 0, week.record!.stdout);
  await assert.rejects(readFile(summary.file), "record removes the plan file");
  await assert.rejects(readFile(selectionFile), "and the selection file");
  assert.equal((await tree(root)).some((line) => line.includes(".plan.json") || line.includes(".selection.json")), false, "never in the brain");

  const quiet = await plan(root, busySnapshot("2026-11-09T09:00:00Z"), "2026-11-09T09:00:00Z");
  assert.deepEqual([quiet.json.data.quiet, quiet.json.data.file], [true, null]);
  await assert.rejects(readFile(summary.file), "a quiet plan writes no file");
});
