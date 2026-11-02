import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

test("unmapped prose restricts the whole note, while a note of marked statements keeps its live ones", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Unmarked pricing prose yak.\n\nContract goes Friday yak. ^[${src}#¶3:${h.get(3)}]\n\nPricing yak. ^[${src}#¶2:${h.get(2)}]\n`);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  assert.equal((await ask(dir, "yak")).json.data.candidates.length, 0, "a note with unmapped text is restricted whole, marked lines included");
});

test("a note of marked statements keeps the live ones and loses its summary when partly restricted", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Contract goes Friday yak. ^[${src}#¶3:${h.get(3)}]\n\nPricing yak. ^[${src}#¶2:${h.get(2)}]\n`);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const found = (await ask(dir, "yak")).json.data.candidates as { summary: string | null; snippets: { text: string }[] }[];
  const quoted = found.flatMap((c) => c.snippets.map((s) => s.text)).join("|");
  assert.ok(quoted.includes("Contract goes Friday") && !quoted.includes("Pricing yak"));
  assert.equal(found[0]?.summary, null, "the summary may carry the excluded text, so it is not returned");
});

test("an unsupported fact on a note that rests on a changed input restricts the note", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing ${src}. ^[${src}#¶3:${h.get(3)}]\n`);
  const text = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), text.replace(/\n---\n/, "\nfacts:\n  budget: capybara-77\n---\n"));
  commit(dir, "fact without timeline");
  assert.equal((await ask(dir, "capybara")).json.data.candidates.length, 1);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  assert.equal((await ask(dir, "capybara")).json.data.candidates.length, 0, "a fact no accepted timeline entry supports is unmapped");
});

test("a citation absent from the note's sources list is still judged claim by claim", async (context) => {
  const { dir, id, h } = await seeded(context, () => "placeholder\n");
  const text = await readFile(join(dir, CONCEPT), "utf8");
  // sources names only an independent input; the body cites the extract that will be suppressed.
  await writeFile(join(dir, CONCEPT), text.replace(/\nsources:\n  - [^\n]*\n/, "\nsources:\n  - src-2k6m9p3t\n").replace("placeholder", `Pricing gecko. ^[${id}#¶2:${h.get(2)}]`));
  commit(dir, "mixed sources");
  assert.equal((await ask(dir, "gecko")).json.data.candidates.length, 1);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  assert.equal((await ask(dir, "gecko")).json.data.candidates.length, 0);
});

test("re-inclusion after the exclusion was reconciled stays restricted until Restore, in query, views and the cleanup plan", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing ibis. ^[${src}#¶2:${h.get(2)}]\n`);
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records[0].status = "reconciled";
  await writeFile(path, JSON.stringify(record, null, 2));
  commit(dir, "reconcile");
  const v3 = await extract(dir, "Use in brain", "--previous", v2.json.data.created[0]);
  assert.equal(v3.code, 0, v3.stdout);
  assert.equal((await ask(dir, "ibis")).json.data.candidates.length, 0, "the claim waits for Restore although no suppression is active");
  const sources = (await ask(dir, "zebrafish95k", "--types", "source")).json.data.candidates as { id: string }[];
  assert.ok(!sources.some((c) => c.id === v3.json.data.created[0]), "the latest extract does not return the re-included text");
  const plan = await brain(["source", "cleanup-plan", "--page", PAGE, "--brain", dir, "--json"]);
  assert.equal(plan.json.data.restore.length, 1, "the cleanup plan lists the Restore");
  const views = await brain(["views", "--check", "--brain", dir, "--json"]);
  assert.equal(views.code, 0, "views are current");
  const noteId = /^id: (.+)$/m.exec(await readFile(join(dir, CONCEPT), "utf8"))![1]!;
  record.records.push({ kind: "restore", extract_version: 3, items: [{ note: noteId, n: 2 }], written: NOW });
  await writeFile(path, JSON.stringify(record, null, 2));
  assert.equal((await ask(dir, "ibis")).json.data.candidates.length, 1, "restored");
});

test("a suppression directory that cannot be read fails closed", async (context) => {
  const dir = await gitBrain(context);
  await writeFile(join(dir, "_suppressions"), "not a directory");
  const run = await ask(dir, "anything");
  assert.equal(run.json.error.code, "SUPPRESSIONS_UNREADABLE");
});

test("a failed commit rolls back index and worktree to the last commit", async (context) => {
  const dir = await gitBrain(context);
  await writeFile(join(dir, ".git/hooks/pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const failed = await extract(dir, "Use in brain");
  assert.notEqual(failed.code, 0);
  assert.equal(git(dir, "status", "--porcelain").trim(), "", "nothing staged, nothing left in the worktree");
  assert.equal(git(dir, "diff", "--cached", "--name-only").trim(), "");
  assert.equal((await ask(dir, "anything")).code, 0, "no journal is left behind");
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
  const noteId = /^id: (.+)$/m.exec(await readFile(join(dir, CONCEPT), "utf8"))![1]!;
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records.push({ kind: "restore", extract_version: 3, items: [{ note: noteId, n: 2 }], written: NOW });
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

test("a reconciled exclusion does not make the excluded passage, its old source or its fact eligible again", async (context) => {
  const { dir, id, h } = await seeded(context, (src, hh) => `Pricing lemur. ^[${src}#¶2:${hh.get(2)}]\n`);
  const text = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), text.replace(/\n---\n/, `\nfacts:\n  budget: wombat-31\ntimeline:\n  - field: budget\n    value: wombat-31\n    from: 2026-12-10\n    learned: 2026-12-10\n    source: ${id}\n    passage: ${id}#¶2:${h.get(2)}\n    assessment: accepted\n---\n`));
  commit(dir, "fact");
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records[0].status = "reconciled";
  await writeFile(path, JSON.stringify(record, null, 2));
  commit(dir, "reconcile");
  assert.equal((await ask(dir, "lemur")).json.data.candidates.length, 0, "the claim stays restricted");
  assert.equal((await ask(dir, "wombat")).json.data.candidates.length, 0, "and so does the fact");
  assert.equal(((await ask(dir, "zebrafish95k", "--types", "source")).json.data.candidates as unknown[]).length, 0, "the old source text is not returned");
  assert.equal((await brain(["views", "--check", "--brain", dir, "--json"])).code, 0);
});

test("a Restore is accepted per claim: restoring one note leaves another note on the same passage restricted", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing heron. ^[${src}#¶2:${h.get(2)}]\n`);
  // A second note cites the same paragraph.
  const second = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
  const original = await readFile(join(dir, second), "utf8");
  const head = original.split("\n---\n")[0]!.replace(/\nsources:[^\n]*(\n  - [^\n]*)*/, `\nsources: [${id}]`);
  const h2 = (await hashes(dir, (await brain(["query", "--candidates", "zebrafish95k", "--types", "source", "--brain", dir, "--json"])).json.data.candidates[0].path)).get(2)!;
  await writeFile(join(dir, second), `${head}\n---\nPricing heron too. ^[${id}#¶2:${h2}]\n`);
  commit(dir, "second claim");
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  const v3 = await extract(dir, "Use in brain", "--previous", v2.json.data.created[0]);
  assert.equal(v3.code, 0, v3.stdout);
  assert.equal((await ask(dir, "heron")).json.data.candidates.length, 0, "both claims wait for Restore");
  const noteId = /^id: (.+)$/m.exec(await readFile(join(dir, CONCEPT), "utf8"))![1]!;
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records.push({ kind: "restore", extract_version: 3, items: [{ note: noteId, n: 2 }], written: NOW });
  await writeFile(path, JSON.stringify(record, null, 2));
  const found = (await ask(dir, "heron")).json.data.candidates as { id: string }[];
  assert.deepEqual(found.map((c) => c.id), [noteId], "only the restored claim is returned");
});

test("source diff and the index never show excluded text", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing ${src}. ^[${src}#¶2:${h.get(2)}]\n`);
  const text = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), text.replace(/\n---\n/, "\nsummary: Pricing is zebrafish95k\n---\n").replace(/^summary: .*\n(?=[\s\S]*^summary: )/m, ""));
  commit(dir, "summary");
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  const diff = await brain(["source", "diff", v2.json.data.created[0], "--brain", dir, "--json"]);
  assert.equal(diff.code, 0, diff.stdout);
  assert.ok(!JSON.stringify(diff.json.data).includes("zebrafish95k"), "no excluded text in the diff");
  const built = await brain(["index", "--brain", dir, "--json"]);
  assert.equal(built.code, 0, built.stdout);
  assert.ok(!(await readFile(join(dir, "index.md"), "utf8")).includes("zebrafish95k"), "the index lists the note without its summary");
  assert.ok(!JSON.stringify(built.json.data).includes("zebrafish95k"));
  assert.equal((await brain(["index", "--check", "--brain", dir, "--json"])).code, 0, "lint and status agree the index is current");
});

test("after a reconciled exclusion a claim citing the old version without a passage stays restricted, unless marked independent", async (context) => {
  const { dir, id } = await seeded(context, () => "Pricing is zebrafish95k kiwi.\n");
  const text = await readFile(join(dir, CONCEPT), "utf8");
  void text;
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records[0].status = "reconciled";
  await writeFile(path, JSON.stringify(record, null, 2));
  commit(dir, "reconcile");
  assert.equal((await ask(dir, "kiwi")).json.data.candidates.length, 0, "a reconciled cleanup does not free the old text");
  const note = await readFile(join(dir, CONCEPT), "utf8");
  await writeFile(join(dir, CONCEPT), note.replace(/\n---\n/, `\nlineage_cleared:\n  - ${PAGE}\n---\n`));
  assert.equal((await ask(dir, "kiwi")).json.data.candidates.length, 1, "Keep (lineage_cleared) releases it");
});

test("a Restore stays valid for a later version that holds the passage, until a new exclusion removes it again", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing tapir. ^[${src}#¶2:${h.get(2)}]\n`);
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  const v3 = await extract(dir, "Use in brain", "--previous", v2.json.data.created[0]);
  const noteId = /^id: (.+)$/m.exec(await readFile(join(dir, CONCEPT), "utf8"))![1]!;
  const path = join(dir, `_suppressions/${PAGE}.json`);
  const record = JSON.parse(await readFile(path, "utf8"));
  record.records.push({ kind: "restore", extract_version: 3, items: [{ note: noteId, n: 2 }], written: NOW });
  await writeFile(path, JSON.stringify(record, null, 2));
  commit(dir, "restore");
  // A mapping-only version (an item id renamed) leaves paragraphs unchanged.
  await writeFile(join(dir, "..", "s.md"), SUMMARY("Use in brain").replace("[s3.i1]", "[s3.i9]"));
  const v4 = await brain(["source", "extract", "--page", PAGE, "--title", "Launch sync", "--date", "2026-12-10", "--summary", join(dir, "..", "s.md"), "--transcript", join(dir, "..", "t.md"), "--previous", v3.json.data.created[0], "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(v4.code, 0, v4.stdout);
  assert.equal((await ask(dir, "tapir")).json.data.candidates.length, 1, "the Restore carries to v4");
  const v5 = await extract(dir, "Meeting only", "--previous", v4.json.data.created[0]);
  assert.equal(v5.code, 0, v5.stdout);
  assert.equal((await ask(dir, "tapir")).json.data.candidates.length, 0, "excluded again");
});

test("an unreadable record shape fails closed", async (context) => {
  const dir = await gitBrain(context);
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions/x.json"), JSON.stringify({ input: "x", records: [{ version: 1, passages: [null], status: "active" }] }));
  assert.equal((await ask(dir, "anything")).json.error.code, "SUPPRESSIONS_UNREADABLE");
});

test("a meeting's required source field is provenance too", async (context) => {
  const { dir, id } = await seeded(context, () => "placeholder\n");
  const meeting = join(dir, "knowledge/meetings", (await (await import("node:fs/promises")).readdir(join(dir, "knowledge/meetings")))[0]!);
  const text = await readFile(meeting, "utf8");
  await writeFile(meeting, text.replace(/^sources:.*\n/m, "").replace(/^source: .*$/m, `source: ${id}`).replace(/\n---\n/, "\n---\n") + "\nPricing is zebrafish95k kiwi.\n");
  commit(dir, "meeting from the extract");
  const before = (await ask(dir, "kiwi")).json.data.candidates as unknown[];
  assert.equal(before.length, 1);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  assert.equal(((await ask(dir, "kiwi")).json.data.candidates as unknown[]).length, 0, "text of a meeting resting on the excluded input is not returned");
});

test("a partly restricted note loses its summary and aliases, and so does one that rests on a changed input", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Contract goes Friday. ^[${src}#¶3:${h.get(3)}]\n`);
  const text = await readFile(join(dir, CONCEPT), "utf8");
  const bare = text.replace(/^summary: .*\n/m, "").replace(/^aliases:\n(?:  - .*\n)+/m, "").replace(/^aliases: .*\n/m, "");
  await writeFile(join(dir, CONCEPT), bare.replace(/\n---\n/, "\nsummary: Pricing is zebrafish95k\naliases:\n  - pricingalias\n---\n"));
  commit(dir, "summary");
  assert.equal((await ask(dir, "pricingalias")).json.data.candidates.length, 1);
  assert.equal((await extract(dir, "Meeting only", "--previous", id)).code, 0);
  assert.equal((await ask(dir, "pricingalias")).json.data.candidates.length, 0, "the alias no longer ranks the note");
  const found = (await ask(dir, "Friday")).json.data.candidates as { summary: string | null }[];
  assert.equal(found[0]?.summary, null, "the summary may come from the excluded paragraph");
});

test("recover never overwrites a path the user changed after the interrupted operation, and an unreadable journal is named", async (context) => {
  const dir = await gitBrain(context);
  const tracked = "knowledge/concepts/row-level-security.md";
  const original = await readFile(join(dir, tracked), "utf8");
  await mkdir(join(dir, "_journal"), { recursive: true });
  const { createHash } = await import("node:crypto");
  const ours = `${original}\nfrom the operation\n`;
  await writeFile(join(dir, "_journal/op-aaaa0001.json"), JSON.stringify({ op: "op-aaaa0001", written: NOW, entries: [{ path: tracked, hash: createHash("sha256").update(ours).digest("hex"), new: false }] }));
  await writeFile(join(dir, tracked), `${original}\nUSER EDIT\n`);
  const refused = await brain(["recover", "--brain", dir, "--json"]);
  assert.equal(refused.json.error.code, "RECOVERY_NEEDED");
  assert.match(refused.json.error.message, /changed after the interrupted operation/);
  assert.ok((await readFile(join(dir, tracked), "utf8")).includes("USER EDIT"), "the edit is kept");
  await writeFile(join(dir, tracked), ours);
  assert.deepEqual((await brain(["recover", "--brain", dir, "--json"])).json.data.recovered, [{ op: "op-aaaa0001", action: "restored" }]);
  assert.equal(await readFile(join(dir, tracked), "utf8"), original);
  await mkdir(join(dir, "_journal"), { recursive: true });
  await writeFile(join(dir, "_journal/op-bbbb0002.json"), "{ nope");
  const corrupt = await brain(["recover", "--brain", dir, "--json"]);
  assert.equal(corrupt.json.error.code, "RECOVERY_NEEDED");
  assert.match(corrupt.json.error.message, /op-bbbb0002\.json/);
});

test("lint flags a damaged suppression record and extract refuses a page that is not the latest", async (context) => {
  const { dir, id } = await seeded(context, (src, h) => `Pricing ${src}. ^[${src}#¶2:${h.get(2)}]\n`);
  const v2 = await extract(dir, "Meeting only", "--previous", id);
  assert.equal(v2.code, 0, v2.stdout);
  const stale = await extract(dir, "Use in brain", "--previous", id);
  assert.match(stale.stdout, /NOT_LATEST/);
  await writeFile(join(dir, `_suppressions/${PAGE}.json`), "{ broken");
  const lint = await brain(["lint", "--brain", dir, "--json"]);
  assert.ok(lint.json.data.issues.some((i: { rule: string; severity: string }) => i.rule === "suppression-record" && i.severity === "error"));
});
