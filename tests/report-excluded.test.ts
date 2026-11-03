import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) { const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`); await writeFile(file, JSON.stringify(input)); extra.push("--input", file); }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

test("a report line that links a note resting on excluded content is flagged (source excluded) and the report is not edited", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const body = `## Where it stands\n\nOn track.\n\n## Timeline\n\n- Dec 1: kickoff\n\n## Decisions in force\n\n- Pricing was settled ([Pricing call](../${note.path})).\n\n## Open questions and risks\n\nNone.\n\n## People involved\n\nAlex.\n\n## Gaps\n\nNone.\n`;
  const created = await run(dir, ["report", "new"], { title: "Login: where we stand", question: "Where does it stand?", body });
  assert.equal(created.code, 0, created.stdout);
  const flagged = () => run(dir, ["lint"]).then((out) => out.json.data.issues.filter((issue: { rule: string }) => issue.rule === "report-source-excluded"));
  assert.deepEqual(await flagged(), [], "nothing is flagged while the evidence is live");
  await exclude();
  const issues = await flagged();
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /\(source excluded\)/);
  assert.equal(issues[0].severity, "warning");
  assert.equal(issues[0].line, (await readFile(join(dir, created.json.data.path), "utf8")).split("\n").findIndex((text) => text.includes("Pricing was settled")) + 1);
  assert.ok((await readFile(join(dir, created.json.data.path), "utf8")).includes("Pricing was settled"), "the accepted report text is not edited");
});
