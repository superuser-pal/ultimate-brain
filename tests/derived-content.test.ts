// CC-183: derived content keeps eligibility (spec/eligibility.md §6 rule 5, §8; cli.md §5.8, §5.9, §5.13.1 "Views", §5.14.4 "Restricted notes").
// Every brain here is the synthetic fixture with a synthetic input whose second version drops one paragraph.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { passageHash } from "../src/lib/selection.ts";
import { excludableDecision, INPUT } from "./exclusion-fixture.ts";
import { approveNote, brain, fixtureCopy } from "./helpers.ts";

const NOW = "2026-12-10T09:00:00Z";
const SYNC = "mtg-8c4n2p7w";
const PROJECT = "prj-9x4t1b7e";
const LIVE_NOTE = "dec-7k2m9q4x"; // "Use Supabase for auth": cites the fixture's own meeting, no changed input
const LIVE_PATH = "knowledge/decisions/2026-12-03-use-supabase-for-auth.md";
const V2 = "sources/notion/2026-12-10-extract-v2.md";
const LIVE = "A live paragraph.";
const SECRET = "Pricing was 95k.";
const ref = (n: number, text: string) => `^[src-ex1a3b4c#¶${n}:${passageHash(text)}]`;

async function run(dir: string, args: string[], input?: unknown, now = NOW) {
  const extra: string[] = [];
  if (input !== undefined) { const file = join(dir, "..", `in-${Math.random().toString(36).slice(2)}.json`); await writeFile(file, JSON.stringify(input)); extra.push("--input", file); }
  return brain([...args, ...extra, "--brain", dir, "--now", now, "--json"]);
}

const read = async (dir: string, id: string) => (await run(dir, ["query", "--read", id])).json.data.notes[0];

/** The six report sections, the first holding `first`; `links` go in the Timeline, relative to `reports/`. */
const reportBody = (first: string, links: string[]) => `## Where it stands\n\n${first}\n\n## Timeline\n\n${links.length === 0 ? "- None" : links.map((link) => `- 2026-12-03 · ${link}`).join("\n")}\n\n## Decisions in force\n\n- None\n\n## Open questions and risks\n\n- None\n\n## People involved\n\n- None\n\n## Gaps\n\n- None\n`;

/** Give the second extract version the full capture time the brain records, so a report's freshness can be judged against it. */
async function captureAt(dir: string, at: string): Promise<void> {
  const file = join(dir, V2);
  await writeFile(file, (await readFile(file, "utf8")).replace(/^captured: .*$/m, `captured: ${at}`));
}

/** A hand-written report, for the cases `report new` never writes. */
async function handReport(dir: string, id: string, frontmatter: string, links = ""): Promise<void> {
  await mkdir(join(dir, "reports"), { recursive: true });
  await writeFile(join(dir, `reports/2026-12-10-${id}.md`), `---\nid: ${id}\ntype: view\ntitle: Hand report ${id}\ncreated: 2026-12-10\nupdated: 2026-12-10\nview_kind: report\nquestion: q\n${frontmatter}\n---\n\n${reportBody(`On track. ${links}`, [])}`);
}

test("a report that links a view resting on an excluded note is withheld, to any depth and through a cycle once; the notes it rests on stay readable (eligibility.md §8 rules 1 and 5)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  await approveNote(dir, note.path);
  assert.equal((await run(dir, ["views", "--project", PROJECT])).code, 0);
  const brief = (await readFile(join(dir, "projects/acme-website/brief.md"), "utf8"));
  assert.ok(brief.includes("Pricing call"), "the Brief links the decision while its evidence is live");
  const briefId = /^id: (vw-[0-9a-z]{8})$/m.exec(brief)![1]!;

  // A report on the Brief, and a second report on the first: two levels above the note.
  const first = await run(dir, ["report", "new"], { title: "Website: where we stand", question: "Where does the website stand?", body: reportBody("See the brief.", ["Brief ([Acme website brief](../projects/acme-website/brief.md))"]) });
  assert.equal(first.code, 0, first.stdout);
  const firstPath = first.json.data.path as string;
  const second = await run(dir, ["report", "new"], { title: "Overview", question: "Overview?", body: reportBody("See the other report.", [`Report ([website](../${firstPath}))`]) });
  assert.equal(second.code, 0, second.stdout);
  for (const id of [briefId, first.json.data.id, second.json.data.id]) assert.equal((await read(dir, id)).status, "ok", `${id} is read while nothing is excluded`);

  await exclude();
  await captureAt(dir, "2026-12-10T08:00:00Z"); // before the reports: only what they rest on can withhold them
  assert.deepEqual(await read(dir, briefId), { id: briefId, status: "withheld", reason: "restricted", cause: "dependency", rebuild: "views" }, "the Brief rests on the decision");
  assert.deepEqual(await read(dir, first.json.data.id), { id: first.json.data.id, status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" }, "a report on the Brief is withheld though it links no restricted note itself");
  assert.deepEqual(await read(dir, second.json.data.id), { id: second.json.data.id, status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" }, "and so is a report on that report");
  const candidates = (await run(dir, ["query", "--candidates", "website overview brief", "--types", "view"])).json.data.candidates.map((candidate: { id: string }) => candidate.id);
  assert.deepEqual(candidates.filter((id: string) => [briefId, first.json.data.id, second.json.data.id].includes(id)), [], "none is a candidate");

  // Canonical material stays: the decision in its awaiting-cleanup form with its live line, and the fixture's live decision whole.
  const decision = await read(dir, note.id);
  assert.equal(decision.status, "ok");
  assert.equal(decision.title, null);
  assert.ok(decision.body.includes("Kept statement.") && !decision.body.includes("95k"));
  const live = await read(dir, LIVE_NOTE);
  assert.equal(live.status, "ok");
  assert.equal(live.title, "Use Supabase for auth");

  // A cycle: a report that links a report that links the first is judged once, and withheld only for what the cycle rests on.
  await handReport(dir, "vw-cyc1a2b3", "generated_from: [vw-cyc4d5e6]\ngenerated_at: 2026-12-10T12:00:00Z", "[other](2026-12-10-vw-cyc4d5e6.md)");
  await handReport(dir, "vw-cyc4d5e6", "generated_from: [vw-cyc1a2b3]\ngenerated_at: 2026-12-10T12:00:00Z", "[other](2026-12-10-vw-cyc1a2b3.md)");
  assert.equal((await read(dir, "vw-cyc1a2b3")).status, "ok", "a cycle of live reports is read");
  await handReport(dir, "vw-cyc4d5e6", `generated_from: [vw-cyc1a2b3, ${note.id}]\ngenerated_at: 2026-12-10T12:00:00Z`, "[other](2026-12-10-vw-cyc1a2b3.md)");
  assert.equal((await read(dir, "vw-cyc1a2b3")).cause, "dependency", "the cycle rests on the restricted decision through its other report");

  // `brain views` writes the decision by type and id, outside generated_from, so the regenerated Brief no longer rests on it.
  assert.equal((await run(dir, ["views", "--project", PROJECT])).code, 0);
  assert.equal((await read(dir, briefId)).status, "ok", "the regenerated Brief is read again");
});

test("a report written before an exclusion stays withheld after the note is cleaned, and is read again after a refresh (eligibility.md §8 rule 2)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  const created = await run(dir, ["report", "new"], { title: "Price: where we stand", question: "Where does the price stand?", body: reportBody("Price is 95k, said on the call.", [`Auth chosen ([Use Supabase for auth](../${LIVE_PATH}))`]) });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.id as string;
  assert.equal((await read(dir, id)).status, "ok");

  await exclude();
  await captureAt(dir, "2026-12-10T10:00:00Z"); // the exclusion came after the report
  assert.deepEqual(await read(dir, id), { id, status: "withheld", reason: "restricted", cause: "stale", rebuild: "refresh" });

  // The cleanup: the restricted line removed, the note resolved for the input, the record reconciled.
  const file = join(dir, note.path);
  const cleaned = (await readFile(file, "utf8")).replace(/^SECRET .*\n/m, "").replace(/^sources:/m, `lineage_cleared: [${INPUT}]\nsources:`);
  await writeFile(file, cleaned);
  const records = join(dir, "_suppressions", `${INPUT}.json`);
  const value = JSON.parse(await readFile(records, "utf8"));
  value.records[0].status = "reconciled";
  value.records[0].reconciled_at = "2026-12-10T10:30:00Z";
  await writeFile(records, JSON.stringify(value));
  const decision = await read(dir, note.id);
  assert.equal(decision.title, "Pricing call", "the cleaned note is whole again, with its title");
  assert.equal(decision.restricted, false);
  assert.deepEqual(await read(dir, id), { id, status: "withheld", reason: "restricted", cause: "stale", rebuild: "refresh" }, "a cleanup doesn't make the older report fresh");

  const refreshed = await run(dir, ["report", "new"], { refresh: id, body: reportBody("No price is recorded.", [`Auth chosen ([Use Supabase for auth](../${LIVE_PATH}))`]) }, "2026-12-10T11:00:00Z");
  assert.equal(refreshed.code, 0, refreshed.stdout);
  const after = await read(dir, id);
  assert.equal(after.status, "ok", "the refresh is read");
  assert.ok(!JSON.stringify(after).includes("95k"));
});

test("a report whose provenance or freshness can't be read is withheld whole, naming only its id, reason, cause and rebuild (eligibility.md §8 rule 3)", async (context) => {
  const dir = await fixtureCopy(context);
  const { exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  await handReport(dir, "vw-unr0a1b2", "generated_from: [dec-7k2m9q4x]\ngenerated_at: 2026-12-10T12:00:00Z");
  assert.equal((await read(dir, "vw-unr0a1b2")).status, "ok", "with no suppression record nothing is withheld");
  await exclude();
  await captureAt(dir, "2026-12-10T08:00:00Z");
  assert.equal((await read(dir, "vw-unr0a1b2")).status, "ok", "readable provenance, written after the exclusion");

  // A proposal is never evidence: a report resting on one, by generated_from or by a link, is withheld (cli §5.13.1, "Views").
  const proposal = /^id: (prp-[0-9a-z]{8})$/m.exec(await readFile(join(dir, "_proposals/2026-12-03-acme-launch-jan-feb.md"), "utf8"))![1]!;
  await handReport(dir, "vw-prp0a1b2", `generated_from: [${proposal}]\ngenerated_at: 2026-12-10T12:00:00Z`);
  assert.deepEqual(await read(dir, "vw-prp0a1b2"), { id: "vw-prp0a1b2", status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" }, "generated_from names a proposal");
  await handReport(dir, "vw-prp0a1b2", "generated_from: []\ngenerated_at: 2026-12-10T12:00:00Z", "[the proposal](../_proposals/2026-12-03-acme-launch-jan-feb.md)");
  assert.deepEqual(await read(dir, "vw-prp0a1b2"), { id: "vw-prp0a1b2", status: "withheld", reason: "restricted", cause: "dependency", rebuild: "refresh" }, "the body links a proposal");

  const withheld = (id: string) => ({ id, status: "withheld", reason: "restricted", cause: "unreadable", rebuild: "refresh" });
  await handReport(dir, "vw-unr0a1b2", "generated_from: dec-7k2m9q4x\ngenerated_at: 2026-12-10T12:00:00Z");
  assert.deepEqual(await read(dir, "vw-unr0a1b2"), withheld("vw-unr0a1b2"), "generated_from that isn't a list");
  await handReport(dir, "vw-unr0a1b2", "generated_at: 2026-12-10T12:00:00Z");
  assert.deepEqual(await read(dir, "vw-unr0a1b2"), withheld("vw-unr0a1b2"), "no generated_from");
  await handReport(dir, "vw-unr0a1b2", "generated_from: [dec-7k2m9q4x]\ngenerated_at: last week");
  assert.deepEqual(await read(dir, "vw-unr0a1b2"), withheld("vw-unr0a1b2"), "a generated_at that is no time");
  await handReport(dir, "vw-unr0a1b2", "generated_from: [dec-7k2m9q4x]");
  assert.deepEqual(await read(dir, "vw-unr0a1b2"), withheld("vw-unr0a1b2"), "no generated_at");
  await handReport(dir, "vw-unr0a1b2", "generated_from: [dec-7k2m9q4x]\ngenerated_at: 2026-12-10T12:00:00Z");
  const file = join(dir, V2);
  await writeFile(file, (await readFile(file, "utf8")).replace(/^captured: .*\n/m, ""));
  assert.deepEqual(await read(dir, "vw-unr0a1b2"), withheld("vw-unr0a1b2"), "the extract version a record names has no captured time");
});

test("index.md, the JSON index and the views keep no title, alias or summary of a restricted note, and show one with a restricted claim by type and id (eligibility.md §6 rule 5)", async (context) => {
  const dir = await fixtureCopy(context);
  // Whole: an unmapped remark in the lineage of the changed input. Part: a live line beside the excluded one.
  const { note: whole, exclude } = await excludableDecision(dir, SYNC, PROJECT, "unmapped");
  const wholeFile = join(dir, whole.path);
  await writeFile(wholeFile, (await readFile(wholeFile, "utf8")).replace(/^title: .*$/m, "title: Budget cut to 40k").replace(/^summary: .*$/m, "summary: Budget cut to 40k for launch").replace(/^sources:/m, "aliases: [budget 40k]\ntags: [budget-40k]\nsources:"));
  const made = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Price set at 95k", frontmatter: { summary: "Price set at 95k.", aliases: ["price 95k"], date: "2026-12-04", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: `Vendor stays Acme. ${ref(1, LIVE)}\n\nThe price is set at 95k. ${ref(2, SECRET)}\n` }] });
  assert.equal(made.code, 0, made.stdout);
  const part = made.json.data.created[0] as { id: string; path: string };
  await approveNote(dir, whole.path);
  await approveNote(dir, part.path);
  assert.equal((await run(dir, ["index"])).code, 0);
  assert.equal((await run(dir, ["views"])).code, 0);
  assert.ok((await readFile(join(dir, "index.md"), "utf8")).includes("Price set at 95k"), "listed with its title while the evidence is live");

  await exclude();
  assert.equal((await run(dir, ["index"])).code, 0);
  assert.equal((await run(dir, ["views"])).code, 0);
  const restricted = ["40k", "95k", "Budget cut", "budget-40k", "Price set", "price 95k"];
  const index = await readFile(join(dir, "index.md"), "utf8");
  for (const text of restricted) assert.ok(!index.includes(text), `index.md holds no "${text}"`);
  assert.ok(index.includes(`- (title withheld: awaiting cleanup) — ${whole.id} · date: 2026-12-03 · assessment: accepted`), "the whole note stays listed, by id");
  assert.ok(index.includes(`- (title withheld: awaiting cleanup) — ${part.id} · date: 2026-12-04 · assessment: accepted`), "and the note with a restricted claim");
  assert.ok(!index.includes(whole.path) && !index.includes(part.path), "with no link: the file name repeats the title");
  assert.ok(index.includes("[Use Supabase for auth]"), "a note with no restricted part keeps its title");

  const json = (await run(dir, ["index", "--check"])).json.data;
  const entries = new Map(json.notes.map((entry: { id: string }) => [entry.id, entry]));
  for (const id of [whole.id, part.id]) {
    const entry = entries.get(id) as Record<string, unknown>;
    assert.equal(entry.title, null);
    assert.equal(entry.summary, null);
    assert.deepEqual(entry.aliases, []);
    assert.deepEqual(entry.tags, []);
  }
  const knowledge = json.notes.filter((entry: { type: string }) => !["source", "memory", "proposal"].includes(entry.type));
  for (const text of restricted) assert.ok(!JSON.stringify(knowledge).includes(text), `the JSON index's knowledge notes and views hold no "${text}"`);

  const views = await Promise.all(["projects/acme-website/brief.md", "projects/acme-website/decision-log.md", "areas/briefs/clients.md"].map((path) => readFile(join(dir, path), "utf8")));
  for (const view of views) for (const text of restricted) assert.ok(!view.includes(text), `a view holds no "${text}"`);
  assert.ok(views[0]!.includes(`- 2026-12-04 — decision ${part.id}, title withheld: awaiting cleanup (accepted)`), "the Brief shows the note with a restricted claim by type and id");
  const log = views[1]!;
  assert.ok(log.includes(`- 2026-12-04 — decision ${part.id}, title withheld: awaiting cleanup — accepted`), "the Decision log shows the note with a restricted claim by type and id");
  assert.ok(!log.includes(whole.id), "and leaves out the note restricted whole");
  assert.ok(!/^generated_from:.*$/m.exec(log)![0].includes(part.id) && !log.includes(`  - ${part.id}`), "the label rests nothing on the note");
});

test("sync render publishes a note with a restricted part in the awaiting-cleanup form, rewrites its published page, and publishes a withheld report as a notice (cli §5.14.4)", async (context) => {
  const dir = await fixtureCopy(context);
  const config = JSON.parse(await readFile(join(dir, "brain.json"), "utf8"));
  config.notion.databases.documents = "a1000000-0000-4000-8000-00000000000d";
  await writeFile(join(dir, "brain.json"), `${JSON.stringify(config, null, 2)}\n`);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  const file = join(dir, note.path);
  await writeFile(file, (await readFile(file, "utf8")).replace(/^title: .*$/m, "title: Price set at 95k"));
  await approveNote(dir, note.path);
  const report = await run(dir, ["report", "new"], { title: "Price: where we stand", question: "Where does the price stand?", body: reportBody("Price is 95k, said on the call.", [`Auth chosen ([Use Supabase for auth](../${LIVE_PATH}))`]) });
  assert.equal(report.code, 0, report.stdout);
  const reportId = report.json.data.id as string;
  const render = async (id: string) => (await run(dir, ["sync", "render", "--ids", id])).json.data.items[0];

  const before = await render(note.id);
  assert.equal(before.properties.Name.value, "Price set at 95k");
  const beforeReport = await render(reportId);
  assert.ok(String(beforeReport.body).includes("95k"));

  await exclude();
  await captureAt(dir, "2026-12-10T10:00:00Z");
  const after = await render(note.id);
  assert.equal(after.action, before.action, "the same page: rewritten in place, never deleted");
  assert.equal(after.properties.Name.value, `decision ${note.id}, title withheld: awaiting cleanup`);
  assert.ok(String(after.body).includes("Kept statement."), "the live line is still published");
  assert.ok(!JSON.stringify(after).includes("95k") && !JSON.stringify(after).includes("Price set"), "no title or excluded line in the payload");
  assert.notEqual(after.published["@content"], before.published["@content"], "the content moves, so a published page is re-rendered");
  assert.notEqual(after.published.Name, before.published.Name, "and so does its Name");

  const withheld = await render(reportId);
  assert.equal(withheld.properties.Name.value, `report ${reportId}, withheld: refresh to rebuild`);
  assert.match(String(withheld.body), /^Withheld: this report rests on content you excluded/);
  assert.ok(!JSON.stringify(withheld).includes("95k"), "the report's prose isn't published");
  assert.equal(withheld.properties["Refresh asked"], undefined, "a notice is no refresh: Refresh asked stays as you ticked it");
  assert.equal(withheld.published["@git_body"], undefined, "and it sets no wording baseline");

  // A Review row about the note names it by the label, never by its title.
  await writeFile(join(dir, "_proposals/2026-12-10-link-the-price.md"), `---\nid: prp-lnk1a2b3\ntype: proposal\ntitle: Link the call\ncreated: 2026-12-10\nupdated: 2026-12-10\nkind: add_link\ntarget: ${note.id}\nfield: related_to\nafter: ${LIVE_NOTE}\nwhy: Both are about the launch\nsource: ${SYNC}\nstatus: pending\n---\n`);
  const row = await render("prp-lnk1a2b3");
  assert.equal(row.properties.About.value, `decision ${note.id}, title withheld: awaiting cleanup (${note.id})`);
  assert.ok(!JSON.stringify(row).includes("Price set"));

  // The Decision log section of the project page: the regenerated view shows the note by type and id.
  assert.equal((await run(dir, ["views", "--project", PROJECT])).code, 0);
  const project = await render(PROJECT);
  assert.ok(!JSON.stringify(project).includes("95k") && !JSON.stringify(project).includes("Price set"));
  assert.ok(String(project.sections["Decision log"]).includes(`decision ${note.id}, title withheld: awaiting cleanup`));
});

test("a Review page names a note with a restricted part by type and id: on create, and on a published page through title_withheld item updates that keep your pending edits (cli §5.14.4, §5.27)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  const file = join(dir, note.path);
  await writeFile(file, (await readFile(file, "utf8")).replace(/^title: .*$/m, "title: Price set at 95k"));
  const created = await run(dir, ["proposal", "new"], { proposals: [
    { kind: "review_notes", source: SYNC, notes: [note.id] },
    { kind: "add_to_note", title: "RLS", target: "con-1s6t8e2b", content: "Carlos will use RLS for the auth migration.", why: "Carlos said so.", source: SYNC },
  ] });
  assert.equal(created.code, 0, created.stdout);
  const id = created.json.data.created[0].id as string;
  const render = async (plan?: string) => (await run(dir, ["sync", "render", "--ids", id, ...(plan === undefined ? [] : ["--plan", plan])])).json.data;
  const before = (await render()).items[0];
  assert.ok(String(before.body).includes("Creates: Price set at 95k"), "while the evidence is live the page names the note");

  await exclude();
  const fresh = (await render()).items[0];
  assert.equal(fresh.action, "create");
  assert.ok(String(fresh.body).includes(`Held: decision ${note.id}, title withheld: awaiting cleanup`), "a page created after the exclusion names it by type and id");
  assert.ok(!JSON.stringify(fresh).includes("Price set") && !JSON.stringify(fresh).includes("95k"));

  // The page was published before the exclusion: record that render, then render again.
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion: "6a7b0000-0000-4000-8000-0000000000aa", synced_at: NOW, published: before.published }] });
  assert.equal(recorded.json.data.records[0].result, "recorded", recorded.stdout);
  const update = (await render()).items[0];
  assert.equal(update.action, "update");
  assert.equal(update.body, null, "the body is never rewritten whole");
  assert.equal(update.item_updates.length, 1, "only the item that names the note is rewritten: the other section and its hash stay");
  assert.equal(update.item_updates[0].reason, "title_withheld");
  assert.ok(update.item_updates[0].section.includes(`decision ${note.id}, title withheld: awaiting cleanup`));
  assert.ok(!JSON.stringify(update).includes("Price set") && !JSON.stringify(update).includes("95k"));
  const kept = before.published["@review"].items;
  const after = update.review_published_after["@review"].items;
  const itemId = update.item_updates[0].item_id as string;
  for (const other of Object.keys(kept).filter((key) => key !== itemId)) assert.deepEqual(after[other], kept[other]);
  assert.equal(after[itemId].held, true);
  assert.equal(after[itemId].base_hash, kept[itemId].base_hash);

  // A page with your pending edits or tokens is not rewritten: the plan marks it and the render holds it back whole.
  const plan = join(dir, "..", "plan.json");
  await writeFile(plan, JSON.stringify({ as_of: NOW, create: [], updates: [], corrections: [], decisions: [], conflicts: [], ignored: [], review_pending: [{ proposal: id, page_id: "6a7b0000-0000-4000-8000-0000000000aa" }] }));
  const held = await render(plan);
  assert.deepEqual(held.items, []);
  assert.deepEqual(held.skipped, [{ id, reason: "REVIEW_PENDING" }]);
});

test("a live line's link to a note in the awaiting-cleanup form, or restricted whole, keeps its text and loses its target on every surface; a link to an eligible note is unchanged (cli §5.13, CC-176's question 4)", async (context) => {
  const dir = await fixtureCopy(context);
  const { note: part, exclude } = await excludableDecision(dir, SYNC, PROJECT, true);
  const made = await run(dir, ["note", "new"], { notes: [{ type: "decision", title: "Budget cut to 40k", frontmatter: { summary: "s", date: "2026-12-03", assessment: "accepted", projects: [PROJECT], sources: [SYNC] }, body: `An unsourced remark.\n\nThe budget is cut. ${ref(2, SECRET)}\n` }] });
  assert.equal(made.code, 0, made.stdout);
  const whole = made.json.data.created[0] as { id: string; path: string };
  const slug = (path: string) => path.split("/").pop()!.replace(/\.md$/, "");
  const name = (path: string) => path.split("/").pop()!;
  // A live meeting line and a live decision line link both, and the fixture's eligible decision.
  const meeting = join(dir, "knowledge/meetings/2026-12-03-acme-sync.md");
  await writeFile(meeting, `${await readFile(meeting, "utf8")}\nSee [the price call](../decisions/${name(part.path)}), [the budget](../decisions/${name(whole.path)}) and [the auth choice](../decisions/2026-12-03-use-supabase-for-auth.md).\n`);
  const decision = join(dir, LIVE_PATH);
  await writeFile(decision, `${await readFile(decision, "utf8")}\nRelated: [the price call](${name(part.path)}) and [Use Firebase for auth](2026-10-01-use-firebase-for-auth.md).\n`);
  const linked = (await read(dir, SYNC)).body as string;
  assert.ok(linked.includes(name(part.path)) && linked.includes(name(whole.path)), "while the evidence is live the links are returned");

  await exclude();
  const read2 = await run(dir, ["query", "--read", `${SYNC},${LIVE_NOTE}`]);
  const [sync, live] = read2.json.data.notes;
  assert.equal(sync.status, "ok");
  assert.ok(sync.body.includes("See the price call, the budget and [the auth choice](../decisions/2026-12-03-use-supabase-for-auth.md)."), "text kept, target dropped; the eligible link unchanged");
  assert.equal(sync.title, "Acme sync", "the linking note is not restricted by it");
  assert.equal(sync.restricted, true);
  assert.ok(live.body.includes("Related: the price call and [Use Firebase for auth](2026-10-01-use-firebase-for-auth.md)."));
  const candidates = await run(dir, ["query", "--candidates", "price call budget auth choice"]);
  for (const out of [read2, candidates]) for (const path of [part.path, whole.path]) {
    assert.ok(!out.stdout.includes(slug(path)), `no slug ${slug(path)} in ${out.json.command}`);
    assert.ok(!out.stdout.includes(path), "and no path");
  }

  // Published: the live decision's Notion body.
  await approveNote(dir, LIVE_PATH);
  const page = (await run(dir, ["sync", "render", "--ids", LIVE_NOTE])).json.data.items[0];
  assert.ok(String(page.body).includes("Related: the price call and Use Firebase for auth."), String(page.body));
  for (const path of [part.path, whole.path]) assert.ok(!JSON.stringify(page).includes(slug(path)));
});
