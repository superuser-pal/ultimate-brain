import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { parseFrontmatter } from "../src/lib/frontmatter.ts";
import { approveNote, brain, fixtureCopy } from "./helpers.ts";

// CC-124, decision 0071: a report is a Documents row with Origin = Report; its Ask rows stay on the Inbox.

const NOW = "2026-12-10T09:00:00Z";
const DOCUMENTS = "d1000000-0000-4000-8000-000000000001";
const INBOX = "c1000000-0000-4000-8000-000000000001";
const ASK = "f1000000-0000-4000-8000-000000000011";
const ASK2 = "f1000000-0000-4000-8000-000000000012";
const BODY = [
  "## Where it stands", "Launch is set for February, per [the auth decision](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md).",
  "## Timeline", "- 2026-12-03: auth chosen.",
  "## Decisions in force", "- [Use Supabase for auth](../knowledge/decisions/2026-12-03-use-supabase-for-auth.md)",
  "## Open questions and risks", "- None",
  "## People involved", "- None",
  "## Gaps", "- Nothing on pricing.",
].join("\n\n");

async function run(dir: string, args: string[], input?: unknown) {
  const extra: string[] = [];
  if (input !== undefined) {
    const file = join(dir, "..", `input-${Math.random().toString(36).slice(2)}.json`);
    await writeFile(file, JSON.stringify(input));
    extra.push("--input", file);
  }
  return brain([...args, ...extra, "--brain", dir, "--now", NOW, "--json"]);
}

let pages = 0;
/** Render one note and record what was sent, as the skill does after writing the page. */
async function renderAndRecord(dir: string, id: string): Promise<Record<string, any> | undefined> {
  const rendered = await run(dir, ["sync", "render", "--ids", id]);
  assert.equal(rendered.code, 0, rendered.stdout);
  const item = rendered.json.data.items.find((candidate: { id: string }) => candidate.id === id);
  if (item === undefined) return undefined;
  pages += 1;
  const notion = item.page_id ?? `b3000000-0000-4000-8000-${String(pages).padStart(12, "0")}`;
  const recorded = await run(dir, ["sync", "record"], { records: [{ id, notion, synced_at: NOW, published: item.published }] });
  assert.equal(recorded.code, 0, recorded.stdout);
  return item;
}

async function reportBrain(context: TestContext, modules?: Record<string, boolean>): Promise<string> {
  const dir = await fixtureCopy(context);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.notion.databases.inbox = INBOX;
  config.notion.databases.documents = DOCUMENTS;
  if (modules !== undefined) config.modules = modules;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

async function newReport(dir: string): Promise<{ id: string; path: string }> {
  const created = await run(dir, ["report", "new"], { title: "Acme launch: where we stand", question: "Everything about the Acme launch", asked_in: ASK, projects: ["prj-9x4t1b7e"], area: "area-2m7c4h8n", body: BODY });
  assert.equal(created.code, 0, created.stdout);
  return created.json.data;
}

test("a new report is published to Documents with Origin Report and Asked in, and nothing Inbox-only (0071)", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  const item = await renderAndRecord(dir, report.id);
  assert.equal(item!.action, "create");
  assert.equal(item!.database, "documents");
  assert.equal(item!.database_id, DOCUMENTS);
  const p = item!.properties;
  assert.deepEqual(Object.keys(p).sort(), ["Area", "Asked in", "Brain ID", "Name", "Origin", "Project"]);
  assert.deepEqual(p.Origin, { type: "select", value: "Report" });
  assert.deepEqual(p["Asked in"], { type: "relation", value: [ASK] });
  assert.deepEqual([p.Name.value, p["Brain ID"].value], ["Acme launch: where we stand", report.id]);
  assert.ok(item!.body.startsWith("## Where it stands\n\nLaunch is set for February"), item!.body);
  assert.equal(await renderAndRecord(dir, report.id), undefined, "a published report is not rendered again");
});

test("a Report row in Documents: Refresh asked and What to fix are read, and a refresh rewrites the same page (0045, 0071)", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  await renderAndRecord(dir, report.id);
  const path = join(dir, report.path);
  const page = parseFrontmatter(await readFile(path, "utf8")).attributes.notion as string;

  // Only the request fields are read: an edited Name on a Report row is not a correction.
  const row = { database: "documents", page_id: page, last_edited: NOW, properties: { "Brain ID": report.id, Name: "Renamed in Notion", "Refresh asked": true, "What to fix": "Pricing is known" } };
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [row] })).json.data;
  assert.deepEqual(plan.refresh_requests, [{ page_id: page, report: report.id }]);
  assert.deepEqual(plan.report_fixes, [{ page_id: page, report: report.id, text: "Pricing is known" }]);
  assert.deepEqual([plan.corrections, plan.conflicts, plan.updates], [[], [], []]);

  const input = join(dir, "..", "refresh.json");
  const later = "2026-12-17T09:00:00Z";
  await writeFile(input, JSON.stringify({ refresh: report.id, asked_in: ASK2, body: BODY.replace("set for February", "set for March") }));
  const refreshed = await brain(["report", "new", "--input", input, "--brain", dir, "--now", later, "--json"]);
  assert.equal(refreshed.code, 0, refreshed.stdout);
  assert.deepEqual([refreshed.json.data.id, refreshed.json.data.path], [report.id, report.path]);

  const sent = await renderAndRecord(dir, report.id);
  assert.deepEqual([sent!.action, sent!.database, sent!.page_id], ["update", "documents", page]);
  assert.ok(sent!.body.startsWith("## Where it stands\n\nLaunch is set for March"), sent!.body);
  assert.deepEqual(sent!.properties["Refresh asked"], { type: "checkbox", value: false });
  assert.deepEqual(sent!.properties["Asked in"], { type: "relation", value: [ASK, ASK2] });
  assert.equal(await renderAndRecord(dir, report.id), undefined, "nothing changed since");
});

test("a report published on the Inbox before 0.9.1 keeps its page: the first render resends every property once, no body (migration 0019)", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  const created = await run(dir, ["sync", "render", "--ids", report.id]);
  const item = created.json.data.items[0];
  // What a 0.9.0 render had published to the Inbox row: Kind, Brain Status and Ask, and no Origin or Asked in.
  const old = { ...item.published, Kind: "Report", "Brain Status": "Done", Ask: [ASK] };
  delete old.Origin; delete old["Asked in"];
  const page = "b1000000-0000-4000-8000-000000000019";
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: report.id, notion: page, synced_at: NOW, published: old }] })).code, 0);

  const changed = await run(dir, ["sync", "render", "--changed"]);
  const moved = changed.json.data.items.find((candidate: { id: string }) => candidate.id === report.id);
  assert.deepEqual([moved.action, moved.database, moved.page_id, moved.body], ["update", "documents", page, null]);
  // A move between databases can drop properties, so all of them go out once (cli §5.14.4).
  assert.deepEqual(Object.keys(moved.properties).sort(), ["Area", "Asked in", "Brain ID", "Last Synced", "Name", "Origin", "Project"]);
  assert.equal((await run(dir, ["sync", "record"], { records: [{ id: report.id, synced_at: NOW, published: moved.published }] })).code, 0);
  const again = await run(dir, ["sync", "render", "--changed"]);
  assert.equal(again.json.data.items.some((candidate: { id: string }) => candidate.id === report.id), false);
});

test("a Report row still on the Inbox (a space before migration 0019) is read the same way", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  await renderAndRecord(dir, report.id);
  const page = parseFrontmatter(await readFile(join(dir, report.path), "utf8")).attributes.notion as string;
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "inbox", page_id: page, last_edited: NOW, properties: { "Brain ID": report.id, "Refresh asked": true } }] })).json.data;
  assert.deepEqual(plan.refresh_requests, [{ page_id: page, report: report.id }]);
});

test("a Report row in Documents follows Reports, not Documents: with Reports off it is MODULE_OFF and nothing is planned", async (context) => {
  const dir = await reportBrain(context, { domains: false, knowledge: true, orgs: true, documents: true, reports: false, tasks: true, planning: true });
  const report = await newReport(dir);
  const page = "b1000000-0000-4000-8000-000000000020";
  const plan = (await run(dir, ["sync", "plan"], { as_of: NOW, rows: [{ database: "documents", page_id: page, last_edited: NOW, properties: { "Brain ID": report.id, "Refresh asked": true } }] })).json.data;
  assert.deepEqual(plan.refresh_requests, []);
  assert.deepEqual(plan.ignored.map((entry: { reason: string }) => entry.reason), ["MODULE_OFF"]);
  assert.deepEqual(plan.conflicts, []);
});

test("Documents · Origin: a whole Document is Kept, a promoted one Promoted (0071)", async (context) => {
  const dir = await reportBrain(context);
  const text = "## Requirements\n\n- Login\n";
  const kept = await run(dir, ["note", "new"], { notes: [{ type: "source", title: "Requirements", file_date: "2026-12-01", frontmatter: { source_key: `file:sha256:${"a".repeat(64)}`, file_name: "requirements.pdf", converter: "markitdown 0.1.8", kind: "document", summary: "The requirements.", digest: "- Login." }, body: text }] });
  assert.equal(kept.code, 0, kept.stdout);
  await approveNote(dir, "knowledge/decisions/2026-12-03-use-supabase-for-auth.md"); // only a reviewed decision is promoted (0071)
  const made = await run(dir, ["note", "new"], { notes: [
    { type: "reference", title: "Requirements (whole)", frontmatter: { summary: "Whole.", origin: "whole", sources: [kept.json.data.created[0].id] }, body: text },
    { type: "reference", title: "Supabase auth (page)", frontmatter: { summary: "A page for the decision.", origin: "promoted", promoted_from: "dec-7k2m9q4x" }, body: "## Why\nBecause.\n" },
  ] });
  assert.equal(made.code, 0, made.stdout);
  const [whole, promoted] = made.json.data.created.map((entry: { id: string }) => entry.id);
  assert.deepEqual((await renderAndRecord(dir, whole))!.properties.Origin, { type: "select", value: "Kept" });
  assert.deepEqual((await renderAndRecord(dir, promoted))!.properties.Origin, { type: "select", value: "Promoted" });
});

test("a report is still never a source and never a proposal target (0057)", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  const proposal = await run(dir, ["proposal", "new"], { proposals: [{ kind: "add_to_note", title: "Add pricing", target: report.id, content: "Pricing is known.", why: "A fix.", source: "mtg-8c4n2p7w" }] });
  assert.notEqual(proposal.code, 0, proposal.stdout);
  const cited = await run(dir, ["note", "new"], { notes: [{ type: "question", title: "What is the price?", frontmatter: { summary: "Open.", kind: "Question", sources: [report.id] }, body: "Open.\n" }] });
  assert.notEqual(cited.code, 0, cited.stdout);
});

test("modules: Reports needs Documents; on reports turns Documents on, off documents turns Reports off (0071)", async (context) => {
  const dir = await reportBrain(context, { domains: false, knowledge: true, orgs: true, documents: false, reports: false, tasks: true, planning: true });
  const list = await run(dir, ["modules"]);
  const reports = list.json.data.modules.find((entry: { name: string }) => entry.name === "reports");
  assert.deepEqual(reports.databases, ["documents"]);

  const on = await run(dir, ["modules", "on", "reports"]);
  assert.equal(on.code, 0, on.stdout);
  assert.deepEqual(on.json.data, { module: "reports", on: true, changed: true, missing: [], also: [{ module: "documents", on: true }] });
  const config = () => readFile(join(dir, "brain.json"), "utf8").then((text) => JSON.parse(text).modules);
  assert.deepEqual([(await config()).reports, (await config()).documents], [true, true]);
  const log = await readFile(join(dir, "log/2026-12.md"), "utf8");
  assert.ok(log.includes('modules - "reports" state=on') && log.includes('modules - "documents" state=on'), log);

  const off = await run(dir, ["modules", "off", "documents"]);
  assert.deepEqual(off.json.data, { module: "documents", on: false, changed: true, missing: [], also: [{ module: "reports", on: false }] });
  assert.deepEqual([(await config()).reports, (await config()).documents], [false, false]);
  // The other two switches touch only their own key.
  const docsOn = await run(dir, ["modules", "on", "documents"]);
  assert.equal(docsOn.json.data.also, undefined);
  assert.equal((await config()).reports, false);
});

test("modules: Reports on with Documents off (a hand-edited brain.json) counts as off; render publishes no report", async (context) => {
  const dir = await reportBrain(context);
  const report = await newReport(dir);
  const configPath = join(dir, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { domains: false, knowledge: true, orgs: true, documents: false, reports: true, tasks: true, planning: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const list = await run(dir, ["modules"]);
  assert.equal(list.json.data.modules.find((entry: { name: string }) => entry.name === "reports").on, false);
  const named = await run(dir, ["sync", "render", "--ids", report.id]);
  assert.deepEqual(named.json.data.errors, [{ id: report.id, reason: "MODULE_OFF" }]);
});

test("upgrade turns Documents on in a brain that has Reports on, and warns DOCUMENTS_TURNED_ON (0071)", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "brain-upgrade-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "brain");
  assert.equal((await brain(["init", target, "--owner", "Test Owner", "--no-git", "--now", NOW, "--json"], root)).code, 0);
  const configPath = join(target, "brain.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.modules = { ...config.modules, documents: false, reports: true };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  const upgraded = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(upgraded.code, 0, upgraded.stdout);
  assert.ok(upgraded.json.warnings.some((warning: { code: string }) => warning.code === "DOCUMENTS_TURNED_ON"), JSON.stringify(upgraded.json.warnings));
  const modules = JSON.parse(await readFile(configPath, "utf8")).modules;
  assert.deepEqual([modules.documents, modules.reports], [true, true]);
  const again = await brain(["upgrade", "--brain", target, "--now", NOW, "--json"], root);
  assert.equal(again.json.warnings.some((warning: { code: string }) => warning.code === "DOCUMENTS_TURNED_ON"), false);
});
