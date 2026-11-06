import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  AS_OF, area, areaPage, areaRow, daysAgo, domain, findings, keys, meeting, note, project, projectPage, projectRow, snapshot, stampAgo, task, taskPage, world,
} from "./assistant-world.ts";

// `brain assistant findings` (spec/assistant.md §3 and §4, cli.md §5.31). Synthetic brains only.

const WORK = domain("dom-aaaaaaa1", "Work");
const CLIENTS = area("area-aaaaaaa1", "Clients", { domain: "dom-aaaaaaa1", notion: areaPage(1) });
const CLIENTS_ROW = areaRow(1, "area-aaaaaaa1", "Clients");

async function writeDismissals(root: string, entries: unknown[]): Promise<void> {
  await mkdir(join(root, "_assistant"), { recursive: true });
  await writeFile(join(root, "_assistant", "dismissals.json"), `${JSON.stringify({ version: 1, dismissals: entries }, null, 2)}\n`);
}

test("task_overdue fires at 3 days late and task_stalled at 14 idle days, not one day before; parked, done and dropped tasks never", async (context) => {
  const root = await world(context, [
    WORK, CLIENTS,
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
  ]);
  const p = [projectPage(1)];
  const run = await findings(root, snapshot({
    tasks: [
      task(1, "Send the quote", { due: daysAgo(3), projects: p }),
      task(2, "Call the printer", { due: daysAgo(2), projects: p }),
      task(3, "Draft the copy", { last_edited: stampAgo(14), projects: p }),
      task(4, "Review the copy", { last_edited: stampAgo(13), projects: p }),
      task(5, "Get the quote back", { status: "Waiting On", due: daysAgo(10), last_edited: stampAgo(30), projects: p }),
      task(6, "Maybe a video", { status: "Someday", last_edited: stampAgo(30), projects: p }),
      task(7, "Kickoff", { status: "Done", due: daysAgo(40), last_edited: stampAgo(40), projects: p }),
      task(8, "Old idea", { status: "Won't Do", last_edited: stampAgo(40), projects: p }),
      task(9, "Overdue and idle", { due: daysAgo(5), last_edited: stampAgo(20), projects: p }),
    ],
    projects: [projectRow(1, "prj-aaaaaaa1", "Acme website")],
    areas: [CLIENTS_ROW],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), [`task_overdue:notion:${taskPage(9)}`, `task_overdue:notion:${taskPage(1)}`, `task_stalled:notion:${taskPage(3)}`]);
  const [late, , idle] = run.json.data.findings;
  assert.deepEqual(late.evidence, { due: daysAgo(5), days_late: 5, status: "To Do" });
  assert.deepEqual(idle.evidence, { last_edited: stampAgo(14), days_idle: 14, status: "To Do" });
  const overdue = run.json.data.findings[1];
  assert.deepEqual(overdue.subject, {
    kind: "task", id: null, page_id: taskPage(1), title: "Send the quote",
    current: { status: "To Do", due: daysAgo(3), projects: p, areas: [] },
  });
  assert.equal(overdue.category, "overdue");
  assert.equal(overdue.project, "prj-aaaaaaa1");
  assert.equal(overdue.area, "area-aaaaaaa1");
  assert.equal(overdue.rank, 2);
  assert.deepEqual(overdue.recommendations, [
    { letter: "a", action: "set_task_due", value: null, label: "give it a new due date" },
    { letter: "b", action: "set_task_status", value: "Done", label: "mark it Done" },
    { letter: "c", action: "set_task_status", value: "Won't Do", label: "mark it Won't Do" },
  ]);
  assert.deepEqual(overdue.status_offers, [{ action: "set_task_status", value: "Waiting On" }, { action: "set_task_status", value: "Someday" }]);
  assert.equal(run.json.data.total, 3);
});

test("project_stalled fires at 21 days since the last task done or mention, not at 20, with the activity that dates it", async (context) => {
  const root = await world(context, [
    WORK, CLIENTS,
    project("prj-bbbbbbb1", "Signage", "area-aaaaaaa1", { notion: projectPage(1), created: daysAgo(90), updated: daysAgo(60) }),
    meeting("mtg-bbbbbbb1", "Signage kickoff", daysAgo(21), { area: "area-aaaaaaa1", projects: ["prj-bbbbbbb1"] }),
    project("prj-bbbbbbb2", "Brand refresh", "area-aaaaaaa1", { notion: projectPage(2), created: daysAgo(90), updated: daysAgo(60) }),
    project("prj-bbbbbbb3", "Catalogue", "area-aaaaaaa1", { notion: projectPage(3), created: daysAgo(90), updated: daysAgo(25) }),
    project("prj-bbbbbbb4", "Shed", "area-aaaaaaa1", { notion: projectPage(4), created: daysAgo(90), updated: daysAgo(90) }),
  ]);
  const run = await findings(root, snapshot({
    tasks: [
      task(1, "Sketch the signs", { status: "Done", last_edited: stampAgo(30), projects: [projectPage(1)] }),
      task(2, "Measure the walls", { projects: [projectPage(1)] }),
      task(3, "Run the workshop", { status: "Done", last_edited: stampAgo(20), projects: [projectPage(2)] }),
      task(4, "Draft the guidelines", { projects: [projectPage(2)] }),
      task(5, "Gather the titles", { status: "Done", last_edited: stampAgo(25), projects: [projectPage(3)] }),
      task(6, "Photograph the books", { projects: [projectPage(3)] }),
    ],
    projects: [
      projectRow(1, "prj-bbbbbbb1", "Signage"), projectRow(2, "prj-bbbbbbb2", "Brand refresh"),
      projectRow(3, "prj-bbbbbbb3", "Catalogue"), projectRow(4, "prj-bbbbbbb4", "Shed", { status: "On Hold" }),
    ],
    areas: [CLIENTS_ROW],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), ["project_stalled:prj-bbbbbbb3", "project_stalled:prj-bbbbbbb1"]);
  const [tie, stalled] = run.json.data.findings;
  // On equal dates the kind order decides: a task done before the project note's own update.
  assert.deepEqual(tie.evidence, { last_activity: { date: daysAgo(25), kind: "task_done", ref: taskPage(5) }, days_idle: 25 });
  assert.deepEqual(stalled.evidence, { last_activity: { date: daysAgo(21), kind: "meeting", ref: "mtg-bbbbbbb1" }, days_idle: 21 });
  assert.deepEqual(stalled.recommendations.map((r: { action: string; value: unknown }) => [r.action, r.value]), [
    ["set_project_status", "On Hold"], ["add_task", { project: "prj-bbbbbbb1" }], ["set_project_status", "Done"],
  ]);
  assert.deepEqual(stalled.status_offers, [{ action: "set_project_status", value: "On Hold" }]);
  assert.deepEqual(stalled.subject, { kind: "project", id: "prj-bbbbbbb1", page_id: projectPage(1), title: "Signage", current: { status: "Active", archived: false, area: "area-aaaaaaa1" } });
  assert.match(run.json.data.report, /2\. Stalled · Signage \(project\) · nothing done or mentioned for 21 days \(last: meeting Signage kickoff, 16 Oct\)\n {3}a\) set Status to On Hold {2}b\) add a next step {2}c\) set Status to Done\n/);
});

test("project_no_next_step and project_done_but_open: Someday isn't a next step, Waiting On and a repo's open items are", async (context) => {
  const recent = { updated: daysAgo(1) };
  const root = await world(context, [
    WORK, CLIENTS,
    project("prj-ccccccc1", "Talk", "area-aaaaaaa1", { notion: projectPage(1), ...recent }),
    project("prj-ccccccc2", "Packaging", "area-aaaaaaa1", { notion: projectPage(2), ...recent }),
    project("prj-ccccccc3", "Only someday", "area-aaaaaaa1", { notion: projectPage(3), ...recent }),
    project("prj-ccccccc4", "Waiting", "area-aaaaaaa1", { notion: projectPage(4), ...recent }),
    project("prj-ccccccc5", "Repo work", "area-aaaaaaa1", { notion: projectPage(5), ...recent }),
    project("prj-ccccccc6", "All dropped", "area-aaaaaaa1", { notion: projectPage(6), ...recent }),
    project("prj-ccccccc7", "Next year", "area-aaaaaaa1", { notion: projectPage(7), ...recent }),
    area("area-aaaaaaa2", "Tools", { domain: "dom-aaaaaaa1", notion: areaPage(2) }),
    project("prj-ccccccc8", "Tooling upgrade", "area-aaaaaaa2", { notion: projectPage(8), ...recent }),
  ]);
  const at = (n: number) => [projectPage(n)];
  const run = await findings(root, snapshot({
    tasks: [
      task(1, "Design the label", { status: "Done", projects: at(2) }),
      task(2, "Order boxes", { status: "Done", projects: at(2) }),
      task(3, "Foil print", { status: "Won't Do", projects: at(2) }),
      task(4, "One day", { status: "Someday", projects: at(3) }),
      task(5, "Quote from the tiler", { status: "Waiting On", projects: at(4) }),
      task(6, "Dropped", { status: "Won't Do", projects: at(6) }),
    ],
    projects: [1, 2, 3, 4, 5, 6].map((n) => projectRow(n, `prj-ccccccc${n}`, `P${n}`)).concat([projectRow(7, "prj-ccccccc7", "Next year", { status: "Planned" }), projectRow(8, "prj-ccccccc8", "Tooling upgrade")]),
    areas: [CLIENTS_ROW, areaRow(2, "area-aaaaaaa2", "Tools")],
    // A rollup that targets only an Area is a next step of every project of that Area (§2.2).
    repos: [{ name: "tools", rollup: { name: "tools", target: { area: "area-aaaaaaa2" }, counts: { todo: 0, in_progress: 0, waiting: 1, review: 0, done: 0, dropped: 0, unmapped: 0 } } }, { name: "site", rollup: { name: "site", target: { area: "area-aaaaaaa1", project: "prj-ccccccc5" }, counts: { todo: 1, in_progress: 0, waiting: 0, review: 0, done: 2, dropped: 0, unmapped: 0 } } }],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), ["project_no_next_step:prj-ccccccc6", "project_no_next_step:prj-ccccccc3", "project_no_next_step:prj-ccccccc1", "project_done_but_open:prj-ccccccc2"]);
  const byKey = Object.fromEntries(run.json.data.findings.map((f: { key: string }) => [f.key, f]));
  assert.deepEqual(byKey["project_no_next_step:prj-ccccccc3"].evidence, { tasks_someday: 1, tasks_done: 0, tasks_dropped: 0 });
  assert.deepEqual(byKey["project_no_next_step:prj-ccccccc6"].evidence, { tasks_someday: 0, tasks_done: 0, tasks_dropped: 1 });
  assert.deepEqual(byKey["project_done_but_open:prj-ccccccc2"].evidence, { tasks_done: 2, tasks_dropped: 1 });
  assert.deepEqual(byKey["project_done_but_open:prj-ccccccc2"].recommendations.map((r: { label: string }) => r.label), ["set Status to Done", "add a next step"]);
  assert.deepEqual(byKey["project_done_but_open:prj-ccccccc2"].status_offers, []);
  assert.match(run.json.data.report, /No next step · All dropped \(project\) · Active with no next step\n/);
  assert.match(run.json.data.report, /No next step · Packaging \(project\) · every task done \(2 done, 1 dropped\), Status still Active\n/);
});

test("project_misplaced needs 3 mentions with an Area and two thirds of them in one other Area", async (context) => {
  const marketing = area("area-aaaaaaa2", "Marketing", { domain: "dom-aaaaaaa1", notion: areaPage(2) });
  const mention = (id: string, projectId: string, areaId: string) => meeting(id, `Meeting ${id}`, daysAgo(3), { area: areaId, projects: [projectId] });
  const root = await world(context, [
    WORK, CLIENTS, marketing,
    project("prj-ddddddd1", "Newsletter", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    mention("mtg-ddddddd1", "prj-ddddddd1", "area-aaaaaaa2"),
    mention("mtg-ddddddd2", "prj-ddddddd1", "area-aaaaaaa2"),
    note({ id: "dec-ddddddd3", type: "decision", title: "Send it monthly", date: daysAgo(3), created: daysAgo(3), area: "area-aaaaaaa2", projects: ["prj-ddddddd1"] }),
    mention("mtg-ddddddd4", "prj-ddddddd1", "area-aaaaaaa1"),
    project("prj-ddddddd2", "Portfolio", "area-aaaaaaa1", { notion: projectPage(2), updated: daysAgo(2) }),
    mention("mtg-ddddddd5", "prj-ddddddd2", "area-aaaaaaa2"),
    mention("mtg-ddddddd6", "prj-ddddddd2", "area-aaaaaaa2"),
    project("prj-ddddddd3", "Talk", "area-aaaaaaa2", { notion: projectPage(3), updated: daysAgo(2) }),
    // Exactly two thirds (2 of 3) fires; 3 of 5 (3 × 3 < 2 × 5) doesn't.
    project("prj-ddddddd4", "Brochure", "area-aaaaaaa1", { notion: projectPage(4), updated: daysAgo(2) }),
    mention("mtg-ddddddd7", "prj-ddddddd4", "area-aaaaaaa2"),
    mention("mtg-ddddddd8", "prj-ddddddd4", "area-aaaaaaa2"),
    mention("mtg-ddddddd9", "prj-ddddddd4", "area-aaaaaaa1"),
    project("prj-ddddddd5", "Website", "area-aaaaaaa1", { notion: projectPage(5), updated: daysAgo(2) }),
    ...["mtg-dddddda1", "mtg-dddddda2", "mtg-dddddda3"].map((id) => mention(id, "prj-ddddddd5", "area-aaaaaaa2")),
    ...["mtg-dddddda4", "mtg-dddddda5"].map((id) => mention(id, "prj-ddddddd5", "area-aaaaaaa1")),
  ]);
  const run = await findings(root, snapshot({
    tasks: [
      task(1, "Write the issue", { projects: [projectPage(1)], areas: [areaPage(1)] }),
      task(2, "Pick a tool", { projects: [projectPage(1)], areas: [areaPage(1)] }),
      task(3, "Plan the next one", { projects: [projectPage(1)] }),
      task(4, "Update the site", { projects: [projectPage(2)] }),
      task(5, "Write the abstract", { projects: [projectPage(3)] }),
      task(6, "Print the brochure", { projects: [projectPage(4)] }),
      task(7, "Fix the menu", { projects: [projectPage(5)] }),
    ],
    projects: [projectRow(1, "prj-ddddddd1", "Newsletter"), projectRow(2, "prj-ddddddd2", "Portfolio"), projectRow(3, "prj-ddddddd3", "Talk"),
      projectRow(4, "prj-ddddddd4", "Brochure"), projectRow(5, "prj-ddddddd5", "Website")],
    areas: [CLIENTS_ROW, areaRow(2, "area-aaaaaaa2", "Marketing")],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), ["project_misplaced:prj-ddddddd4", "project_misplaced:prj-ddddddd1"]);
  assert.deepEqual(run.json.data.findings[0].evidence, { area: "area-aaaaaaa1", suggested_area: "area-aaaaaaa2", notes: 2, of: 3 });
  const misplaced = run.json.data.findings[1];
  assert.deepEqual(misplaced.evidence, { area: "area-aaaaaaa1", suggested_area: "area-aaaaaaa2", notes: 3, of: 4 });
  assert.deepEqual(misplaced.recommendations, [
    { letter: "a", action: "move_project", value: "area-aaaaaaa2", label: "move it to Marketing (and its 2 open tasks that name Clients)" },
  ]);
  assert.match(run.json.data.report, /Structure · Newsletter \(project\) · in Clients, but 3 of its 4 notes are in Marketing\n/);
});

test("project_duplicate: alike titles after the spelling step, or a title equal to the other's alias; the pair's survivor is the more mentioned", async (context) => {
  const root = await world(context, [
    WORK, CLIENTS,
    project("prj-eeeeeee1", "Quayside Books catalogue", "area-aaaaaaa1", { notion: projectPage(1), created: "2026-09-01", updated: daysAgo(2) }),
    project("prj-eeeeeee2", "Quayside Books catalog redesign", "area-aaaaaaa1", { notion: projectPage(2), created: "2026-10-01", updated: daysAgo(2) }),
    meeting("mtg-eeeeeee1", "Layout review", daysAgo(3), { area: "area-aaaaaaa1", projects: ["prj-eeeeeee2"] }),
    meeting("mtg-eeeeeee2", "Grid review", daysAgo(3), { area: "area-aaaaaaa1", projects: ["prj-eeeeeee2"] }),
    project("prj-eeeeeee3", "Garden shed", "area-aaaaaaa1", { notion: projectPage(3), created: "2026-08-01", updated: daysAgo(2) }),
    project("prj-eeeeeee4", "Backyard storage", "area-aaaaaaa1", { notion: projectPage(4), created: "2026-09-01", updated: daysAgo(2), aliases: ["garden shed"] }),
    project("prj-eeeeeee5", "Larkspur Bakery website", "area-aaaaaaa1", { notion: projectPage(5), updated: daysAgo(2) }),
    project("prj-eeeeeee6", "Larkspur Bakery packaging", "area-aaaaaaa1", { notion: projectPage(6), updated: daysAgo(2) }),
    project("prj-eeeeeee7", "Quayside Books catalogue redesign", "area-aaaaaaa1", { notion: projectPage(7), updated: daysAgo(2) }),
    // Exactly two thirds of the union (2 of 3) is a duplicate; 3 of 5 isn't.
    project("prj-eeeeeee8", "Harbour mural", "area-aaaaaaa1", { notion: projectPage(8), created: "2026-08-01", updated: daysAgo(2) }),
    project("prj-eeeeeee9", "Harbour mural sketches", "area-aaaaaaa1", { notion: projectPage(9), created: "2026-09-01", updated: daysAgo(2) }),
    project("prj-eeeeeeea", "Delta river bridge", "area-aaaaaaa1", { notion: projectPage(10), updated: daysAgo(2) }),
    project("prj-eeeeeeeb", "Delta river bridge north span", "area-aaaaaaa1", { notion: projectPage(11), updated: daysAgo(2) }),
    // The spelling step needs a stem of 5 characters: "logo" doesn't make "logos" the same word.
    project("prj-eeeeeeec", "Logo pack", "area-aaaaaaa1", { notion: projectPage(12), updated: daysAgo(2) }),
    project("prj-eeeeeeed", "Logos pack", "area-aaaaaaa1", { notion: projectPage(13), updated: daysAgo(2) }),
  ]);
  const open = (n: number, p: number) => task(n, `Step ${n}`, { projects: [projectPage(p)] });
  const run = await findings(root, snapshot({
    tasks: [open(1, 1), open(2, 1), open(3, 2), open(4, 3), open(5, 4), open(6, 5), open(7, 6), ...[8, 9, 10, 11, 12, 13].map((n) => open(n + 10, n))],
    projects: [1, 2, 3, 4, 5, 6].map((n) => projectRow(n, `prj-eeeeeee${n}`, `P${n}`)).concat([projectRow(7, "prj-eeeeeee7", "P7", { status: "Done" })],
      [[8, "8"], [9, "9"], [10, "a"], [11, "b"], [12, "c"], [13, "d"]].map(([n, suffix]) => projectRow(n as number, `prj-eeeeeee${suffix}`, `P${n}`))),
    areas: [CLIENTS_ROW],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), ["project_duplicate:prj-eeeeeee3+prj-eeeeeee4", "project_duplicate:prj-eeeeeee8+prj-eeeeeee9", "project_duplicate:prj-eeeeeee1+prj-eeeeeee2"]);
  const [shed, mural, books] = run.json.data.findings;
  assert.deepEqual(mural.evidence, { survivor: "prj-eeeeeee8", duplicate: "prj-eeeeeee9", shared_tokens: ["harbour", "mural"] });
  assert.deepEqual(books.subject, { kind: "project_pair", ids: ["prj-eeeeeee1", "prj-eeeeeee2"], titles: ["Quayside Books catalogue", "Quayside Books catalog redesign"] });
  assert.deepEqual(books.evidence, { survivor: "prj-eeeeeee2", duplicate: "prj-eeeeeee1", shared_tokens: ["books", "catalog", "quayside"] });
  assert.equal(books.project, "prj-eeeeeee2");
  assert.deepEqual(books.recommendations, [{
    letter: "a", action: "merge_projects", value: { target: "prj-eeeeeee1", merge_into: "prj-eeeeeee2" },
    label: "merge Quayside Books catalogue into Quayside Books catalog redesign (and move its 2 open tasks)",
  }]);
  assert.deepEqual(shed.evidence, { survivor: "prj-eeeeeee3", duplicate: "prj-eeeeeee4", shared_tokens: ["garden", "shed"] });
  assert.match(run.json.data.report, /Structure · Backyard storage and Garden shed \(projects\) · look like the same project\n/);
});

test("task_no_project: no project, or every project it names closed; the recommendation is the Area's only Active project", async (context) => {
  const finance = area("area-aaaaaaa3", "Finance", { domain: "dom-aaaaaaa1", notion: areaPage(3) });
  const root = await world(context, [
    WORK, finance,
    project("prj-fffffff1", "Budget", "area-aaaaaaa3", { notion: projectPage(7), updated: daysAgo(2) }),
    project("prj-fffffff2", "Last year's taxes", "area-aaaaaaa3", { notion: projectPage(8), updated: daysAgo(2) }),
  ]);
  const run = await findings(root, snapshot({
    tasks: [
      task(1, "Renew the domain", { areas: [areaPage(3)] }),
      task(2, "File the receipts", { projects: [projectPage(8)] }),
      task(3, "Ask the old client", { projects: [projectPage(9)] }),
      task(4, "Unknown page", { projects: [projectPage(10)] }),
      task(5, "Done already", { status: "Done" }),
      task(6, "Plan the budget", { projects: [projectPage(7)] }),
    ],
    projects: [
      projectRow(7, "prj-fffffff1", "Budget"), projectRow(8, "prj-fffffff2", "Last year's taxes", { status: "Done" }),
      projectRow(9, null, "Old client work", { status: "Done" }),
    ],
    areas: [areaRow(3, "area-aaaaaaa3", "Finance")],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), [`task_no_project:notion:${taskPage(3)}`, `task_no_project:notion:${taskPage(2)}`, `task_no_project:notion:${taskPage(1)}`]);
  const byTitle = Object.fromEntries(run.json.data.findings.map((f: { subject: { title: string } }) => [f.subject.title, f]));
  assert.deepEqual(byTitle["Renew the domain"].evidence, { projects: [] });
  assert.deepEqual(byTitle["Renew the domain"].recommendations, [
    { letter: "a", action: "set_task_project", value: "prj-fffffff1", label: "put it in Budget" },
    { letter: "b", action: "set_task_status", value: "Won't Do", label: "mark it Won't Do" },
  ]);
  assert.equal(byTitle["Renew the domain"].area, "area-aaaaaaa3");
  assert.deepEqual(byTitle["File the receipts"].evidence, { projects: [projectPage(8)] });
  assert.equal(byTitle["File the receipts"].recommendations[0].value, "prj-fffffff1");
  assert.equal(byTitle["Ask the old client"].recommendations[0].value, null);
  assert.equal(byTitle["Ask the old client"].recommendations[0].label, "put it in a project");
  assert.deepEqual(run.json.data.read, { tasks: 6, projects: 3, areas: 1, projects_not_in_brain: 1, areas_not_in_brain: 0 });
  assert.match(run.json.data.report, /Structure · "Renew the domain" \(task\) · no project\n/);
  assert.match(run.json.data.report, /Structure · "File the receipts" \(task in Last year's taxes\) · its project is closed\n/);
});

test("area_no_domain and area_empty: archived Areas never; a repo's open items, a Planned project or an open task keep an Area busy", async (context) => {
  const root = await world(context, [
    WORK, domain("dom-aaaaaaa2", "Old", { lifecycle: "archived" }), CLIENTS,
    area("area-aaaaaaa2", "Workshops", { domain: "dom-aaaaaaa1", notion: areaPage(2) }),
    area("area-aaaaaaa3", "Finance", { notion: areaPage(3) }),
    area("area-aaaaaaa4", "Home", { domain: "dom-aaaaaaa1", notion: areaPage(4) }),
    area("area-aaaaaaa5", "Tools", { domain: "dom-aaaaaaa1", notion: areaPage(5) }),
    area("area-aaaaaaa6", "Retired", { notion: areaPage(6) }),
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    project("prj-aaaaaaa2", "Spring workshop", "area-aaaaaaa2", { notion: projectPage(2), updated: daysAgo(2) }),
    project("prj-aaaaaaa3", "Autumn workshop", "area-aaaaaaa2", { notion: projectPage(3), updated: daysAgo(2) }),
    project("prj-aaaaaaa4", "Kitchen", "area-aaaaaaa4", { notion: projectPage(4), updated: daysAgo(2) }),
  ]);
  const run = await findings(root, snapshot({
    tasks: [task(1, "Pay the invoice", { areas: [areaPage(3)], projects: [projectPage(1)] }), task(2, "Ship it", { projects: [projectPage(1)] })],
    projects: [
      projectRow(1, "prj-aaaaaaa1", "Acme website"), projectRow(2, "prj-aaaaaaa2", "Spring workshop", { status: "Done" }),
      projectRow(3, "prj-aaaaaaa3", "Autumn workshop", { status: "On Hold" }), projectRow(4, "prj-aaaaaaa4", "Kitchen", { status: "Planned" }),
    ],
    areas: [CLIENTS_ROW, areaRow(2, "area-aaaaaaa2", "Workshops"), areaRow(3, "area-aaaaaaa3", "Finance"), areaRow(4, "area-aaaaaaa4", "Home"),
      areaRow(5, "area-aaaaaaa5", "Tools"), areaRow(6, "area-aaaaaaa6", "Retired", { archived: true })],
    repos: [{ name: "tools", rollup: { name: "tools", target: { area: "area-aaaaaaa5" }, counts: { todo: 0, in_progress: 1, waiting: 0, review: 0, done: 0, dropped: 0, unmapped: 0 } } }],
  }));
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), ["area_no_domain:area-aaaaaaa3", "area_empty:area-aaaaaaa2"]);
  const [noDomain, empty] = run.json.data.findings;
  assert.deepEqual(noDomain.recommendations, [{ letter: "a", action: "set_area_domain", value: "dom-aaaaaaa1", label: "put it in Work" }]);
  assert.equal(noDomain.project, null);
  assert.equal(noDomain.area, "area-aaaaaaa3");
  assert.deepEqual(noDomain.subject, { kind: "area", id: "area-aaaaaaa3", page_id: areaPage(3), title: "Finance", current: { archived: false, domain: null } });
  assert.deepEqual(empty.evidence, { projects_on_hold: 1, projects_done: 1 });
  assert.deepEqual(empty.recommendations, [{ letter: "a", action: "archive_area", value: true, label: "archive it" }]);
});

test("ranking, the cap, --number-from and --exclude: ranks continue the session's numbers and total counts the whole list", async (context) => {
  const root = await world(context, [
    WORK, CLIENTS,
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    area("area-aaaaaaa3", "Finance", { notion: areaPage(3) }),
    project("prj-aaaaaaa3", "Budget", "area-aaaaaaa3", { notion: projectPage(3), updated: daysAgo(2) }),
  ]);
  const p = [projectPage(1)];
  const snap = snapshot({
    tasks: [
      task(1, "Alpha", { due: daysAgo(4), projects: p }), task(2, "Beta", { due: daysAgo(9), projects: p }),
      task(3, "Gamma", { due: daysAgo(4), projects: p }), task(4, "Delta", { last_edited: stampAgo(15), projects: p }),
      task(5, "Budget step", { projects: [projectPage(3)] }),
    ],
    projects: [projectRow(1, "prj-aaaaaaa1", "Acme website"), projectRow(3, "prj-aaaaaaa3", "Budget")],
    areas: [CLIENTS_ROW, areaRow(3, "area-aaaaaaa3", "Finance")],
  });
  const all = await findings(root, snap);
  assert.deepEqual(keys(all), [
    `task_overdue:notion:${taskPage(2)}`, `task_overdue:notion:${taskPage(1)}`, `task_overdue:notion:${taskPage(3)}`,
    `task_stalled:notion:${taskPage(4)}`, "area_no_domain:area-aaaaaaa3",
  ]);
  const page = await findings(root, snap, ["--limit", "2", "--number-from", "5"]);
  assert.deepEqual(page.json.data.findings.map((f: { rank: number }) => f.rank), [5, 6]);
  assert.equal(page.json.data.total, 5);
  assert.equal(page.json.data.number_from, 5);
  assert.match(page.json.data.report, /^5\. Overdue · "Beta"/m);
  assert.match(page.json.data.report, /\n\n3 more\. Say "more", or name an Area, Domain or Project\.\n/);

  const exclude = join(dirname(root), "exclude.json");
  await writeFile(exclude, JSON.stringify([`task_overdue:notion:${taskPage(2)}`, `notion:${taskPage(4)}`, "area-aaaaaaa3"]));
  const rest = await findings(root, snap, ["--exclude", exclude]);
  assert.deepEqual(keys(rest), [`task_overdue:notion:${taskPage(1)}`, `task_overdue:notion:${taskPage(3)}`]);
  assert.equal(rest.json.data.excluded, 3);
  assert.equal(rest.json.data.total, 2);

  await writeFile(exclude, JSON.stringify(["prj-nonsense!"]));
  const bad = await findings(root, snap, ["--exclude", exclude]);
  assert.equal(bad.json.error.code, "INPUT_INVALID");
  assert.equal((await findings(root, snap, ["--limit", "0"])).json.error.code, "USAGE");
  assert.equal((await findings(root, snap, ["--number-from", "x"])).json.error.code, "USAGE");
});

test("--scope keeps the findings in an Area's, a Domain's or a Project's reach and names it on line 1", async (context) => {
  const root = await world(context, [
    WORK, domain("dom-aaaaaaa2", "Life"), CLIENTS,
    area("area-aaaaaaa2", "Health", { domain: "dom-aaaaaaa2", notion: areaPage(2) }),
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    project("prj-aaaaaaa2", "Running", "area-aaaaaaa2", { notion: projectPage(2), updated: daysAgo(2) }),
    note({ id: "per-aaaaaaa1", type: "person", title: "Pat Example" }),
  ]);
  const snap = snapshot({
    tasks: [
      task(1, "Send the quote", { due: daysAgo(5), projects: [projectPage(1)] }),
      task(2, "Buy shoes", { due: daysAgo(5), projects: [projectPage(2)] }),
      task(3, "Book a check-up", { areas: [areaPage(2)] }),
    ],
    projects: [projectRow(1, "prj-aaaaaaa1", "Acme website"), projectRow(2, "prj-aaaaaaa2", "Running")],
    areas: [CLIENTS_ROW, areaRow(2, "area-aaaaaaa2", "Health")],
  });
  const health = await findings(root, snap, ["--scope", "area-aaaaaaa2"]);
  assert.deepEqual(keys(health), [`task_overdue:notion:${taskPage(2)}`, `task_no_project:notion:${taskPage(3)}`]);
  assert.equal(health.json.data.scope, "area-aaaaaaa2");
  assert.match(health.json.data.report, /^Ultimate Assistant · Health \(area\) · 6 Nov 2026\n/);
  assert.deepEqual(keys(await findings(root, snap, ["--scope", "dom-aaaaaaa1"])), [`task_overdue:notion:${taskPage(1)}`]);
  const acme = await findings(root, snap, ["--scope", "prj-aaaaaaa1"]);
  assert.deepEqual(keys(acme), [`task_overdue:notion:${taskPage(1)}`]);
  assert.match(acme.json.data.report, /^Ultimate Assistant · Acme website \(project\) · /);
  assert.equal(acme.json.data.read.tasks, 3, "read counts the whole snapshot, whatever the scope");
  assert.equal((await findings(root, snap, ["--scope", "area-zzzzzzz9"])).json.error.code, "UNKNOWN_ID");
  assert.equal((await findings(root, snap, ["--scope", "per-aaaaaaa1"])).json.error.code, "INPUT_INVALID");
});

test("dismissals leave out active skips, not expired ones, and a Suggestion rejected less than 30 days ago counts as one", async (context) => {
  const projectId = "prj-aaaaaaa1";
  const rejected = (id: string, finding: string, decidedAt: string) => ({
    path: `_proposals/2026-10-01-${id}.md`, id, type: "proposal", title: `Suggestion ${id}`, created: "2026-10-01", updated: "2026-10-01",
    kind: "notion_change", status: "rejected", finding,
    decision: { action: "reject", decided_at: decidedAt, decided_by: "notion" },
  });
  const p = [projectPage(1)];
  const root = await world(context, [
    WORK, CLIENTS,
    project(projectId, "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    // One second under 30 days before as_of still counts as a skip; exactly 30 days doesn't.
    rejected("prp-aaaaaaa1", `task_overdue:notion:${taskPage(3)}`, "2026-10-07T10:00:01Z"),
    rejected("prp-aaaaaaa2", `task_overdue:notion:${taskPage(4)}`, "2026-10-07T10:00:00Z"),
  ]);
  await writeDismissals(root, [
    // Active while until is after as_of: one second after is active, until equal to as_of has expired.
    { key: `task_overdue:notion:${taskPage(1)}`, reason: "waiting for the client", dismissed_at: "2026-10-07T10:00:01Z", until: "2026-11-06T10:00:01Z" },
    { key: `task_overdue:notion:${taskPage(2)}`, reason: "", dismissed_at: "2026-10-07T10:00:00Z", until: AS_OF },
  ]);
  const snap = snapshot({
    tasks: [1, 2, 3, 4].map((n) => task(n, `Task ${n}`, { due: daysAgo(5), projects: p })),
    projects: [projectRow(1, projectId, "Acme website")],
    areas: [CLIENTS_ROW],
  });
  const run = await findings(root, snap);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(keys(run), [`task_overdue:notion:${taskPage(2)}`, `task_overdue:notion:${taskPage(4)}`]);
  assert.equal(run.json.data.dismissed, 2);
  assert.match(run.json.data.report, /\n\n2 skipped for now\.\nAnswer with/);

  await writeFile(join(root, "_assistant", "dismissals.json"), "{ not json");
  const damaged = await findings(root, snap);
  assert.equal(damaged.code, 5);
  assert.equal(damaged.json.error.code, "DISMISSALS_UNREADABLE");
});

test("the report: layout, counts, the not-in-the-brain sentence, the skipped line and nothing found", async (context) => {
  const root = await world(context, [
    WORK, CLIENTS,
    area("area-aaaaaaa2", "Health", { notion: areaPage(2) }),
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) }),
    project("prj-aaaaaaa2", "Running", "area-aaaaaaa2", { notion: projectPage(2), updated: daysAgo(2) }),
  ]);
  await writeDismissals(root, [{ key: `task_stalled:notion:${taskPage(3)}`, reason: "", dismissed_at: "2026-11-01T10:00:00Z", until: "2026-12-01T10:00:00Z" }]);
  const snap = snapshot({
    tasks: [
      task(1, "Send the revised quote", { due: "2026-10-29", projects: [projectPage(1)] }),
      task(2, "Plan the route", { projects: [projectPage(2)] }),
      task(3, "Water the plants", { last_edited: stampAgo(20), projects: [projectPage(2)] }),
    ],
    projects: [projectRow(1, "prj-aaaaaaa1", "Acme website"), projectRow(2, "prj-aaaaaaa2", "Running"), projectRow(3, null, "Someone else's")],
    areas: [CLIENTS_ROW, areaRow(2, "area-aaaaaaa2", "Health")],
  });
  const run = await findings(root, snap);
  assert.equal(run.json.data.report, [
    "Ultimate Assistant · whole brain · 6 Nov 2026",
    "Notion read live: 3 tasks, 3 projects, 2 areas. 1 project isn't in the brain yet: run a sync.",
    "",
    "1. Overdue · \"Send the revised quote\" (task in Acme website) · due 29 Oct, 8 days late",
    "   a) give it a new due date  b) mark it Done  c) mark it Won't Do",
    "2. Structure · Health (area) · no Domain",
    "   a) put it in Work",
    "",
    "1 skipped for now.",
    "Answer with \"yes 1, 2b\", a change (\"1: due Friday\"), \"skip 4 because …\", or \"propose 5\" for a Review row; \"done\" to finish.",
    "",
  ].join("\n"));
  const first = await findings(root, snap, ["--limit", "1"]);
  assert.match(first.json.data.report, /a\) give it a new due date {2}b\) mark it Done {2}c\) mark it Won't Do\n\n1 more\. Say "more", or name an Area, Domain or Project\.\n1 skipped for now\.\nAnswer with/);
  const scoped = await findings(root, snap, ["--scope", "prj-aaaaaaa2"]);
  assert.equal(scoped.json.data.report, [
    "Ultimate Assistant · Running (project) · 6 Nov 2026",
    "Notion read live: 3 tasks, 3 projects, 2 areas. 1 project isn't in the brain yet: run a sync.",
    "",
    "Nothing needs you.",
    "1 skipped for now.",
    "",
  ].join("\n"));
});

test("brain only: Notion signals are skipped, statuses come from notion_fields, and no Notion-owned change is offered", async (context) => {
  const fields = (asOf: string, status: string) => ({ notion_fields: { as_of: asOf, status, archived: false } });
  const root = await world(context, [
    WORK, CLIENTS,
    area("area-aaaaaaa3", "Finance", { notion: areaPage(3), notion_fields: { as_of: "2026-11-01T08:00:00Z", archived: false } }),
    project("prj-aaaaaaa1", "Signage", "area-aaaaaaa1", { notion: projectPage(1), created: daysAgo(90), updated: daysAgo(30), ...fields("2026-11-02T08:00:00Z", "Active") }),
    project("prj-aaaaaaa2", "Shed", "area-aaaaaaa1", { notion: projectPage(2), created: daysAgo(90), updated: daysAgo(30), ...fields("2026-10-20T08:00:00Z", "On Hold") }),
    project("prj-aaaaaaa3", "Old", "area-aaaaaaa1", { path: "archive/projects/old/project.md", notion: projectPage(3), updated: daysAgo(30), ...fields("2026-01-01T08:00:00Z", "Active") }),
  ]);
  const run = await findings(root, { as_of: AS_OF, notion: "unreachable", repos: [{ name: "site", error: "gh is not logged in" }] });
  assert.equal(run.code, 0, run.stdout);
  const data = run.json.data;
  assert.equal(data.mode, "brain_only");
  assert.equal(data.statuses_as_of, "2026-10-20T08:00:00Z");
  assert.deepEqual(data.read, { tasks: 0, projects: 0, areas: 0, projects_not_in_brain: 0, areas_not_in_brain: 0 });
  assert.deepEqual(data.skipped_signals.map((s: { signal: string }) => s.signal), ["task_overdue", "task_stalled", "project_no_next_step", "project_done_but_open", "task_no_project", "area_empty"]);
  assert.ok(data.skipped_signals.every((s: { reason: string }) => s.reason === "NOTION_UNREACHABLE"));
  assert.deepEqual(data.repos_failed, [{ name: "site", error: "gh is not logged in" }]);
  assert.deepEqual(keys(run), ["project_stalled:prj-aaaaaaa1", "area_no_domain:area-aaaaaaa3"]);
  assert.deepEqual(data.findings[0].recommendations, []);
  assert.deepEqual(data.findings[0].status_offers, []);
  assert.deepEqual(data.findings[1].recommendations.map((r: { action: string }) => r.action), ["set_area_domain"]);
  assert.equal(data.report.split("\n")[1], "Notion unreachable: brain only. Statuses as of 20 Oct 2026; tasks not checked. Repo site not read: gh is not logged in.");
  assert.match(data.report, /1\. Stalled · Signage \(project\) · nothing done or mentioned for 30 days \(last: project note Signage, 7 Oct\)\n {3}no change I can make here: skip it, or say what to do\n/);
});

test("needs: Tasks off, Domains off and an unmapped property skip their signals and say so on line 2", async (context) => {
  const notes = [WORK, CLIENTS, area("area-aaaaaaa3", "Finance", { notion: areaPage(3) }),
    project("prj-aaaaaaa1", "Acme website", "area-aaaaaaa1", { notion: projectPage(1), updated: daysAgo(2) })];
  const rows = { projects: [projectRow(1, "prj-aaaaaaa1", "Acme website")], areas: [CLIENTS_ROW, areaRow(3, "area-aaaaaaa3", "Finance")] };

  const off = await world(context, notes, { modules: { tasks: false, domains: false } });
  const noTasks = { as_of: AS_OF, notion: "live", ...rows, repos: [] };
  const run = await findings(off, noTasks);
  assert.equal(run.code, 0, run.stdout);
  assert.deepEqual(run.json.data.skipped_signals, [
    { signal: "task_overdue", reason: "MODULE_OFF" }, { signal: "task_stalled", reason: "MODULE_OFF" },
    { signal: "project_no_next_step", reason: "MODULE_OFF" }, { signal: "project_done_but_open", reason: "MODULE_OFF" },
    { signal: "task_no_project", reason: "MODULE_OFF" }, { signal: "area_no_domain", reason: "MODULE_OFF" },
  ]);
  assert.equal(run.json.data.report.split("\n")[1], "Notion read live: 1 project, 2 areas. Tasks module off: tasks not checked. Domains module off: Areas without a Domain not checked.");
  assert.deepEqual(keys(run), ["area_empty:area-aaaaaaa3"]);
  const refused = await findings(off, snapshot(rows));
  assert.equal(refused.json.error.code, "INPUT_INVALID");
  assert.ok(refused.json.error.details.some((d: { pointer: string }) => d.pointer === "/tasks"));

  const unmapped = await world(context, notes, { properties: { due: "" } });
  const late = await findings(unmapped, snapshot({ ...rows, tasks: [task(1, "Ship it", { projects: [projectPage(1)], areas: [areaPage(3)] })] }));
  assert.deepEqual(late.json.data.skipped_signals, [{ signal: "task_overdue", reason: "NOT_MAPPED", property: "due" }]);
  assert.equal(late.json.data.report.split("\n")[1], "Notion read live: 1 task, 1 project, 2 areas. Tasks has no due mapped: overdue tasks not checked.");
  const missing = await findings(unmapped, { as_of: AS_OF, notion: "live", ...rows, repos: [] });
  assert.equal(missing.json.error.code, "INPUT_INVALID", "Tasks on and live needs tasks and task_statuses");
});

test("input errors: an invalid snapshot names its pointers, unreadable input and a damaged brain.json refuse", async (context) => {
  const root = await world(context, [WORK, CLIENTS]);
  const invalid = await findings(root, { ...snapshot(), as_of: "yesterday" });
  assert.equal(invalid.code, 4);
  assert.equal(invalid.json.error.code, "INPUT_INVALID");
  assert.ok(invalid.json.error.details.some((d: { pointer: string }) => d.pointer === "/as_of"));
  const extra = await findings(root, { ...snapshot(), surprise: 1 });
  assert.equal(extra.json.error.code, "INPUT_INVALID");
  const fractional = await findings(root, { ...snapshot(), as_of: "2026-11-06T10:00:00.123Z" });
  assert.equal(fractional.json.data.as_of, AS_OF);
});
