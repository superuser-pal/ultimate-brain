import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";
const PAGE = "6a7b0000-0000-4000-8000-0000000000aa";

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
/** A review apply is a journaled, committed operation (§7.11): it needs a Git brain with a clean tree. */
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if (args[0] === "sync" && args[1] === "apply") settle(dir);
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
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

// CC-82: one submission mixing a row of the new layout with a legacy row, partial decisions, a revision request, a stale base and reruns.
test("a new-layout row and a legacy row decided together: exact partial decisions apply, a revision waits, a stale base holds, and reruns change nothing", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids, draft } = await published(dir);

  // A legacy row: a proposal written the 0045 way, published without item sections, decided with Approve.
  const legacyCreated = await run(dir, ["proposal", "new"], { proposals: [{ kind: "update_fact", title: "Budget", target: PROJECT, field: "budget", after: "95000 EUR", why: "Raised.", source: SYNC }] });
  const legacy = legacyCreated.json.data.created[0].id as string;
  const [legacyItem] = (await run(dir, ["sync", "render", "--ids", legacy])).json.data.items;
  assert.equal(legacyItem.body, null, "a standalone proposal has no sections");
  await run(dir, ["sync", "record"], { records: [{ id: legacy, notion: "6a7b0000-0000-4000-8000-0000000000ee", synced_at: NOW, published: legacyItem.published }] });

  // Item 0: accepted with the user's value; item 1: rejected; item 2: revision requested; item 3 left pending.
  let page = decide(body, ids[0]!, "Accept").replace("2027-03", "2027-04");
  page = decide(page, ids[1]!, "Reject");
  page = decide(page, ids[2]!, "Request revision").replace(new RegExp(`(## \\[[a-z]+ · ${ids[2]}\\][\\s\\S]*?Decision: Request revision)`), "$1\nRevision request: shorter please");
  const legacyRow = { database: "review", page_id: "6a7b0000-0000-4000-8000-0000000000ee", last_edited: AFTER, properties: { "Brain ID": legacy, State: "Pending", "Your call": "Approve" } };
  const plan = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, page), legacyRow] }, AFTER)).json.data;
  for (const decision of plan.review_decisions) for (const item of decision.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  assert.equal(plan.decisions.length, 1, "the legacy row is read by the 0045 rules in the same plan");
  const applied = await run(dir, ["sync", "apply"], plan, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  const byItem = Object.fromEntries((applied.json.data.review_results as Array<{ item_id: string; result: string }>).map((entry) => [entry.item_id, entry.result]));
  assert.deepEqual([byItem[ids[0]!], byItem[ids[1]!]], ["applied", "closed"]);
  assert.equal(byItem[ids[2]!], undefined, "a requested revision is not a decision");
  assert.deepEqual(applied.json.data.revision_results.map((entry: { result: string }) => entry.result), ["recorded"]);
  const project = await attributes(dir, await pathOf(dir, PROJECT));
  assert.equal(project.facts.launch_date, "2027-04", "the user's wording, exactly");
  assert.ok(project.timeline.some((entry: { source?: string }) => entry.source === `user-correction:${id}`), "attributed to the user, the source's value kept apart");
  assert.equal((await attributes(dir, await pathOf(dir, legacy))).status, "applied", "the legacy Approve applied as before");
  assert.equal((await attributes(dir, await pathOf(dir, id))).status, "pending", "items 2 and 3 are still pending");
  assert.deepEqual(await errors(dir), []);
  assert.equal((await attributes(dir, draft.path)).lifecycle, "draft", "the draft whose revision was requested is untouched until it is accepted");

  // The page still holds the user's pending work, so a publish withholds it whole (capture-and-review §7.10).
  assert.ok(plan.review_pending.some((entry: { proposal: string }) => entry.proposal === id));
  const planFile = join(dir, "..", "plan-pending.json");
  await writeFile(planFile, JSON.stringify(plan));
  const publish = await run(dir, ["sync", "render", "--ids", id, "--plan", planFile]);
  assert.ok(publish.json.data.skipped.some((entry: { id: string; reason: string }) => entry.id === id && entry.reason === "REVIEW_PENDING"), publish.stdout);

  // Reruns change nothing, and no revision applies before it is accepted.
  const head = git(dir, "rev-parse", "HEAD");
  const again = await run(dir, ["sync", "apply"], plan, AFTER);
  const rerun = again.json.data.review_results as Array<{ result: string }>;
  assert.ok(rerun.length > 0 && rerun.every((entry) => entry.result === "skipped"), again.stdout);
  assert.equal(git(dir, "rev-parse", "HEAD"), head, "a no-op rerun commits nothing");

  // A stale base: the target of item 3 moved after the page was rendered, so accepting it holds.
  const concept = await pathOf(dir, CONCEPT);
  await writeFile(join(dir, concept), (await readFile(join(dir, concept), "utf8")).replace(/^tags: .*$/m, "$&\nprojects: [prj-9x4t1b7e]"));
  const stale = await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, decide(page, ids[3]!, "Accept"))] }, AFTER);
  assert.ok(stale.json.data.review_held.some((held: { item_id: string; reason: string }) => held.item_id === ids[3] && held.reason === "BASE_CHANGED"), stale.stdout);
});
