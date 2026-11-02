import assert from "node:assert/strict";
import { test } from "node:test";

import { eligible, lineageOf, noteReleased, restrictedSources, type Context, type SourceInfo, type Suppression } from "../src/lib/eligibility.ts";

const M1 = "page-meeting-1";
const M2 = "page-meeting-2";
const source = (info: SourceInfo): [string, SourceInfo] => [info.id, info];
const sources = new Map<string, SourceInfo>([
  source({ id: "src-full1", source_key: `notion:${M1}` }),
  source({ id: "src-ex1v1", extract_of: M1, replaces: "src-full1", transcript_hash: "h1", passages: ["1:aaaaaaaa", "2:bbbbbbbb"] }),
  source({ id: "src-ex1v2", extract_of: M1, replaces: "src-ex1v1", transcript_hash: "h1", passages: ["1:aaaaaaaa"] }),
  source({ id: "src-other", source_key: `notion:${M2}` }),
  source({ id: "src-orphan" }),
]);
const suppress = (input: string, status: Suppression["status"] = "active"): Suppression => ({ input, version: 2, passages: [{ extract_of: input, transcript_hash: "h1", n: 2 }], status });
const context = (suppressions: Suppression[], awaitingRestore?: Set<string>): Context => ({ sources, suppressions, awaitingRestore });

test("lineage follows extract_of, source_key and the replaces chain; unknown is null", () => {
  assert.equal(lineageOf("src-ex1v2", sources), M1);
  assert.equal(lineageOf("src-full1", sources), M1);
  assert.equal(lineageOf("src-orphan", sources), null);
});

test("with no suppression every claim is eligible", () => {
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }] }, context([])), true);
});

test("a claim on a suppressed passage is restricted, one on a kept passage is live, and an older full copy does not rescue it", () => {
  const ctx = context([suppress(M1)]);
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }] }, ctx), false);
  assert.equal(eligible({ entries: [{ source: "src-ex1v2", passage: { n: 1, hash: "aaaaaaaa" } }] }, ctx), true);
  assert.equal(eligible({ entries: [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }, { source: "src-full1" }] }, ctx), false);
});

test("a claim that also cites a different input stays eligible", () => {
  const entries = [{ source: "src-ex1v1", passage: { n: 2, hash: "bbbbbbbb" } }, { source: "src-other" }];
  assert.equal(eligible({ entries }, context([suppress(M1)])), true);
});

test("a re-included passage is live only after its Restore item is accepted", () => {
  const entry = { source: "src-ex1v2", passage: { n: 1, hash: "aaaaaaaa" } };
  assert.equal(eligible({ entries: [entry] }, context([suppress(M1)], new Set([`${M1}|h1|1`]))), false);
  assert.equal(eligible({ entries: [entry] }, context([suppress(M1)], new Set())), true);
});

test("unknown lineage is never live while any suppression is active, until every active input is cleared", () => {
  const claim = { entries: [{ source: "src-orphan" }] };
  assert.equal(eligible(claim, context([])), true);
  assert.equal(eligible(claim, context([suppress(M1)])), false);
  assert.equal(eligible({ ...claim, lineage_cleared: [M1] }, context([suppress(M1)])), true);
  assert.equal(eligible({ ...claim, lineage_cleared: [M1] }, context([suppress(M1), suppress(M2)])), false, "a second suppression restricts again");
  assert.equal(eligible({ ...claim, lineage_cleared: [M1, M2] }, context([suppress(M1), suppress(M2)])), true);
});

test("release is per note and per active suppression; a reconciled suppression no longer restricts", () => {
  const ctx = context([suppress(M1), suppress(M2)]);
  assert.equal(noteReleased({ lineage_cleared: [M1] }, ctx), false);
  assert.equal(noteReleased({ lineage_cleared: [M1] }, ctx, new Set([M2])), true);
  assert.equal(noteReleased({}, context([suppress(M1, "reconciled")])), true);
});

test("older versions and full copies of a changed input are restricted as sources; the latest extract is not", () => {
  assert.deepEqual([...restrictedSources(context([suppress(M1)]))].sort(), ["src-ex1v1", "src-full1"]);
  assert.equal(restrictedSources(context([])).size, 0);
});

import { mkdir, readFile as read, writeFile as write } from "node:fs/promises";
import { join } from "node:path";
import { brain, fixtureCopy } from "./helpers.ts";

test("brain query leaves out restricted statements and notes resting on a suppressed passage", async (context) => {
  const dir = await fixtureCopy(context);
  const text = "The pricing figure was ninety five thousand.";
  const { passageHash } = await import("../src/lib/selection.ts");
  const hash = passageHash(text);
  const page = "11111111-2222-4333-8444-555555555555";
  // The fixture already has sources and concepts: add an extract source, a suppression and a concept citing it.
  const src = join(dir, "sources/notion/2026-12-10-extract.md");
  await write(src, `---\nid: src-ex2a3b4c\ntype: source\ntitle: Launch extract\nsource_key: notion:${page}\nkind: minutes\nextract: true\nextract_of: ${page}\nextract_version: 2\ntranscript_hash: ${"a".repeat(64)}\npage_fingerprint: ${"b".repeat(64)}\nselection:\n  - id: s1\n    effective: use\n    explicit: null\npassages:\n  - n: 1\n    hash: ${hash}\n    items:\n      - s1.i1\ncontent_hash: sha256:${"0".repeat(64)}\ncaptured: 2026-12-10T09:00:00Z\n---\n<!-- passage ¶1 item s1.i1 -->\n${text}\n`);
  const concept = join(dir, "knowledge/concepts/row-level-security.md");
  const original = await read(concept, "utf8");
  const withSources = original.replace(/\nsources:[^\n]*\n/, "\n").replace(/\n---\n/, `\nsources:\n  - src-ex2a3b4c\n---\n`);
  await write(concept, `${withSources}\nZebra pricing statement. ^[src-ex2a3b4c#¶2:deadbeef]\nZebra kept statement. ^[src-ex2a3b4c#¶1:${hash}]\n`);
  const ask = async () => (await brain(["query", "--candidates", "zebra", "--brain", dir, "--json"])).json.data.candidates as { id: string; snippets: { text: string }[] }[];
  assert.equal((await ask()).length, 1, "no suppression: the note is a candidate");
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await write(join(dir, "_suppressions", `${page}.json`), JSON.stringify({ input: page, version: 2, passages: [{ extract_of: page, transcript_hash: "a".repeat(64), n: 2 }], status: "active" }));
  const after = await ask();
  assert.equal(after.length, 1);
  const quoted = after[0]?.snippets.map((snippet) => snippet.text).join("|") ?? "";
  assert.ok(quoted.includes("kept"), "the live passage statement is still quoted");
  assert.ok(!quoted.includes("pricing"), "the suppressed passage statement is not quoted");
});

test("brain status counts suppressions, restricted notes and unreadable records", async (context) => {
  const dir = await fixtureCopy(context);
  const clean = await brain(["status", "--brain", dir, "--json"]);
  assert.deepEqual(clean.json.data.suppressions, { active: 0, reconciled: 0, restricted_notes: 0, unresolved_lineage: 0, problems: [] });
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await write(join(dir, "_suppressions", "page-a.json"), JSON.stringify({ input: "page-a", version: 2, passages: [], status: "active" }));
  await write(join(dir, "_suppressions", "broken.json"), "{");
  const run = await brain(["status", "--brain", dir, "--json"]);
  assert.equal(run.json.data.suppressions.active, 1);
  assert.deepEqual(run.json.data.suppressions.problems, ["_suppressions/broken.json: unreadable"]);
  assert.equal(run.json.data.suppressions.unresolved_lineage, 0, "no fixture note rests on page-a");
});
