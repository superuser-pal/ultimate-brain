import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { brain, FIXTURE_BRAIN, fixtureCopy } from "./helpers.ts";

async function folders(context: import("node:test").TestContext) {
  const root = await mkdtemp(join(tmpdir(), "ingest-score-"));
  context.after(async () => { await rm(root, { recursive: true, force: true }); });
  const base = join(root, "base");
  const run = join(root, "run");
  await cp(FIXTURE_BRAIN, base, { recursive: true });
  await cp(base, run, { recursive: true });
  return { root, base, run };
}

async function expected(root: string, value: object) {
  const path = join(root, "expected.json");
  await writeFile(path, JSON.stringify(value));
  return path;
}

function score(base: string, run: string, expectedPath: string, skipKinds: string[] = []) {
  const result = spawnSync(process.execPath, [join(import.meta.dirname, "..", "scripts", "score-ingest.mjs"), "--base", base, "--run", run, "--expected", expectedPath, ...(skipKinds.length ? ["--skip-kinds", skipKinds.join(",")] : [])], { encoding: "utf8" });
  assert.equal(result.error, undefined, result.stderr);
  return JSON.parse(result.stdout);
}

test("ingest scorer passes an unchanged stop case", async (context) => {
  const { root, base, run } = await folders(context);
  const report = score(base, run, await expected(root, { case: "stop", expect: { stop: true } }));
  assert.equal(report.verdict, "pass", JSON.stringify(report, null, 2));
  assert.deepEqual(report.files, { created: [], changed: [], deleted: [] });
});

test("ingest scorer fails a modified stop case", async (context) => {
  const { root, base, run } = await folders(context);
  await writeFile(join(run, "README.md"), "changed\n");
  const report = score(base, run, await expected(root, { case: "stop", expect: { stop: true } }));
  assert.equal(report.verdict, "fail");
  assert.deepEqual(report.files.changed, ["README.md"]);
});

test("ingest scorer passes a non-stop run and resolves references", async (context) => {
  const dir = await fixtureCopy(context);
  const input = join(dir, "batch.json");
  await writeFile(input, JSON.stringify({ notes: [
    { type: "source", id: "src-4m9q2x7c", title: "Reference minutes", file_date: "2026-12-10", frontmatter: { source_key: "agent:test/reference" }, body: "Minutes.\n" },
    { type: "meeting", id: "mtg-6b2d8f4h", title: "Reference meeting", frontmatter: { summary: "S.", date: "2026-12-10", attendees: ["per-zzvs98vn"], source: "src-4m9q2x7c", decisions: ["dec-3f7k9m2q"], projects: ["prj-9x4t1b7e"], sources: ["src-4m9q2x7c"] }, body: "## Summary\nReference.\n" },
    { type: "person", id: "per-zzvs98vn", title: "Zoë Example", frontmatter: { summary: "S.", org: "org-6d1f9z3k", sources: ["mtg-6b2d8f4h"] }, body: "Person.\n" },
    { type: "decision", id: "dec-3f7k9m2q", title: "Reference decision", frontmatter: { summary: "S.", date: "2026-12-10", assessment: "accepted", decided_in: "mtg-6b2d8f4h", projects: ["prj-9x4t1b7e"], sources: ["mtg-6b2d8f4h"] }, body: "Decision.\n" },
  ] }));
  const created = await brain(["note", "new", "--input", input, "--brain", dir, "--now", "2026-12-10T18:00:00Z", "--json"]);
  assert.equal(created.code, 0, created.stdout);
  await mkdir(join(dir, "_proposals"), { recursive: true });
  await writeFile(join(dir, "_proposals/reference.md"), "---\nid: prp-4m9q2x7c\ntype: proposal\ntitle: Reference supersede\ncreated: 2026-12-10\nupdated: 2026-12-10\nkind: supersede\ntarget: dec-3f7k9m2q\nsupersedes: dec-2p9f6h1r\nwhy: Reference reversal.\nsource: mtg-6b2d8f4h\nstatus: pending\n---\n");
  const expectedPath = await expected(dir, {
    case: "references", expect: {
      stop: false,
      meeting: { attendees: ["@new:Zoë Example"], projects: ["prj-9x4t1b7e"] },
      notes: [
        { type: "person", title: ["zoe", "example"], fields: { org: "org-6d1f9z3k" } },
        { type: "decision", title: ["Reference"], fields: { decided_in: "@meeting" } },
      ],
      proposals: [{ kind: "supersede", target: "@note:1", supersedes: "dec-2p9f6h1r" }], tasks: [], must_not: [],
    }, optional: [],
  });
  const report = score(FIXTURE_BRAIN, dir, expectedPath);
  assert.equal(report.meeting.pass, true);
  assert.equal(report.verdict, "pass", JSON.stringify(report, null, 2));
});

test("ingest scorer reports low recall", async (context) => {
  const { root, base, run } = await folders(context);
  const report = score(base, run, await expected(root, {
    case: "low-recall",
    expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [{ type: "person", title: ["Missing"] }], proposals: [], tasks: [], must_not: [] },
    optional: [],
  }));
  assert.equal(report.verdict, "fail");
  assert.equal(report.metrics.notes.recall, 0);
  assert.equal(report.unmatched.notes.length, 1);
});

test("ingest scorer detects a must_not proposal", async (context) => {
  const { root, base, run } = await folders(context);
  await (await import("node:fs/promises")).mkdir(join(run, "_proposals"), { recursive: true });
  await writeFile(join(run, "_proposals", "new.md"), "---\nid: prp-0a1b2c3d\ntype: proposal\ntitle: forbidden\nkind: update_fact\ntarget: prj-9x4t1b7e\nstatus: pending\n---\n");
  const report = score(base, run, await expected(root, {
    case: "must-not",
    expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [], proposals: [], tasks: [], must_not: [{ proposal: {} }] },
    optional: [],
  }));
  assert.equal(report.verdict, "fail");
  assert.equal(report.must_not.length, 1);
});

test("ingest scorer checks every must_not kind", async (context) => {
  const cases: Array<[string, (run: string) => Promise<void>, Record<string, unknown>]> = [
    ["note", async (run: string) => { await mkdir(join(run, "knowledge", "people"), { recursive: true }); await writeFile(join(run, "knowledge/people/extra.md"), "---\nid: per-extra01\ntype: person\ntitle: Forbidden Person\norg: org-6d1f9z3k\n---\n"); }, { note: { type: "person", title: ["Forbidden"] } }],
    ["proposal", async (run: string) => { await mkdir(join(run, "_proposals"), { recursive: true }); await writeFile(join(run, "_proposals/extra.md"), "---\nid: prp-extra01\ntype: proposal\ntitle: Forbidden\nkind: update_fact\ntarget: prj-9x4t1b7e\nstatus: pending\n---\n"); }, { proposal: {} }],
    ["unchanged", async (run: string) => { await writeFile(join(run, "knowledge/people/carlos-ruiz.md"), "changed\n"); }, { unchanged: "knowledge/people/carlos-ruiz.md" }],
    ["deleted", async (run: string) => { await rm(join(run, "knowledge/people/carlos-ruiz.md")); }, { deleted: "knowledge/people/carlos-ruiz.md" }],
    ["changed_status", async (run: string) => { const path = join(run, "_proposals/2026-12-03-acme-mobile-app-relaunch.md"); const source = await readFile(path, "utf8"); await writeFile(path, source.replace("status: pending", "status: approved")); }, { changed_status: "_proposals" }],
  ];
  for (const [name, mutate, mustNot] of cases) {
    const { root, base, run } = await folders(context);
    await mutate(run);
    const report = score(base, run, await expected(root, { case: name, expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [], proposals: [], tasks: [], must_not: [mustNot] }, optional: [] }));
    assert.equal(report.must_not.length, 1, name);
  }
});

test("ingest scorer handles optional precision, tasks, sets, lint and skipped kinds", async (context) => {
  const { root, base, run } = await folders(context);
  await mkdir(join(run, "_proposals"), { recursive: true });
  await writeFile(join(run, "_proposals/optional.md"), "---\nid: prp-opt0001\ntype: proposal\ntitle: Optional\nkind: add_link\ntarget: prj-9x4t1b7e\nfield: people\nafter: per-3h8w2n6c\nstatus: pending\n---\n");
  const report = score(base, run, await expected(root, { case: "optional", expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [], proposals: [{ kind: "add_link", target: "prj-9x4t1b7e" }], tasks: [{ title: ["missing"], owner: "Nobody", due: null }], must_not: [] }, optional: [{ proposal: { kind: "add_link", target: "prj-9x4t1b7e" } }] }), ["add_link"]);
  assert.equal(report.unmatched.proposals.length, 0);
  assert.equal(report.metrics.proposals.precision, 1);
  assert.equal(report.metrics.tasks.recall, 0);

  await writeFile(join(run, "bad.txt"), "not a note\n");
  const lintReport = score(base, run, await expected(root, { case: "lint", expect: { stop: false, meeting: { attendees: [], projects: [] }, notes: [], proposals: [], tasks: [], must_not: [] }, optional: [] }));
  assert.ok(lintReport.lint.errors > 0);
});
