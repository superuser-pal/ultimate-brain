import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyDrift, extractBody, passageHash, pageFingerprint, paragraphs, parseSummary, planExtract } from "../src/lib/selection.ts";

const TRANSCRIPT = [
  "We start with the launch plan and agree the launch moves to February.",
  "Pricing is 95k, keep it between us, and also the offsite is booked.",
  "Small talk about the weather and the train.",
  "Maria will send the draft contract on Friday.",
].join("\n\n");

const SUMMARY = `## [s1] Launch
Selection: Use in brain
- [s1.i1] Launch moves to February “the launch moves to February”
- [s1.i2] Maria sends the contract “send the draft contract on Friday”

## [s2] Pricing
Selection: Meeting only
- [s2.i1] Pricing figure “Pricing is 95k”
- [s2.i2] Offsite booked “the offsite is booked”
`;

test("parses subjects, tokens and items, tolerating bullets and straight quotes", () => {
  const summary = parseSummary(SUMMARY.replace(/“|”/g, '"'));
  assert.deepEqual(summary.subjects.map((s) => [s.id, s.selection]), [["s1", "use"], ["s2", "meeting only"]]);
  assert.equal(summary.items.length, 4);
  assert.deepEqual(summary.items[0]?.anchors, ["the launch moves to February"]);
  assert.equal(summary.problems.length, 0);
});

test("an unreadable subject token is SELECTION_UNREADABLE and blocks the input", () => {
  const summary = parseSummary("## [s1] A\nSelection: Maybe\n- [s1.i1] x “the launch moves to February”\n");
  assert.equal(summary.problems[0]?.code, "SELECTION_UNREADABLE");
  assert.equal(planExtract(summary, TRANSCRIPT).ok, false);
});

test("a paragraph shared with excluded content is not copied and blocks the including item", () => {
  const shared = SUMMARY.replace("“the launch moves to February”", "“also the offsite is booked”");
  const plan = planExtract(parseSummary(shared), TRANSCRIPT);
  assert.equal(plan.ok, false);
  const blocked = plan.problems.find((p) => p.reason === "shares a paragraph with excluded content");
  assert.equal(blocked?.id, "s1.i1");
  assert.deepEqual(blocked?.with, ["s2.i1", "s2.i2"]);
  assert.ok(plan.copied.every((entry) => !entry.text.includes("95k")), "the excluded words never reach the extract");
});

test("separate paragraphs: only included subjects are copied, the transcript is never copied whole", () => {
  const summary = parseSummary(SUMMARY.replace("the launch moves to February”", "launch moves to February”").replace("“Pricing is 95k”", "“keep it between us”"));
  const plan = planExtract(summary, TRANSCRIPT.replace("and also the offsite is booked", "and nothing else"));
  assert.equal(plan.ok, false, "s2.i2 anchor is gone so it is unmappable");
  const fixed = parseSummary(SUMMARY.replace("“Pricing is 95k”", "“keep it between us”").replace("“the offsite is booked”", "“keep it between us”"));
  const clean = planExtract(fixed, [TRANSCRIPT.split("\n\n")[0], "Pricing is 95k, keep it between us.", TRANSCRIPT.split("\n\n")[3]].join("\n\n"));
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.copied.map((entry) => entry.n), [1, 3]);
  assert.ok(!extractBody(clean).includes("95k"));
  assert.equal(clean.uncovered, 0);
});

test("an explicit Use in brain under a Meeting only subject is copied when no excluded item cites its paragraph", () => {
  const summary = parseSummary("## [s2] Pricing\nSelection: Meeting only\n- [s2.i1] Use in brain: Contract “send the draft contract on Friday”\n");
  const plan = planExtract(summary, TRANSCRIPT);
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.copied.map((entry) => entry.n), [4]);
});

test("missing, ambiguous, absent-id and cyclic references make the item unmappable", () => {
  const text = "A repeated line.\n\nA repeated line.\n\nUnique line here.";
  const summary = parseSummary("## [s1] A\n- [s1.i1] a “A repeated line”\n- [s1.i2] b “not in transcript”\n- [s1.i3] c “Unique line here” (depends on [s9])\n- [s1.i4] d “Unique line here” (depends on [s1.i5])\n- [s1.i5] e “Unique line here” (depends on [s1.i4])\n");
  const reasons = planExtract(summary, text).problems.map((p) => `${p.id}:${p.reason.split(" ").slice(0, 3).join(" ")}`);
  assert.deepEqual(reasons, ["s1.i1:anchor in 2", "s1.i2:anchor not in", "s1.i3:depends on unknown", "s1.i4:depends on cycle", "s1.i5:depends on cycle"]);
});

test("an item that depends on excluded context is not imported unless it has an explicit use", () => {
  const base = "## [s1] Context\nSelection: Meeting only\n- [s1.i1] c “We start with the launch plan”\n\n## [s2] Ask\n- [s2.i1] a “Maria will send the draft contract” (depends on [s1])\n";
  const dropped = planExtract(parseSummary(base), TRANSCRIPT);
  assert.equal(dropped.problems[0]?.code, "DEPENDS_ON_EXCLUDED");
  assert.equal(dropped.copied.length, 0);
  const kept = planExtract(parseSummary(base.replace("[s2.i1] a", "[s2.i1] Use in brain: a")), TRANSCRIPT);
  assert.deepEqual(kept.copied.map((entry) => entry.n), [4]);
  assert.equal(kept.mappings.find((m) => m.item === "s2.i1")?.context_excluded, true);
});

test("paragraphs are numbered, identical paragraphs are two passages, and re-reading is stable", () => {
  const a = paragraphs("One.\n\nOne.\n\nTwo.");
  assert.deepEqual(a.paragraphs.map((p) => p.n), [1, 2, 3]);
  assert.equal(a.paragraphs[0]?.hash, a.paragraphs[1]?.hash);
  assert.equal(paragraphs("One.\n\nOne.\n\nTwo.").transcript_hash, a.transcript_hash);
});

test("drift: tokens, text-only, stale and none", () => {
  const hash = paragraphs(TRANSCRIPT).transcript_hash;
  const before = parseSummary(SUMMARY);
  assert.deepEqual(classifyDrift(before, parseSummary(SUMMARY), hash, hash), { kind: "none" });
  const tokens = classifyDrift(before, parseSummary(SUMMARY.replace("Selection: Meeting only", "Selection: Use in brain")), hash, hash);
  assert.equal(tokens.kind, "tokens");
  assert.deepEqual(tokens.kind === "tokens" && tokens.changes.map((c) => c.id), ["s2", "s2.i1", "s2.i2"].slice(0, 1));
  assert.equal(classifyDrift(before, parseSummary(SUMMARY.replace("Pricing figure", "The price")), hash, hash).kind, "text");
  assert.equal(classifyDrift(before, parseSummary(SUMMARY.replace("“Pricing is 95k”", "“keep it between us”")), hash, hash).kind, "stale");
  assert.equal(classifyDrift(before, before, hash, "other").kind, "stale");
  assert.notEqual(pageFingerprint(before, hash), pageFingerprint(parseSummary(SUMMARY.replace("Pricing figure", "The price")), hash));
});

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brain, fixtureCopy } from "./helpers.ts";

const EXTRACT = {
  extract: true, extract_of: "11111111-2222-4333-8444-555555555555", extract_version: 1,
  transcript_hash: "a".repeat(64), page_fingerprint: "b".repeat(64),
  selection: [{ id: "s1", effective: "use", explicit: null }, { id: "s1.i1", effective: "use", explicit: null }],
  passages: [{ n: 1, hash: "0123abcd", items: ["s1.i1"] }],
};

let counter = 0;
async function create(dir: string, frontmatter: Record<string, unknown>) {
  counter += 1;
  const text = `The launch moves to February ${counter}.`;
  const passages = Array.isArray(frontmatter.passages) ? [{ n: 1, hash: passageHash(text), items: ["s1.i1"] }] : undefined;
  const file = join(dir, "..", "extract.json");
  await writeFile(file, JSON.stringify({ notes: [{ type: "source", title: "Launch sync (extract)", file_date: "2026-12-10", frontmatter: { source_key: "notion:11111111-2222-4333-8444-555555555555", ...frontmatter, ...(passages === undefined ? {} : { passages }) }, body: `<!-- passage ¶1 item s1.i1 -->\n${text}\n` }] }));
  return brain(["note", "new", "--input", file, "--brain", dir, "--now", "2026-12-10T09:00:00Z", "--json"]);
}

test("an extract source is written with all its fields, in order, and an incomplete one is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await create(dir, EXTRACT);
  assert.equal(run.code, 0, run.stdout);
  const path = run.json.data.created[0].path as string;
  const file = await readFile(join(dir, path), "utf8");
  assert.match(file, /source_key: notion:[^\n]+\n(?:[a-z_]+: [^\n]+\n)*?extract: true\nextract_of: [^\n]+\nextract_version: 1\ntranscript_hash:/);
  const { selection, ...partial } = EXTRACT;
  assert.ok(selection.length > 0);
  const bad = await create(dir, partial);
  assert.notEqual(bad.code, 0, "an extract without its selection is invalid");
  const plain = await create(dir, { extract_of: EXTRACT.extract_of });
  assert.notEqual(plain.code, 0, "extract fields come together");
});

import { readdir } from "node:fs/promises";

test("lint checks an extract's passages and the passage references that cite it", async (context) => {
  const dir = await fixtureCopy(context);
  const run = await create(dir, EXTRACT);
  const path = run.json.data.created[0].path as string;
  const id = run.json.data.created[0].id as string;
  const real = /\n\s+hash: ([0-9a-f]{8})\n/.exec(await readFile(join(dir, path), "utf8"))?.[1] ?? "";
  const lintRules = async () => {
    const out = await brain(["lint", "--brain", dir, "--json"]);
    return (out.json.data.issues as { rule: string; message: string }[]).filter((issue) => issue.rule === "extract-passages" || issue.rule === "passage-ref");
  };
  assert.deepEqual(await lintRules(), []);
  const concept = join(dir, "knowledge/concepts", (await readdir(join(dir, "knowledge/concepts")))[0] as string);
  const original = await readFile(concept, "utf8");
  await writeFile(concept, original.replace(/\n$/, "") + `\n\nA statement. ^[${id}#¶1:${real}]\n`);
  assert.deepEqual(await lintRules(), []);
  await writeFile(concept, original.replace(/\n$/, "") + `\n\nA statement. ^[${id}#¶1:00000000]\n`);
  assert.match((await lintRules())[0]?.message ?? "", /has the hash/);
  await writeFile(concept, original.replace(/\n$/, "") + `\n\nA statement. ^[${id}#¶9:00000000]\n`);
  assert.match((await lintRules())[0]?.message ?? "", /not a passage/);
  await writeFile(concept, original);
  const file = await readFile(join(dir, path), "utf8");
  await writeFile(join(dir, path), file.replace("hash: 0123abcd", "hash: x").replace(/passages:[\s\S]*?\n(?=\w+:|---)/, "passages:\n  - n: 2\n    hash: 0123abcd\n    items:\n      - s1.i1\n"));
  assert.ok((await lintRules()).some((issue) => issue.rule === "extract-passages"));
});

test("source extract-plan reports the copied paragraphs, blocks an unmappable input and compares with a previous extract", async (context) => {
  const dir = await fixtureCopy(context);
  const summary = join(dir, "..", "summary.md");
  const transcript = join(dir, "..", "transcript.md");
  await writeFile(transcript, TRANSCRIPT.replace("and also the offsite is booked", "and nothing else"));
  const text = `## [s1] Launch\nSelection: Use in brain\n- [s1.i1] Launch moves “the launch moves to February”\n\n## [s2] Pricing\nSelection: Meeting only\n- [s2.i1] Price “keep it between us”\n`;
  await writeFile(summary, text);
  const run = await brain(["source", "extract-plan", "--summary", summary, "--transcript", transcript, "--brain", dir, "--json"]);
  assert.equal(run.code, 0, run.stdout);
  assert.equal(run.json.data.ok, true);
  assert.deepEqual(run.json.data.passages.map((p: { n: number }) => p.n), [1]);
  assert.ok(!run.json.data.body.includes("95k"));
  await writeFile(summary, text.replace("“keep it between us”", "“not in the transcript”"));
  const blocked = await brain(["source", "extract-plan", "--summary", summary, "--transcript", transcript, "--brain", dir, "--json"]);
  assert.equal(blocked.json.data.ok, false);
  assert.equal(blocked.json.data.body, null);
  const made = await create(dir, { ...EXTRACT, transcript_hash: run.json.data.transcript_hash, page_fingerprint: run.json.data.page_fingerprint, selection: run.json.data.selection });
  assert.equal(made.code, 0, made.stdout);
  await writeFile(summary, text);
  const same = await brain(["source", "extract-plan", "--summary", summary, "--transcript", transcript, "--previous", made.json.data.created[0].id, "--brain", dir, "--json"]);
  assert.equal(same.json.data.previous.state, "unchanged");
  await writeFile(summary, text.replace("Selection: Meeting only", "Selection: Use in brain"));
  const moved = await brain(["source", "extract-plan", "--summary", summary, "--transcript", transcript, "--previous", made.json.data.created[0].id, "--brain", dir, "--json"]);
  assert.equal(moved.json.data.previous.state, "tokens");
  assert.deepEqual(moved.json.data.previous.selection_changes.map((c: { id: string }) => c.id).sort(), ["s2", "s2.i1"]);
});

test("a list line without an id is listed as unnumbered and never imported", () => {
  const summary = parseSummary("## [s1] Launch\n- [s1.i1] Launch moves “the launch moves to February”\n- Maria to send the contract by Friday\n");
  assert.deepEqual(summary.unnumbered, [{ subject: "s1", text: "Maria to send the contract by Friday" }]);
  const plan = planExtract(summary, TRANSCRIPT);
  assert.equal(plan.unnumbered.length, 1);
  assert.equal(plan.ok, false, "an unnumbered line blocks the input");
  assert.equal(plan.problems.find((p) => p.code === "UNNUMBERED_LINE")?.id, null);
});

test("an unnumbered excluded line cannot leak through an included item sharing its paragraph", () => {
  const summary = parseSummary("## [s1] Launch\n- [s1.i1] Launch moves “the launch moves to February”\n- Keep the pricing between us (Meeting only)\n");
  const plan = planExtract(summary, "Pricing is 95k, keep it between us, and the launch moves to February.");
  assert.equal(plan.ok, false, "the input is blocked, so the command returns no body");
  assert.ok(plan.problems.some((p) => p.code === "UNNUMBERED_LINE"));
});
