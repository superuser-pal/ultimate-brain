// CC-214: the Review summary names each item's outcome by its letter and title (capture-and-review §7.4 a, cli §5.14.4 "The Review summary").
// Synthetic fixture brain only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { excludableDecision } from "./exclusion-fixture.ts";
import { brain, fixtureCopy, withPassages } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const AFTER = "2026-12-10T09:10:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const CONCEPT = "con-1s6t8e2b";
const PAGE = "6a7b0000-0000-4000-8000-0000000000aa";
const PAGE_B = "6a7b0000-0000-4000-8000-0000000000bb";
const PAGE_C = "6a7b0000-0000-4000-8000-0000000000cc";
const HEAD = "**Review summary** (the brain keeps this up to date; do not edit): ";

const git = (dir: string, ...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
function settle(dir: string) {
  if (!existsSync(join(dir, ".git"))) { git(dir, "init", "-q"); git(dir, "config", "user.email", "t@example.com"); git(dir, "config", "user.name", "T"); }
  git(dir, "add", "-A");
  if (git(dir, "status", "--porcelain").trim() !== "") git(dir, "commit", "-q", "-m", "state");
}

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  if ((args[0] === "sync" && args[1] === "apply") || args[0] === "apply") settle(dir);
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(args[0] === "proposal" && args[1] === "new" ? withPassages(input) : input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

async function attributes(dir: string, id: string): Promise<Record<string, any>> {
  for (const path of await readdir(dir, { recursive: true })) {
    if (!path.endsWith(".md")) continue;
    const text = await readFile(join(dir, path), "utf8");
    if (text.startsWith("---\n") && parseFrontmatter(text).attributes.id === id) return parseFrontmatter(text).attributes as Record<string, any>;
  }
  throw new Error(`no file with id ${id}`);
}

async function renderOne(dir: string, id: string) {
  const items = (await run(dir, ["sync", "render", "--ids", id])).json.data.items as Array<Record<string, any>>;
  assert.equal(items.length, 1);
  return items[0]!;
}
async function record(dir: string, id: string, notion: string, published: unknown) {
  const out = await run(dir, ["sync", "record"], { records: [{ id, notion, synced_at: NOW, published }] });
  assert.equal(out.json.data.records[0].result, "recorded", out.stdout);
}
/** The summary's item lines, without the count line. */
const lines = (summary: string) => summary.split("\n").filter((line) => line.startsWith("- "));

/** A published row of five items: a: fact, b: text, c: second text, d: new draft, e: link. */
async function published(dir: string) {
  const note = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Launch in March", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: "Launch moves to March.\n" }] });
  assert.equal(note.code, 0, note.stdout);
  const draft = note.json.data.created[0] as { id: string; path: string };
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [draft.id] },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS.", why: "Carlos said so.", source: SYNC },
    { kind: "add_to_note", title: "Policies", target: CONCEPT, content: "Policies are reviewed monthly.", why: "Said.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved it.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const item = await renderOne(dir, id);
  await record(dir, id, PAGE, item.published);
  const ids = [...(item.body as string).matchAll(/^## \[[a-z]+ · (it-[0-9a-z]{8})\]/gm)].map((m) => m[1]!);
  assert.equal(ids.length, 5);
  return { id, body: item.body as string, summary: item.sections["Review summary"] as string, ids, draft };
}
const decide = (body: string, itemId: string, token: string) => body.replace(new RegExp(`(## \\[[a-z]+ · ${itemId}\\][\\s\\S]*?\\nDecision: )Pending`), `$1${token}`);
const row = (id: string, page: string, body: string) => ({ database: "review", page_id: page, last_edited: AFTER, properties: { "Brain ID": id, State: "Pending" }, review: { decided: true, decided_at: NOW, accept_all: false, page_edited_at: NOW, body_markdown: body } });
async function submit(dir: string, id: string, body: string, page = PAGE) {
  const plan = (await run(dir, ["sync", "plan"], { as_of: AFTER, rows: [row(id, page, body)] }, AFTER)).json.data;
  for (const decision of plan.review_decisions) for (const item of decision.items) item.verified = { snapshot_hash: item.snapshot_hash, proposed_hash: item.proposed_hash };
  const applied = await run(dir, ["sync", "apply"], plan, AFTER);
  assert.equal(applied.code, 0, applied.stdout);
  return (applied.json.data.review_results ?? []) as Array<{ item_id: string; result: string; deferred_to?: string }>;
}

test("a new row's summary lists every item as waiting, by letter and title, under the count line", async (context) => {
  const dir = await fixtureCopy(context);
  const { summary, body } = await published(dir);
  assert.equal(summary, [
    `${HEAD}0 of 5 decided: 0 applied, 0 closed, 5 waiting for you.`,
    "",
    "- a · Launch date on Acme website — Waiting for your decision.",
    "- b · Row-level security — Waiting for your decision.",
    "- c · Row-level security — Waiting for your decision.",
    "- d · Launch in March — Waiting for your decision.",
    "- e · Row-level security — Waiting for your decision.",
  ].join("\n"));
  assert.ok(body.includes(`## Review summary\n${summary}\n`), "the body carries the same summary under its heading");
  assert.ok(!/^(?:## \[|Decision:)/m.test(body.split("\n## [")[0]!), "no summary line reads as a section heading or a decision line");
});

test("a mixed submission names each item's outcome; a drafted revision waits for a fresh decision; no item section is rewritten for an outcome", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  let page = decide(body, ids[0]!, "Accept").replace("2027-03", "2027-04");
  page = decide(page, ids[1]!, "Request revision").replace(new RegExp(`(## \\[[a-z]+ · ${ids[1]}\\][\\s\\S]*?Decision: Request revision)`), "$1\nRevision request: shorter");
  page = decide(page, ids[2]!, "Defer");
  page = decide(page, ids[3]!, "Reject");
  const results = await submit(dir, id, page);
  const moved = results.find((entry) => entry.item_id === ids[2])!.deferred_to!;
  const movedTitle = (await attributes(dir, moved)).title as string;

  const update = await renderOne(dir, id);
  assert.equal(update.action, "update");
  assert.equal(update.body, null, "the page body is never rewritten");
  assert.equal(update.item_updates, undefined, "an outcome is never written into an item section");
  assert.equal(update.sections["Review summary"], [
    `${HEAD}3 of 5 decided: 1 applied, 1 closed, 1 deferred, 2 waiting for you.`,
    "",
    "- a · Launch date on Acme website — Applied, with your wording.",
    "- b · Row-level security — Revision requested: waiting for the new wording.",
    `- c · Row-level security — Deferred to "${movedTitle}", which awaits publication.`,
    "- d · Launch in March — Rejected; the draft is archived.",
    "- e · Row-level security — Waiting for your decision.",
  ].join("\n"));
  assert.ok(!update.sections["Review summary"].includes("2027-04"), "the summary reports the outcome, not the wording");

  const revised = await run(dir, ["proposal", "revise"], { proposal: id, item_id: ids[1], proposed: "Carlos uses RLS.", previous: "Carlos will use RLS." });
  assert.equal(revised.code, 0, revised.stdout);
  const after = await renderOne(dir, id);
  assert.ok(lines(after.sections["Review summary"]).includes("- b · Row-level security — Revised wording ready: waiting for your decision."));
  assert.deepEqual(after.item_updates.map((entry: { item_id: string; reason: string }) => [entry.item_id, entry.reason]), [[ids[1], "revision_drafted"]], "only the existing guarded update is listed");
});

test("outcomes follow item ids: decisions stored out of order stay on their items, and the destination row lists the moved item under its new letter", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const results = await submit(dir, id, decide(decide(body, ids[4]!, "Accept"), ids[3]!, "Defer"));
  const moved = results.find((entry) => entry.item_id === ids[3])!.deferred_to!;
  // Reverse the stored decisions: the summary must still put each outcome on its own item.
  const path = (await run(dir, ["proposal", "list"])).json.data.proposals.find((p: { id: string }) => p.id === id).path as string;
  const text = await readFile(join(dir, path), "utf8");
  const parsed = parseFrontmatter(text).attributes as Record<string, any>;
  assert.deepEqual(parsed.item_decisions.map((d: any) => d.item_id), [ids[4], ids[3]]);
  const first = await renderOne(dir, id);
  const blocks = /item_decisions:\n((?:  - [\s\S]*?)(?=\n[a-z_]+:|\n---))/.exec(text)![1]!;
  const entries = blocks.split(/\n(?=  - )/);
  await writeFile(join(dir, path), text.replace(blocks, [...entries].reverse().join("\n")));
  assert.deepEqual((await attributes(dir, id)).item_decisions.map((d: any) => d.item_id), [ids[3], ids[4]]);
  const second = await renderOne(dir, id);
  assert.equal(second.sections["Review summary"], first.sections["Review summary"]);
  assert.ok(lines(second.sections["Review summary"]).some((line: string) => line.startsWith("- d · Launch in March — Deferred to ")));
  assert.ok(lines(second.sections["Review summary"]).includes("- e · Row-level security — Applied."));

  const destination = await renderOne(dir, moved);
  assert.equal(destination.action, "create");
  assert.equal(destination.sections["Review summary"], `${HEAD}0 of 1 decided: 0 applied, 0 closed, 1 waiting for you.\n\n- a · Launch in March — Waiting for your decision.`);
  assert.ok(String(destination.body).includes(`## [a · ${ids[3]}] Creates: Launch in March`), "the same id, a new letter");
});

test("a deferred item's line awaits publication, links the row once it is published, and follows a second deferral; an unchanged row is not rendered again", async (context) => {
  const dir = await fixtureCopy(context);
  const { id, body, ids } = await published(dir);
  const b = (await submit(dir, id, decide(body, ids[3]!, "Defer"))).find((entry) => entry.item_id === ids[3])!.deferred_to!;
  const titleB = (await attributes(dir, b)).title as string;
  const line = async () => lines((await renderOne(dir, id)).sections["Review summary"]).find((entry: string) => entry.startsWith("- d · "))!;
  assert.equal(await line(), `- d · Launch in March — Deferred to "${titleB}", which awaits publication.`);

  // The destination is published: the origin's next render links its page and sends the summary alone.
  const renderedB = await renderOne(dir, b);
  await record(dir, b, PAGE_B, renderedB.published);
  const linked = await renderOne(dir, id);
  assert.equal(lines(linked.sections["Review summary"])[3], `- d · Launch in March — Deferred to [${titleB}](https://www.notion.so/${PAGE_B.replaceAll("-", "")}).`);
  assert.equal(linked.body, null);
  assert.equal(linked.item_updates, undefined);
  await record(dir, id, PAGE, linked.published);
  const changed = (await run(dir, ["sync", "render", "--changed"])).json.data.items.filter((item: { id: string }) => item.id === id);
  assert.deepEqual(changed, [], "a render of the unchanged row sends nothing");

  // The item is deferred again from the destination: the origin names the last row in the chain.
  const resultsB = await submit(dir, b, decide(renderedB.body as string, ids[3]!, "Defer"), PAGE_B);
  const c = resultsB[0]!.deferred_to!;
  const titleC = (await attributes(dir, c)).title as string;
  assert.equal(await line(), `- d · Launch in March — Deferred to "${titleC}", which awaits publication.`);
  await record(dir, c, PAGE_C, (await renderOne(dir, c)).published);
  assert.equal(await line(), `- d · Launch in March — Deferred to [${titleC}](https://www.notion.so/${PAGE_C.replaceAll("-", "")}).`);
});

test("a row decided as a whole names each item: deferred, closed because its note changed, closed because it rests on excluded text, applied; the counts match", async (context) => {
  const dir = await fixtureCopy(context);
  const { note: draft, exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [draft.id] },
    { kind: "update_fact", title: "Launch", target: PROJECT, field: "launch_date", after: "2027-03", why: "Maria moved it.", source: SYNC },
    { kind: "add_to_note", title: "RLS", target: CONCEPT, content: "Carlos will use RLS.", why: "Carlos said so.", source: SYNC },
    { kind: "add_link", title: "link", target: CONCEPT, field: "projects", after: PROJECT, why: "Said.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  await record(dir, id, PAGE, (await renderOne(dir, id)).published);
  await exclude(); // the draft rests only on the paragraph that left the input
  // The project's launch date moves before the row is applied: the fact change is stale.
  const projectPath = join(dir, "projects/acme-website/project.md");
  await writeFile(projectPath, (await readFile(projectPath, "utf8")).replace(/launch_date: 2027-02/, "launch_date: 2027-05"));
  const applied = await run(dir, ["apply"], { decisions: [{ proposal: id, action: "approve", decided_at: NOW, decided_by: "chat", exclude: [{ target: CONCEPT, field: "projects", value: PROJECT }] }] });
  assert.equal(applied.code, 0, applied.stdout);
  const p = await attributes(dir, id);
  assert.equal(p.status, "applied");
  assert.deepEqual(p.item_decisions.map((d: any) => [d.state, d.reason]), [["closed", "source_excluded"]], "only the withheld item has an item decision");
  const moved = (await run(dir, ["proposal", "list"])).json.data.proposals.find((entry: { id: string; title?: string }) => entry.id !== id && entry.title?.startsWith("Deferred from") === true);
  assert.ok(moved !== undefined, "the excluded link moved to a new row");
  const movedTitle = moved.title as string;

  const summary = (await renderOne(dir, id)).sections["Review summary"] as string;
  assert.equal(summary, [
    `${HEAD}4 of 4 decided: 1 applied, 2 closed, 1 deferred, 0 waiting for you.`,
    "",
    "- a · Launch date on Acme website — Closed without applying: the note changed first.",
    "- b · Row-level security — Applied.",
    `- c · decision ${draft.id}, title withheld: awaiting cleanup — Closed without applying: it rests on text you excluded.`,
    `- d · Row-level security — Deferred to "${movedTitle}", which awaits publication.`,
  ].join("\n"));
  assert.ok(!summary.includes("Pricing") && !summary.includes("95,000"), "a restricted title and its text stay withheld");
});

test("a held pending item is named by its withheld title and told to Reject or Defer", async (context) => {
  const dir = await fixtureCopy(context);
  const { note: draft, exclude } = await excludableDecision(dir, SYNC, PROJECT);
  const created = await run(dir, ["proposal", "new"], { proposals: [{ kind: "review_notes", source: SYNC, notes: [draft.id] }] });
  const id = created.json.data.created[0].id as string;
  await exclude();
  const item = await renderOne(dir, id);
  assert.equal(item.sections["Review summary"], `${HEAD}0 of 1 decided: 0 applied, 0 closed, 1 waiting for you.\n\n- a · decision ${draft.id}, title withheld: awaiting cleanup — Held: it rests on text you excluded. Reject or Defer it.`);
  assert.ok(!JSON.stringify(item).includes("Pricing call"));
});
