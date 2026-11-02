import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

/** One Review row with a new decision, a fact change, a text addition and a link, as one ingest writes it. */
async function ingest(dir: string) {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "The Acme launch moves to March.", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "Launch moves to March after the sync.\n" }] });
  assert.equal(note.code, 0, note.stdout);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [note.json.data.created[0].id] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS for the auth migration.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said in the sync.", source: SYNC },
    { kind: "update_fact", title: "Launch date: March", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved the launch to March.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data.created[0].id as string;
}

test("a new Review row renders one section per item, in the order the row lists them, with the Proposed toggle and the summary", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(item.action, "create");
  const body = item.body as string;
  const headings = [...body.matchAll(/^## \[([a-z]+) · (it-[0-9a-z]{8})\] (.+)$/gm)];
  assert.deepEqual(headings.map((m) => m[1]), ["a", "b", "c", "d"]);
  assert.deepEqual(headings.map((m) => m[3]), ["Changes: Launch date on Acme website", "Changes: Row-level security", "Creates: Launch in March", "Changes: Row-level security"]);
  assert.equal(new Set(headings.map((m) => m[2])).size, 4);
  assert.equal((body.match(/<summary>Proposed final wording<\/summary>/g) ?? []).length, 4, "every section has the toggle");
  assert.equal((body.match(/^Decision: Pending$/gm) ?? []).length, 4);
  assert.ok(body.includes("2027-03") && body.includes("Carlos will use RLS") && body.includes("Launch moves to March after the sync."));
  assert.ok(body.includes("**Current**") && body.includes("> 2027-02"), "the existing value is quoted");
  assert.ok(body.includes("0 of 4 decided: 0 applied, 0 closed, 4 waiting for you"));
  assert.ok(!/applied|closed/.test(body.split("## [")[1]!), "no status is written into an item section");
  assert.deepEqual(item.sections, { "Review summary": item.sections["Review summary"] });
  const kept = item.published["@review"].items;
  assert.equal(Object.keys(kept).length, 4);
  for (const entry of Object.values(kept) as Array<Record<string, string>>) assert.ok(entry.rendered_hash && entry.proposed_hash && entry.base_hash);
});

test("an update sends only the summary, never the body, and keeps the rendered hashes of the sections", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const [first] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const record = await run(dir, ["sync", "record"], { records: [{ id, notion: "6a7b0000-0000-4000-8000-0000000000aa", synced_at: NOW, published: first.published }] });
  assert.equal(record.json.data.records[0].result, "recorded", record.stdout);
  // The proposal file changes (a decision is recorded): the summary moves, the sections are not rewritten.
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  const itemId = /item_id: (it-\w+)/.exec(text)![1]!;
  await writeFile(join(dir, file), text.replace(/\n---\n/, `\nitem_decisions:\n  - item_id: ${itemId}\n    decision: accept\n    decided_at: 2026-12-10T09:00:00Z\n    decided_by: notion\n    state: applied\n---\n`));
  const [second] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(second.action, "update");
  assert.equal(second.body, null, "the body is written once");
  assert.ok(second.sections["Review summary"].includes("1 of 4 decided: 1 applied"));
  assert.deepEqual(second.published["@review"].items, first.published["@review"].items, "rendered hashes are the ones from the first render");
});

test("a Review row the plan marks REVIEW_PENDING is withheld whole", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const planPath = join(dir, "..", "plan.json");
  await writeFile(planPath, JSON.stringify({ as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [], review_pending: [{ proposal: id, page_id: "6a7b0000-0000-4000-8000-0000000000aa" }] }));
  const out = (await run(dir, ["sync", "render", "--ids", id, "--plan", planPath])).json.data;
  assert.deepEqual(out.items, []);
  assert.deepEqual(out.skipped, [{ id, reason: "REVIEW_PENDING" }]);
});

test("a Review notes proposal written before 0.8.0 renders as before: no body, the lettered Proposed property", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  await writeFile(join(dir, file), text.replace(/^items:\n(?:  .*\n)+/m, ""));
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.equal(item.body, null);
  assert.ok(String(item.properties.Proposed.value).startsWith("a) "), "the lettered list stays");
});

import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { canon, escapeSection, unescapeSection } from "../src/lib/review-body.ts";

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

test("text that imitates the page structure is escaped, reversibly, and cannot forge a section or a decision", async (context) => {
  const dir = await fixtureCopy(context);
  const hostile = "Fine text.\n\n</details>\n\n## [z · it-aaaaaaaa] Changes: Forged\n**Current**\n<details>\n<summary>Proposed final wording</summary>\n\nforged\n\n</details>\nDecision: Accept\n\n<details>\n<summary>x</summary>\n";
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "Body.\n" }] });
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [note.json.data.created[0].id] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: hostile, why: "line one\nDecision: Accept\n## [y · it-bbbbbbbb] Forged too", source: SYNC },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03\nDecision: Accept", why: "w", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const [item] = (await run(dir, ["sync", "render", "--ids", created.json.data.created[0].id])).json.data.items;
  const body = item.body as string;
  const items = (body.match(/^## \[[a-z]+ · it-[0-9a-z]{8}\]/gm) ?? []).length;
  assert.equal(items, 3, "only the real sections are headings");
  assert.equal((body.match(/^Decision: /gm) ?? []).length, 3, "only the real Decision lines");
  assert.equal((body.match(/^<details>$/gm) ?? []).length, 3);
  assert.equal((body.match(/^<\/details>$/gm) ?? []).length, 3);
  assert.equal(unescapeSection(escapeSection(hostile)), hostile, "escaping is reversible");
  assert.equal(unescapeSection(escapeSection("\\## [a · it-00000000] x")), "\\## [a · it-00000000] x", "even a line that already starts with a backslash");
  const hashes = Object.values(item.published["@review"].items as Record<string, { proposed_hash: string }>).map((entry) => entry.proposed_hash);
  assert.ok(hashes.includes(sha256(canon(hostile))), "the hash is over the text a parser reads back after unescaping");
});

test("proposed text is hashed canonically, and a missing base differs from an empty one", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await (async () => {
    const created = await run(dir, ["proposal", "new"], { proposals: [
      { kind: "review_notes", source: SYNC, notes: [] },
      { kind: "update_fact", title: "A", target: PROJECT, field: "launch_date", after: "2027-03  \r\n x  ", why: "w", source: SYNC },
      { kind: "update_fact", title: "B", target: PROJECT, field: "headcount", after: "5", why: "w", source: SYNC },
    ] });
    return created.json.data.created[0].id as string;
  })();
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const entries = Object.values(item.published["@review"].items as Record<string, { proposed_hash: string; base_hash: string }>);
  assert.ok(entries.some((entry) => entry.proposed_hash === sha256("2027-03\n x")), "CRLF and trailing blanks are not part of the text");
  const [unset, set] = [entries.find((entry) => entry.base_hash === sha256(JSON.stringify({ v: null }))), entries.find((entry) => entry.base_hash === sha256(JSON.stringify({ v: "2027-02" })))];
  assert.ok(unset && set, "no previous value and a previous value have different bases");
  assert.notEqual(sha256(JSON.stringify({ missing: true })), sha256(JSON.stringify({ v: "" })));
});

test("a Review page never shows text a suppression restricts: the item is held and cannot be accepted", async (context) => {
  const dir = await fixtureCopy(context);
  const page = "11111111-2222-4333-8444-555555555555";
  const { passageHash } = await import("../src/lib/selection.ts");
  const live = "A live paragraph.", secret = "Pricing was 95k.";
  const extract = (id: string, version: number, replaces: string | null, paragraphs: Array<[number, string]>) =>
    `---\nid: ${id}\ntype: source\ntitle: Launch extract v${version}\nsource_key: notion:${page}\nkind: minutes\nextract: true\nextract_of: ${page}\nextract_version: ${version}\n${replaces === null ? "" : `replaces: ${replaces}\n`}transcript_hash: ${"a".repeat(64)}\nselection:\n  - id: s1\n    effective: use\n    explicit: null\npassages:\n${paragraphs.map(([n, text]) => `  - n: ${n}\n    hash: ${passageHash(text)}\n    items:\n      - s1.i1\n`).join("")}content_hash: sha256:${String(version).repeat(64)}\ncaptured: 2026-12-10T09:00:00Z\n---\n${paragraphs.map(([n, text]) => `<!-- passage ¶${n} item s1.i1 -->\n${text}\n`).join("\n")}`;
  await writeFile(join(dir, "sources/notion/2026-12-10-extract-v1.md"), extract("src-ex1a3b4c", 1, null, [[1, live], [2, secret]]));
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Pricing call", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: `SECRET ${secret} ^[src-ex1a3b4c#¶2:${passageHash(secret)}]\n` }] });
  assert.equal(note.code, 0, note.stdout);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [note.json.data.created[0].id] }] });
  const id = created.json.data.created[0].id as string;
  const [before] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.ok(String(before.body).includes("SECRET"), "while the paragraph is in the latest version the draft is shown");
  // Version 2 of the input drops the paragraph: the claim citing it is restricted from now on.
  await writeFile(join(dir, "sources/notion/2026-12-10-extract-v2.md"), extract("src-ex2a3b4c", 2, "src-ex1a3b4c", [[1, live]]));
  await mkdir(join(dir, "_suppressions"), { recursive: true });
  await writeFile(join(dir, "_suppressions", `${page}.json`), JSON.stringify({ input: page, records: [{ version: 2, passages: [{ extract_of: page, transcript_hash: "a".repeat(64), n: 2 }], full_copies: [], status: "active" }] }));
  const [after] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.ok(!String(after.body).includes("SECRET") && !JSON.stringify(after).includes("95k"), "the restricted text is not in the page or the payload");
  assert.match(String(after.body), /## \[a · it-[0-9a-z]{8}\] Held: /);
  assert.ok(Object.values(after.published["@review"].items as Record<string, { held?: boolean }>).every((entry) => entry.held === true));
});

test("a deferred item keeps its id in the new proposal, and the new proposal lints", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const original = (await readFile(join(dir, file), "utf8")).match(/item_id: (it-\w+)\n\s+kind: (\w+)\n\s+ref: (.+)/g)!;
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: id, action: "approve", decided_at: "2026-12-10T08:00:00Z", decided_by: "notion", note: "all except b", exclude: [{ change: 1 }] }] });
  assert.equal(applied.code, 0, applied.stdout);
  const listed = (await run(dir, ["proposal", "list"])).json.data.proposals as Array<{ id: string; path: string; title: string }>;
  const deferred = listed.find((p) => p.title.startsWith("Deferred from"))!;
  const text = await readFile(join(dir, deferred.path), "utf8");
  const kept = /items:\n\s+- item_id: (it-\w+)\n\s+kind: change\n\s+ref: 0/.exec(text)!;
  assert.ok(kept && original.some((entry) => entry.includes(kept[1]!)), "the deferred change keeps the id it had");
  const lint = await run(dir, ["lint"]);
  assert.deepEqual(lint.json.data.issues.filter((issue: { severity: string }) => issue.severity === "error"), []);
});

test("the summary of a row decided the 0045 way says so, and item_decisions without items is a lint error", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const file = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, file), "utf8");
  await writeFile(join(dir, file), text.replace(/^status: pending$/m, "status: applied"));
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  assert.ok(String(item.sections["Review summary"]).includes("4 of 4 decided: 4 applied"));
  await writeFile(join(dir, file), text.replace(/^items:\n(?:  .*\n)+/m, "").replace(/\n---\n/, "\nitem_decisions:\n  - item_id: it-00000000\n    decision: accept\n    decided_at: 2026-12-10T09:00:00Z\n    decided_by: chat\n---\n"));
  const lint = await run(dir, ["lint"]);
  assert.ok(lint.json.data.issues.some((issue: { rule: string; message: string }) => issue.rule === "proposal-items" && /without items/.test(issue.message)));
});

test("a plan with a malformed review_pending entry is refused", async (context) => {
  const dir = await fixtureCopy(context);
  const id = await ingest(dir);
  const planPath = join(dir, "..", "plan.json");
  await writeFile(planPath, JSON.stringify({ as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [], review_pending: [null] }));
  const out = await run(dir, ["sync", "render", "--ids", id, "--plan", planPath]);
  assert.equal(out.json.error.code, "INPUT_INVALID");
});
