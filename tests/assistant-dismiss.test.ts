import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { area, areaPage, domain, project, projectPage, taskPage, world } from "./assistant-world.ts";
import { brain } from "./helpers.ts";

// `brain assistant dismiss` and the dismissal store (spec/assistant.md §8, cli.md §5.31), and the lint rule `assistant-dismissals`.

const NOW = "2026-11-06T10:22:00Z";
const STORE = join("_assistant", "dismissals.json");

async function studio(context: Parameters<typeof world>[0]): Promise<string> {
  return world(context, [
    domain("dom-aaaaaaa1", "Work"),
    area("area-aaaaaaa1", "Clients", { domain: "dom-aaaaaaa1", notion: areaPage(1) }),
    area("area-aaaaaaa2", "Health", { notion: areaPage(2) }),
    project("prj-aaaaaaa1", "Quayside catalogue", "area-aaaaaaa1", { notion: projectPage(1) }),
    project("prj-aaaaaaa2", "Quayside catalog redesign", "area-aaaaaaa1", { notion: projectPage(2) }),
  ]);
}

async function dismiss(root: string, input: unknown, now = NOW) {
  const file = join(dirname(root), `dismiss-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(input));
  return brain(["assistant", "dismiss", "--brain", root, "--input", file, "--now", now, "--json"]);
}

const taskKey = `task_stalled:notion:${taskPage(1)}`;

test("dismiss adds, replaces and removes entries, writes the store in its format and logs each item", async (context) => {
  const root = await studio(context);
  const first = await dismiss(root, { dismissals: [
    { key: "area_no_domain:area-aaaaaaa2", reason: "a personal area, no Domain needed" },
    { key: taskKey, reason: "" },
  ] });
  assert.equal(first.code, 0, first.stdout);
  assert.deepEqual(first.json.data, {
    path: "_assistant/dismissals.json",
    items: [
      { key: "area_no_domain:area-aaaaaaa2", result: "added", until: "2026-12-06T10:22:00Z" },
      { key: taskKey, result: "added", until: "2026-12-06T10:22:00Z" },
    ],
    pruned: 0,
  });
  assert.equal(await readFile(join(root, STORE), "utf8"), `${JSON.stringify({
    version: 1,
    dismissals: [
      { key: "area_no_domain:area-aaaaaaa2", reason: "a personal area, no Domain needed", dismissed_at: NOW, until: "2026-12-06T10:22:00Z" },
      { key: taskKey, reason: "", dismissed_at: NOW, until: "2026-12-06T10:22:00Z" },
    ],
  }, null, 2)}\n`);

  const second = await dismiss(root, { dismissals: [
    { key: taskKey, reason: "on hold until the client answers" },
    { key: "area_no_domain:area-aaaaaaa2", remove: true },
    { key: "area_empty:area-aaaaaaa2", remove: true },
    { key: "project_duplicate:prj-aaaaaaa1+prj-aaaaaaa2", reason: "two phases" },
  ] }, "2026-11-10T08:00:00Z");
  assert.equal(second.code, 0, second.stdout);
  assert.deepEqual(second.json.data.items, [
    { key: taskKey, result: "replaced", until: "2026-12-10T08:00:00Z" },
    { key: "area_no_domain:area-aaaaaaa2", result: "removed" },
    { key: "area_empty:area-aaaaaaa2", result: "unchanged" },
    { key: "project_duplicate:prj-aaaaaaa1+prj-aaaaaaa2", result: "added", until: "2026-12-10T08:00:00Z" },
  ]);
  const store = JSON.parse(await readFile(join(root, STORE), "utf8"));
  assert.deepEqual(store.dismissals.map((entry: { key: string }) => entry.key), ["project_duplicate:prj-aaaaaaa1+prj-aaaaaaa2", taskKey], "sorted by key");
  assert.equal(store.dismissals[1].reason, "on hold until the client answers");
  assert.equal(store.dismissals[1].dismissed_at, "2026-11-10T08:00:00Z");

  const log = await readFile(join(root, "log", "2026-11.md"), "utf8");
  assert.match(log, /^- 2026-11-06T10:22:00Z assistant-dismiss - "" key=area_no_domain:area-aaaaaaa2 result=added$/m);
  assert.match(log, /^- 2026-11-10T08:00:00Z assistant-dismiss - "" key=area_empty:area-aaaaaaa2 result=unchanged$/m);
});

test("dismiss drops expired entries on each write and deletes the store when none is left", async (context) => {
  const root = await studio(context);
  await mkdir(join(root, "_assistant"), { recursive: true });
  await writeFile(join(root, STORE), `${JSON.stringify({ version: 1, dismissals: [
    { key: "area_empty:area-aaaaaaa2", reason: "", dismissed_at: "2026-10-01T10:00:00Z", until: "2026-10-31T10:00:00Z" },
    { key: "area_no_domain:area-aaaaaaa2", reason: "", dismissed_at: "2026-10-07T10:22:00Z", until: NOW },
    { key: taskKey, reason: "", dismissed_at: "2026-10-20T10:00:00Z", until: "2026-11-19T10:00:00Z" },
  ] }, null, 2)}\n`);
  const run = await dismiss(root, { dismissals: [{ key: taskKey, remove: true }] });
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.pruned, 2, "an entry whose until is at or before now is expired");
  assert.deepEqual(run.json.data.items, [{ key: taskKey, result: "removed" }]);
  assert.equal(existsSync(join(root, STORE)), false);
});

test("dismiss checks every item before writing: key shapes, a pair's order, unknown notes and repeated keys", async (context) => {
  const root = await studio(context);
  const refused = async (input: unknown, code: string) => {
    const run = await dismiss(root, input);
    assert.equal(run.json?.error?.code, code, `${JSON.stringify(input)}: ${run.stdout}`);
    assert.equal(existsSync(join(root, STORE)), false, "nothing written");
  };
  await refused({ dismissals: [] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: "task_stalled:prj-aaaaaaa1", reason: "" }] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: "project_duplicate:prj-aaaaaaa2+prj-aaaaaaa1", reason: "" }] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: "project_duplicate:prj-aaaaaaa1+prj-aaaaaaa1", reason: "" }] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: taskKey, reason: "" }, { key: taskKey, remove: true }] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: taskKey, reason: "", remove: true }] }, "INPUT_INVALID");
  await refused({ dismissals: [{ key: taskKey, reason: "" }, { key: "area_empty:area-zzzzzzz9", reason: "" }] }, "UNKNOWN_ID");
  // A remove isn't checked against the notes: a skip whose note was deleted can still be removed.
  const gone = await dismiss(root, { dismissals: [{ key: "area_empty:area-zzzzzzz9", remove: true }] });
  assert.equal(gone.code, 0, gone.stdout);
  assert.deepEqual(gone.json.data.items, [{ key: "area_empty:area-zzzzzzz9", result: "unchanged" }]);
});

test("a damaged store is refused by dismiss and flagged by lint", async (context) => {
  const root = await studio(context);
  await mkdir(join(root, "_assistant"), { recursive: true });
  const lintIssues = async () => {
    const run = await brain(["lint", "--brain", root, "--json"]);
    return run.json.data.issues.filter((issue: { rule: string }) => issue.rule === "assistant-dismissals");
  };
  assert.deepEqual(await lintIssues(), []);

  await writeFile(join(root, STORE), "{ broken");
  const run = await dismiss(root, { dismissals: [{ key: taskKey, reason: "" }] });
  assert.equal(run.code, 5);
  assert.equal(run.json.error.code, "DISMISSALS_UNREADABLE");
  assert.equal(await readFile(join(root, STORE), "utf8"), "{ broken", "never replaced");
  const unreadable = await lintIssues();
  assert.equal(unreadable.length, 1);
  assert.equal(unreadable[0].severity, "error");
  assert.equal(unreadable[0].path, "_assistant/dismissals.json");
  assert.equal(unreadable[0].line, 1);

  const entry = { key: taskKey, reason: "", dismissed_at: NOW, until: "2026-12-06T10:22:00Z" };
  await writeFile(join(root, STORE), JSON.stringify({ version: 1, dismissals: [entry, entry, { key: "nope", reason: "" }] }));
  const invalid = await lintIssues();
  assert.ok(invalid.length >= 2, JSON.stringify(invalid));
  assert.ok(invalid.some((issue: { message: string }) => issue.message.includes("repeats")));
  assert.equal((await dismiss(root, { dismissals: [{ key: taskKey, reason: "" }] })).json.error.code, "DISMISSALS_UNREADABLE");

  await writeFile(join(root, STORE), `${JSON.stringify({ version: 1, dismissals: [entry] }, null, 2)}\n`);
  assert.deepEqual(await lintIssues(), []);
  assert.deepEqual((await readdir(join(root, "_assistant"))).sort(), ["dismissals.json"]);
});
