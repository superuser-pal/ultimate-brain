import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { brain } from "./helpers.ts";

// CC-143's acceptance: `brain assistant findings` on a sandbox from eval/acceptance-0.10.0 (CC-140) returns exactly
// planted.json's `planted` and none of `not_flagged`, over the first page and "more". The sandbox is made by the
// harness's own make-sandbox.sh, with a `brain` on PATH that runs this checkout's source; the snapshot is read from the
// notion-sim state the way spec/assistant.md §2.1 says the skill reads Notion.
const REPO = join(import.meta.dirname, "..");
const HARNESS = join(REPO, "eval", "acceptance-0.10.0", "harness");
const planted = JSON.parse(readFileSync(join(REPO, "eval", "acceptance-0.10.0", "planted.json"), "utf8"));

type Page = { database: string; properties: Record<string, any>; archived: boolean; in_trash: boolean; last_edited: string };

function makeSandbox(): { dir: string; brainDir: string; state: { as_of: string; databases: Record<string, { name: string; properties: Record<string, any> }>; pages: Record<string, Page> } } {
  const dir = mkdtempSync(join(tmpdir(), "cc143-acceptance-"));
  const install = join(dir, "i");
  mkdirSync(join(install, "bin"), { recursive: true });
  const shim = join(install, "bin", "brain");
  writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" --experimental-strip-types --no-warnings "${join(REPO, "src", "cli.ts")}" "$@"\n`);
  chmodSync(shim, 0o755);
  writeFileSync(join(install, "env.sh"), `export PATH="${join(install, "bin")}:$PATH"\n`);
  execFileSync("sh", [join(HARNESS, "make-sandbox.sh"), install, join(dir, "s")], { stdio: "pipe" });
  const state = JSON.parse(readFileSync(join(dir, "s", "notion", "state.json"), "utf8"));
  return { dir, brainDir: join(dir, "s", "brain"), state };
}

/** The assistant snapshot of §2.1, read from the notion-sim state at its as_of. */
function snapshotOf(state: ReturnType<typeof makeSandbox>["state"]) {
  const database = (name: string) => Object.keys(state.databases).find((id) => state.databases[id]!.name === name)!;
  const rows = (name: string) => Object.entries(state.pages).filter(([, p]) => p.database === database(name) && !p.in_trash && !p.archived);
  const sorted = (value: unknown) => (Array.isArray(value) ? [...value].sort() : []);
  const brainId = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  const options: string[] = state.databases[database("Tasks")]!.properties.Status.options;
  return {
    as_of: `${state.as_of}T10:00:00Z`,
    notion: "live",
    task_statuses: options.map((name) => ({ name, group: null })),
    tasks: rows("Tasks").map(([id, p]) => ({
      page_id: id, title: p.properties.Name, status: p.properties.Status ?? null, due: p.properties.Due ?? null,
      projects: sorted(p.properties.Project), areas: sorted(p.properties.Area), created: p.last_edited, last_edited: p.last_edited,
    })),
    projects: rows("Projects").map(([id, p]) => ({
      page_id: id, brain_id: brainId(p.properties["Brain ID"]), title: p.properties.Name, status: p.properties.Status ?? null,
      archived: p.properties.Archived === true, last_edited: p.last_edited,
    })),
    areas: rows("Areas").map(([id, p]) => ({ page_id: id, brain_id: brainId(p.properties["Brain ID"]), title: p.properties.Name, archived: p.properties.Archived === true })),
    repos: [],
  };
}

test("findings on the CC-140 sandbox are exactly planted.json's planted, none of not_flagged, over the first page and more", { skip: process.platform === "win32" }, async (context) => {
  const { dir, brainDir, state } = makeSandbox();
  context.after(() => rmSync(dir, { recursive: true, force: true }));
  const snapshot = snapshotOf(state);
  const input = join(dir, "snapshot.json");
  writeFileSync(input, JSON.stringify(snapshot));
  const pageOfBrain = new Map(snapshot.projects.map((row) => [row.brain_id, row.page_id]));
  const describe = (finding: any) => {
    const pages = finding.subject.kind === "project_pair" ? finding.subject.ids.map((id: string) => pageOfBrain.get(id)) : [finding.subject.page_id];
    return `${finding.signal} ${[...pages].sort().join(" ")}`;
  };

  const first = await brain(["assistant", "findings", "--brain", brainDir, "--input", input, "--json"]);
  assert.equal(first.code, 0, first.stdout);
  assert.equal(first.json.data.findings.length, 10);
  const exclude = join(dir, "exclude.json");
  writeFileSync(exclude, JSON.stringify(first.json.data.findings.map((finding: { key: string }) => finding.key)));
  const more = await brain(["assistant", "findings", "--brain", brainDir, "--input", input, "--exclude", exclude, "--number-from", "11", "--json"]);
  assert.equal(more.code, 0, more.stdout);
  assert.equal(more.json.data.findings[0]?.rank, 11);

  const found = [...first.json.data.findings, ...more.json.data.findings].map(describe).sort();
  const expected = planted.planted.map((entry: { signal: string; pages: string[] }) => `${entry.signal} ${[...entry.pages].sort().join(" ")}`).sort();
  assert.deepEqual(found, expected);
  assert.equal(first.json.data.total, planted.planted.length);
  for (const entry of planted.not_flagged) assert.ok(!found.some((line) => line.includes(entry.page)), `${entry.key} is flagged`);
  assert.match(first.json.data.report, /\n\n3 more\. Say "more", or name an Area, Domain or Project\.\n/);
  // One task to move: the verb agrees (CC-110's acceptance found "its 1 open task that name Clients").
  assert.match(first.json.data.report, /a\) move it to Marketing \(and its 1 open task that names Clients\)\n/);
});
