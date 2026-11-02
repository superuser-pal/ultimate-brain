import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const PAGE = "11111111-2222-4333-8444-555555555555";
const TRANSCRIPT = "The launch moves to February.\n\nPricing is zebrafish95k, keep it between us.\n\nMaria sends the contract on Friday.";
const SUMMARY = (pricing: "Use in brain" | "Meeting only") => `## [s1] Launch\n- [s1.i1] Launch “The launch moves to February”\n\n## [s2] Pricing\nSelection: ${pricing}\n- [s2.i1] Price “keep it between us”\n\n## [s3] Contract\n- [s3.i1] Contract “sends the contract on Friday”\n`;
const CONCEPT = "knowledge/concepts/row-level-security.md";
const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

async function gitBrain(context: TestContext) {
  const dir = await fixtureCopy(context);
  git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T");
  git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "fixture");
  return dir;
}
async function extract(dir: string, pricing: "Use in brain" | "Meeting only", ...extra: string[]) {
  await writeFile(join(dir, "..", "s.md"), SUMMARY(pricing)); await writeFile(join(dir, "..", "t.md"), TRANSCRIPT);
  return brain(["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s.md"), "--transcript", join(dir, "..", "t.md"), "--brain", dir, "--now", NOW, "--json", ...extra]);
}
const hashes = async (dir: string, path: string) => new Map([...(await readFile(join(dir, path), "utf8")).matchAll(/- n: (\d+)\n\s+hash: ([0-9a-f]{8})/g)].map((m) => [Number(m[1]), m[2]!]));
const ask = async (dir: string, word: string, ...extra: string[]) => brain(["query", "--candidates", word, "--brain", dir, "--json", ...extra]);
const commit = (dir: string, message: string) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", message); };

/** v1 uses everything; a concept cites the pricing and contract paragraphs. Returns what later steps need. */
async function seeded(context: TestContext, body: (id: string, h: Map<number, string>) => string, extraFrontmatter = "") {
  const dir = await gitBrain(context);
  const v1 = await extract(dir, "Use in brain");
  const id = v1.json.data.created[0] as string;
  const h = await hashes(dir, v1.json.data.path);
  const original = await readFile(join(dir, CONCEPT), "utf8");
  const withSource = original.replace(/\nsources:[^\n]*\n/, "\n").replace(/\n---\n/, `\nsources:\n  - ${id}\n${extraFrontmatter}---\n`);
  await writeFile(join(dir, CONCEPT), `${withSource.split("\n---\n")[0]}\n---\n${body(id, h)}`);
  commit(dir, "claims");
  return { dir, id, h, v1 };
}

test("an older extract version or full copy of an excluded paragraph is no longer retrievable", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing zebrafish ${src}. ^[${src}#¶2:${h.get(2)}]\n`);
  assert.ok((await ask(dir, "zebrafish95k", "--types", "source")).json.data.candidates.some((c: { id: string }) => c.id === id), "v1 is retrievable before the exclusion");
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  const after = (await ask(dir, "zebrafish95k", "--types", "source,concept")).json.data.candidates as { id: string }[];
  assert.deepEqual(after.filter((c) => c.id === id || c.id.startsWith("con-")), [], "neither the older source nor the claim resting on it");
});

test("unmarked prose in a note that rests on an excluded paragraph fails closed, marked live statements stay", async (context) => {
  const { dir, id, h } = await seeded(context, (src, hh) => `Unmarked pricing prose yak.\n\nContract goes Friday yak. ^[${src}#¶3:${hh.get(3)}]\n\nPricing yak. ^[${src}#¶2:${hh.get(2)}]\n`);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const quoted = ((await ask(dir, "yak")).json.data.candidates as { snippets: { text: string }[] }[]).flatMap((c) => c.snippets.map((s) => s.text)).join("|");
  assert.ok(quoted.includes("Contract goes Friday"), "the live marked statement stays");
  assert.ok(!quoted.includes("Unmarked pricing prose"), "unmapped text is restricted");
  assert.ok(!quoted.includes("Pricing yak"), "the suppressed statement is restricted");
  void h;
});

test("a timeline entry and the fact it supports resting on an excluded paragraph are neither returned nor rendered", async (context) => {
  const { dir, id, h } = await seeded(context, () => "Body.\n", "");
  // Add facts and a timeline whose only accepted entry cites the pricing paragraph.
  const text = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), text.replace(/\n---\n/, `\nfacts:\n  budget: quokka-9000\ntimeline:\n  - field: budget\n    value: quokka-9000\n    from: 2026-12-10\n    learned: 2026-12-10\n    source: ${id}\n    passage: ${id}#¶2:${h.get(2)}\n    assessment: accepted\n---\n`));
  commit(dir, "fact");
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.equal(lint.json.data.issues.filter((i: { severity: string; rule: string }) => i.severity === "error" && i.rule === "schema").length, 0, "the timeline accepts a passage reference");
  assert.equal((await ask(dir, "quokka")).json.data.candidates.length, 1, "returned before the exclusion");
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const left = (await ask(dir, "quokka")).json.data.candidates;
  assert.equal(left.length, 0, JSON.stringify(left));
});

test("a re-included paragraph stays restricted until a Restore record names it", async (context) => {
  const { dir, id, h } = await seeded(context, (src, hh) => `Pricing narwhal. ^[${src}#¶2:${hh.get(2)}]\n`);
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  const v3 = await extract(dir, "Use in brain", "--previous", v2.json.data.created[0]);
  assert.equal(v3.code, 0, v3.stdout);
  assert.equal((await ask(dir, "narwhal")).json.data.candidates.length, 0, "re-included but not yet restored");
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records.push({ kind: "restore", extract_version: 3, passages: [{ n: 2 }], written: NOW });
  await writeFile(path, JSON.stringify(record, null, 2));
  assert.equal((await ask(dir, "narwhal")).json.data.candidates.length, 1, "restored");
  void h;
});

test("unreadable suppression data fails closed for query, views and the writer, and is never replaced", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing okapi. ^[${src}#¶2:${h.get(2)}]\n`);
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  const path = join(dir, `_suppressions/${PAGE}.json`);
  await writeFile(path, "{ not json");
  commit(dir, "break");
  for (const args of [["query", "--candidates", "okapi"], ["views", "--check"]]) {
    const run = await brain([...args, "--brain", dir, "--json"]);
    assert.equal(run.json.error.code, "SUPPRESSIONS_UNREADABLE", args.join(" "));
  }
  const again = await extract(dir, "Use in brain", "--previous", v2.json.data.created[0]);
  assert.equal(again.json.error.code, "SUPPRESSIONS_UNREADABLE");
  assert.equal(await readFile(path, "utf8"), "{ not json", "the damaged history is preserved");
  const status = await brain(["status", "--brain", dir, "--json"]);
  assert.equal(status.json.data.suppressions.problems.length, 1, "status still reports it");
});

test("a statement resting on a different, unchanged input stays eligible beside a suppressed one", async (context) => {
  const { dir, id, h } = await seeded(context, () => "placeholder\n");
  const other = "99999999-2222-4333-8444-555555555555";
  await writeFile(join(dir, "..", "s2.md"), "## [s1] Other\n- [s1.i1] Other “Independent evidence”\n");
  await writeFile(join(dir, "..", "t2.md"), "Independent evidence about hedgehogs.");
  const second = await brain(["source", "extract", "--page", other, "--title", "Other sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s2.md"), "--transcript", join(dir, "..", "t2.md"), "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(second.code, 0, second.stdout);
  const otherId = second.json.data.created[0] as string;
  const oh = await hashes(dir, second.json.data.path);
  const text = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), text.replace(/\nsources:\n  - [^\n]*\n/, `\nsources:\n  - ${id}\n  - ${otherId}\n`).replace("placeholder", `Hedgehog independent. ^[${otherId}#¶1:${oh.get(1)}]\nHedgehog pricing. ^[${id}#¶2:${h.get(2)}]`));
  commit(dir, "claims");
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const quoted = ((await ask(dir, "hedgehog")).json.data.candidates as { snippets: { text: string }[] }[]).flatMap((c) => c.snippets.map((s) => s.text)).join("|");
  assert.ok(quoted.includes("Hedgehog independent"), "the independently supported statement stays");
  assert.ok(!quoted.includes("Hedgehog pricing"), "the suppressed one does not");
});
