import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import { serializeNewFile } from "../src/lib/frontmatter.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-11-08T10:00:00Z";
const SESSION = "agent:brain-reflect/20261108T100000Z";

/** A new, empty brain (no Git) for synthetic notes. */
async function freshBrain(context: TestContext): Promise<string> {
  const parent = await mkdtemp(join(tmpdir(), "brain-reflect-"));
  context.after(() => rm(parent, { recursive: true, force: true }));
  const dir = join(parent, "brain");
  const made = await brain(["init", dir, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], parent);
  assert.equal(made.code, 0, made.stdout);
  return dir;
}

async function put(dir: string, path: string, attributes: Record<string, unknown>, body = ""): Promise<void> {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), serializeNewFile(attributes, body));
}

function person(id: string, title: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, type: "person", title, summary: `${title}.`, lifecycle: "reviewed", sources: [], created: "2026-09-01", updated: "2026-09-01", ...extra };
}

function meeting(id: string, title: string, date: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, type: "meeting", title, summary: `${title}.`, lifecycle: "draft", date, source: "src-0000aaaa", sources: ["src-0000aaaa"], created: date, updated: date, ...extra };
}

function textSource(id: string, title: string, captured: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, type: "source", kind: "note", title, source_key: `text:${id}`, content_hash: `sha256:${"c".repeat(64)}`, captured: `${captured}T09:00:00Z`, created: captured, updated: captured, ...extra };
}

async function reflect(dir: string, ...args: string[]) {
  const result = await brain(["reflect", "--candidates", ...args, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  return result.json.data;
}

async function lint(dir: string) {
  return (await brain(["lint", "--brain", dir, "--now", NOW, "--json"])).json.data.issues as Array<{ rule: string; path: string; message: string; severity: string }>;
}

async function propose(dir: string, proposals: unknown[]) {
  const file = join(dir, "..", `proposals-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ proposals }));
  return brain(["proposal", "new", "--input", file, "--brain", dir, "--now", NOW, "--json"]);
}

async function decide(dir: string, proposal: string, action: string, decidedAt: string) {
  const file = join(dir, "..", `decisions-${Math.random().toString(36).slice(2)}.json`);
  await writeFile(file, JSON.stringify({ decisions: [{ proposal, action, decided_at: decidedAt, decided_by: "chat" }] }));
  const result = await brain(["apply", "--input", file, "--brain", dir, "--now", NOW, "--json"]);
  assert.equal(result.code, 0, result.stdout);
  return result;
}

test("reflect without --candidates, with an extra argument or a bad --limit is a usage error (cli.md §5.32)", async (context) => {
  const dir = await freshBrain(context);
  const bare = await brain(["reflect", "--brain", dir, "--json"]);
  assert.equal(bare.code, 2);
  assert.deepEqual(bare.json.error, { code: "USAGE", message: "brain reflect requires --candidates; use the brain-reflect skill to tidy the brain" });
  const extra = await brain(["reflect", "--candidates", "x", "--brain", dir, "--json"]);
  assert.deepEqual(extra.json.error, { code: "USAGE", message: "Unexpected argument: x" });
  for (const args of [["--limit", "0"], ["--limit", "101"], ["--offset", "-1"], ["--offset", "a"]]) {
    assert.equal((await brain(["reflect", "--candidates", ...args, "--brain", dir, "--json"])).json.error.code, "USAGE", args.join(" "));
  }
  const empty = await reflect(dir);
  assert.deepEqual({ ...empty, read: undefined }, { as_of: NOW, window: { from: "2026-10-10", to: "2026-11-08" }, read: undefined, total: 0, held: 0, offset: 0, clusters: [] });
});

test("María López and M. Lopez are a near-duplicate pair and a near-duplicate warning, until their merge is skipped (0052, 0076 §3)", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/people/maria-lopez.md", person("per-2a2a2a2a", "María López"));
  await put(dir, "knowledge/people/m-lopez.md", person("per-3b3b3b3b", "M. Lopez", { lifecycle: "draft" }));
  // Not a pair: one name of one token against two, initials alone, another type.
  await put(dir, "knowledge/people/maria.md", person("per-4c4c4c4c", "Maria"));
  await put(dir, "knowledge/orgs/m-lopez.md", { id: "org-5d5d5d5d", type: "org", title: "M. Lopez", summary: "An org.", lifecycle: "reviewed", sources: [], created: "2026-09-01", updated: "2026-09-01" });

  const first = await reflect(dir);
  const pairs = first.clusters.filter((cluster: { signal: string }) => cluster.signal === "near_duplicate");
  assert.equal(pairs.length, 1, JSON.stringify(first.clusters));
  assert.equal(pairs[0].key, "near_duplicate:per-2a2a2a2a+per-3b3b3b3b");
  assert.deepEqual(pairs[0].names, ["María López", "M. Lopez"]);
  assert.equal(pairs[0].fingerprint, "merge:per-2a2a2a2a+per-3b3b3b3b");
  assert.deepEqual(pairs[0].notes.map((note: { id: string }) => note.id), ["per-2a2a2a2a", "per-3b3b3b3b"]);
  const warned = (await lint(dir)).filter((issue) => issue.rule === "near-duplicate");
  assert.deepEqual(warned.map(({ path, message, severity }) => ({ path, message, severity })), [{ path: "knowledge/people/m-lopez.md", message: 'may be the same person as "María López" (knowledge/people/maria-lopez.md)', severity: "warning" }]);

  const skipped = await propose(dir, [{ kind: "merge", title: "Merge M. Lopez into María López", target: "per-3b3b3b3b", merge_into: "per-2a2a2a2a", why: "The same name once initials are ignored.", source: SESSION, fingerprint: "merge:per-2a2a2a2a+per-3b3b3b3b", evidence: [] }]);
  assert.equal(skipped.code, 0, skipped.stdout);
  await decide(dir, skipped.json.data.created[0].id, "reject", "2026-11-08T10:05:00Z");

  const second = await reflect(dir);
  assert.equal(second.clusters.some((cluster: { signal: string }) => cluster.signal === "near_duplicate"), false);
  assert.equal(second.held, 1);
  assert.equal((await lint(dir)).some((issue) => issue.rule === "near-duplicate"), false);
});

test("a reviewed person older than two meetings naming her is overtaken; a meeting in her sources or before her update is not evidence", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/people/tomas-vega.md", person("per-6e6e6e6e", "Tomás Vega", { sources: ["mtg-9a9a9a9a"], updated: "2026-10-15" }));
  await put(dir, "knowledge/meetings/2026-10-20-acme-sync.md", meeting("mtg-7f7f7f7f", "Acme sync", "2026-10-20"), "Tomas Vega now leads the account.\n");
  await put(dir, "knowledge/meetings/2026-11-03-acme-review.md", meeting("mtg-8g8g8g8g", "Acme review", "2026-11-03"), "Notes.\n\nTomás Vega asked for the budget.\n");
  await put(dir, "knowledge/meetings/2026-10-25-cited.md", meeting("mtg-9a9a9a9a", "Cited", "2026-10-25"), "Tomás Vega joined.\n");
  await put(dir, "knowledge/meetings/2026-10-12-before.md", meeting("mtg-9b9b9b9b", "Before", "2026-10-12"), "Tomás Vega started.\n");
  const data = await reflect(dir);
  const cluster = data.clusters.find((entry: { key: string }) => entry.key === "overtaken:per-6e6e6e6e");
  assert.ok(cluster !== undefined, JSON.stringify(data.clusters));
  assert.equal(cluster.signal, "overtaken");
  assert.deepEqual(cluster.evidence.map((input: { id: string }) => input.id), ["mtg-8g8g8g8g", "mtg-7f7f7f7f"]);
  assert.deepEqual(cluster.evidence[0].lines, [{ line: 16, text: "Tomás Vega asked for the budget." }]);
  assert.deepEqual(cluster.held, []);
  assert.equal(cluster.notes[0].updated, "2026-10-15");
});

test("a term in three window inputs with no note is a recurring term; in two it isn't, nor once a note carries it", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "sources/text/2026-10-20-one.md", textSource("src-1a1a1a1a", "Call one", "2026-10-20"), "We reviewed pricing tiers today.\nThe onboarding checklist slipped.\n");
  await put(dir, "sources/text/2026-10-25-two.md", textSource("src-2b2b2b2b", "Call two", "2026-10-25"), "Pricing tiers need work.\nAnother onboarding checklist pass.\n");
  await put(dir, "sources/text/2026-11-01-three.md", textSource("src-3c3c3c3c", "Call three", "2026-11-01"), "Draft pricing tiers for Q1.\n");
  // Outside the window: not counted.
  await put(dir, "sources/text/2026-09-01-old.md", textSource("src-4d4d4d4d", "Old call", "2026-09-01"), "Onboarding checklist again.\n");
  const data = await reflect(dir);
  const terms = data.clusters.filter((cluster: { signal: string }) => cluster.signal === "recurring_term");
  assert.deepEqual(terms.map((cluster: { key: string }) => cluster.key), ["recurring_term:pricing-tiers"]);
  assert.equal(terms[0].term, "pricing tiers");
  assert.equal(terms[0].fingerprint, "theme:pricing-tiers");
  assert.deepEqual(terms[0].notes, []);
  assert.deepEqual(terms[0].evidence.map((input: { id: string }) => input.id), ["src-3c3c3c3c", "src-2b2b2b2b", "src-1a1a1a1a"]);
  assert.deepEqual(terms[0].evidence[2].lines, [{ line: 12, text: "We reviewed pricing tiers today." }]);
  assert.equal(data.read.inputs, 3);

  await put(dir, "knowledge/references/pricing.md", { id: "ref-5e5e5e5e", type: "reference", title: "Pricing tiers", summary: "s", lifecycle: "draft", origin: "learned", sources: [], created: "2026-11-02", updated: "2026-11-02" });
  assert.equal((await reflect(dir)).clusters.some((cluster: { signal: string }) => cluster.signal === "recurring_term"), false);
});

test("note-size checks a learned Document over 10 KB, not a source or a whole Document (0076 §7)", async (context) => {
  const dir = await freshBrain(context);
  const big = `${"A line of the brain's own words about the topic.\n".repeat(250)}`;
  assert.ok(Buffer.byteLength(big) > 12_000);
  await put(dir, "knowledge/references/learned.md", { id: "ref-6f6f6f6f", type: "reference", title: "Learned", summary: "s", lifecycle: "draft", origin: "learned", area: "area-0000aaaa", sources: [], created: "2026-11-01", updated: "2026-11-01" }, big);
  await put(dir, "knowledge/references/whole.md", { id: "ref-7g7g7g7g", type: "reference", title: "Whole", summary: "s", lifecycle: "draft", origin: "whole", sources: [], created: "2026-11-01", updated: "2026-11-01" }, big);
  await put(dir, "sources/text/2026-11-01-big.md", textSource("src-8h8h8h8h", "Big", "2026-11-01"), big);
  const sized = (await lint(dir)).filter((issue) => issue.rule === "note-size");
  assert.deepEqual(sized.map(({ path, severity }) => ({ path, severity })), [{ path: "knowledge/references/learned.md", severity: "warning" }]);
});

test("a reviewed learned Document nothing references, with no project or area, is an orphan", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/references/alone.md", { id: "ref-9j9j9j9j", type: "reference", title: "Alone", summary: "s", lifecycle: "reviewed", origin: "learned", sources: [], created: "2026-11-01", updated: "2026-11-01" }, "Text.\n");
  await put(dir, "knowledge/references/linked.md", { id: "ref-9k9k9k9k", type: "reference", title: "Linked", summary: "s", lifecycle: "reviewed", origin: "learned", sources: [], created: "2026-11-01", updated: "2026-11-01" }, "Text.\n");
  await put(dir, "knowledge/people/ana.md", person("per-9m9m9m9m", "Ana Ruiz", { area: "area-0000aaaa" }), "See [Linked](../references/linked.md).\n");
  const orphans = (await lint(dir)).filter((issue) => issue.rule === "orphan");
  assert.deepEqual(orphans.map(({ path, message }) => ({ path, message })), [{ path: "knowledge/references/alone.md", message: "nothing links to it and it has no project or area" }]);
});

test("a skipped contradiction stays held until an input not in its evidence, created on or after the skip, names its note (schema §11.4)", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/people/ana-ruiz.md", person("per-2n2n2n2n", "Ana Ruiz", { facts: { role: "CTO" }, timeline: [{ field: "role", value: "CTO", from: "2026-01-01", learned: "2026-01-01", source: "mtg-0000aaaa", assessment: "accepted" }] }));
  await put(dir, "knowledge/meetings/2026-10-20-one.md", meeting("mtg-3p3p3p3p", "Board one", "2026-10-20"), "Ana Ruiz is now CEO.\n");
  const before = (await reflect(dir)).clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-2n2n2n2n");
  assert.deepEqual(before.held, []);

  const fingerprint = "contradiction:per-2n2n2n2n:role";
  const made = await propose(dir, [{ kind: "contradiction", title: "Ana Ruiz: role", target: "per-2n2n2n2n", field: "role", after: "CEO", why: "Board one, 20 Oct: Ana Ruiz is now CEO.", source: "mtg-3p3p3p3p", fingerprint, evidence: ["mtg-3p3p3p3p"] }]);
  assert.equal(made.code, 0, made.stdout);
  const id = made.json.data.created[0].id;
  const waiting = (await reflect(dir)).clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-2n2n2n2n");
  assert.deepEqual(waiting.held, [{ fingerprint, state: "waiting", proposal: id }]);

  await decide(dir, id, "reject", "2026-11-01T12:00:00Z");
  const held = [{ fingerprint, state: "skipped", proposal: id }];
  assert.deepEqual((await reflect(dir)).clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-2n2n2n2n").held, held);
  // Created before the skip: still held.
  await put(dir, "knowledge/meetings/2026-10-28-two.md", meeting("mtg-4q4q4q4q", "Board two", "2026-10-28"), "Ana Ruiz presented.\n");
  assert.deepEqual((await reflect(dir)).clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-2n2n2n2n").held, held);
  // Created on the skip's date, not in its evidence, naming her: released.
  await put(dir, "knowledge/meetings/2026-11-01-three.md", meeting("mtg-5r5r5r5r", "Board three", "2026-11-01"), "Ana Ruiz signed.\n");
  assert.deepEqual((await reflect(dir)).clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-2n2n2n2n").held, []);
});

test("a restricted note is neither a target nor evidence (0076 §6)", async (context) => {
  const dir = await fixtureCopy(context);
  const now = "2026-12-10T09:00:00Z";
  const run = async () => (await brain(["reflect", "--candidates", "--limit", "100", "--brain", dir, "--now", now, "--json"])).json.data;
  const decision = await excludableDecision(dir, "mtg-8c4n2p7w", "prj-9x4t1b7e", "unmapped");
  await put(dir, "knowledge/decisions/2026-12-04-pricing-call.md", { id: "dec-6s6s6s6s", type: "decision", title: "Pricing call", summary: "s", lifecycle: "draft", date: "2026-12-04", assessment: "accepted", sources: ["mtg-8c4n2p7w"], created: "2026-12-04", updated: "2026-12-04" }, "Another note.\n");
  await put(dir, "knowledge/people/pedro-sanz.md", person("per-7t7t7t7t", "Pedro Sanz", { sources: ["mtg-8c4n2p7w"], updated: "2026-11-20" }));
  await put(dir, "knowledge/meetings/2026-12-08-pricing.md", meeting("mtg-8v8v8v8v", "Pricing follow-up", "2026-12-08", { source: "src-ex1a3b4c", sources: ["src-ex1a3b4c"] }), "Pedro Sanz joined the pricing call.\n");
  const keyOf = (cluster: { key: string }) => cluster.key;
  const before = await run();
  assert.ok(before.clusters.map(keyOf).includes(`near_duplicate:${[decision.note.id, "dec-6s6s6s6s"].sort().join("+")}`), JSON.stringify(before.clusters.map(keyOf)));
  assert.ok(before.clusters.find((cluster: { key: string }) => cluster.key === "overtaken:per-7t7t7t7t")?.evidence.some((input: { id: string }) => input.id === "mtg-8v8v8v8v"));

  await decision.exclude();
  const after = await run();
  assert.equal(after.clusters.some((cluster: { notes: Array<{ id: string }> }) => cluster.notes.some((note) => note.id === decision.note.id)), false, JSON.stringify(after.clusters.map(keyOf)));
  assert.equal(after.clusters.some((cluster: { evidence?: Array<{ id: string }> }) => (cluster.evidence ?? []).some((input) => input.id === "mtg-8v8v8v8v")), false);
});

test("shared ground pairs two reviewed notes with two references in common; paging ranks by signal", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/decisions/2026-11-03-launch.md", { id: "dec-2w2w2w2w", type: "decision", title: "Launch in February", summary: "s", lifecycle: "reviewed", date: "2026-11-03", assessment: "accepted", people: ["per-3x3x3x3x"], org: "org-4y4y4y4y", sources: [], created: "2026-11-03", updated: "2026-11-04" });
  await put(dir, "knowledge/people/eva.md", person("per-5z5z5z5z", "Eva Marsh", { org: "org-4y4y4y4y" }), "Works with [Bo](bo.md).\n");
  await put(dir, "knowledge/people/bo.md", person("per-3x3x3x3x", "Bo Lind"));
  await put(dir, "knowledge/orgs/acme.md", { id: "org-4y4y4y4y", type: "org", title: "Acme", summary: "s", lifecycle: "reviewed", sources: [], created: "2026-09-01", updated: "2026-09-01" });
  await put(dir, "knowledge/people/eve.md", person("per-6a6a6a6a", "E. Marsh", { lifecycle: "draft" }));
  const data = await reflect(dir);
  assert.deepEqual(data.clusters.map((cluster: { key: string; rank: number }) => [cluster.rank, cluster.key]), [
    [1, "shared_ground:dec-2w2w2w2w+per-5z5z5z5z"],
    [2, "near_duplicate:per-5z5z5z5z+per-6a6a6a6a"],
  ]);
  assert.deepEqual(data.clusters[0].shared, ["org-4y4y4y4y", "per-3x3x3x3x"]);
  const page = await reflect(dir, "--limit", "1", "--offset", "1");
  assert.deepEqual([page.total, page.offset, page.clusters.map((cluster: { rank: number }) => cluster.rank)], [2, 1, [2]]);
});

test("proposal new checks a fingerprint against its item and dedupes on it; lint checks stored ones (cli.md §5.6, §5.10)", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/people/maria-lopez.md", person("per-2a2a2a2a", "María López"));
  await put(dir, "knowledge/people/m-lopez.md", person("per-3b3b3b3b", "M. Lopez", { lifecycle: "draft" }));
  const merge = { kind: "merge", title: "Merge M. Lopez into María López", target: "per-3b3b3b3b", merge_into: "per-2a2a2a2a", why: "Same name.", source: SESSION, fingerprint: "merge:per-2a2a2a2a+per-3b3b3b3b", evidence: [] };
  const unsorted = await propose(dir, [{ ...merge, fingerprint: "merge:per-3b3b3b3b+per-2a2a2a2a" }]);
  assert.equal(unsorted.json.error.code, "INPUT_INVALID", unsorted.stdout);
  assert.equal((await propose(dir, [{ ...merge, fingerprint: "stale:per-3b3b3b3b:role" }])).json.error.code, "INPUT_INVALID");
  assert.equal((await propose(dir, [{ ...merge, evidence: undefined }])).json.error.code, "INPUT_INVALID");
  assert.equal((await propose(dir, [{ ...merge, finding: "project_stalled:prj-0000aaaa" }])).json.error.code, "INPUT_INVALID");
  assert.equal((await propose(dir, [{ ...merge, evidence: ["mtg-0000bbbb"] }])).json.error.code, "UNKNOWN_ID");
  const made = await propose(dir, [merge]);
  assert.equal(made.code, 0, made.stdout);
  const again = await propose(dir, [{ ...merge, title: "Merge again" }]);
  assert.deepEqual(again.json.data.skipped, [{ input_index: 0, reason: "DUPLICATE_PENDING", existing: made.json.data.created[0].id }]);
  assert.equal((await lint(dir)).some((issue) => issue.rule === "proposal-fingerprint"), false);

  // A stored fingerprint that no longer matches its proposal is an error.
  const path = made.json.data.created[0].path;
  const { readFile } = await import("node:fs/promises");
  await put(dir, "knowledge/people/maria.md", person("per-4c4c4c4c", "Maria"));
  await writeFile(join(dir, path), (await readFile(join(dir, path), "utf8")).replace("merge:per-2a2a2a2a+per-3b3b3b3b", "merge:per-2a2a2a2a+per-4c4c4c4c"));
  assert.ok((await lint(dir)).some((issue) => issue.rule === "proposal-fingerprint" && issue.severity === "error"));
});

test("a theme's review_notes is its own row and lists one learned Document; its skip is a new_item holding one", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "sources/text/2026-11-01-three.md", textSource("src-3c3c3c3c", "Call three", "2026-11-01"), "Draft pricing tiers for Q1.\n");
  await put(dir, "knowledge/references/pricing-tiers.md", { id: "ref-5e5e5e5e", type: "reference", title: "Pricing tiers", summary: "s", lifecycle: "draft", origin: "learned", sources: ["src-3c3c3c3c"], created: "2026-11-08", updated: "2026-11-08" }, "Text.\n");
  await put(dir, "knowledge/references/whole.md", { id: "ref-7g7g7g7g", type: "reference", title: "Whole", summary: "s", lifecycle: "draft", origin: "whole", sources: ["src-3c3c3c3c"], created: "2026-11-08", updated: "2026-11-08" }, "Text.\n");
  const theme = { kind: "review_notes", source: "src-3c3c3c3c", notes: ["ref-5e5e5e5e"], fingerprint: "theme:pricing-tiers", evidence: ["src-3c3c3c3c"] };
  assert.equal((await propose(dir, [{ ...theme, notes: ["ref-7g7g7g7g"] }])).json.error.code, "INPUT_INVALID");
  const made = await propose(dir, [theme]);
  assert.equal(made.code, 0, made.stdout);
  assert.equal(made.json.data.created.length, 1);
  const skip = { kind: "new_item", title: "Pricing tiers", why: "In 3 inputs.", source: "src-3c3c3c3c", fingerprint: "theme:onboarding-checklist", evidence: ["src-3c3c3c3c"], note: { type: "reference", title: "Onboarding checklist", frontmatter: { summary: "s", origin: "learned", sources: ["src-3c3c3c3c"] }, body: "One line.\n" } };
  assert.equal((await propose(dir, [{ ...skip, note: { ...skip.note, type: "decision", frontmatter: { summary: "s", date: "2026-11-08", assessment: "accepted", sources: ["src-3c3c3c3c"] } } }])).json.error.code, "INPUT_INVALID");
  assert.equal((await propose(dir, [skip])).code, 0);
});

test("a reflection answer decided in chat never becomes a Review row (cli.md §5.14.4)", async (context) => {
  const dir = await freshBrain(context);
  await put(dir, "knowledge/people/maria-lopez.md", person("per-2a2a2a2a", "María López"));
  await put(dir, "knowledge/people/m-lopez.md", person("per-3b3b3b3b", "M. Lopez", { lifecycle: "draft" }));
  const made = await propose(dir, [{ kind: "merge", title: "Merge M. Lopez into María López", target: "per-3b3b3b3b", merge_into: "per-2a2a2a2a", why: "Same name.", source: SESSION, fingerprint: "merge:per-2a2a2a2a+per-3b3b3b3b", evidence: [] }]);
  const id = made.json.data.created[0].id;
  await decide(dir, id, "reject", "2026-11-08T10:05:00Z");
  const render = await brain(["sync", "render", "--ids", id, "--brain", dir, "--now", NOW, "--json"]);
  assert.deepEqual(render.json.data.skipped, [{ id, reason: "DECIDED_IN_CHAT" }], render.stdout);
});
