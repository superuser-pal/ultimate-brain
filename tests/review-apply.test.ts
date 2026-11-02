import assert from "node:assert/strict";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";
const PAGE = "6a7b0000-0000-4000-8000-0000000000aa";

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

async function attributes(dir: string, path: string) { return parseFrontmatter(await readFile(join(dir, path), "utf8")).attributes as Record<string, any>; }
async function pathOf(dir: string, id: string): Promise<string> {
  for (const path of await readdir(dir, { recursive: true })) {
    if (!path.endsWith(".md")) continue;
    const text = await readFile(join(dir, path), "utf8");
    if (text.startsWith("---\n") && parseFrontmatter(text).attributes.id === id) return path;
  }
  throw new Error(`no file with id ${id}`);
}
async function errors(dir: string) { return (await run(dir, ["lint"])).json.data.issues.filter((issue: { severity: string }) => issue.severity === "error"); }

/** A published Review row of the new layout: a fact change, a text addition, a new draft decision and a link. Items: 0 fact, 1 text, 2 note, 3 link. */
async function published(dir: string) {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "Launch moves to March.\n" }] });
  assert.equal(note.code, 0, note.stdout);
  const draft = note.json.data.created[0] as { id: string; path: string };
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [draft.id] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved it.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const ids = [...(item.body as string).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)].map((m) => m[1]!);
  return { id, body: item.body as string, ids, draft };
}
const decide = (body: string, itemId: string, token: string) => body.replace(new RegExp(`(## \\[[a-z]+ · ${itemId}\\][\\s\\S]*?\\nDecision: )Pending`), `$1${token}`);
const row = (id: string, body: string, extra: Record<string, unknown> = {}) => ({ database: "review", page_id: PAGE, last_edited: AFTER, properties: { "Brain ID": id, State: "Pending" }, review: { decided: true, decided_at: NOW, accept_all: false, page_edited_at: NOW, body_markdown: body, ...extra } });
/** Plan the submitted page, have the "skill" verify every item, apply, and return both. */
async function submit(dir: string, id: string, body: string, mutate?: (plan: any) => void) {
  const plan = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, body)] }, AFTER)).json.data;
  for (const decision of plan.review_decisions) for (const item of decision.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  mutate?.(plan);
  const applied = await run(dir, ["sync", "apply"], plan, AFTER);
  return { plan, applied, results: (applied.json.data?.review_results ?? []) as Array<{ item_id: string; result: string; reason?: string; deferred_to?: string }> };
}

test("an accepted, edited fact applies exactly with the user's value attributed to the user, while the rest stays pending", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[0]!, "Accept").replace("2027-03", "2027-04");
  const { results } = await submit(dir, id, page);
  assert.deepEqual(results.map((r) => [r.item_id, r.result]), [[ids[0], "applied"]]);
  const project = await attributes(dir, "projects/acme-website/project.md");
  assert.equal(project.facts.launch_date, "2027-04", "the exact final wording");
  const entries = (project.timeline as Array<Record<string, any>>).filter((entry) => entry.field === "launch_date");
  assert.ok(entries.some((entry) => entry.value === "2027-03" && entry.source === SYNC && entry.assessment === "superseded"), "the source's claim is kept, as the source said it");
  assert.ok(entries.some((entry) => entry.value === "2027-04" && entry.source === `user-correction:${id}` && entry.assessment === "accepted"), "the correction is the user's");
  const proposal = await attributes(dir, await pathOf(dir, id));
  assert.equal(proposal.status, "pending");
  assert.deepEqual(proposal.item_decisions.map((d: any) => [d.item_id, d.state, d.edited]), [[ids[0], "applied", true]]);
  assert.deepEqual(await errors(dir), []);
});

test("an unedited accept applies what the proposal said, not the page's normalised copy", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const { results } = await submit(dir, id, decide(body, ids[1]!, "Accept"));
  assert.deepEqual(results.map((r) => r.result), ["applied"]);
  const concept = await readFile(join(dir, await pathOf(dir, CONCEPT)), "utf8");
  assert.ok(concept.includes("Carlos will use RLS.\nSource: " + SYNC));
  const project = await attributes(dir, "projects/acme-website/project.md");
  assert.equal(project.facts.launch_date, "2027-02", "the other items were not touched");
});

test("a new draft is reviewed when accepted and archived when rejected; the row closes when no item is pending", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids, draft } = await published(dir);
  let page = decide(body, ids[0]!, "Reject");
  page = decide(page, ids[1]!, "Reject");
  page = decide(page, ids[2]!, "Accept");
  page = decide(page, ids[3]!, "Reject");
  const { results, plan } = await submit(dir, id, page);
  assert.deepEqual(results.map((r) => r.result), ["closed", "closed", "applied", "closed"]);
  assert.equal((await attributes(dir, draft.path)).lifecycle, "reviewed");
  const proposal = await attributes(dir, await pathOf(dir, id));
  assert.equal(proposal.status, "applied");
  assert.equal(proposal.decision.action, "approve");
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.launch_date, "2027-02", "a rejected change changes nothing");
  assert.deepEqual(await errors(dir), []);
  const planAgain = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, page)] }, AFTER)).json.data;
  assert.deepEqual(planAgain.review_decisions, [], "a closed row plans nothing");
  const again = { results: (await run(dir, ["sync", "apply"], plan, AFTER)).json.data.review_results as Array<{ result: string; reason?: string }> };
  assert.equal(again.results.length, 4);
  assert.ok(again.results.every((r) => r.result === "skipped" && r.reason === "ALREADY_TERMINAL"), "applying again is a no-op");
  assert.deepEqual(await attributes(dir, await pathOf(dir, id)), proposal, "and the proposal is untouched");
});

test("every item rejected closes the row; a rejected draft is archived", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids, draft } = await published(dir);
  let page = body;
  for (const itemId of ids) page = decide(page, itemId, "Reject");
  await submit(dir, id, page);
  const proposal = await attributes(dir, await pathOf(dir, id));
  assert.equal(proposal.status, "closed");
  assert.equal(proposal.decision.action, "reject");
  assert.equal((await attributes(dir, draft.path)).lifecycle, "archived");
  assert.deepEqual(await errors(dir), []);
});

test("Defer moves the item, under its own id, to a new pending proposal", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  let page = decide(body, ids[2]!, "Defer");
  page = decide(page, ids[0]!, "Accept");
  const { results } = await submit(dir, id, page);
  const deferred = results.find((r) => r.item_id === ids[2])!;
  assert.equal(deferred.result, "deferred");
  const moved = await attributes(dir, await pathOf(dir, deferred.deferred_to!));
  assert.equal(moved.status, "pending");
  assert.equal(moved.deferred_from, id);
  assert.deepEqual(moved.items.map((item: any) => item.item_id), [ids[2]]);
  const original = await attributes(dir, await pathOf(dir, id));
  assert.equal(original.item_decisions.find((d: any) => d.item_id === ids[2]).deferred_to, deferred.deferred_to);
  assert.deepEqual(await errors(dir), []);
});

test("an item is refused unless the skill verified it, and when the page or the wording moved since the plan", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[0]!, "Accept");
  const unverified = await submit(dir, id, page, (plan) => { delete plan.review_decisions[0].items[0].verified; });
  assert.deepEqual(unverified.results.map((r) => r.reason), ["UNVERIFIED"]);
  const moved = await submit(dir, id, page, (plan) => { plan.review_decisions[0].items[0].verified.snapshot_hash = "0".repeat(64); });
  assert.deepEqual(moved.results.map((r) => r.reason), ["CHANGED_SINCE_PLAN"]);
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.launch_date, "2027-02");
});

test("a target that changed between the plan and the apply is not overwritten (BASE_CHANGED)", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[0]!, "Accept");
  const planned = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, page)] }, AFTER)).json.data;
  for (const item of planned.review_decisions[0].items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  const projectPath = "projects/acme-website/project.md";
  await writeFile(join(dir, projectPath), (await readFile(join(dir, projectPath), "utf8")).replace("launch_date: 2027-02", "launch_date: 2027-06"));
  const applied = await run(dir, ["sync", "apply"], planned, AFTER);
  assert.deepEqual(applied.json.data.review_results.map((r: any) => r.reason), ["BASE_CHANGED"]);
  assert.equal((await attributes(dir, projectPath)).facts.launch_date, "2027-06");
});

test("an edited link names one note; a name that matches none is refused and nothing is written", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const linkId = ids[3]!;
  const bad = await submit(dir, id, decide(body, linkId, "Accept").replace(/(<summary>Proposed final wording<\/summary>\n\n)Acme website/, "$1No such project"));
  assert.deepEqual(bad.results.map((r) => r.reason), ["LINK_VALUE_UNKNOWN"]);
  assert.deepEqual(await errors(dir), []);
});

test("a note deferred twice follows its chain: the second deferral works and nothing is lost", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const first = await submit(dir, id, decide(body, ids[2]!, "Defer"));
  const b = first.results.find((r) => r.item_id === ids[2])!.deferred_to!;
  const pageB = "6a7b0000-0000-4000-8000-0000000000bb";
  const [render] = (await run(dir, ["sync", "render", "--ids", b])).json.data.items;
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: b, notion: pageB, synced_at: NOW, published: render.published }] })).json.data.records[0].result, "recorded");
  const rowB = { database: "review", page_id: pageB, last_edited: AFTER, properties: { "Brain ID": b, State: "Pending" }, review: { decided: true, decided_at: NOW, accept_all: false, page_edited_at: NOW, body_markdown: decide(render.body as string, ids[2]!, "Defer") } };
  const plan = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [rowB] }, AFTER)).json.data;
  for (const d of plan.review_decisions) for (const item of d.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  const applied = await run(dir, ["sync", "apply"], plan, AFTER);
  const result = applied.json.data.review_results[0];
  assert.equal(result.result, "deferred", applied.stdout);
  const c = await attributes(dir, await pathOf(dir, result.deferred_to));
  assert.equal(c.status, "pending");
  assert.deepEqual(c.items.map((item: any) => item.item_id), [ids[2]], "the item keeps the id it was born with");
  assert.equal((await attributes(dir, await pathOf(dir, b))).status, "closed");
  assert.deepEqual(await errors(dir), []);
});

test("the accepted wording is bound to its hashes: a doctored plan applies nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const page = decide(body, ids[0]!, "Accept");
  const forged = await submit(dir, id, page, (plan) => { plan.review_decisions[0].items[0].proposed = "HACKED"; plan.review_decisions[0].items[0].edited = true; });
  assert.deepEqual(forged.results.map((r) => r.reason), ["WORDING_NOT_BOUND"]);
  const blank = await submit(dir, id, page, (plan) => { plan.review_decisions[0].items[0].proposed = "   "; });
  assert.equal(blank.applied.json.error.code, "INPUT_INVALID", "blank wording is refused by the plan check");
  const stripped = await submit(dir, id, page, (plan) => { const item = plan.review_decisions[0].items[0]; delete item.snapshot_hash; delete item.proposed_hash; item.verified = {}; item.proposed = "FORGED"; });
  assert.equal(stripped.applied.json.error.code, "INPUT_INVALID");
  const nulled = await submit(dir, id, page, (plan) => { plan.review_decisions[0].items[0].verified = null; });
  assert.equal(nulled.applied.json.error.code, "INPUT_INVALID");
  assert.equal((await attributes(dir, "projects/acme-website/project.md")).facts.launch_date, "2027-02", "nothing was written");
  // Whether the user edited is read from the hashes, not from a flag in the plan.
  const edited = await submit(dir, id, page.replace("2027-03", "2027-09"), (plan) => { delete plan.review_decisions[0].items[0].edited; });
  assert.deepEqual(edited.results.map((r) => r.result), ["applied"]);
  const entries = ((await attributes(dir, "projects/acme-website/project.md")).timeline as Array<Record<string, any>>).filter((e) => e.field === "launch_date");
  assert.ok(entries.some((e) => e.value === "2027-09" && e.source === `user-correction:${id}`), "the edit is attributed to the user");
});

test("two accepted additions to one note both apply", async (context) => {
  const dir = await fixtureCopy(context);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [] },
    { kind: "add_to_note", title: "A", target: CONCEPT, content: "First addition.", why: "w", source: SYNC },
    { kind: "add_to_note", title: "B", target: CONCEPT, content: "Second addition.", why: "w", source: SYNC },
  ] });
  const id = created.json.data.created[0].id as string;
  const [item] = (await run(dir, ["sync", "render", "--ids", id])).json.data.items;
  await run(dir, ["sync", "record"], { records: [{ id, notion: PAGE, synced_at: NOW, published: item.published }] });
  const ids = [...(item.body as string).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)].map((m) => m[1]!);
  const { results } = await submit(dir, id, decide(decide(item.body as string, ids[0]!, "Accept"), ids[1]!, "Accept"));
  assert.deepEqual(results.map((r) => r.result), ["applied", "applied"]);
  const text = await readFile(join(dir, await pathOf(dir, CONCEPT)), "utf8");
  assert.ok(text.includes("First addition.") && text.includes("Second addition."));
  assert.equal((await attributes(dir, await pathOf(dir, id))).status, "applied");
});

test("a draft that is no longer a draft is not accepted, and no decision is recorded", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids, draft } = await published(dir);
  const file = join(dir, draft.path);
  await writeFile(file, (await readFile(file, "utf8")).replace("lifecycle: draft", "lifecycle: archived"));
  const { results } = await submit(dir, id, decide(body, ids[2]!, "Accept"));
  assert.deepEqual(results.map((r) => [r.result, r.reason]), [["skipped", "NOT_A_DRAFT"]]);
  assert.equal((await attributes(dir, await pathOf(dir, id))).item_decisions, undefined);
});
