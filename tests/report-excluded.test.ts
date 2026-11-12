import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { excludableDecision } from "./exclusion-fixture.ts";
import { approveNote, brain, fixtureCopy } from "./helpers.ts";

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

test("sync render publishes a restricted note in its eligible form, so a copy published before the exclusion is re-rendered without the excluded text", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  await approveNote(dir, note.path);
  const before = (await run(dir, ["sync", "render", "--ids", note.id])).json.data.items[0];
  assert.ok(String(before.body).includes("95,000"), "while the paragraph is live it is published");
  await exclude();
  const after = (await run(dir, ["sync", "render", "--ids", note.id])).json.data.items[0];
  assert.ok(!JSON.stringify(after).includes("95,000"), "the excluded text is not in the payload");
  assert.ok(String(after.body).includes("Kept statement"), "what stays is still published");
  assert.notEqual(after.published["@content"], before.published["@content"], "the content hash moves, so a published copy is re-rendered");
});

test("query --read and --candidates leave out a view that links a note resting on excluded content (cli §5.13.1, Views)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const body = `## Where it stands\n\nThe price is 95,000 ([Pricing call](../${note.path})).\n\n## Timeline\n\n- None\n\n## Decisions in force\n\n- None\n\n## Open questions and risks\n\n- None\n\n## People involved\n\n- None\n\n## Gaps\n\n- None\n`;
  const created = await run(dir, ["report", "new"], { title: "Pricing: where we stand", question: "Where does pricing stand?", body });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.id as string;
  const read = async () => (await run(dir, ["query", "--read", id])).json.data.notes[0];
  const found = async () => (await run(dir, ["query", "--candidates", "price 95,000 pricing", "--types", "view"])).json.data.candidates.map((candidate: { id: string }) => candidate.id);
  assert.equal((await read()).status, "ok", "while the evidence is live the report is read");
  assert.ok((await found()).includes(id));
  await exclude();
  assert.deepEqual(await read(), { id, status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" });
  assert.ok(!(await found()).includes(id), "and it is not a candidate");
  assert.ok(!JSON.stringify((await run(dir, ["query", "--candidates", "price 95,000 pricing", "--types", "view"])).json.data.candidates).includes("95,000"));
});

test("the index lists no alias of a wholly restricted note", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, "unmapped");
  const file = join(dir, note.path);
  await writeFile(file, (await readFile(file, "utf8")).replace("\nsummary:", "\naliases: ['Budget 95,000']\nsummary:"));
  await exclude();
  assert.equal((await run(dir, ["index"])).code, 0);
  assert.ok(!(await readFile(join(dir, "index.md"), "utf8")).includes("95,000"));
});

test("a report written before an exclusion is withheld until it is refreshed, and a link that names no note withholds a view (cli §5.13.1, Views)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const sections = (first: string) => `## Where it stands\n\n${first}\n\n## Timeline\n\n- 2026-12-03 · Auth chosen ([Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md))\n\n## Decisions in force\n\n- None\n\n## Open questions and risks\n\n- None\n\n## People involved\n\n- None\n\n## Gaps\n\n- None\n`;
  const created = await run(dir, ["report", "new"], { title: "Price: where we stand", question: "Where does the price stand?", body: sections("Price is 95,000, said on the call.") });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.id as string;
  const read = async () => (await run(dir, ["query", "--read", id])).json.data.notes[0];
  assert.equal((await read()).status, "ok");
  await exclude();
  // The fixture's second version carries a date; a real extract carries the time it was captured, after the report was written.
  const v2 = join(dir, "sources/notion/2026-12-10-extract-v2.md");
  await writeFile(v2, (await readFile(v2, "utf8")).replace("captured: 2026-12-10", "captured: 2026-12-10T10:00:00Z"));
  assert.deepEqual(await read(), { id, status: "withheld", reason: "restricted", cause: "stale", rebuild: "refresh" }, "the report links no restricted note, and is still withheld: it is older than the exclusion");
  const refreshed = await brain(["report", "new", "--input", await inputFile(dir, { refresh: id, body: sections("No price is recorded.") }), "--brain", dir, "--now", "2026-12-10T11:00:00Z", "--json"]);
  assert.equal(refreshed.code, 0, refreshed.stdout);
  const after = await read();
  assert.equal(after.status, "ok", "a refresh after the exclusion is read again");
  assert.ok(!JSON.stringify(after).includes("95,000"));

  await writeFile(join(dir, "reports/2026-12-10-hand.md"), `---\nid: vw-aaaa0009\ntype: view\ntitle: Hand report\ncreated: 2026-12-10\nupdated: 2026-12-10\nview_kind: report\nquestion: q\ngenerated_from: []\ngenerated_at: 2026-12-10T12:00:00Z\n---\n\n## Where it stands\n\nPrice is 95,000 ([gone](../knowledge/decisions/gone.md)).\n`);
  assert.deepEqual((await run(dir, ["query", "--read", "vw-aaaa0009"])).json.data.notes[0], { id: "vw-aaaa0009", status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" });
});

test("a report's time and the extract's are compared as full timestamps: a date alone, or the same second, withholds the report (cli §5.13.1, Views)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  await exclude();
  const v2 = join(dir, "sources/notion/2026-12-10-extract-v2.md");
  const original = await readFile(v2, "utf8");
  await mkdir(join(dir, "reports"), { recursive: true });
  const report = (at: string) => `---\nid: vw-aaaa0011\ntype: view\ntitle: Timed report\ncreated: 2026-12-10\nupdated: 2026-12-10\nview_kind: report\nquestion: q\ngenerated_from: []\ngenerated_at: ${at}\n---\n\n## Where it stands\n\nOn track.\n`;
  const status = async (captured: string, at: string) => {
    await writeFile(v2, original.replace("captured: 2026-12-10", `captured: ${captured}`));
    await writeFile(join(dir, "reports/2026-12-10-timed.md"), report(at));
    return (await run(dir, ["query", "--read", "vw-aaaa0011"])).json.data.notes[0].status;
  };
  assert.equal(await status("2026-12-10T10:00:00Z", "2026-12-10T10:00:01Z"), "ok", "a report written a second after the extract is read");
  assert.equal(await status("2026-12-10T10:00:00Z", "2026-12-10T10:00:00Z"), "withheld", "the same second: the report may have been written first");
  assert.equal(await status("2026-12-10", "2026-12-10T23:59:59Z"), "withheld", "a date alone on the extract is not a time");
  assert.equal(await status("2026-12-10T10:00:00Z", "2026-12-11"), "withheld", "a date alone on the report is not a time");
});

test("a view's link to a file that isn't a note (a PDF, an index, a folder) doesn't withhold it; a .md link that names nothing does (cli §5.13.1, Views)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT);
  await exclude();
  const v2 = join(dir, "sources/notion/2026-12-10-extract-v2.md");
  await writeFile(v2, (await readFile(v2, "utf8")).replace("captured: 2026-12-10", "captured: 2026-12-10T10:00:00Z"));
  await writeFile(join(dir, "README.md"), "# Brain\n");
  await mkdir(join(dir, "reports"), { recursive: true });
  const write = (links: string) => writeFile(join(dir, "reports/2026-12-10-links.md"), `---\nid: vw-aaaa0012\ntype: view\ntitle: Linked report\ncreated: 2026-12-10\nupdated: 2026-12-10\nview_kind: report\nquestion: q\ngenerated_from: []\ngenerated_at: 2026-12-10T12:00:00Z\n---\n\n## Where it stands\n\n${links}\n`);
  const status = async () => (await run(dir, ["query", "--read", "vw-aaaa0012"])).json.data.notes[0].status;
  await write("See [the deck](../files/deck.pdf), [the readme](../README.md), [the folder](../knowledge/decisions/) and [the image](<../files/a b.png>).");
  assert.equal(await status(), "ok");
  await write("See [the readme](../README.md) and [a removed note](../knowledge/decisions/removed.md).");
  assert.equal(await status(), "withheld");
  await write("See [outside](../../elsewhere/notes.md).");
  assert.equal(await status(), "withheld", "a .md link that leaves the brain names no note of it");
});

async function inputFile(dir: string, value: unknown): Promise<string> {
  const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify(value));
  return file;
}
